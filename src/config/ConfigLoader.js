import fs from "fs-extra";
import path from "path";

export class ConfigLoader {
  constructor() {
    this.accountsPath = "config/accounts.json";
    this.settingsPath = "config/settings.json";
    this.accounts = null;
    this.settings = null;
  }

  /**
   * 加载所有配置
   */
  async loadAll() {
    await Promise.all([this.loadAccounts(), this.loadSettings()]);

    this.validateConfigs();
    return {
      accounts: this.accounts,
      settings: this.settings,
    };
  }

  /**
   * 加载账户配置
   */
  async loadAccounts() {
    try {
      if (!(await fs.exists(this.accountsPath))) {
        throw new Error(`账户配置文件不存在: ${this.accountsPath}`);
      }

      this.accounts = await fs.readJson(this.accountsPath);
      console.log(`已加载 ${this.accounts.accounts.length} 个账户配置`);

      return this.accounts;
    } catch (error) {
      console.error("加载账户配置失败:", error.message);
      throw error;
    }
  }

  /**
   * 加载应用设置
   */
  async loadSettings() {
    try {
      if (!(await fs.exists(this.settingsPath))) {
        throw new Error(`设置配置文件不存在: ${this.settingsPath}`);
      }

      this.settings = await fs.readJson(this.settingsPath);

      // 应用环境变量覆盖
      this.applyEnvironmentOverrides();

      console.log("应用设置加载成功");
      return this.settings;
    } catch (error) {
      console.error("加载应用设置失败:", error.message);
      throw error;
    }
  }

  /**
   * 应用环境变量覆盖
   */
  applyEnvironmentOverrides() {
    if (process.env.OPENAI_PROXY_URL) {
      this.settings.openai.proxy_url = process.env.OPENAI_PROXY_URL;
    }

    if (process.env.OPENAI_API_KEY) {
      this.settings.openai.api_key = process.env.OPENAI_API_KEY;
    }

    if (process.env.LOG_LEVEL) {
      this.settings.logging.level = process.env.LOG_LEVEL;
    }

    if (process.env.DEFAULT_POLLING_INTERVAL) {
      const interval = parseInt(process.env.DEFAULT_POLLING_INTERVAL);
      if (!isNaN(interval)) {
        // 将默认轮询间隔应用到所有账户
        this.accounts.accounts.forEach((account) => {
          if (!account.polling_interval) {
            account.polling_interval = interval;
          }
        });
      }
    }
  }

  /**
   * 验证配置
   */
  validateConfigs() {
    this.validateAccounts();
    this.validateSettings();
    console.log("配置验证通过");
  }

  /**
   * 验证账户配置
   */
  validateAccounts() {
    if (!this.accounts || !this.accounts.accounts || !Array.isArray(this.accounts.accounts)) {
      throw new Error("账户配置格式无效");
    }

    const enabledAccounts = this.accounts.accounts.filter((account) => account.enabled);
    if (enabledAccounts.length === 0) {
      throw new Error("没有启用的账户");
    }

    for (const account of enabledAccounts) {
      if (!account.id || !account.authToken) {
        throw new Error(`账户配置无效: ${account.id || "unknown"} - 缺少必需字段`);
      }

      if (account.proxy && (!account.proxy.host || !account.proxy.port)) {
        throw new Error(`账户 ${account.id} 的代理配置无效`);
      }

      // 验证轮询间隔
      if (account.polling_interval && (account.polling_interval < 10000 || account.polling_interval > 3600000)) {
        console.warn(`账户 ${account.id} 的轮询间隔 ${account.polling_interval}ms 可能不合适（建议 10s-1h）`);
      }
    }
  }

  /**
   * 验证应用设置
   */
  validateSettings() {
    if (!this.settings) {
      throw new Error("应用设置未加载");
    }

    // 验证OpenAI配置
    if (!this.settings.openai || !this.settings.openai.proxy_url || !this.settings.openai.api_key) {
      throw new Error("OpenAI配置不完整");
    }

    // 验证监控配置
    if (!this.settings.monitoring || !this.settings.monitoring.tweet_url_regex) {
      throw new Error("监控配置不完整");
    }

    // 验证通知配置
    if (!this.settings.notifications || !Array.isArray(this.settings.notifications.filter_keywords)) {
      throw new Error("通知配置不完整");
    }

    // 测试正则表达式
    try {
      new RegExp(this.settings.monitoring.tweet_url_regex, "gi");
    } catch (error) {
      throw new Error(`推文URL正则表达式无效: ${error.message}`);
    }
  }

  /**
   * 保存账户配置
   */
  async saveAccounts(accounts) {
    try {
      await fs.writeJson(this.accountsPath, accounts, { spaces: 2 });
      this.accounts = accounts;
      console.log("账户配置已保存");
    } catch (error) {
      console.error("保存账户配置失败:", error.message);
      throw error;
    }
  }

  /**
   * 保存应用设置
   */
  async saveSettings(settings) {
    try {
      await fs.writeJson(this.settingsPath, settings, { spaces: 2 });
      this.settings = settings;
      console.log("应用设置已保存");
    } catch (error) {
      console.error("保存应用设置失败:", error.message);
      throw error;
    }
  }

  /**
   * 重新加载配置
   */
  async reload() {
    console.log("重新加载配置...");
    return await this.loadAll();
  }

  /**
   * 获取启用的账户
   */
  getEnabledAccounts() {
    if (!this.accounts) {
      throw new Error("账户配置未加载");
    }
    return this.accounts.accounts.filter((account) => account.enabled);
  }

  /**
   * 获取账户配置
   */
  getAccount(accountId) {
    if (!this.accounts) {
      throw new Error("账户配置未加载");
    }
    return this.accounts.accounts.find((account) => account.id === accountId);
  }

  /**
   * 更新账户状态
   */
  async updateAccountStatus(accountId, enabled) {
    const account = this.getAccount(accountId);
    if (!account) {
      throw new Error(`账户不存在: ${accountId}`);
    }

    account.enabled = enabled;
    await this.saveAccounts(this.accounts);
    console.log(`账户 ${accountId} 状态已更新为: ${enabled ? "启用" : "禁用"}`);
  }

  /**
   * 添加新账户
   */
  async addAccount(accountConfig) {
    if (!this.accounts) {
      throw new Error("账户配置未加载");
    }

    // 检查ID是否已存在
    if (this.getAccount(accountConfig.id)) {
      throw new Error(`账户ID已存在: ${accountConfig.id}`);
    }

    this.accounts.accounts.push(accountConfig);
    await this.saveAccounts(this.accounts);
    console.log(`新账户已添加: ${accountConfig.id}`);
  }

  /**
   * 删除账户
   */
  async removeAccount(accountId) {
    if (!this.accounts) {
      throw new Error("账户配置未加载");
    }

    const index = this.accounts.accounts.findIndex((account) => account.id === accountId);
    if (index === -1) {
      throw new Error(`账户不存在: ${accountId}`);
    }

    this.accounts.accounts.splice(index, 1);
    await this.saveAccounts(this.accounts);
    console.log(`账户已删除: ${accountId}`);
  }

  /**
   * 获取配置摘要
   */
  getSummary() {
    if (!this.accounts || !this.settings) {
      return { error: "配置未完全加载" };
    }

    const enabledAccounts = this.getEnabledAccounts();

    return {
      total_accounts: this.accounts.accounts.length,
      enabled_accounts: enabledAccounts.length,
      openai_configured: !!(this.settings.openai.proxy_url && this.settings.openai.api_key),
      monitoring_keywords: this.settings.notifications.filter_keywords.length,
      polling_intervals: enabledAccounts.map((a) => a.polling_interval || 30000),
      config_files: {
        accounts: this.accountsPath,
        settings: this.settingsPath,
      },
    };
  }
}
