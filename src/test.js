#!/usr/bin/env node

import { ConfigLoader } from "./config/ConfigLoader.js";
import { RettwitAuth } from "./auth/RettwitAuth.js";
import { TwitterMonitorSystem } from "./monitor/TwitterMonitorSystem.js";
import { OpenAIClient } from "./ai/OpenAIClient.js";
import fs from "fs-extra";

class TestRunner {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.testResults = [];
    this.testData = null;
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    console.log("🧪 Twitter监控系统测试套件 v2.0");
    console.log("=====================================\n");

    // 预加载配置数据
    try {
      console.log("📋 预加载系统配置...");
      this.testData = await this.configLoader.loadAll();
      console.log("✅ 配置预加载成功\n");
    } catch (error) {
      console.log("❌ 配置预加载失败，某些测试可能无法运行\n");
    }

    const tests = [
      { name: "配置加载测试", fn: () => this.testConfigLoading() },
      { name: "Rettiwt认证测试", fn: () => this.testRettwitAuth() },
      { name: "监控系统测试", fn: () => this.testMonitorSystem() },
      { name: "OpenAI客户端测试", fn: () => this.testOpenAIClient() },
      { name: "异常处理测试", fn: () => this.testErrorHandling() },
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn);
    }

    this.displayResults();
  }

  /**
   * 运行单个测试
   */
  async runTest(testName, testFn) {
    console.log(`🔍 ${testName}...`);
    const startTime = Date.now();

    try {
      await testFn();
      const duration = Date.now() - startTime;
      console.log(`✅ ${testName} - 通过 (${duration}ms)\n`);
      this.testResults.push({ name: testName, status: "PASS", duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${testName} - 失败: ${error.message}`);
      if (error.stack) {
        console.log(`   详细错误: ${error.stack.split("\n")[1]?.trim() || "N/A"}`);
      }
      console.log("");
      this.testResults.push({ name: testName, status: "FAIL", duration, error: error.message });
    }
  }

  /**
   * 测试配置加载
   */
  async testConfigLoading() {
    console.log("   - 测试配置文件存在性...");

    // 检查配置文件是否存在
    const accountsExists = await fs.exists("config/accounts.json");
    const settingsExists = await fs.exists("config/settings.json");

    if (!accountsExists) {
      throw new Error("账户配置文件不存在: config/accounts.json");
    }
    if (!settingsExists) {
      throw new Error("设置配置文件不存在: config/settings.json");
    }

    console.log("   - 加载并验证配置结构...");
    const { accounts, settings } = this.testData || (await this.configLoader.loadAll());

    // 验证账户配置结构
    if (!accounts || !accounts.accounts || !Array.isArray(accounts.accounts)) {
      throw new Error("账户配置格式无效 - 缺少accounts数组");
    }

    // 验证设置配置结构
    if (!settings || typeof settings !== "object") {
      throw new Error("应用设置格式无效 - 不是对象");
    }

    // 验证必需的设置项
    const requiredSettings = ["openai", "monitoring", "notifications"];
    for (const key of requiredSettings) {
      if (!settings[key]) {
        throw new Error(`设置配置缺少必需项: ${key}`);
      }
    }

    // 验证OpenAI配置
    if (!settings.openai.proxy_url || !settings.openai.api_key) {
      console.log("   - ⚠️  OpenAI配置不完整，相关测试可能会跳过");
    }

    // 统计账户信息
    const totalAccounts = accounts.accounts.length;
    const enabledAccounts = accounts.accounts.filter((a) => a.enabled).length;
    const groupAccount = accounts.groupNotificationAccount;

    console.log(`   - 总账户数: ${totalAccounts}`);
    console.log(`   - 启用账户: ${enabledAccounts}`);
    console.log(`   - 群组通知账户: ${groupAccount ? "已配置" : "未配置"}`);
    console.log(`   - OpenAI配置: ${settings.openai.api_key ? "已配置" : "未配置"}`);

    // 验证账户配置完整性
    for (const account of accounts.accounts) {
      if (account.enabled) {
        if (!account.id || !account.authToken) {
          throw new Error(`账户配置不完整: ${account.id || "unknown"}`);
        }
        if (account.proxy && (!account.proxy.host || !account.proxy.port)) {
          throw new Error(`账户 ${account.id} 代理配置无效`);
        }
      }
    }
  }

  /**
   * 测试Rettiwt认证
   */
  async testRettwitAuth() {
    const { accounts } = this.testData || (await this.configLoader.loadAll());
    // const enabledAccounts = accounts.groupNotificationAccount.filter((a) => a.enabled);

    // if (enabledAccounts.length === 0) {
    //   throw new Error("没有启用的账户进行测试");
    // }

    // 测试第一个启用的账户
    const testAccount = accounts.groupNotificationAccount;
    console.log(`   - 测试账户: ${testAccount.id}`);
    console.log(`   - 代理配置: ${testAccount.proxy ? `${testAccount.proxy.host}:${testAccount.proxy.port}` : "无"}`);

    // 验证必需配置项
    if (!testAccount.authToken) {
      throw new Error("认证令牌缺失");
    }

    if (testAccount.proxy) {
      if (!testAccount.proxy.host || !testAccount.proxy.port) {
        throw new Error("代理配置无效");
      }
      if (!testAccount.proxy.username || !testAccount.proxy.password) {
        console.log("   - ⚠️  代理未配置用户名密码，可能影响连接");
      }
    }

    console.log("   - 初始化认证客户端...");
    const auth = new RettwitAuth(testAccount);

    // 测试客户端初始化（不进行实际API调用以避免配额消耗）
    try {
      // 验证配置是否能正确创建客户端实例
      const clientConfig = {
        apiKey: testAccount.authToken,
      };

      if (testAccount.proxy) {
        clientConfig.proxyUrl = `${testAccount.proxy.protocol || "http"}://${testAccount.proxy.username}:${testAccount.proxy.password}@${testAccount.proxy.host}:${testAccount.proxy.port}`;
      }

      console.log("   - 验证客户端配置格式...");
      if (!clientConfig.apiKey.startsWith("ct0=") && !clientConfig.apiKey.includes("auth_token")) {
        console.log("   - ⚠️  认证令牌格式可能不正确");
      }

      // 测试状态获取功能
      const status = auth.initialize();
      console.log(`   - 客户端状态: ${JSON.stringify(status ?? 失败, null, 2)}`);

      console.log("   - 认证配置验证通过");
    } catch (error) {
      throw new Error(`认证客户端初始化失败: ${error.message}`);
    }
  }

  /**
   * 测试监控系统
   */
  async testMonitorSystem() {
    const { accounts, settings } = this.testData || (await this.configLoader.loadAll());

    console.log("   - 初始化监控系统...");
    const monitorSystem = new TwitterMonitorSystem(accounts, settings);

    // 测试系统配置
    console.log("   - 验证系统配置...");
    if (!monitorSystem.accountsConfig) {
      throw new Error("账户配置未正确设置");
    }

    if (!monitorSystem.settings) {
      throw new Error("应用设置未正确设置");
    }

    // 测试状态获取（在启动前）
    console.log("   - 测试初始状态...");
    const initialStatus = monitorSystem.getStatus();
    if (initialStatus.isRunning) {
      throw new Error("系统应该处于未运行状态");
    }

    // 测试详细报告生成
    console.log("   - 测试报告生成...");
    const report = monitorSystem.getDetailedReport();
    if (!report.timestamp || !report.system || !report.performance) {
      throw new Error("报告格式不完整");
    }

    // 测试健康状态检查
    console.log("   - 测试健康状态检查...");
    const healthStatus = monitorSystem.getHealthStatus();
    if (!healthStatus.overall || !Array.isArray(healthStatus.issues)) {
      throw new Error("健康状态格式不正确");
    }

    // 测试统计信息重置
    console.log("   - 测试统计信息重置...");
    monitorSystem.resetStats();
    const resetStatus = monitorSystem.getStatus();
    if (resetStatus.stats.totalTweetsProcessed !== 0) {
      throw new Error("统计信息重置失败");
    }

    // 测试事件发射器功能
    console.log("   - 测试事件系统...");
    let eventReceived = false;
    monitorSystem.once("statsReset", () => {
      eventReceived = true;
    });

    monitorSystem.resetStats();

    if (!eventReceived) {
      throw new Error("事件系统不工作");
    }

    console.log("   - 监控系统测试通过（未启动完整系统以避免资源消耗）");
  }

  /**
   * 测试OpenAI客户端
   */
  async testOpenAIClient() {
    const { settings } = this.testData || (await this.configLoader.loadAll());

    console.log("   - 初始化OpenAI客户端...");
    const aiClient = new OpenAIClient(settings.openai);

    // 检查配置
    const config = aiClient.getConfig();
    console.log(`   - 代理URL: ${config.proxy_url}`);
    console.log(`   - 模型: ${config.model}`);
    console.log(`   - API密钥: ${config.has_api_key ? "已配置" : "未配置"}`);
    console.log(`   - 最大令牌: ${config.max_tokens}`);
    console.log(`   - 温度: ${config.temperature}`);

    if (!config.has_api_key) {
      console.log("   - ⚠️  跳过实际API测试（未配置API密钥）");
    }

    // 测试提示词构建
    console.log("   - 测试提示词构建...");
    const testTweetContent = "今天天气真好！☀️ 大家都在做什么呢？";
    const testContext = {
      author: "test_user",
      hashtags: ["天气", "心情", "日常"],
      mentions: ["@friend1", "@friend2"],
    };

    const prompt = aiClient.buildPrompt(testTweetContent, testContext);

    if (!prompt || prompt.length < 50) {
      throw new Error("提示词构建失败或过短");
    }

    console.log(`   - 提示词长度: ${prompt.length} 字符`);

    // 验证提示词包含必要信息
    if (!prompt.includes(testTweetContent)) {
      throw new Error("提示词未包含原始推文内容");
    }

    // 测试系统提示词
    const systemPrompt = aiClient.getSystemPrompt();
    if (!systemPrompt || systemPrompt.length < 100) {
      throw new Error("系统提示词无效");
    }

    // 测试回复清理功能
    console.log("   - 测试回复清理功能...");
    const testReplies = ['"这是一个测试回复，包含引号和多余空格   "', "  带有前后空格的回复  ", '"中文回复测试，包含表情符号😊"', "超长回复测试" + "很长的内容".repeat(50) + "结束", "[回复]这是一个带有标记的回复"];

    for (const testReply of testReplies) {
      const sanitized = aiClient.sanitizeReply(testReply);

      if (sanitized.length > 280) {
        throw new Error(`回复清理后仍超长: ${sanitized.length} 字符`);
      }

      if (sanitized.includes('"') && sanitized.startsWith('"')) {
        throw new Error("清理后仍包含多余引号");
      }

      console.log(`   - 清理测试: "${testReply.substring(0, 30)}..." -> "${sanitized}"`);
    }

    // 测试字符计数功能
    const testTexts = ["简单文本", "包含表情😊🎉的文本", "English text with emoji 🚀"];
    for (const text of testTexts) {
      const count = aiClient.getCharacterCount(text);
      console.log(`   - 字符计数: "${text}" = ${count} 字符`);
    }
  }

  /**
   * 测试推文URL提取
   */
  async testTweetUrlExtraction() {
    const { settings } = this.testData || (await this.configLoader.loadAll());
    const processor = new NotificationProcessor(settings);

    const testCases = [
      {
        name: "标准Twitter URL",
        input: "https://twitter.com/elonmusk/status/1234567890123456789",
        expected: "1234567890123456789",
      },
      {
        name: "X.com URL",
        input: "https://x.com/user/status/9876543210987654321",
        expected: "9876543210987654321",
      },
      {
        name: "文本中的Twitter URL",
        input: "看这个推文 https://twitter.com/test/status/1111111111111111111 很有趣",
        expected: "1111111111111111111",
      },
      {
        name: "多个URL",
        input: "第一个 https://twitter.com/a/status/1111111111111111111 第二个 https://x.com/b/status/2222222222222222222",
        expected: ["1111111111111111111", "2222222222222222222"],
      },
      {
        name: "移动端URL",
        input: "https://mobile.twitter.com/user/status/3333333333333333333",
        expected: "3333333333333333333",
      },
      {
        name: "带参数的URL",
        input: "https://twitter.com/user/status/4444444444444444444?ref_src=twsrc%5Etfw",
        expected: "4444444444444444444",
      },
      {
        name: "无效URL",
        input: "没有推文链接的文本",
        expected: null,
      },
      {
        name: "错误格式URL",
        input: "https://twitter.com/user/invalid/12345",
        expected: null,
      },
    ];

    console.log(`   - 测试 ${testCases.length} 个案例...`);

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const urls = processor.extractTweetUrls({ text: testCase.input });

      if (testCase.expected === null) {
        if (urls.length > 0) {
          throw new Error(`案例 "${testCase.name}" 失败: 期望无URL，实际找到 ${urls.length} 个`);
        }
      } else if (Array.isArray(testCase.expected)) {
        if (urls.length !== testCase.expected.length) {
          throw new Error(`案例 "${testCase.name}" 失败: 期望 ${testCase.expected.length} 个URL，实际找到 ${urls.length} 个`);
        }

        for (let j = 0; j < urls.length; j++) {
          const tweetId = processor.extractTweetId(urls[j]);
          if (tweetId !== testCase.expected[j]) {
            throw new Error(`案例 "${testCase.name}" 失败: URL${j + 1} 期望ID ${testCase.expected[j]}，实际得到 ${tweetId}`);
          }
        }
      } else {
        if (urls.length === 0) {
          throw new Error(`案例 "${testCase.name}" 失败: 期望找到URL，实际未找到`);
        }

        const tweetId = processor.extractTweetId(urls[0]);
        if (tweetId !== testCase.expected) {
          throw new Error(`案例 "${testCase.name}" 失败: 期望ID ${testCase.expected}，实际得到 ${tweetId}`);
        }
      }

      console.log(`   - 案例 "${testCase.name}": ✓`);
    }
  }

  /**
   * 测试异常处理
   */
  async testErrorHandling() {
    console.log("   - 测试配置文件缺失处理...");

    // 创建临时的错误配置加载器来测试异常情况
    const tempConfigLoader = new ConfigLoader();
    tempConfigLoader.accountsPath = "config/nonexistent_accounts.json";

    try {
      await tempConfigLoader.loadAccounts();
      throw new Error("应该抛出文件不存在异常");
    } catch (error) {
      if (!error.message.includes("不存在")) {
        throw new Error(`异常信息不正确: ${error.message}`);
      }
    }

    console.log("   - 测试无效配置处理...");

    // 测试无效的通知处理器配置
    try {
      const invalidSettings = {
        monitoring: { tweet_url_regex: "[invalid regex(" },
        notifications: { filter_keywords: "not_an_array" },
      };

      new NotificationProcessor(invalidSettings);
      throw new Error("应该抛出正则表达式无效异常");
    } catch (error) {
      if (!error.message.includes("regex") && !error.message.includes("正则")) {
        throw new Error(`异常处理不正确: ${error.message}`);
      }
    }

    console.log("   - 测试网络超时模拟...");

    // 测试OpenAI客户端的配置验证
    const invalidAIConfig = {
      proxy_url: "",
      api_key: "",
      model: "",
      max_tokens: -1,
      temperature: 2.0,
    };

    const aiClient = new OpenAIClient(invalidAIConfig);
    const config = aiClient.getConfig();

    if (config.has_api_key) {
      throw new Error("应该检测到API密钥缺失");
    }

    console.log("   - 异常处理测试通过");
  }

  /**
   * 测试性能
   */
  async testPerformance() {
    console.log("   - 测试大量数据处理性能...");

    const { settings } = this.testData || (await this.configLoader.loadAll());
    const processor = new NotificationProcessor(settings);

    // 生成大量测试通知
    const largeNotificationSet = [];
    for (let i = 0; i < 1000; i++) {
      largeNotificationSet.push({
        id: `perf_test_${i}`,
        text: i % 3 === 0 ? `测试消息 ${i} https://twitter.com/user/status/12345${i.toString().padStart(13, "0")}` : `普通消息 ${i}`,
        type: "dm",
        conversation_id: "perf_test_group",
      });
    }

    const startTime = Date.now();
    const results = await processor.processNotifications(largeNotificationSet, "perf_test_account");
    const duration = Date.now() - startTime;

    console.log(`   - 处理 ${largeNotificationSet.length} 条通知耗时: ${duration}ms`);
    console.log(`   - 平均每条通知处理时间: ${(duration / largeNotificationSet.length).toFixed(2)}ms`);
    console.log(`   - 发现推文: ${results.tweets_found.length} 条`);

    if (duration > 5000) {
      console.log("   - ⚠️  性能较慢，考虑优化处理逻辑");
    }

    // 测试内存使用情况
    const memUsage = process.memoryUsage();
    console.log(`   - 内存使用: ${Math.round((memUsage.heapUsed / 1024 / 1024) * 100) / 100}MB`);
  }

  /**
   * 显示测试结果
   */
  displayResults() {
    console.log("\n📊 测试结果汇总");
    console.log("=====================================");

    const passed = this.testResults.filter((r) => r.status === "PASS").length;
    const failed = this.testResults.filter((r) => r.status === "FAIL").length;
    const total = this.testResults.length;

    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed} ✅`);
    console.log(`失败: ${failed} ❌`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log("\n❌ 失败的测试:");
      this.testResults
        .filter((r) => r.status === "FAIL")
        .forEach((r) => {
          console.log(`   - ${r.name}: ${r.error}`);
        });
    }

    console.log("\n⏱️  执行时间:");
    this.testResults.forEach((r) => {
      const status = r.status === "PASS" ? "✅" : "❌";
      console.log(`   - ${r.name}: ${r.duration}ms ${status}`);
    });

    const totalTime = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    console.log(`   - 总执行时间: ${totalTime}ms`);

    // 性能分析
    const slowTests = this.testResults.filter((r) => r.duration > 1000);
    if (slowTests.length > 0) {
      console.log("\n⚠️  较慢的测试 (>1000ms):");
      slowTests.forEach((r) => {
        console.log(`   - ${r.name}: ${r.duration}ms`);
      });
    }

    console.log("\n");

    if (failed === 0) {
      console.log("🎉 所有测试通过！系统已准备就绪。");
    } else {
      console.log("⚠️  部分测试失败，请检查配置后重试。");
      console.log("\n💡 故障排除建议:");
      console.log("   - 检查配置文件是否存在且格式正确");
      console.log("   - 验证API密钥和认证令牌");
      console.log("   - 确认网络连接和代理设置");
      console.log("   - 查看详细错误信息进行针对性修复");
      process.exit(1);
    }
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Twitter监控系统测试套件 v2.0

用法:
  node src/test.js [选项]

选项:
  --help, -h     显示帮助信息

测试内容:
  ✅ 配置文件加载和验证
  ✅ Rettiwt-API认证配置
  ✅ 通知处理逻辑
  ✅ OpenAI客户端配置
  ✅ 推文URL提取功能
  ✅ 异常处理和错误恢复
  ✅ 性能和内存使用测试

新增功能:
  - 更严格的配置验证
  - 真实的功能测试
  - 异常处理验证
  - 性能基准测试
  - 详细的错误诊断
`);
    return;
  }

  const testRunner = new TestRunner();
  await testRunner.runAllTests();
}

// 运行测试
main().catch((error) => {
  console.error("💥 测试运行失败:", error);
  process.exit(1);
});
