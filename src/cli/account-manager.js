#!/usr/bin/env node

import { AccountManager } from "../config/AccountManager.js";

/**
 * 命令行账号管理工具
 */
class AccountManagerCLI {
  constructor() {
    this.accountManager = new AccountManager();
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
Twitter监控系统 - 账号管理工具

用法:
  node src/cli/account-manager.js <命令> [选项]

命令:
  list                    列出所有账号
  add <id> <token>        添加评论账号
  update <id> <字段=值>   更新账号配置
  remove <id>             删除评论账号
  enable <id>             启用账号
  disable <id>            禁用账号

  群组管理:
  group-add <id> <token> <url> <name>  添加群组监控账号
  group-update <id> <字段=值>          更新群组监控账号
  group-remove <id>                    删除群组监控账号
  group-url <id> <url>                 更新群组链接
  group-list                           列出所有群组

  其他:
  backup                  备份配置文件
  export                  导出配置（隐藏敏感信息）
  import <file>           从文件导入账号

示例:
  # 列出所有账号
  node src/cli/account-manager.js list

  # 添加新的评论账号
  node src/cli/account-manager.js add account_6 "auth_token=your_token_here"

  # 更新账号轮询间隔
  node src/cli/account-manager.js update account_1 polling_interval=45000

  # 更新账号代理
  node src/cli/account-manager.js update account_1 proxyUrl="http://127.0.0.1:7890"

  # 禁用账号
  node src/cli/account-manager.js disable account_2

  # 更新群组链接
  node src/cli/account-manager.js group-url "https://x.com/messages/1234567890"

  # 更新群组代理
  node src/cli/account-manager.js group-update group_1 proxyUrl="http://127.0.0.1:7890"

  # 备份配置
  node src/cli/account-manager.js backup
`);
  }

  /**
   * 列出所有账号
   */
  async listAccounts() {
    try {
      const accounts = await this.accountManager.listAccounts();

      console.log("\n=== 群组监控账号 ===");
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        accounts.groupAccounts.forEach((group, index) => {
          console.log(`${index + 1}. ${group.id} (${group.groupName || "Unknown"})`);
          console.log(`   状态: ${group.enabled ? "✅ 启用" : "❌ 禁用"}`);
          console.log(`   群组链接: ${group.groupMessageUrl || "未设置"}`);
          console.log(`   轮询间隔: ${group.polling_interval}ms`);
          console.log(`   优先级: ${group.priority || 999}`);
          console.log(`   代理: ${group.proxyUrl || "未设置"}`);
          console.log(`   增强Token: ${group.enhancedAuthToken ? "✅ 已获取" : "❌ 未获取"}`);
          console.log("");
        });
      } else {
        console.log("未配置群组监控账号");
      }

      console.log("\n=== 评论账号列表 ===");
      if (accounts.commentAccounts.length === 0) {
        console.log("没有配置评论账号");
      } else {
        accounts.commentAccounts.forEach((account, index) => {
          console.log(`${index + 1}. ${account.id}`);
          console.log(`   状态: ${account.enabled ? "✅ 启用" : "❌ 禁用"}`);
          console.log(`   轮询间隔: ${account.polling_interval}ms`);
          console.log(`   代理: ${account.proxyUrl || "未设置"}`);
          console.log(`   增强Token: ${account.enhancedAuthToken ? "✅ 已获取" : "❌ 未获取"}`);
          console.log("");
        });
      }

      console.log("=== 统计信息 ===");
      console.log(`总群组监控账号: ${accounts.summary.totalGroupAccounts}`);
      console.log(`启用的群组监控账号: ${accounts.summary.enabledGroupAccounts}`);
      console.log(`总评论账号: ${accounts.summary.totalCommentAccounts}`);
      console.log(`启用的评论账号: ${accounts.summary.enabledCommentAccounts}`);
      console.log(`群组监控状态: ${accounts.summary.groupAccountEnabled ? "✅ 有启用的群组" : "❌ 无启用的群组"}`);
    } catch (error) {
      console.error("❌ 列出账号失败:", error.message);
    }
  }

  /**
   * 添加评论账号
   */
  async addAccount(id, token, options = {}) {
    try {
      const accountData = {
        id,
        authToken: token,
        enabled: true,
        polling_interval: options.polling_interval || 30000,
        ...options,
      };

      const newAccount = await this.accountManager.addCommentAccount(accountData);
      console.log(`✅ 成功添加评论账号: ${newAccount.id}`);
    } catch (error) {
      console.error("❌ 添加账号失败:", error.message);
    }
  }

  /**
   * 更新账号配置
   */
  async updateAccount(id, updates) {
    try {
      const updatedAccount = await this.accountManager.updateAccount(id, updates);
      console.log(`✅ 成功更新账号: ${updatedAccount.id}`);
      console.log("更新的字段:", Object.keys(updates).join(", "));
    } catch (error) {
      console.error("❌ 更新账号失败:", error.message);
    }
  }

  /**
   * 删除账号
   */
  async removeAccount(id) {
    try {
      const removedAccount = await this.accountManager.removeCommentAccount(id);
      console.log(`✅ 成功删除账号: ${removedAccount.id}`);
    } catch (error) {
      console.error("❌ 删除账号失败:", error.message);
    }
  }

  /**
   * 启用/禁用账号
   */
  async toggleAccount(id, enabled) {
    try {
      await this.accountManager.toggleAccount(id, enabled);
      console.log(`✅ 账号 ${id} 已${enabled ? "启用" : "禁用"}`);
    } catch (error) {
      console.error(`❌ ${enabled ? "启用" : "禁用"}账号失败:`, error.message);
    }
  }

  /**
   * 添加群组监控账号
   */
  async addGroupAccount(id, token, url, name, options = {}) {
    try {
      const groupData = {
        id,
        authToken: token,
        groupMessageUrl: url,
        groupName: name,
        enabled: true,
        polling_interval: options.polling_interval || 60000,
        priority: options.priority || 999,
        ...options,
      };

      const newGroup = await this.accountManager.addGroupMonitorAccount(groupData);
      console.log(`✅ 成功添加群组监控账号: ${newGroup.id} (${newGroup.groupName})`);
    } catch (error) {
      console.error("❌ 添加群组监控账号失败:", error.message);
    }
  }

  /**
   * 更新群组监控账号
   */
  async updateGroupAccount(id, updates) {
    try {
      const updatedGroup = await this.accountManager.updateGroupMonitorAccount(id, updates);
      console.log(`✅ 成功更新群组监控账号: ${updatedGroup.id}`);
      console.log("更新的字段:", Object.keys(updates).join(", "));
    } catch (error) {
      console.error("❌ 更新群组监控账号失败:", error.message);
    }
  }

  /**
   * 删除群组监控账号
   */
  async removeGroupAccount(id) {
    try {
      const removedGroup = await this.accountManager.removeGroupMonitorAccount(id);
      console.log(`✅ 成功删除群组监控账号: ${removedGroup.id} (${removedGroup.groupName})`);
    } catch (error) {
      console.error("❌ 删除群组监控账号失败:", error.message);
    }
  }

  /**
   * 更新群组链接
   */
  async updateGroupUrl(groupId, url) {
    try {
      await this.accountManager.updateGroupMessageUrl(groupId, url);
      console.log(`✅ 群组 ${groupId} 的链接已更新: ${url}`);
    } catch (error) {
      console.error("❌ 更新群组链接失败:", error.message);
    }
  }

  /**
   * 列出群组监控账号
   */
  async listGroups() {
    try {
      const accounts = await this.accountManager.listAccounts();

      console.log("\n=== 群组监控账号列表 ===");
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        // 按优先级排序
        const sortedGroups = accounts.groupAccounts.sort((a, b) => (a.priority || 999) - (b.priority || 999));

        sortedGroups.forEach((group, index) => {
          console.log(`${index + 1}. ${group.id}`);
          console.log(`   名称: ${group.groupName || "Unknown"}`);
          console.log(`   状态: ${group.enabled ? "✅ 启用" : "❌ 禁用"}`);
          console.log(`   群组链接: ${group.groupMessageUrl || "未设置"}`);
          console.log(`   轮询间隔: ${group.polling_interval}ms`);
          console.log(`   优先级: ${group.priority || 999}`);
          console.log(`   代理: ${group.proxyUrl || "未设置"}`);
          console.log(`   增强Token: ${group.enhancedAuthToken ? "✅ 已获取" : "❌ 未获取"}`);
          console.log(`   描述: ${group.description || "无"}`);
          console.log("");
        });

        console.log("📊 统计信息:");
        console.log(`   总群组数: ${accounts.summary.totalGroupAccounts}`);
        console.log(`   启用群组: ${accounts.summary.enabledGroupAccounts}`);
      } else {
        console.log("未配置群组监控账号");
        console.log("\n💡 添加群组监控账号:");
        console.log("   npm run accounts group-add <id> <token> <url> <name>");
      }
    } catch (error) {
      console.error("❌ 列出群组失败:", error.message);
    }
  }

  /**
   * 备份配置
   */
  async backupConfig() {
    try {
      const backupPath = await this.accountManager.backupConfig();
      console.log(`✅ 配置已备份到: ${backupPath}`);
    } catch (error) {
      console.error("❌ 备份配置失败:", error.message);
    }
  }

  /**
   * 导出配置
   */
  async exportConfig() {
    try {
      const config = await this.accountManager.exportAccounts();
      console.log(JSON.stringify(config, null, 2));
    } catch (error) {
      console.error("❌ 导出配置失败:", error.message);
    }
  }

  /**
   * 解析命令行参数中的更新字段
   */
  parseUpdates(args) {
    const updates = {};

    for (const arg of args) {
      if (arg.includes("=")) {
        const [key, value] = arg.split("=", 2);

        // 尝试解析数值
        if (!isNaN(value)) {
          updates[key] = parseInt(value);
        } else if (value === "true") {
          updates[key] = true;
        } else if (value === "false") {
          updates[key] = false;
        } else {
          updates[key] = value;
        }
      }
    }

    return updates;
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
          await this.listAccounts();
          break;

        case "add":
          if (args.length < 3) {
            console.error("❌ 用法: add <id> <token> [选项]");
            return;
          }
          await this.addAccount(args[1], args[2]);
          break;

        case "update":
          if (args.length < 3) {
            console.error("❌ 用法: update <id> <字段=值> [更多字段=值]");
            return;
          }
          const updates = this.parseUpdates(args.slice(2));
          await this.updateAccount(args[1], updates);
          break;

        case "remove":
          if (args.length < 2) {
            console.error("❌ 用法: remove <id>");
            return;
          }
          await this.removeAccount(args[1]);
          break;

        case "enable":
          if (args.length < 2) {
            console.error("❌ 用法: enable <id>");
            return;
          }
          await this.toggleAccount(args[1], true);
          break;

        case "disable":
          if (args.length < 2) {
            console.error("❌ 用法: disable <id>");
            return;
          }
          await this.toggleAccount(args[1], false);
          break;

        case "group-add":
          if (args.length < 5) {
            console.error("❌ 用法: group-add <id> <token> <url> <name>");
            return;
          }
          await this.addGroupAccount(args[1], args[2], args[3], args[4]);
          break;

        case "group-update":
          if (args.length < 3) {
            console.error("❌ 用法: group-update <id> <字段=值> [更多字段=值]");
            return;
          }
          const groupUpdates = this.parseUpdates(args.slice(2));
          await this.updateGroupAccount(args[1], groupUpdates);
          break;

        case "group-remove":
          if (args.length < 2) {
            console.error("❌ 用法: group-remove <id>");
            return;
          }
          await this.removeGroupAccount(args[1]);
          break;

        case "group-url":
          if (args.length < 3) {
            console.error("❌ 用法: group-url <groupId> <url>");
            return;
          }
          await this.updateGroupUrl(args[1], args[2]);
          break;

        case "group-list":
          await this.listGroups();
          break;

        case "backup":
          await this.backupConfig();
          break;

        case "export":
          await this.exportConfig();
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
const cli = new AccountManagerCLI();
cli.run().catch((error) => {
  console.error("❌ CLI运行失败:", error.message);
  process.exit(1);
});
