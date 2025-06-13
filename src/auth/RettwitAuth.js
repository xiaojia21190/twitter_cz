import { Rettiwt } from "rettiwt-api";
import { PuppeteerNotificationService } from "../notification/PuppeteerNotificationService.js";
import { PuppeteerCookieExtractor } from "./PuppeteerCookieExtractor.js";

export class RettwitAuth {
  constructor(config, settings = {}) {
    this.config = config;
    this.settings = settings;
    this.client = null;
    this.isAuthenticated = false;
    this.notificationCache = new Map(); // 通知缓存
    this.lastNotificationFetch = null; // 上次获取时间
    this.cacheExpiry = 5 * 60 * 1000; // 缓存过期时间：5分钟
    this.puppeteerService = new PuppeteerNotificationService(config, settings); // Puppeteer 服务
    this.cookieExtractor = new PuppeteerCookieExtractor(config, settings); // Cookie 提取器
    this.enhancedCookies = null; // 增强的 cookie 数据
  }

  /**
   * 初始化Rettiwt客户端，配置代理和认证
   */
  async initialize() {
    try {
      console.log(`[${this.config.id}] 开始初始化 RettwitAuth...`);

      // 步骤1：使用 Puppeteer 提取完整的 cookie 参数
      console.log(`[${this.config.id}] 正在通过 Puppeteer 获取完整 cookie...`);
      this.enhancedCookies = await this.extractEnhancedCookies();

      // 步骤2：使用增强的 cookie 初始化 Rettiwt 客户端
      const options = {
        apiKey: this.enhancedCookies.base64Cookie,
        logging: true,
      };

      // 配置代理
      if (this.config.proxyUrl) {
        options.proxyUrl = this.config.proxyUrl;
        console.log(`[${this.config.id}] 使用代理: ${this.config.proxyUrl}`);
      }

      this.client = new Rettiwt(options);

      // 验证认证状态
      await this.verifyAuthentication();

      // 步骤3：可选择性回写增强的token到配置文件
      if (this.config.saveEnhancedToken !== false) {
        await this.saveEnhancedTokenToConfig();
      }

      console.log(`[${this.config.id}] Rettiwt客户端初始化成功`);
      console.log(`[${this.config.id}] 使用增强 cookie: ${Object.keys(this.enhancedCookies.cookies).join(", ")}`);
      return true;
    } catch (error) {
      console.error(`[${this.config.id}] 初始化失败:`, error.message);
      this.isAuthenticated = false;

      // 如果增强初始化失败，尝试回退到原始方法
      console.log(`[${this.config.id}] 尝试回退到原始认证方法...`);
      return await this.initializeWithFallback();
    }
  }

  /**
   * 提取增强的 cookie 参数
   */
  async extractEnhancedCookies() {
    // 提取纯净的 auth_token 值
    const authToken = this.extractAuthTokenValue(this.config.authToken);

    console.log(`[${this.config.id}] 提取到 auth_token: ${authToken.substring(0, 10)}...`);

    // 使用 PuppeteerCookieExtractor 获取完整 cookie
    const cookies = await this.cookieExtractor.extractCookiesFromAuthToken(authToken);

    return cookies;
  }

  /**
   * 回退初始化方法（使用原始 authToken）
   */
  async initializeWithFallback() {
    try {
      console.log(`[${this.config.id}] 使用回退方法初始化...`);

      const options = {
        apiKey: Buffer.from(this.config.authToken).toString("base64"),
        logging: true,
      };

      // 配置代理
      if (this.config.proxyUrl) {
        options.proxyUrl = this.config.proxyUrl;
        console.log(`[${this.config.id}] 使用代理: ${this.config.proxyUrl}`);
      }

      this.client = new Rettiwt(options);

      // 验证认证状态
      await this.verifyAuthentication();

      console.log(`[${this.config.id}] 回退方法初始化成功`);
      return true;
    } catch (error) {
      console.error(`[${this.config.id}] 回退初始化也失败:`, error.message);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * 从配置字符串中提取auth_token值
   * @param {string} authTokenString - auth_token配置字符串
   * @returns {string} 纯净的auth_token值
   */
  extractAuthTokenValue(authTokenString) {
    if (!authTokenString) return "";

    // 如果是完整的cookie字符串格式
    if (authTokenString.includes("auth_token=")) {
      const match = authTokenString.match(/auth_token=([^;]+)/);
      return match ? match[1] : authTokenString;
    }

    // 如果是直接的token值
    return authTokenString;
  }

  /**
   * 验证认证状态
   */
  async verifyAuthentication() {
    try {
      if (!this.client) {
        throw new Error("客户端未初始化");
      }

      // 尝试获取用户信息来验证认证
      const userInfo = await this.client.user.details("twitter");
      this.isAuthenticated = true;
      console.log(`[${this.config.id}] 认证验证成功`);
      return true;
    } catch (error) {
      console.error(`[${this.config.id}] 认证验证失败:`, error.message);
      this.isAuthenticated = false;
      return false;
    }
  }

  /**
   * 从配置文件加载群组通知账号信息
   * @returns {Object} 群组通知配置
   */
  static getGroupNotificationConfig() {
    try {
      const fs = require("fs");
      const path = require("path");
      const configPath = path.join(process.cwd(), "config", "accounts.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      return config.groupNotificationAccount;
    } catch (error) {
      console.error("加载群组通知配置失败:", error.message);
      // 返回默认配置
      return {
        id: "group_notification_monitor",
        accountId: "08a67be758cf415da83bfb43f6c36ce42a1621c6",
        description: "群组通知监控专用账号",
        type: "group_monitor",
        enabled: true,
        polling_interval: 60000,
        features: ["notifications", "group_activity", "timeline_monitoring"],
      };
    }
  }

  /**
   * 发送推文
   */
  async postTweet(content, replyToId = null) {
    if (!this.isAuthenticated || !this.client) {
      throw new Error("客户端未认证或未初始化");
    }

    try {
      const tweetOptions = {
        text: content,
      };

      if (replyToId) {
        tweetOptions.reply = { in_reply_to_tweet_id: replyToId };
      }

      const result = await this.client.tweet.post(tweetOptions);
      console.log(`[${this.config.id}] 推文发送成功:`, result.id);
      return result;
    } catch (error) {
      console.error(`[${this.config.id}] 发送推文失败:`, error.message);
      throw error;
    }
  }

  /**
   * 获取推文详情
   */
  async getTweetDetails(tweetId) {
    if (!this.isAuthenticated || !this.client) {
      throw new Error("客户端未认证或未初始化");
    }

    try {
      const tweet = await this.client.tweet.details(tweetId);
      return tweet;
    } catch (error) {
      console.error(`[${this.config.id}] 获取推文详情失败:`, error.message);
      throw error;
    }
  }

  /**
   * 重新连接
   */
  async reconnect() {
    console.log(`[${this.config.id}] 尝试重新连接...`);
    this.client = null;
    this.isAuthenticated = false;
    return await this.initialize();
  }

  /**
   * 获取客户端状态
   */
  getStatus() {
    return {
      id: this.config.id,
      isAuthenticated: this.isAuthenticated,
      hasClient: !!this.client,
      proxy: this.config.proxyUrl || "none",
      cacheSize: this.notificationCache.size,
      lastNotificationFetch: this.lastNotificationFetch,
      puppeteerStatus: this.puppeteerService.getStatus(),
      enhancedCookies: this.enhancedCookies
        ? {
            hasValidCookies: Object.keys(this.enhancedCookies.cookies).length > 0,
            availableCookies: Object.keys(this.enhancedCookies.cookies),
            timestamp: this.enhancedCookies.timestamp,
          }
        : null,
    };
  }

  /**
   * 保存增强的token到配置文件
   */
  async saveEnhancedTokenToConfig() {
    try {
      if (!this.enhancedCookies || !this.enhancedCookies.base64Cookie) {
        console.log(`[${this.config.id}] 没有增强token可保存`);
        return;
      }

      const fs = await import("fs-extra");
      const path = await import("path");
      const configPath = path.join(process.cwd(), "config", "accounts.json");

      // 读取当前配置
      const config = await fs.readJson(configPath);

      // 更新对应账号的token信息
      if (this.config.type === "group_monitor" && config.groupNotificationAccount) {
        config.groupNotificationAccount.enhancedAuthToken = this.enhancedCookies.base64Cookie;
        config.groupNotificationAccount.enhancedCookies = this.enhancedCookies.cookies;
        config.groupNotificationAccount.lastTokenUpdate = new Date().toISOString();
      } else if (config.accounts) {
        const accountIndex = config.accounts.findIndex((acc) => acc.id === this.config.id);
        if (accountIndex !== -1) {
          config.accounts[accountIndex].enhancedAuthToken = this.enhancedCookies.base64Cookie;
          config.accounts[accountIndex].enhancedCookies = this.enhancedCookies.cookies;
          config.accounts[accountIndex].lastTokenUpdate = new Date().toISOString();
        }
      }

      // 写回配置文件
      await fs.writeJson(configPath, config, { spaces: 2 });
      console.log(`[${this.config.id}] 增强token已保存到配置文件`);
    } catch (error) {
      console.error(`[${this.config.id}] 保存增强token失败:`, error.message);
    }
  }

  /**
   * 清理资源，关闭 Puppeteer 浏览器
   */
  async cleanup() {
    try {
      if (this.puppeteerService) {
        await this.puppeteerService.close();
      }
      if (this.cookieExtractor) {
        await this.cookieExtractor.cleanup();
      }
      console.log(`[${this.config.id}] 资源清理完成`);
    } catch (error) {
      console.error(`[${this.config.id}] 资源清理失败:`, error.message);
    }
  }

  /**
   * 检查通知缓存是否有效
   * @param {string} cursor - 分页游标
   * @returns {boolean} 缓存是否有效
   */
  isNotificationCacheValid(cursor) {
    if (!this.lastNotificationFetch) return false;

    const now = Date.now();
    const timeDiff = now - this.lastNotificationFetch;
    return timeDiff < this.cacheExpiry;
  }

  /**
   * 缓存通知数据
   * @param {Object} data - 通知数据
   * @param {number} count - 数量
   * @param {string} cursor - 游标
   */
  cacheNotifications(data, count, cursor) {
    const cacheKey = `${count}_${cursor || "initial"}`;
    this.notificationCache.set(cacheKey, data);
    this.lastNotificationFetch = Date.now();

    // 限制缓存大小，保留最近10个查询结果
    if (this.notificationCache.size > 10) {
      const firstKey = this.notificationCache.keys().next().value;
      this.notificationCache.delete(firstKey);
    }
  }

  /**
   * 重试API调用
   * @param {Function} apiCall - API调用函数
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise} API响应
   */
  async retryApiCall(apiCall, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error) {
        lastError = error;
        console.log(`[${this.config.id}] API调用失败 (尝试 ${attempt}/${maxRetries}):`, error.message);

        // 如果是认证错误，不重试
        if (error.response?.status === 401 || error.response?.status === 403) {
          this.isAuthenticated = false;
          throw error;
        }

        // 如果不是最后一次尝试，等待后重试
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大10秒
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * 清除通知缓存
   */
  clearNotificationCache() {
    this.notificationCache.clear();
    this.lastNotificationFetch = null;
    console.log(`[${this.config.id}] 通知缓存已清除`);
  }

  /**
   * 获取指定群组账号的通知（使用 Puppeteer）
   * @param {number} count - 获取通知数量，默认50
   * @param {string} cursor - 分页游标
   * @param {Object} options - 附加选项
   * @returns {Promise<Object>} 群组通知数据
   */
  async getGroupNotifications(count = 50, cursor = null, options = {}) {
    try {
      console.log(`[${this.config.id}] 使用 Puppeteer 获取群组通知...`);

      // 检查缓存
      const cacheKey = `puppeteer_${count}_${cursor || "initial"}`;
      if (options.useCache !== false && this.isNotificationCacheValid(cursor)) {
        const cached = this.notificationCache.get(cacheKey);
        if (cached) {
          console.log(`[${this.config.id}] 使用缓存的群组通知数据`);
          return cached;
        }
      }

      // 使用配置的群组链接或默认链接
      const groupUrl = this.config.groupMessageUrl || "https://x.com/messages/1933360709339131974";
      const targetLinkResult = await this.puppeteerService.getTweetLinks(groupUrl);

      const result = {
        notifications: [], // 简化为空数组，专注于链接获取
        count: 0,
        hasMore: false,
        nextCursor: null,
        account_id: this.config.id,
        timestamp: new Date().toISOString(),
        fromCache: false,
        type: "puppeteer_notifications",
        // 推文链接数据
        tweetLinks: targetLinkResult,
      };

      // 缓存结果
      this.notificationCache.set(cacheKey, result);
      this.lastNotificationFetch = Date.now();

      console.log(`[${this.config.id}] Puppeteer 获取成功: 目标链接=${!!result.targetLink}, 推文链接=${result.tweetLinks.length}个`);
      if (result.targetLink) {
        console.log(`[${this.config.id}] 目标链接: ${result.targetLink}`);
      }

      return result;
    } catch (error) {
      console.error(`[${this.config.id}] Puppeteer 获取群组通知失败:`, error.message);

      // 尝试返回缓存数据
      if (options.fallbackToCache !== false) {
        const cacheKey = `puppeteer_${count}_${cursor || "initial"}`;
        const cached = this.notificationCache.get(cacheKey);
        if (cached) {
          console.log(`[${this.config.id}] Puppeteer 失败，使用缓存数据`);
          return { ...cached, fromCache: true, error: error.message };
        }
      }

      throw error;
    }
  }
}
