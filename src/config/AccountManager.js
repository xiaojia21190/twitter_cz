import fs from "fs-extra";
import path from "path";

/**
 * 账号配置管理器
 * 提供账号配置的增删改查功能
 */
export class AccountManager {
  constructor() {
    this.configPath = path.join(process.cwd(), "config", "accounts.json");
  }

  /**
   * 加载账号配置
   */
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configPath)) {
        return await fs.readJson(this.configPath);
      } else {
        throw new Error("配置文件不存在");
      }
    } catch (error) {
      console.error("加载账号配置失败:", error.message);
      throw error;
    }
  }

  /**
   * 保存账号配置
   */
  async saveConfig(config) {
    try {
      await fs.writeJson(this.configPath, config, { spaces: 2 });
      console.log("账号配置已保存");
    } catch (error) {
      console.error("保存账号配置失败:", error.message);
      throw error;
    }
  }

  /**
   * 添加评论账号
   */
  async addCommentAccount(accountData) {
    const config = await this.loadConfig();

    // 检查账号ID是否已存在
    const existingAccount = config.accounts.find((acc) => acc.id === accountData.id);
    if (existingAccount) {
      throw new Error(`账号ID ${accountData.id} 已存在`);
    }

    // 添加默认字段
    const newAccount = {
      id: accountData.id,
      authToken: accountData.authToken,
      enabled: accountData.enabled !== false,
      polling_interval: accountData.polling_interval || 30000,
      proxyUrl: accountData.proxyUrl || "http://127.0.0.1:7890",
      saveEnhancedToken: accountData.saveEnhancedToken !== false,
      ...accountData,
    };

    config.accounts.push(newAccount);
    await this.saveConfig(config);

    console.log(`已添加评论账号: ${accountData.id}`);
    return newAccount;
  }

  /**
   * 更新账号配置
   */
  async updateAccount(accountId, updates) {
    const config = await this.loadConfig();

    // 更新群组监控账号
    if (config.groupNotificationAccount && config.groupNotificationAccount.id === accountId) {
      Object.assign(config.groupNotificationAccount, updates);
      await this.saveConfig(config);
      console.log(`已更新群组监控账号: ${accountId}`);
      return config.groupNotificationAccount;
    }

    // 更新评论账号
    const accountIndex = config.accounts.findIndex((acc) => acc.id === accountId);
    if (accountIndex === -1) {
      throw new Error(`账号 ${accountId} 不存在`);
    }

    Object.assign(config.accounts[accountIndex], updates);
    await this.saveConfig(config);

    console.log(`已更新评论账号: ${accountId}`);
    return config.accounts[accountIndex];
  }

  /**
   * 删除评论账号
   */
  async removeCommentAccount(accountId) {
    const config = await this.loadConfig();

    const accountIndex = config.accounts.findIndex((acc) => acc.id === accountId);
    if (accountIndex === -1) {
      throw new Error(`账号 ${accountId} 不存在`);
    }

    const removedAccount = config.accounts.splice(accountIndex, 1)[0];
    await this.saveConfig(config);

    console.log(`已删除评论账号: ${accountId}`);
    return removedAccount;
  }

  /**
   * 启用/禁用账号
   */
  async toggleAccount(accountId, enabled) {
    return await this.updateAccount(accountId, { enabled });
  }

  /**
   * 添加群组监控账号
   */
  async addGroupMonitorAccount(groupData) {
    const config = await this.loadConfig();

    // 确保 groupMonitorAccounts 数组存在
    if (!config.groupMonitorAccounts) {
      config.groupMonitorAccounts = [];
    }

    // 检查群组ID是否已存在
    const existingGroup = config.groupMonitorAccounts.find((group) => group.id === groupData.id);
    if (existingGroup) {
      throw new Error(`群组监控账号ID ${groupData.id} 已存在`);
    }

    // 添加默认字段
    const newGroup = {
      id: groupData.id,
      authToken: groupData.authToken,
      description: groupData.description || `群组监控账号 ${groupData.id}`,
      type: "group_monitor",
      enabled: groupData.enabled !== false,
      polling_interval: groupData.polling_interval || 60000,
      features: groupData.features || ["notifications", "group_activity"],
      groupMessageUrl: groupData.groupMessageUrl,
      groupName: groupData.groupName || `群组 ${groupData.id}`,
      priority: groupData.priority || 999,
      proxyUrl: groupData.proxyUrl || "http://127.0.0.1:7890",
      saveEnhancedToken: groupData.saveEnhancedToken !== false,
      ...groupData,
    };

    config.groupMonitorAccounts.push(newGroup);
    await this.saveConfig(config);

    console.log(`已添加群组监控账号: ${groupData.id} (${newGroup.groupName})`);
    return newGroup;
  }

  /**
   * 更新群组监控账号
   */
  async updateGroupMonitorAccount(groupId, updates) {
    const config = await this.loadConfig();

    if (!config.groupMonitorAccounts) {
      throw new Error("未配置群组监控账号");
    }

    const groupIndex = config.groupMonitorAccounts.findIndex((group) => group.id === groupId);
    if (groupIndex === -1) {
      throw new Error(`群组监控账号 ${groupId} 不存在`);
    }

    Object.assign(config.groupMonitorAccounts[groupIndex], updates);
    await this.saveConfig(config);

    console.log(`已更新群组监控账号: ${groupId}`);
    return config.groupMonitorAccounts[groupIndex];
  }

  /**
   * 删除群组监控账号
   */
  async removeGroupMonitorAccount(groupId) {
    const config = await this.loadConfig();

    if (!config.groupMonitorAccounts) {
      throw new Error("未配置群组监控账号");
    }

    const groupIndex = config.groupMonitorAccounts.findIndex((group) => group.id === groupId);
    if (groupIndex === -1) {
      throw new Error(`群组监控账号 ${groupId} 不存在`);
    }

    const removedGroup = config.groupMonitorAccounts.splice(groupIndex, 1)[0];
    await this.saveConfig(config);

    console.log(`已删除群组监控账号: ${groupId}`);
    return removedGroup;
  }

  /**
   * 更新群组链接
   */
  async updateGroupMessageUrl(groupId, newUrl) {
    const config = await this.loadConfig();

    // 支持新的多群组配置
    if (config.groupMonitorAccounts) {
      const groupIndex = config.groupMonitorAccounts.findIndex((group) => group.id === groupId);
      if (groupIndex === -1) {
        throw new Error(`群组监控账号 ${groupId} 不存在`);
      }

      config.groupMonitorAccounts[groupIndex].groupMessageUrl = newUrl;
      await this.saveConfig(config);

      console.log(`已更新群组 ${groupId} 的链接: ${newUrl}`);
      return config.groupMonitorAccounts[groupIndex];
    }

    // 兼容旧的单群组配置
    if (config.groupNotificationAccount) {
      config.groupNotificationAccount.groupMessageUrl = newUrl;
      await this.saveConfig(config);

      console.log(`已更新群组链接: ${newUrl}`);
      return config.groupNotificationAccount;
    }

    throw new Error("未找到群组监控账号配置");
  }

  /**
   * 获取账号列表
   */
  async listAccounts() {
    const config = await this.loadConfig();

    // 支持新的多群组配置
    const groupAccounts = config.groupMonitorAccounts || [];

    // 兼容旧的单群组配置
    if (groupAccounts.length === 0 && config.groupNotificationAccount) {
      groupAccounts.push(config.groupNotificationAccount);
    }

    return {
      groupAccounts: groupAccounts,
      commentAccounts: config.accounts || [],
      summary: {
        totalGroupAccounts: groupAccounts.length,
        enabledGroupAccounts: groupAccounts.filter((acc) => acc.enabled).length,
        totalCommentAccounts: (config.accounts || []).length,
        enabledCommentAccounts: (config.accounts || []).filter((acc) => acc.enabled).length,
        // 兼容旧字段
        groupAccountEnabled: groupAccounts.some((acc) => acc.enabled),
      },
    };
  }

  /**
   * 验证账号配置
   */
  validateAccountConfig(accountData) {
    const errors = [];

    if (!accountData.id) {
      errors.push("账号ID不能为空");
    }

    if (!accountData.authToken) {
      errors.push("authToken不能为空");
    }

    if (accountData.polling_interval && (accountData.polling_interval < 10000 || accountData.polling_interval > 300000)) {
      errors.push("轮询间隔必须在10秒到5分钟之间");
    }

    if (accountData.proxyUrl && !this.isValidUrl(accountData.proxyUrl)) {
      errors.push("代理URL格式不正确");
    }

    return errors;
  }

  /**
   * 验证URL格式
   */
  isValidUrl(urlString) {
    try {
      const url = new URL(urlString);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (error) {
      return false;
    }
  }

  /**
   * 批量导入账号
   */
  async importAccounts(accountsData) {
    const results = {
      success: [],
      failed: [],
    };

    for (const accountData of accountsData) {
      try {
        const errors = this.validateAccountConfig(accountData);
        if (errors.length > 0) {
          throw new Error(errors.join(", "));
        }

        const newAccount = await this.addCommentAccount(accountData);
        results.success.push(newAccount);
      } catch (error) {
        results.failed.push({
          accountData,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * 导出账号配置
   */
  async exportAccounts() {
    const config = await this.loadConfig();

    // 移除敏感信息的副本
    const exportConfig = JSON.parse(JSON.stringify(config));

    // 可选择性隐藏token信息
    if (exportConfig.groupNotificationAccount) {
      exportConfig.groupNotificationAccount.authToken = "***HIDDEN***";
    }

    exportConfig.accounts.forEach((account) => {
      account.authToken = "***HIDDEN***";
      if (account.enhancedAuthToken) {
        account.enhancedAuthToken = "***HIDDEN***";
      }
    });

    return exportConfig;
  }

  /**
   * 备份配置文件
   */
  async backupConfig() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(process.cwd(), "config", `accounts.backup.${timestamp}.json`);

    const config = await this.loadConfig();
    await fs.writeJson(backupPath, config, { spaces: 2 });

    console.log(`配置已备份到: ${backupPath}`);
    return backupPath;
  }
}
