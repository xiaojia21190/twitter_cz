#!/usr/bin/env node

import { AccountManager } from "../config/AccountManager.js";
import { ProxyFormatter } from "../utils/ProxyFormatter.js";

/**
 * 代理配置管理工具
 */
class ProxyManagerCLI {
  constructor() {
    this.accountManager = new AccountManager();
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
Twitter监控系统 - 代理配置管理工具

用法:
  node src/cli/proxy-manager.js <命令> [选项]

命令:
  list                    列出所有账号的代理配置
  set-all <proxyUrl>      为所有账号设置相同代理
  set-account <id> <url>  为指定评论账号设置代理
  set-group <id> <url>    为指定群组账号设置代理
  test <proxyUrl>         测试代理连接
  clear <id>              清除指定账号的代理配置
  clear-all               清除所有账号的代理配置
  convert <proxy>         转换代理格式
  examples                显示支持的代理格式示例

示例:
  # 列出所有代理配置
  node src/cli/proxy-manager.js list

  # 为所有账号设置代理（标准格式）
  node src/cli/proxy-manager.js set-all "http://127.0.0.1:7890"

  # 为所有账号设置代理（IP:端口:用户名:密码格式）
  node src/cli/proxy-manager.js set-all "142.173.139.108:15308:E3oeIbOnIC:qIEmVMinlF"

  # 为特定评论账号设置代理
  node src/cli/proxy-manager.js set-account account_1 "192.168.1.100:8080:user:pass"

  # 为特定群组账号设置代理
  node src/cli/proxy-manager.js set-group group_monitor_1 "http://proxy.example.com:8080"

  # 测试代理连接
  node src/cli/proxy-manager.js test "142.173.139.108:15308:E3oeIbOnIC:qIEmVMinlF"

  # 转换代理格式
  node src/cli/proxy-manager.js convert "142.173.139.108:15308:E3oeIbOnIC:qIEmVMinlF"

  # 查看支持的格式示例
  node src/cli/proxy-manager.js examples
`);
  }

  /**
   * 列出所有代理配置
   */
  async listProxyConfig() {
    try {
      const accounts = await this.accountManager.listAccounts();

      console.log("\n=== 代理配置列表 ===");

      // 群组监控账号代理配置
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        console.log("\n📡 群组监控账号:");
        accounts.groupAccounts.forEach((group, index) => {
          console.log(`${index + 1}. ${group.id} (${group.groupName || "Unknown"})`);
          console.log(`   代理: ${group.proxyUrl ? ProxyFormatter.formatForDisplay(group.proxyUrl) : "❌ 未设置"}`);
          console.log(`   状态: ${group.enabled ? "✅ 启用" : "❌ 禁用"}`);
          console.log("");
        });
      }

      // 评论账号代理配置
      if (accounts.commentAccounts && accounts.commentAccounts.length > 0) {
        console.log("💬 评论账号:");
        accounts.commentAccounts.forEach((account, index) => {
          console.log(`${index + 1}. ${account.id}`);
          console.log(`   代理: ${account.proxyUrl ? ProxyFormatter.formatForDisplay(account.proxyUrl) : "❌ 未设置"}`);
          console.log(`   状态: ${account.enabled ? "✅ 启用" : "❌ 禁用"}`);
          console.log("");
        });
      }

      // 统计信息
      const totalAccounts = (accounts.groupAccounts?.length || 0) + (accounts.commentAccounts?.length || 0);
      const accountsWithProxy = [...(accounts.groupAccounts || []), ...(accounts.commentAccounts || [])].filter((acc) => acc.proxyUrl).length;

      console.log("📊 代理配置统计:");
      console.log(`   总账号数: ${totalAccounts}`);
      console.log(`   已配置代理: ${accountsWithProxy}`);
      console.log(`   未配置代理: ${totalAccounts - accountsWithProxy}`);

      if (accountsWithProxy < totalAccounts) {
        console.log("\n💡 建议为所有账号配置代理以提高稳定性");
      }
    } catch (error) {
      console.error("❌ 列出代理配置失败:", error.message);
    }
  }

  /**
   * 为所有账号设置相同代理
   */
  async setAllProxy(proxyUrl) {
    try {
      if (!ProxyFormatter.isValidProxy(proxyUrl)) {
        console.error("❌ 代理格式不正确");
        console.log("支持的格式:");
        const examples = ProxyFormatter.getExamples();
        Object.entries(examples).forEach(([name, example]) => {
          console.log(`   ${name}: ${example}`);
        });
        return;
      }

      console.log(`🔧 为所有账号设置代理: ${proxyUrl}`);

      const accounts = await this.accountManager.listAccounts();
      let successCount = 0;
      let errorCount = 0;

      // 更新群组监控账号
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        console.log("\n📡 更新群组监控账号代理...");
        for (const group of accounts.groupAccounts) {
          try {
            await this.accountManager.updateGroupMonitorAccount(group.id, { proxyUrl });
            console.log(`✅ ${group.id}: 代理已更新`);
            successCount++;
          } catch (error) {
            console.error(`❌ ${group.id}: ${error.message}`);
            errorCount++;
          }
        }
      }

      // 更新评论账号
      if (accounts.commentAccounts && accounts.commentAccounts.length > 0) {
        console.log("\n💬 更新评论账号代理...");
        for (const account of accounts.commentAccounts) {
          try {
            await this.accountManager.updateAccount(account.id, { proxyUrl });
            console.log(`✅ ${account.id}: 代理已更新`);
            successCount++;
          } catch (error) {
            console.error(`❌ ${account.id}: ${error.message}`);
            errorCount++;
          }
        }
      }

      console.log(`\n📊 更新结果: 成功 ${successCount} 个, 失败 ${errorCount} 个`);
    } catch (error) {
      console.error("❌ 批量设置代理失败:", error.message);
    }
  }

  /**
   * 为指定评论账号设置代理
   */
  async setAccountProxy(accountId, proxyUrl) {
    try {
      if (!ProxyFormatter.isValidProxy(proxyUrl)) {
        console.error("❌ 代理格式不正确");
        return;
      }

      await this.accountManager.updateAccount(accountId, { proxyUrl });
      console.log(`✅ 评论账号 ${accountId} 的代理已更新: ${proxyUrl}`);
    } catch (error) {
      console.error("❌ 设置评论账号代理失败:", error.message);
    }
  }

  /**
   * 为指定群组账号设置代理
   */
  async setGroupProxy(groupId, proxyUrl) {
    try {
      if (!ProxyFormatter.isValidProxy(proxyUrl)) {
        console.error("❌ 代理格式不正确");
        return;
      }

      await this.accountManager.updateGroupMonitorAccount(groupId, { proxyUrl });
      console.log(`✅ 群组账号 ${groupId} 的代理已更新: ${proxyUrl}`);
    } catch (error) {
      console.error("❌ 设置群组账号代理失败:", error.message);
    }
  }

  /**
   * 测试代理连接
   */
  async testProxy(proxyUrl) {
    try {
      console.log(`🔍 测试代理连接: ${ProxyFormatter.formatForDisplay(proxyUrl)}`);

      const result = await ProxyFormatter.testProxyConnection(proxyUrl);

      if (result.success) {
        console.log("✅ 代理连接测试成功!");
        console.log(`   响应时间: ${result.responseTime}ms`);
        console.log(`   状态码: ${result.statusCode}`);
        if (result.data && result.data.origin) {
          console.log(`   出口IP: ${result.data.origin}`);
        }
      } else {
        console.error("❌ 代理连接测试失败:", result.error);

        if (result.code === "ECONNREFUSED") {
          console.log("💡 建议检查:");
          console.log("   • 代理服务是否正在运行");
          console.log("   • 代理地址和端口是否正确");
        } else if (result.code === "ETIMEDOUT") {
          console.log("💡 建议检查:");
          console.log("   • 网络连接是否正常");
          console.log("   • 代理服务器是否响应");
        }
      }
    } catch (error) {
      console.error("❌ 测试过程出错:", error.message);
    }
  }

  /**
   * 清除指定账号的代理配置
   */
  async clearProxy(accountId) {
    try {
      const accounts = await this.accountManager.listAccounts();

      // 检查是否为群组账号
      const isGroupAccount = accounts.groupAccounts?.some((group) => group.id === accountId);

      if (isGroupAccount) {
        await this.accountManager.updateGroupMonitorAccount(accountId, { proxyUrl: null });
        console.log(`✅ 群组账号 ${accountId} 的代理配置已清除`);
      } else {
        await this.accountManager.updateAccount(accountId, { proxyUrl: null });
        console.log(`✅ 评论账号 ${accountId} 的代理配置已清除`);
      }
    } catch (error) {
      console.error("❌ 清除代理配置失败:", error.message);
    }
  }

  /**
   * 清除所有账号的代理配置
   */
  async clearAllProxy() {
    try {
      console.log("🧹 清除所有账号的代理配置...");

      const accounts = await this.accountManager.listAccounts();
      let successCount = 0;
      let errorCount = 0;

      // 清除群组监控账号代理
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        for (const group of accounts.groupAccounts) {
          try {
            await this.accountManager.updateGroupMonitorAccount(group.id, { proxyUrl: null });
            console.log(`✅ ${group.id}: 代理配置已清除`);
            successCount++;
          } catch (error) {
            console.error(`❌ ${group.id}: ${error.message}`);
            errorCount++;
          }
        }
      }

      // 清除评论账号代理
      if (accounts.commentAccounts && accounts.commentAccounts.length > 0) {
        for (const account of accounts.commentAccounts) {
          try {
            await this.accountManager.updateAccount(account.id, { proxyUrl: null });
            console.log(`✅ ${account.id}: 代理配置已清除`);
            successCount++;
          } catch (error) {
            console.error(`❌ ${account.id}: ${error.message}`);
            errorCount++;
          }
        }
      }

      console.log(`\n📊 清除结果: 成功 ${successCount} 个, 失败 ${errorCount} 个`);
    } catch (error) {
      console.error("❌ 批量清除代理失败:", error.message);
    }
  }

  /**
   * 转换代理格式
   */
  async convertProxy(proxyString) {
    try {
      const standardUrl = ProxyFormatter.toStandardUrl(proxyString);
      const parsed = ProxyFormatter.parseProxy(proxyString);

      console.log("🔄 代理格式转换结果:");
      console.log(`   原始格式: ${proxyString}`);
      console.log(`   标准格式: ${standardUrl}`);
      console.log(`   解析信息:`);
      console.log(`     协议: ${parsed.protocol}`);
      console.log(`     主机: ${parsed.host}`);
      console.log(`     端口: ${parsed.port}`);
      console.log(`     用户名: ${parsed.username || "无"}`);
      console.log(`     密码: ${parsed.password ? "***" : "无"}`);
    } catch (error) {
      console.error("❌ 代理格式转换失败:", error.message);
    }
  }

  /**
   * 显示代理格式示例
   */
  async showExamples() {
    console.log("📋 支持的代理格式示例:");
    console.log("");

    const examples = ProxyFormatter.getExamples();
    Object.entries(examples).forEach(([name, example]) => {
      console.log(`${name}:`);
      console.log(`   ${example}`);
      console.log("");
    });

    console.log("💡 说明:");
    console.log("   • 所有格式都会自动转换为标准URL格式");
    console.log("   • IP:端口:用户名:密码 格式会自动添加 http:// 前缀");
    console.log("   • 用户名和密码会自动进行URL编码");
  }

  /**
   * 运行CLI
   */
  async run() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "help" || args[0] === "--help" || args[0] === "-h") {
      this.showHelp();
      return;
    }

    const command = args[0];

    try {
      switch (command) {
        case "list":
          await this.listProxyConfig();
          break;

        case "set-all":
          if (args.length < 2) {
            console.error("❌ 用法: set-all <proxyUrl>");
            return;
          }
          await this.setAllProxy(args[1]);
          break;

        case "set-account":
          if (args.length < 3) {
            console.error("❌ 用法: set-account <accountId> <proxyUrl>");
            return;
          }
          await this.setAccountProxy(args[1], args[2]);
          break;

        case "set-group":
          if (args.length < 3) {
            console.error("❌ 用法: set-group <groupId> <proxyUrl>");
            return;
          }
          await this.setGroupProxy(args[1], args[2]);
          break;

        case "test":
          if (args.length < 2) {
            console.error("❌ 用法: test <proxyUrl>");
            return;
          }
          await this.testProxy(args[1]);
          break;

        case "clear":
          if (args.length < 2) {
            console.error("❌ 用法: clear <accountId>");
            return;
          }
          await this.clearProxy(args[1]);
          break;

        case "clear-all":
          await this.clearAllProxy();
          break;

        case "convert":
          if (args.length < 2) {
            console.error("❌ 用法: convert <proxyString>");
            return;
          }
          await this.convertProxy(args[1]);
          break;

        case "examples":
          await this.showExamples();
          break;

        default:
          console.error(`❌ 未知命令: ${command}`);
          this.showHelp();
      }
    } catch (error) {
      console.error("❌ 执行命令时出错:", error.message);
      process.exit(1);
    }
  }
}

// 运行CLI
const cli = new ProxyManagerCLI();
cli.run().catch((error) => {
  console.error("❌ CLI运行失败:", error.message);
  process.exit(1);
});
