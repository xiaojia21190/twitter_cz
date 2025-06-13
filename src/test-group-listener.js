#!/usr/bin/env node

import { ConfigLoader } from "./config/ConfigLoader.js";
import { GroupMessageListener } from "./listener/GroupMessageListener.js";
import { MultiGroupListener } from "./listener/MultiGroupListener.js";

class GroupListenerTest {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.testResults = [];
  }

  /**
   * 运行群组监听器测试
   */
  async runTest() {
    console.log("🧪 群组消息监听器测试");
    console.log("========================\n");

    try {
      // 1. 加载配置
      console.log("📋 加载配置...");
      const { accounts, settings } = await this.configLoader.loadAll();
      
      if (!accounts.groupMonitorAccounts || accounts.groupMonitorAccounts.length === 0) {
        throw new Error("没有配置群组监控账号");
      }

      const groupConfigs = accounts.groupMonitorAccounts.filter(config => config.enabled);
      if (groupConfigs.length === 0) {
        throw new Error("没有启用的群组监控账号");
      }

      console.log(`✅ 配置加载成功，找到 ${groupConfigs.length} 个启用的群组配置\n`);

      // 2. 测试单个群组监听器
      await this.testSingleGroupListener(groupConfigs[0], settings);

      // 3. 测试多群组监听器
      await this.testMultiGroupListener(groupConfigs, settings);

      console.log("\n🎉 所有测试完成！");
      this.displayResults();

    } catch (error) {
      console.error("❌ 测试失败:", error.message);
      console.error("详细错误:", error.stack);
      process.exit(1);
    }
  }

  /**
   * 测试单个群组监听器
   */
  async testSingleGroupListener(groupConfig, settings) {
    console.log("🔍 测试单个群组监听器...");
    console.log(`   群组ID: ${groupConfig.id}`);
    console.log(`   群组名称: ${groupConfig.groupName}`);
    console.log(`   群组URL: ${groupConfig.groupMessageUrl}`);
    console.log(`   代理配置: ${groupConfig.proxyUrl || '无'}`);

    const groupListener = new GroupMessageListener(groupConfig, settings);
    let testPassed = false;
    let errorMessage = null;

    // 设置事件监听器
    groupListener.on("listenerStarted", (data) => {
      console.log("   ✅ 群组监听器启动成功");
      testPassed = true;
    });

    groupListener.on("listenerError", (data) => {
      console.log(`   ❌ 群组监听器启动失败: ${data.error}`);
      errorMessage = data.error;
    });

    groupListener.on("messageCheckCompleted", (data) => {
      console.log(`   📊 消息检查完成: 发现 ${data.linksFound} 个链接`);
    });

    groupListener.on("newTweetsFound", (data) => {
      console.log(`   🎯 发现新推文: ${data.tweets.length} 个`);
      data.tweets.forEach(tweet => {
        console.log(`      - ${tweet.id} by @${tweet.username}`);
      });
    });

    groupListener.on("messageCheckError", (data) => {
      console.log(`   ⚠️ 消息检查错误: ${data.error}`);
    });

    try {
      // 启动监听器
      await groupListener.start();
      
      // 等待一段时间让监听器运行
      console.log("   ⏳ 等待监听器运行 10 秒...");
      await new Promise(resolve => setTimeout(resolve, 10000));

      // 手动触发一次检查
      console.log("   🔄 手动触发消息检查...");
      await groupListener.checkGroupMessages();

      // 停止监听器
      await groupListener.stop();
      console.log("   🛑 群组监听器已停止");

      this.testResults.push({
        test: "单个群组监听器",
        status: testPassed ? "通过" : "失败",
        error: errorMessage
      });

    } catch (error) {
      console.log(`   ❌ 测试失败: ${error.message}`);
      this.testResults.push({
        test: "单个群组监听器",
        status: "失败",
        error: error.message
      });
    }

    console.log("");
  }

  /**
   * 测试多群组监听器
   */
  async testMultiGroupListener(groupConfigs, settings) {
    console.log("🔍 测试多群组监听器...");
    console.log(`   配置群组数量: ${groupConfigs.length}`);

    const multiGroupListener = new MultiGroupListener(groupConfigs, settings);
    let testPassed = false;
    let errorMessage = null;

    // 设置事件监听器
    multiGroupListener.on("newTweetsFound", (data) => {
      console.log(`   🎯 群组 ${data.sourceGroup.name} 发现新推文: ${data.tweets.length} 个`);
    });

    multiGroupListener.on("groupCheckCompleted", (data) => {
      console.log(`   📊 群组 ${data.groupName} 检查完成: 发现 ${data.linksFound} 个链接`);
    });

    multiGroupListener.on("groupCheckError", (data) => {
      console.log(`   ⚠️ 群组 ${data.groupName} 检查错误: ${data.error}`);
    });

    try {
      // 启动多群组监听器
      await multiGroupListener.start();
      
      const status = multiGroupListener.getStatus();
      console.log(`   📊 启动状态: ${status.summary.activeGroups}/${status.summary.totalGroups} 个群组活跃`);
      
      if (status.summary.activeGroups > 0) {
        testPassed = true;
        console.log("   ✅ 多群组监听器启动成功");

        // 等待一段时间让监听器运行
        console.log("   ⏳ 等待多群组监听器运行 15 秒...");
        await new Promise(resolve => setTimeout(resolve, 15000));

        // 显示群组状态
        const groupsByPriority = multiGroupListener.getGroupsByPriority();
        console.log("   📋 群组状态:");
        groupsByPriority.forEach(group => {
          console.log(`      • ${group.name} (${group.id}) - 优先级: ${group.priority}, 状态: ${group.status}`);
        });
      } else {
        errorMessage = "没有活跃的群组监听器";
        console.log("   ❌ 没有活跃的群组监听器");
      }

      // 停止多群组监听器
      await multiGroupListener.stop();
      console.log("   🛑 多群组监听器已停止");

      this.testResults.push({
        test: "多群组监听器",
        status: testPassed ? "通过" : "失败",
        error: errorMessage
      });

    } catch (error) {
      console.log(`   ❌ 测试失败: ${error.message}`);
      this.testResults.push({
        test: "多群组监听器",
        status: "失败",
        error: error.message
      });
    }

    console.log("");
  }

  /**
   * 显示测试结果
   */
  displayResults() {
    console.log("📊 测试结果汇总:");
    console.log("================");
    
    let passedCount = 0;
    let failedCount = 0;

    this.testResults.forEach(result => {
      const icon = result.status === "通过" ? "✅" : "❌";
      console.log(`${icon} ${result.test}: ${result.status}`);
      
      if (result.error) {
        console.log(`   错误: ${result.error}`);
      }

      if (result.status === "通过") {
        passedCount++;
      } else {
        failedCount++;
      }
    });

    console.log(`\n总计: ${passedCount} 个通过, ${failedCount} 个失败`);
    
    if (failedCount === 0) {
      console.log("🎉 所有测试都通过了！");
    } else {
      console.log("⚠️ 有测试失败，请检查配置和网络连接");
    }
  }
}

// 运行测试
const tester = new GroupListenerTest();
tester.runTest().catch(error => {
  console.error("💥 测试程序启动失败:", error);
  process.exit(1);
});
