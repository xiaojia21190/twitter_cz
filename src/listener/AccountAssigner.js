import { EventEmitter } from "events";
import { RettwitAuth } from "../auth/RettwitAuth.js";
import { OpenAIClient } from "../ai/OpenAIClient.js";

export class AccountAssigner extends EventEmitter {
  constructor(commentAccounts, settings) {
    super();
    this.commentAccounts = commentAccounts;
    this.settings = settings;
    this.aiClient = new OpenAIClient(settings.openai);
    this.activeAccounts = new Map();
    this.taskQueue = [];
    this.processingQueue = false;
    this.stats = {
      totalAssignments: 0,
      totalRepliesSent: 0,
      totalErrors: 0,
      accountStats: {},
    };
  }

  /**
   * 初始化所有评论账号
   */
  async initialize() {
    console.log(`[AccountAssigner] 初始化 ${this.commentAccounts.length} 个评论账号...`);

    const initPromises = this.commentAccounts.map(async (accountConfig) => {
      try {
        console.log(`[AccountAssigner] 初始化账号: ${accountConfig.id}`);

        const auth = new RettwitAuth(accountConfig, this.settings);
        const success = await auth.initialize();

        if (success) {
          this.activeAccounts.set(accountConfig.id, {
            auth,
            config: accountConfig,
            status: "active",
            lastUsed: null,
            tasksAssigned: 0,
            repliesSent: 0,
            errors: 0,
            workload: 0, // 当前工作负载
          });

          this.stats.accountStats[accountConfig.id] = {
            tasksAssigned: 0,
            repliesSent: 0,
            errors: 0,
            status: "active",
          };

          console.log(`[AccountAssigner] 账号 ${accountConfig.id} 初始化成功`);
        } else {
          console.error(`[AccountAssigner] 账号 ${accountConfig.id} 初始化失败`);
        }
      } catch (error) {
        console.error(`[AccountAssigner] 初始化账号 ${accountConfig.id} 时出错:`, error.message);
      }
    });

    await Promise.all(initPromises);

    console.log(`[AccountAssigner] 账号初始化完成，活跃账号: ${this.activeAccounts.size}`);
    this.emit("accountsInitialized", { activeCount: this.activeAccounts.size });
  }

  /**
   * 分配推文给账号处理
   */
  async assignTweets(tweets) {
    console.log(`[AccountAssigner] 收到 ${tweets.length} 个推文分配任务`);

    for (const tweet of tweets) {
      // 选择最合适的账号
      const selectedAccount = this.selectBestAccount();

      if (selectedAccount) {
        // 创建任务并加入队列
        const task = {
          tweetInfo: tweet,
          accountId: selectedAccount.accountId,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        };

        this.taskQueue.push(task);
        this.stats.totalAssignments++;

        // 更新账号统计
        selectedAccount.account.tasksAssigned++;
        selectedAccount.account.workload++;
        this.stats.accountStats[selectedAccount.accountId].tasksAssigned++;

        console.log(`[AccountAssigner] 推文 ${tweet.id} 分配给账号 ${selectedAccount.accountId}`);
      } else {
        console.warn(`[AccountAssigner] 没有可用账号处理推文 ${tweet.id}`);
      }
    }

    // 启动任务处理
    this.processTaskQueue();
  }

  /**
   * 选择最佳账号（负载均衡策略）
   */
  selectBestAccount() {
    const availableAccounts = Array.from(this.activeAccounts.entries())
      .filter(([id, account]) => account.status === "active")
      .map(([id, account]) => ({ accountId: id, account }));

    if (availableAccounts.length === 0) {
      return null;
    }

    // 策略1: 选择工作负载最少的账号
    availableAccounts.sort((a, b) => {
      // 优先考虑工作负载
      if (a.account.workload !== b.account.workload) {
        return a.account.workload - b.account.workload;
      }

      // 然后考虑上次使用时间（越早越优先）
      const aLastUsed = a.account.lastUsed ? new Date(a.account.lastUsed).getTime() : 0;
      const bLastUsed = b.account.lastUsed ? new Date(b.account.lastUsed).getTime() : 0;
      return aLastUsed - bLastUsed;
    });

    return availableAccounts[0];
  }

  /**
   * 处理任务队列
   */
  async processTaskQueue() {
    if (this.processingQueue || this.taskQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      await this.processTask(task);

      // 添加小延迟避免过快请求
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    this.processingQueue = false;
  }

  /**
   * 处理单个任务
   */
  async processTask(task) {
    const { tweetInfo, accountId } = task;
    const account = this.activeAccounts.get(accountId);

    if (!account || account.status !== "active") {
      console.warn(`[AccountAssigner] 账号 ${accountId} 不可用，跳过任务`);
      return;
    }

    try {
      console.log(`[AccountAssigner] 账号 ${accountId} 开始处理推文 ${tweetInfo.id}`);

      // 获取推文详情
      const tweetDetails = await account.auth.getTweetDetails(tweetInfo.id);

      // 检查是否应该处理这个推文
      if (!this.shouldProcessTweet(tweetInfo, tweetDetails)) {
        console.log(`[AccountAssigner] 跳过推文 ${tweetInfo.id}（不符合处理条件）`);
        this.decreaseWorkload(accountId);
        return;
      }

      // 生成AI回复
      const aiResponse = await this.aiClient.generateReply(tweetDetails.text, {
        author: tweetDetails.author?.username,
        hashtags: tweetDetails.entities?.hashtags?.map((h) => h.text) || [],
        mentions: tweetDetails.entities?.user_mentions?.map((m) => m.username) || [],
      });

      if (aiResponse.success) {
        // 发送回复
        const replyResult = await account.auth.postTweet(aiResponse.reply, tweetInfo.id);

        if (replyResult) {
          this.stats.totalRepliesSent++;
          account.repliesSent++;
          this.stats.accountStats[accountId].repliesSent++;

          console.log(`[AccountAssigner] 账号 ${accountId} 成功回复推文 ${tweetInfo.id}: ${aiResponse.reply}`);

          this.emit("replySuccess", {
            accountId,
            tweetId: tweetInfo.id,
            reply: aiResponse.reply,
            replyId: replyResult.id,
          });
        }
      } else {
        console.error(`[AccountAssigner] 账号 ${accountId} AI回复生成失败:`, aiResponse.error);
        this.handleTaskError(task, aiResponse.error);
      }

      // 更新账号使用时间和减少工作负载
      account.lastUsed = new Date().toISOString();
      this.decreaseWorkload(accountId);
    } catch (error) {
      console.error(`[AccountAssigner] 账号 ${accountId} 处理推文 ${tweetInfo.id} 时出错:`, error.message);
      this.handleTaskError(task, error.message);
    }
  }

  /**
   * 处理任务错误
   */
  async handleTaskError(task, errorMessage) {
    const { accountId, tweetInfo } = task;
    const account = this.activeAccounts.get(accountId);

    if (account) {
      account.errors++;
      this.stats.accountStats[accountId].errors++;
      this.decreaseWorkload(accountId);
    }

    this.stats.totalErrors++;

    // 重试逻辑
    task.retryCount++;
    const maxRetries = this.settings.monitoring?.retry_attempts || 3;

    if (task.retryCount < maxRetries) {
      console.log(`[AccountAssigner] 任务重试 ${task.retryCount}/${maxRetries}: 推文 ${tweetInfo.id}`);

      // 重新分配给其他账号
      const newAccount = this.selectBestAccount();
      if (newAccount && newAccount.accountId !== accountId) {
        task.accountId = newAccount.accountId;
        newAccount.account.workload++;
        this.taskQueue.push(task);
      }
    } else {
      console.error(`[AccountAssigner] 任务最终失败: 推文 ${tweetInfo.id} - ${errorMessage}`);
      this.emit("taskFailed", { task, error: errorMessage });
    }

    // 如果账号错误过多，标记为有问题
    if (account && account.errors >= 5) {
      account.status = "error";
      this.stats.accountStats[accountId].status = "error";
      console.warn(`[AccountAssigner] 账号 ${accountId} 错误过多，标记为有问题状态`);
      this.emit("accountError", { accountId, errors: account.errors });
    }
  }

  /**
   * 减少账号工作负载
   */
  decreaseWorkload(accountId) {
    const account = this.activeAccounts.get(accountId);
    if (account && account.workload > 0) {
      account.workload--;
    }
  }

  /**
   * 检查推文是否应该被处理
   */
  shouldProcessTweet(tweetInfo, tweetDetails) {
    // 忽略自己的推文
    if (this.settings.notifications?.ignore_own_tweets && tweetDetails.author_id === tweetInfo.account_id) {
      return false;
    }

    // 检查推文年龄
    const tweetAge = (Date.now() - new Date(tweetDetails.created_at).getTime()) / 1000;
    const minAge = this.settings.notifications?.min_tweet_age_seconds || 60;

    if (tweetAge < minAge) {
      console.log(`[AccountAssigner] 推文过新，跳过: ${tweetAge}s < ${minAge}s`);
      return false;
    }

    return true;
  }

  /**
   * 获取分配器状态
   */
  getStatus() {
    const accountStatuses = {};
    for (const [accountId, account] of this.activeAccounts) {
      accountStatuses[accountId] = {
        status: account.status,
        lastUsed: account.lastUsed,
        tasksAssigned: account.tasksAssigned,
        repliesSent: account.repliesSent,
        errors: account.errors,
        workload: account.workload,
      };
    }

    return {
      activeAccounts: this.activeAccounts.size,
      queueLength: this.taskQueue.length,
      processingQueue: this.processingQueue,
      accounts: accountStatuses,
      stats: this.stats,
    };
  }

  /**
   * 清理资源
   */
  async cleanup() {
    console.log(`[AccountAssigner] 清理资源...`);

    for (const [accountId, account] of this.activeAccounts) {
      try {
        await account.auth.cleanup();
      } catch (error) {
        console.error(`[AccountAssigner] 清理账号 ${accountId} 时出错:`, error.message);
      }
    }

    this.activeAccounts.clear();
    this.taskQueue = [];
    this.processingQueue = false;

    console.log(`[AccountAssigner] 资源清理完成`);
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalAssignments: 0,
      totalRepliesSent: 0,
      totalErrors: 0,
      accountStats: {},
    };

    for (const [accountId, account] of this.activeAccounts) {
      account.tasksAssigned = 0;
      account.repliesSent = 0;
      account.errors = 0;
      this.stats.accountStats[accountId] = {
        tasksAssigned: 0,
        repliesSent: 0,
        errors: 0,
        status: account.status,
      };
    }
  }
}
