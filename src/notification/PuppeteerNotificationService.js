import puppeteer from "puppeteer-core";

export class PuppeteerNotificationService {
  constructor(config, settings = {}) {
    this.config = config;
    this.settings = settings;
    this.browser = null;
    this.page = null;
    this.isInitialized = false;
    // 链接提取配置
    this.baseUrl = "https://x.com";
    this.tweetPathRegex = /^\/([^\/]+)\/status\/(\d+)/;
    // 从settings中获取puppeteer配置
    this.puppeteerConfig = settings.puppeteer || {};
  }

  /**
   * 初始化 Puppeteer 浏览器实例
   */
  async initialize() {
    try {
      console.log(`[${this.config.id}] 初始化 Puppeteer 浏览器...`);

      const launchOptions = {
        headless: this.puppeteerConfig.headless !== false,
        args: this.puppeteerConfig.args || ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      };

      // 添加Chrome可执行文件路径
      if (this.puppeteerConfig.executablePath) {
        launchOptions.executablePath = this.puppeteerConfig.executablePath;
        console.log(`[${this.config.id}] 使用Chrome路径: ${this.puppeteerConfig.executablePath}`);
      } else {
        console.warn(`[${this.config.id}] 未配置Chrome路径，将尝试自动检测`);
      }

      this.browser = await puppeteer.launch(launchOptions);

      this.page = await this.browser.newPage();
      await this.page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36");

      // 设置超时
      if (this.puppeteerConfig.timeout) {
        this.page.setDefaultNavigationTimeout(this.puppeteerConfig.timeout);
      }

      // 设置 Cookie
      await this.setCookies();

      this.isInitialized = true;
      console.log(`[${this.config.id}] Puppeteer 初始化成功`);
      return true;
    } catch (error) {
      console.error(`[${this.config.id}] Puppeteer 初始化失败:`, error.message);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 设置 Twitter 认证 Cookie
   */
  async setCookies() {
    const authToken = this.extractAuthToken();
    if (!authToken) {
      throw new Error("无法提取 auth_token");
    }

    const cookies = [
      {
        name: "auth_token",
        value: authToken,
        domain: ".x.com",
        path: "/",
        httpOnly: true,
        secure: true,
      },
    ];

    // 如果配置中有完整的 cookie 字符串，解析并设置所有 cookie
    if (this.config.authToken.includes(";")) {
      const cookiePairs = this.config.authToken.split(";");
      for (const pair of cookiePairs) {
        const [name, value] = pair.trim().split("=");
        if (name && value) {
          cookies.push({
            name: name.trim(),
            value: value.trim(),
            domain: ".x.com",
            path: "/",
            httpOnly: true,
            secure: true,
          });
        }
      }
    }

    await this.page.setCookie(...cookies);
    console.log(`[${this.config.id}] 已设置 ${cookies.length} 个 Cookie`);
  }

  /**
   * 从配置中提取 auth_token 值
   */
  extractAuthToken() {
    const authTokenString = this.config.authToken;

    // 如果是完整的 cookie 字符串格式
    if (authTokenString.includes("auth_token=")) {
      const match = authTokenString.match(/auth_token=([^;]+)/);
      return match ? match[1] : null;
    }

    // 如果是直接的 token 值
    return authTokenString;
  }

  /**
   * 导航到指定页面
   */
  async navigateToPage(url = "https://x.com/messages") {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`[${this.config.id}] 访问页面: ${url}`);

    await this.page.goto(url, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    await this.page.waitForTimeout(3000);

    // 检查是否需要登录
    const currentUrl = this.page.url();
    if (currentUrl.includes("login") || currentUrl.includes("oauth")) {
      throw new Error("需要重新登录，Cookie 可能已过期");
    }

    return currentUrl;
  }

  /**
   * 获取推文链接
   */
  async getTweetLinks(pageUrl = null) {
    try {
      if (pageUrl) {
        await this.navigateToPage(pageUrl);
      } else if (!this.page) {
        await this.navigateToPage();
      }

      console.log(`[${this.config.id}] 正在提取页面推文链接...`);

      // 在页面中执行链接提取
      const tweetLinks = await this.page.evaluate(() => {
        const links = document.querySelectorAll('[role="link"] a');
        const results = [];
        const tweetPathRegex = /^\/([^\/]+)\/status\/(\d+)/;

        links.forEach((link) => {
          const href = link.getAttribute("href");
          if (href && tweetPathRegex.test(href)) {
            const match = href.match(tweetPathRegex);
            if (match) {
              const username = match[1];
              const statusId = match[2];
              const tweetPath = `/${username}/status/${statusId}`;
              const fullUrl = `https://x.com${tweetPath}`;

              results.push({
                originalHref: href,
                tweetPath: tweetPath,
                fullUrl: fullUrl,
                username: username,
                statusId: statusId,
              });
            }
          }
        });

        return results;
      });

      // 计算统计信息
      const validLinks = tweetLinks.filter((link) => link.statusId && /^\d+$/.test(link.statusId));
      const uniqueUsers = new Set(validLinks.map((link) => link.username));
      const uniqueTweets = new Set(validLinks.map((link) => link.statusId));

      const stats = {
        total: tweetLinks.length,
        valid: validLinks.length,
        invalid: tweetLinks.length - validLinks.length,
        uniqueUsers: uniqueUsers.size,
        uniqueTweets: uniqueTweets.size,
        users: Array.from(uniqueUsers),
      };

      console.log(`[${this.config.id}] 找到 ${tweetLinks.length} 个推文链接`);

      return {
        success: true,
        account_id: this.config.id,
        pageUrl: this.page.url(),
        tweetLinks: validLinks,
        stats,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`[${this.config.id}] 获取推文链接失败:`, error.message);
      return {
        success: false,
        error: error.message,
        account_id: this.config.id,
        tweetLinks: [],
        stats: { total: 0, valid: 0, invalid: 0, uniqueUsers: 0, uniqueTweets: 0, users: [] },
      };
    }
  }

  /**
   * 关闭浏览器实例
   */
  async close() {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isInitialized = false;
      console.log(`[${this.config.id}] Puppeteer 浏览器已关闭`);
    } catch (error) {
      console.error(`[${this.config.id}] 关闭浏览器失败:`, error.message);
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      id: this.config.id,
      isInitialized: this.isInitialized,
      hasBrowser: !!this.browser,
      hasPage: !!this.page,
      type: "puppeteer_service",
    };
  }
}
