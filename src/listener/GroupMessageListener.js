import { EventEmitter } from "events";
import { RettwitAuth } from "../auth/RettwitAuth.js";
import fs from "fs-extra";
import path from "path";

export class GroupMessageListener extends EventEmitter {
  constructor(groupConfig, settings) {
    super();
    this.groupConfig = groupConfig;
    this.settings = settings;
    this.auth = null;
    this.isListening = false;
    this.listenerInterval = null;
    this.pollingInterval = groupConfig.polling_interval || 60000; // 默认60秒
    this.processedTweets = new Set();
    this.processedTweetsFile = path.join(process.cwd(), this.settings.monitoring?.processed_tweets_file || "data/processed_tweets.json");
    this.stats = {
      totalMessages: 0,
      tweetsFound: 0,
      lastCheck: null,
      errors: 0,
    };
  }

  /**
   * 启动监听器
   */
  async start() {
    if (this.isListening) {
      console.log(`[GroupListener] 监听器已在运行中`);
      return;
    }

    try {
      console.log(`[GroupListener] 启动群组消息监听器...`);

      // 加载已处理的推文记录
      await this.loadProcessedTweets();

      // 初始化认证
      this.auth = new RettwitAuth(this.groupConfig, this.settings);
      const success = await this.auth.initialize();

      if (!success) {
        throw new Error("群组账号认证失败");
      }

      this.isListening = true;

      // 立即执行一次检查
      await this.checkGroupMessages();

      // 启动定时检查
      this.listenerInterval = setInterval(async () => {
        await this.checkGroupMessages();
      }, this.pollingInterval);

      console.log(`[GroupListener] 群组监听器启动成功，检查间隔: ${this.pollingInterval}ms`);
      this.emit("listenerStarted", { config: this.groupConfig });
    } catch (error) {
      console.error(`[GroupListener] 启动失败:`, error.message);
      this.isListening = false;
      this.emit("listenerError", { error: error.message });
      throw error;
    }
  }

  /**
   * 停止监听器
   */
  async stop() {
    if (!this.isListening) {
      console.log(`[GroupListener] 监听器未在运行`);
      return;
    }

    try {
      console.log(`[GroupListener] 停止群组消息监听器...`);

      this.isListening = false;

      // 清除定时器
      if (this.listenerInterval) {
        clearInterval(this.listenerInterval);
        this.listenerInterval = null;
      }

      // 保存最终的已处理推文记录
      await this.saveProcessedTweets();

      // 清理认证资源
      if (this.auth) {
        await this.auth.cleanup();
        this.auth = null;
      }

      console.log(`[GroupListener] 群组监听器已停止`);
      this.emit("listenerStopped");
    } catch (error) {
      console.error(`[GroupListener] 停止监听器时出错:`, error.message);
      this.emit("listenerError", { error: error.message });
    }
  }

  /**
   * 检查群组消息
   */
  async checkGroupMessages() {
    if (!this.isListening || !this.auth) {
      return;
    }

    try {
      console.log(`[GroupListener] 检查群组消息...`);
      this.stats.lastCheck = new Date().toISOString();

      // 获取群组通知
      const groupNotifications = await this.auth.getGroupNotifications(50, null, {
        useCache: false,
      });

      this.stats.totalMessages++;

      // 处理获取到的推文链接
      if (groupNotifications.tweetLinks && groupNotifications.tweetLinks.length > 0) {
        await this.processTweetLinks(groupNotifications.tweetLinks);
      }

      // 发出检查完成事件
      this.emit("messageCheckCompleted", {
        timestamp: this.stats.lastCheck,
        linksFound: groupNotifications.tweetLinks?.length || 0,
        stats: this.getStats(),
      });
    } catch (error) {
      console.error(`[GroupListener] 检查群组消息失败:`, error.message);
      this.stats.errors++;
      this.emit("messageCheckError", { error: error.message });

      // 如果是认证错误，尝试重新连接
      if (error.message.includes("认证") || error.message.includes("401")) {
        await this.handleAuthError();
      }
    }
  }

  /**
   * 加载已处理的推文记录
   */
  async loadProcessedTweets() {
    try {
      if (await fs.pathExists(this.processedTweetsFile)) {
        const data = await fs.readJson(this.processedTweetsFile);
        if (data.processed_tweets && Array.isArray(data.processed_tweets)) {
          // 加载到内存Set中，限制数量避免内存过大
          const maxLoad = this.settings.monitoring?.max_processed_tweets_cache || 10000;
          const recentTweets = data.processed_tweets.slice(-maxLoad);
          this.processedTweets = new Set(recentTweets);
          console.log(`[GroupListener] 已加载 ${this.processedTweets.size} 个已处理推文记录`);
        }
      } else {
        console.log(`[GroupListener] 已处理推文文件不存在，将创建新文件`);
        await this.saveProcessedTweets();
      }
    } catch (error) {
      console.error(`[GroupListener] 加载已处理推文记录失败:`, error.message);
      this.processedTweets = new Set(); // 使用空Set继续运行
    }
  }

  /**
   * 保存已处理的推文记录到文件
   */
  async saveProcessedTweets() {
    try {
      const data = {
        processed_tweets: Array.from(this.processedTweets),
        last_updated: new Date().toISOString(),
        count: this.processedTweets.size,
      };

      // 确保目录存在
      await fs.ensureDir(path.dirname(this.processedTweetsFile));
      await fs.writeJson(this.processedTweetsFile, data, { spaces: 2 });

      console.log(`[GroupListener] 已保存 ${this.processedTweets.size} 个已处理推文记录`);
    } catch (error) {
      console.error(`[GroupListener] 保存已处理推文记录失败:`, error.message);
    }
  }

  /**
   * 处理推文链接
   */
  async processTweetLinks(tweetLinks) {
    const newTweets = [];
    let hasNewTweets = false;

    for (const link of tweetLinks) {
      const tweetId = link.statusId;

      // 检查是否已处理过
      if (!this.processedTweets.has(tweetId)) {
        this.processedTweets.add(tweetId);
        hasNewTweets = true;

        const tweetInfo = {
          id: tweetId,
          url: link.fullUrl,
          username: link.username,
          tweetPath: link.tweetPath,
          discoveredAt: new Date().toISOString(),
          source: "group_message",
        };

        newTweets.push(tweetInfo);
        this.stats.tweetsFound++;

        console.log(`[GroupListener] 发现新推文: ${tweetId} by @${link.username}`);
      }
    }

    // 如果有新推文，保存到文件并发出事件
    if (newTweets.length > 0) {
      console.log(`[GroupListener] 发现 ${newTweets.length} 个新推文，发出分配事件`);

      // 异步保存到文件，不阻塞主流程
      this.saveProcessedTweets().catch((error) => {
        console.error(`[GroupListener] 异步保存推文记录失败:`, error.message);
      });

      this.emit("newTweetsFound", { tweets: newTweets });
    }

    // 清理过期的已处理推文记录（保留最近1000个）
    if (this.processedTweets.size > 1000) {
      const tweetsArray = Array.from(this.processedTweets);
      this.processedTweets = new Set(tweetsArray.slice(-800));

      // 如果清理了内存，也更新文件
      if (hasNewTweets) {
        this.saveProcessedTweets().catch((error) => {
          console.error(`[GroupListener] 清理后保存推文记录失败:`, error.message);
        });
      }
    }
  }

  /**
   * 处理认证错误
   */
  async handleAuthError() {
    console.log(`[GroupListener] 检测到认证错误，尝试重新连接...`);

    try {
      if (this.auth) {
        const success = await this.auth.reconnect();
        if (success) {
          console.log(`[GroupListener] 重新连接成功`);
          this.emit("authRecovered");
        } else {
          console.error(`[GroupListener] 重新连接失败`);
          this.emit("authFailed");
        }
      }
    } catch (error) {
      console.error(`[GroupListener] 重新连接时出错:`, error.message);
      this.emit("authFailed", { error: error.message });
    }
  }

  /**
   * 获取监听器状态
   */
  getStatus() {
    return {
      isListening: this.isListening,
      groupAccountId: this.groupConfig.id,
      pollingInterval: this.pollingInterval,
      authStatus: this.auth ? this.auth.getStatus() : null,
      stats: this.getStats(),
    };
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      processedTweetsCount: this.processedTweets.size,
      uptime: this.stats.lastCheck ? Date.now() - new Date(this.stats.lastCheck).getTime() : 0,
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalMessages: 0,
      tweetsFound: 0,
      lastCheck: null,
      errors: 0,
    };
  }
}
