import { EventEmitter } from "events";
import { MultiGroupListener } from "../listener/MultiGroupListener.js";
import { AccountAssigner } from "../listener/AccountAssigner.js";

export class TwitterMonitorSystem extends EventEmitter {
  constructor(accountsConfig, settings) {
    super();
    this.accountsConfig = accountsConfig;
    this.settings = settings;
    this.multiGroupListener = null;
    this.accountAssigner = null;
    this.isRunning = false;
    this.startTime = null;
    this.stats = {
      systemUptime: 0,
      totalTweetsProcessed: 0,
      totalRepliesSent: 0,
      totalErrors: 0,
      multiGroupStats: {},
      assignerStats: {},
    };
  }

  /**
   * 启动监控系统
   */
  async start() {
    if (this.isRunning) {
      console.log("🔄 监控系统已在运行中");
      return;
    }

    try {
      console.log("🚀 启动Twitter监控系统...");
      this.startTime = new Date();
      this.isRunning = true;

      // 1. 初始化账号分配器
      await this.initializeAccountAssigner();

      // 2. 初始化多群组监听器
      await this.initializeMultiGroupListener();

      // 3. 设置事件监听
      this.setupEventListeners();

      console.log("✅ Twitter监控系统启动成功！");
      const multiGroupStatus = this.multiGroupListener ? this.multiGroupListener.getStatus() : null;
      console.log(`📊 多群组监听器: ${multiGroupStatus ? `${multiGroupStatus.summary.activeGroups}/${multiGroupStatus.summary.totalGroups} 个群组活跃` : "未配置"}`);
      console.log(`👥 评论账号: ${this.accountAssigner.activeAccounts.size} 个活跃`);

      this.emit("systemStarted", {
        hasMultiGroupListener: !!this.multiGroupListener,
        groupStats: multiGroupStatus?.summary,
        activeAccounts: this.accountAssigner.activeAccounts.size,
        startTime: this.startTime,
      });
    } catch (error) {
      console.error("❌ 启动监控系统失败:", error.message);
      this.isRunning = false;
      this.emit("systemError", { error: error.message });
      throw error;
    }
  }

  /**
   * 停止监控系统
   */
  async stop() {
    if (!this.isRunning) {
      console.log("⏹️ 监控系统未在运行");
      return;
    }

    try {
      console.log("🛑 停止监控系统...");
      this.isRunning = false;

      // 停止多群组监听器
      if (this.multiGroupListener) {
        await this.multiGroupListener.stop();
        this.multiGroupListener = null;
      }

      // 停止账号分配器
      if (this.accountAssigner) {
        await this.accountAssigner.cleanup();
        this.accountAssigner = null;
      }

      console.log("✅ 监控系统已安全停止");
      this.emit("systemStopped");
    } catch (error) {
      console.error("❌ 停止监控系统时出错:", error.message);
      this.emit("systemError", { error: error.message });
    }
  }

  /**
   * 重启监控系统
   */
  async restart() {
    console.log("🔄 重启监控系统...");
    await this.stop();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await this.start();
  }

  /**
   * 初始化账号分配器
   */
  async initializeAccountAssigner() {
    console.log("👥 初始化账号分配器...");

    const commentAccounts = this.accountsConfig.accounts.filter((account) => account.enabled);

    if (commentAccounts.length === 0) {
      throw new Error("没有可用的评论账号");
    }

    this.accountAssigner = new AccountAssigner(commentAccounts, this.settings);
    await this.accountAssigner.initialize();

    console.log(`✅ 账号分配器初始化完成，活跃账号: ${this.accountAssigner.activeAccounts.size}`);
  }

  /**
   * 初始化多群组监听器
   */
  async initializeMultiGroupListener() {
    console.log("📡 初始化多群组监听器...");

    // 检查新的多群组配置
    const groupConfigs = this.accountsConfig.groupMonitorAccounts || [];

    // 兼容旧的单群组配置
    if (groupConfigs.length === 0 && this.accountsConfig.groupNotificationAccount) {
      console.log("🔄 检测到旧的单群组配置，自动转换为多群组格式");
      groupConfigs.push(this.accountsConfig.groupNotificationAccount);
    }

    if (groupConfigs.length === 0) {
      console.warn("⚠️ 未配置群组监控账号，跳过多群组监听器初始化");
      return;
    }

    const enabledGroups = groupConfigs.filter((config) => config.enabled);
    if (enabledGroups.length === 0) {
      console.warn("⚠️ 所有群组监控账号都已禁用，跳过多群组监听器初始化");
      return;
    }

    console.log(`📊 配置的群组数量: ${groupConfigs.length}, 启用的群组: ${enabledGroups.length}`);

    this.multiGroupListener = new MultiGroupListener(groupConfigs, this.settings);
    await this.multiGroupListener.start();

    const status = this.multiGroupListener.getStatus();
    console.log("✅ 多群组监听器初始化完成");
    console.log(`📊 活跃群组: ${status.summary.activeGroups}/${status.summary.totalGroups}`);

    // 显示群组列表
    const groupsByPriority = this.multiGroupListener.getGroupsByPriority();
    groupsByPriority.forEach((group) => {
      console.log(`   • ${group.name} (${group.id}) - 优先级: ${group.priority}, 状态: ${group.status}`);
    });
  }

  /**
   * 设置事件监听
   */
  setupEventListeners() {
    console.log("🔗 设置事件监听器...");

    // 多群组监听器事件
    if (this.multiGroupListener) {
      this.multiGroupListener.on("newTweetsFound", async (data) => {
        const sourceInfo = data.sourceGroup ? `来自群组 ${data.sourceGroup.name}` : "";
        console.log(`📥 收到新推文: ${data.tweets.length} 个 ${sourceInfo}`);
        this.stats.totalTweetsProcessed += data.tweets.length;

        // 分配给账号处理
        await this.accountAssigner.assignTweets(data.tweets);

        this.emit("tweetsReceived", data);
      });

      this.multiGroupListener.on("groupCheckCompleted", (data) => {
        this.stats.multiGroupStats[data.groupId] = data.stats;
        this.emit("groupUpdate", data);
      });

      this.multiGroupListener.on("groupCheckError", (data) => {
        console.error(`📡 群组 ${data.groupName} 监听器错误: ${data.error}`);
        this.stats.totalErrors++;
        this.emit("groupError", data);
      });

      this.multiGroupListener.on("groupAuthRecovered", (data) => {
        console.log(`✅ 群组 ${data.groupName} 认证已恢复`);
        this.emit("authRecovered", { component: "multiGroupListener", ...data });
      });

      this.multiGroupListener.on("groupAuthFailed", (data) => {
        console.error(`❌ 群组 ${data.groupName} 认证失败:`, data.error);
        this.emit("authFailed", { component: "multiGroupListener", ...data });
      });

      this.multiGroupListener.on("multiGroupStarted", (data) => {
        console.log(`🚀 多群组监听器已启动: ${data.activeGroups}/${data.totalGroups} 个群组活跃`);
        this.emit("multiGroupStarted", data);
      });

      this.multiGroupListener.on("groupAdded", (data) => {
        console.log(`➕ 新增群组监听器: ${data.groupName} (${data.groupId})`);
        this.emit("groupAdded", data);
      });

      this.multiGroupListener.on("groupRemoved", (data) => {
        console.log(`➖ 移除群组监听器: ${data.groupId}`);
        this.emit("groupRemoved", data);
      });
    }

    // 账号分配器事件
    if (this.accountAssigner) {
      this.accountAssigner.on("replySuccess", (data) => {
        console.log(`✅ 回复成功: 账号 ${data.accountId} -> 推文 ${data.tweetId}`);
        this.stats.totalRepliesSent++;
        this.emit("replySuccess", data);
      });

      this.accountAssigner.on("taskFailed", (data) => {
        console.error(`❌ 任务失败: 推文 ${data.task.tweetInfo.id} - ${data.error}`);
        this.stats.totalErrors++;
        this.emit("taskFailed", data);
      });

      this.accountAssigner.on("accountError", (data) => {
        console.warn(`⚠️ 账号错误: ${data.accountId} (错误次数: ${data.errors})`);
        this.emit("accountError", data);
      });

      this.accountAssigner.on("accountsInitialized", (data) => {
        console.log(`👥 账号分配器就绪: ${data.activeCount} 个活跃账号`);
        this.emit("accountsReady", data);
      });
    }

    console.log("✅ 事件监听器设置完成");
  }

  /**
   * 获取系统状态
   */
  getStatus() {
    const now = new Date();
    const uptime = this.startTime ? now - this.startTime : 0;

    const status = {
      isRunning: this.isRunning,
      startTime: this.startTime,
      uptime: uptime,
      uptimeFormatted: this.formatUptime(uptime),

      // 系统统计
      stats: {
        ...this.stats,
        systemUptime: uptime,
      },

      // 组件状态
      components: {
        multiGroupListener: this.multiGroupListener ? this.multiGroupListener.getStatus() : null,
        accountAssigner: this.accountAssigner ? this.accountAssigner.getStatus() : null,
      },

      // 健康状态
      health: this.getHealthStatus(),
    };

    // 更新统计信息
    if (this.accountAssigner) {
      const assignerStats = this.accountAssigner.getStatus();
      this.stats.assignerStats = assignerStats.stats;
    }

    return status;
  }

  /**
   * 获取健康状态
   */
  getHealthStatus() {
    const health = {
      overall: "healthy",
      issues: [],
      score: 100,
    };

    // 检查多群组监听器
    if (this.multiGroupListener) {
      const multiGroupStatus = this.multiGroupListener.getStatus();
      if (!multiGroupStatus.isRunning) {
        health.issues.push("多群组监听器未运行");
        health.score -= 30;
      }

      const activeRatio = multiGroupStatus.summary.activeGroups / multiGroupStatus.summary.totalGroups;
      if (activeRatio < 0.5) {
        health.issues.push("活跃群组数量过少");
        health.score -= 25;
      }

      if (multiGroupStatus.summary.totalErrors > 20) {
        health.issues.push("多群组监听器错误过多");
        health.score -= 20;
      }
    }

    // 检查账号分配器
    if (this.accountAssigner) {
      const assignerStatus = this.accountAssigner.getStatus();
      const activeAccountsRatio = assignerStatus.activeAccounts / this.accountsConfig.accounts.length;

      if (activeAccountsRatio < 0.5) {
        health.issues.push("活跃账号数量过少");
        health.score -= 40;
      }

      if (assignerStatus.stats.totalErrors > 50) {
        health.issues.push("分配器错误过多");
        health.score -= 30;
      }
    }

    // 判断整体健康状态
    if (health.score >= 80) {
      health.overall = "healthy";
    } else if (health.score >= 60) {
      health.overall = "warning";
    } else {
      health.overall = "critical";
    }

    return health;
  }

  /**
   * 格式化运行时间
   */
  formatUptime(uptime) {
    const seconds = Math.floor((uptime / 1000) % 60);
    const minutes = Math.floor((uptime / (1000 * 60)) % 60);
    const hours = Math.floor((uptime / (1000 * 60 * 60)) % 24);
    const days = Math.floor(uptime / (1000 * 60 * 60 * 24));

    if (days > 0) {
      return `${days}天 ${hours}小时 ${minutes}分钟`;
    } else if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    } else {
      return `${minutes}分钟 ${seconds}秒`;
    }
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      systemUptime: 0,
      totalTweetsProcessed: 0,
      totalRepliesSent: 0,
      totalErrors: 0,
      multiGroupStats: {},
      assignerStats: {},
    };

    if (this.multiGroupListener) {
      this.multiGroupListener.resetStats();
    }

    if (this.accountAssigner) {
      this.accountAssigner.resetStats();
    }

    console.log("📊 统计信息已重置");
    this.emit("statsReset");
  }

  /**
   * 手动触发检查
   */
  async triggerCheck(groupId = null) {
    if (!this.isRunning || !this.multiGroupListener) {
      throw new Error("监控系统未运行或多群组监听器不可用");
    }

    if (groupId) {
      console.log(`🔍 手动触发群组 ${groupId} 消息检查...`);
      const groupData = this.multiGroupListener.groupListeners.get(groupId);
      if (!groupData) {
        throw new Error(`群组 ${groupId} 不存在`);
      }
      await groupData.listener.checkGroupMessages();
    } else {
      console.log("🔍 手动触发所有群组消息检查...");
      const checkPromises = Array.from(this.multiGroupListener.groupListeners.values()).map((groupData) => groupData.listener.checkGroupMessages());
      await Promise.all(checkPromises);
    }
  }

  /**
   * 获取详细报告
   */
  getDetailedReport() {
    const status = this.getStatus();

    return {
      timestamp: new Date().toISOString(),
      system: {
        isRunning: status.isRunning,
        uptime: status.uptimeFormatted,
        health: status.health,
      },
      performance: {
        tweetsProcessed: status.stats.totalTweetsProcessed,
        repliesSent: status.stats.totalRepliesSent,
        successRate: status.stats.totalTweetsProcessed > 0 ? ((status.stats.totalRepliesSent / status.stats.totalTweetsProcessed) * 100).toFixed(2) + "%" : "0%",
        errorRate: status.stats.totalTweetsProcessed > 0 ? ((status.stats.totalErrors / status.stats.totalTweetsProcessed) * 100).toFixed(2) + "%" : "0%",
      },
      accounts: status.components.accountAssigner?.accounts || {},
      multiGroupListener: status.components.multiGroupListener || null,
    };
  }
}
