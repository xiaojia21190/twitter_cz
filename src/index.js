#!/usr/bin/env node

import { ConfigLoader } from "./config/ConfigLoader.js";
import { TwitterMonitorSystem } from "./monitor/TwitterMonitorSystem.js";
import fs from "fs-extra";

class TwitterMonitor {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.monitorSystem = null;
    this.isShuttingDown = false;
  }

  /**
   * 启动应用
   */
  async start() {
    try {
      console.log("=== Twitter监控系统启动 ===");
      console.log("版本: 1.0.0");
      console.log("启动时间:", new Date().toISOString());
      console.log("");

      // 创建必要的目录
      await this.createDirectories();

      // 加载配置
      console.log("📋 加载配置...");
      const { accounts, settings } = await this.configLoader.loadAll();

      // 显示配置摘要
      this.displayConfigSummary();

      // 初始化新的监控系统
      console.log("🚀 初始化监控系统...");
      this.monitorSystem = new TwitterMonitorSystem(accounts, settings);

      // 设置事件监听器
      this.setupSystemEventListeners();

      // 设置信号处理器
      this.setupSignalHandlers();

      // 启动监控
      await this.monitorSystem.start();

      console.log("");
      console.log("✅ Twitter监控系统启动成功！");
      console.log("💡 按 Ctrl+C 退出系统");
      console.log("");

      // 定期显示状态
      this.startStatusDisplay();
    } catch (error) {
      console.error("❌ 启动失败:", error.message);
      console.error("详细错误:", error.stack);
      process.exit(1);
    }
  }

  /**
   * 创建必要的目录
   */
  async createDirectories() {
    const directories = ["logs", "data", "config"];

    for (const dir of directories) {
      await fs.ensureDir(dir);
    }
  }

  /**
   * 显示配置摘要
   */
  displayConfigSummary() {
    const summary = this.configLoader.getSummary();

    console.log("📊 配置摘要:");
    console.log(`   - 总账户数: ${summary.total_accounts}`);
    console.log(`   - 启用账户: ${summary.enabled_accounts}`);
    console.log(`   - OpenAI配置: ${summary.openai_configured ? "✅" : "❌"}`);
    console.log(`   - 监控关键词: ${summary.monitoring_keywords} 个`);
    console.log("");
  }

  /**
   * 设置信号处理器
   */
  setupSignalHandlers() {
    // 优雅退出处理
    const gracefulShutdown = async (signal) => {
      if (this.isShuttingDown) {
        console.log("强制退出...");
        process.exit(1);
      }

      this.isShuttingDown = true;
      console.log(`\n收到信号 ${signal}，开始优雅退出...`);

      try {
        if (this.monitorSystem) {
          await this.monitorSystem.stop();
        }
        console.log("系统已安全关闭");
        process.exit(0);
      } catch (error) {
        console.error("关闭系统时出错:", error.message);
        process.exit(1);
      }
    };

    // 注册信号处理器
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

    // 处理未捕获的异常
    process.on("uncaughtException", (error) => {
      console.error("未捕获的异常:", error);
      gracefulShutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("未处理的Promise拒绝:", reason);
      gracefulShutdown("unhandledRejection");
    });
  }

  /**
   * 启动状态显示
   */
  startStatusDisplay() {
    let statusCount = 0;

    const statusInterval = setInterval(() => {
      if (this.isShuttingDown) {
        clearInterval(statusInterval);
        return;
      }

      statusCount++;

      // 每10次（大约10分钟）显示一次详细状态
      if (statusCount % 10 === 0) {
        this.displayDetailedStatus();
      } else {
        this.displaySimpleStatus();
      }
    }, 60000); // 每分钟显示一次
  }

  /**
   * 设置系统事件监听器
   */
  setupSystemEventListeners() {
    if (!this.monitorSystem) return;

    this.monitorSystem.on("systemStarted", (data) => {
      console.log(`🎉 系统启动成功！群组监听器: ${data.hasGroupListener ? "已启动" : "未配置"}, 活跃账号: ${data.activeAccounts}`);
    });

    this.monitorSystem.on("tweetsReceived", (data) => {
      console.log(`📥 收到新推文: ${data.tweets.length} 个，已分配处理`);
    });

    this.monitorSystem.on("replySuccess", (data) => {
      console.log(`✅ 回复成功: @${data.accountId} -> 推文 ${data.tweetId}`);
    });

    this.monitorSystem.on("taskFailed", (data) => {
      console.warn(`❌ 任务失败: 推文 ${data.task.tweetInfo.id} - ${data.error}`);
    });

    this.monitorSystem.on("accountError", (data) => {
      console.warn(`⚠️ 账号 ${data.accountId} 遇到问题 (错误: ${data.errors})`);
    });

    this.monitorSystem.on("systemError", (data) => {
      console.error(`💥 系统错误: ${data.error}`);
    });
  }

  /**
   * 显示简单状态
   */
  displaySimpleStatus() {
    if (!this.monitorSystem) return;

    const status = this.monitorSystem.getStatus();
    const uptime = status.uptimeFormatted;
    const components = status.components;
    const stats = status.stats;

    console.log(`[${new Date().toLocaleTimeString()}] 运行中 | 健康状态: ${status.health.overall} | 活跃账户: ${components.accountAssigner?.activeAccounts || 0} | 运行时间: ${uptime} | 处理推文: ${stats.totalTweetsProcessed} | 回复发送: ${stats.totalRepliesSent}`);
  }

  /**
   * 显示详细状态
   */
  displayDetailedStatus() {
    if (!this.monitorSystem) return;

    const report = this.monitorSystem.getDetailedReport();

    console.log("\n📈 系统详细报告:");
    console.log(`   运行状态: ${report.system.isRunning ? "✅ 运行中" : "❌ 已停止"}`);
    console.log(`   运行时间: ${report.system.uptime}`);
    console.log(`   健康状态: ${this.getHealthIcon(report.system.health.overall)} ${report.system.health.overall}`);

    if (report.system.health.issues.length > 0) {
      console.log(`   健康问题: ${report.system.health.issues.join(", ")}`);
    }

    console.log("\n📊 性能指标:");
    console.log(`   处理推文: ${report.performance.tweetsProcessed} 个`);
    console.log(`   发送回复: ${report.performance.repliesSent} 个`);
    console.log(`   成功率: ${report.performance.successRate}`);
    console.log(`   错误率: ${report.performance.errorRate}`);

    // 显示账户状态
    if (Object.keys(report.accounts).length > 0) {
      console.log("\n👥 账户状态:");
      for (const [accountId, account] of Object.entries(report.accounts)) {
        const statusIcon = account.status === "active" ? "✅" : account.status === "error" ? "❌" : "⚠️";
        console.log(`   ${statusIcon} ${accountId}: 任务${account.tasksAssigned} | 回复${account.repliesSent} | 错误${account.errors} | 负载${account.workload}`);
      }
    }

    // 显示群组监听器状态
    if (report.groupListener) {
      console.log("\n📡 群组监听器:");
      console.log(`   状态: ${report.groupListener.isListening ? "✅ 监听中" : "❌ 未运行"}`);
      console.log(`   检查间隔: ${report.groupListener.pollingInterval}ms`);
      console.log(`   发现推文: ${report.groupListener.stats.tweetsFound} 个`);
      console.log(`   错误次数: ${report.groupListener.stats.errors}`);
    }

    console.log("");
  }

  /**
   * 获取健康状态图标
   */
  getHealthIcon(health) {
    switch (health) {
      case "healthy":
        return "🟢";
      case "warning":
        return "🟡";
      case "critical":
        return "🔴";
      default:
        return "⚪";
    }
  }

  /**
   * 获取系统信息
   */
  getSystemInfo() {
    return {
      node_version: process.version,
      platform: process.platform,
      memory_usage: process.memoryUsage(),
      uptime: process.uptime(),
      pid: process.pid,
    };
  }
}

/**
 * 主函数
 */
async function main() {
  // 检查Node.js版本
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

  if (majorVersion < 18) {
    console.error("❌ 需要 Node.js 18 或更高版本");
    console.error(`当前版本: ${nodeVersion}`);
    process.exit(1);
  }

  // 检查命令行参数
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Twitter监控系统 v1.0.0

用法:
  node src/index.js [选项]

选项:
  --help, -h     显示帮助信息
  --version, -v  显示版本信息
  --test         测试配置
  --status       显示状态

环境变量:
  OPENAI_PROXY_URL      OpenAI代理URL
  OPENAI_API_KEY        OpenAI API密钥
  LOG_LEVEL             日志级别 (debug, info, warn, error)
  DEFAULT_POLLING_INTERVAL  默认轮询间隔（毫秒）

示例:
  node src/index.js
  OPENAI_API_KEY=sk-xxx node src/index.js
`);
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log("Twitter监控系统 v1.0.0");
    process.exit(0);
  }

  if (args.includes("--test")) {
    console.log("🧪 配置测试模式");
    try {
      const monitor = new TwitterMonitor();
      await monitor.configLoader.loadAll();
      console.log("✅ 配置测试通过");
      monitor.displayConfigSummary();
    } catch (error) {
      console.error("❌ 配置测试失败:", error.message);
      process.exit(1);
    }
    process.exit(0);
  }

  // 启动主应用
  const monitor = new TwitterMonitor();
  await monitor.start();
}

// 运行主函数
main().catch((error) => {
  console.error("💥 程序启动失败:", error);
  process.exit(1);
});
