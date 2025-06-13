import puppeteer from "puppeteer-core";

/**
 * Puppeteer Cookie 提取器
 * 基于用户提供的auth_token获取完整的Twitter cookie参数
 */
export class PuppeteerCookieExtractor {
  constructor(config = {}, settings = {}) {
    this.config = {
      headless: config.headless !== false, // 默认无头模式
      timeout: config.timeout || 50000, // 默认50秒超时
      proxyUrl: config.proxyUrl || "http://127.0.0.1:7890", // 默认代理
      ...config,
    };

    // 从settings中获取puppeteer配置
    this.puppeteerConfig = settings.puppeteer || {};
    this.browser = null;
    this.page = null;
  }

  /**
   * 从auth_token获取完整的cookie参数
   * @param {string} authToken - auth_token值
   * @returns {Promise<Object>} 包含所有cookie的对象
   */
  async extractCookiesFromAuthToken(authToken) {
    if (!authToken) {
      throw new Error("auth_token 不能为空");
    }

    console.log("正在启动浏览器获取cookie参数...");

    try {
      await this.initializeBrowser();
      await this.injectAuthToken(authToken);
      const cookies = await this.extractAllCookies();

      console.log("✅ 成功获取到所有cookie参数");
      return cookies;
    } catch (error) {
      console.error("❌ Cookie提取失败:", error.message);
      await this.takeErrorScreenshot();
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * 初始化浏览器和页面
   */
  async initializeBrowser() {
    const launchOptions = {
      headless: this.puppeteerConfig.headless !== false ? this.config.headless : this.puppeteerConfig.headless,
      args: this.puppeteerConfig.args || ["--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox", "--no-first-run", "--no-sandbox", "--no-zygote", "--start-maximized", "--use-gl=swiftshader", "--disable-gl-drawing-for-tests"],
      ignoreDefaultArgs: ["--enable-automation"],
    };

    // 添加Chrome可执行文件路径
    if (this.puppeteerConfig.executablePath) {
      launchOptions.executablePath = this.puppeteerConfig.executablePath;
      console.log(`[PuppeteerCookieExtractor] 使用Chrome路径: ${this.puppeteerConfig.executablePath}`);
    } else {
      console.warn(`[PuppeteerCookieExtractor] 未配置Chrome路径，将尝试自动检测`);
    }

    this.browser = await puppeteer.launch(launchOptions);

    const context = await this.browser.createBrowserContext();
    this.page = await context.newPage();
    this.page.setDefaultNavigationTimeout(this.puppeteerConfig.timeout || this.config.timeout);

    // 反检测设置
    await this.page.evaluateOnNewDocument(() => {
      const newProto = navigator.__proto__;
      delete newProto.webdriver;
      navigator.__proto__ = newProto;
    });

    await this.page.evaluateOnNewDocument(() => {
      window.navigator.chrome = {
        runtime: {},
      };
    });

    await this.page.setViewport({ width: 1280, height: 800 });
  }

  /**
   * 注入auth_token到浏览器
   * @param {string} authToken - auth_token值
   */
  async injectAuthToken(authToken) {
    console.log("正在向浏览器注入 auth_token...");

    const context = this.browser.defaultBrowserContext();
    await context.setCookie({
      name: "auth_token",
      value: authToken,
      domain: ".x.com",
      secure: true,
      httpOnly: true,
      sameSite: "None",
    });
  }

  /**
   * 访问X主页并验证登录状态，然后提取所有cookie
   */
  async extractAllCookies() {
    // 访问X主页以激活会话
    console.log("正在导航到 X 主页以刷新会话...");
    await this.page.goto("https://x.com");

    // 检查是否登录成功
    console.log("正在验证登录状态...");
    try {
      await this.page.waitForSelector('[data-testid="AppTabBar_Home_Link"]', {
        timeout: 15000,
      });
      console.log("会话有效，登录成功！");
    } catch (error) {
      console.warn("登录验证超时，继续尝试提取cookie...");
    }

    // 提取所有Cookies
    console.log("正在提取所有会话 Cookies...");
    const context = this.browser.defaultBrowserContext();
    const cookies = await context.cookies("https://x.com");

    const TARGET_COOKIES = ["ct0", "kdt", "twid", "auth_token"];
    const extractedCookies = cookies
      .filter((cookie) => TARGET_COOKIES.includes(cookie.name))
      .reduce((acc, cookie) => {
        acc[cookie.name] = cookie.value;
        return acc;
      }, {});

    // 如果没有获取到某些cookie，使用默认值或从现有token推导
    if (!extractedCookies.auth_token) {
      // 如果没有从cookies中获取到auth_token，使用注入的值
      extractedCookies.auth_token = this.extractAuthTokenValue(this.config.authToken);
    }

    // 验证必要的cookie是否存在
    this.validateExtractedCookies(extractedCookies);

    console.log("✅ 成功获取到目标 Cookie:", Object.keys(extractedCookies));

    // 生成base64编码的cookie字符串（用于rettiwt-api）
    const cookieString = `kdt=${extractedCookies["kdt"] || ""};auth_token=${extractedCookies["auth_token"]};ct0=${extractedCookies["ct0"] || ""};twid=${extractedCookies["twid"] || ""};`;
    const base64Cookie = Buffer.from(cookieString).toString("base64");

    return {
      cookies: extractedCookies,
      cookieString: cookieString,
      base64Cookie: base64Cookie,
      timestamp: new Date().toISOString(),
    };
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
   * 验证提取的cookie是否完整
   * @param {Object} cookies - 提取的cookie对象
   */
  validateExtractedCookies(cookies) {
    if (!cookies.auth_token) {
      throw new Error("未能获取到 auth_token");
    }

    const requiredCookies = ["auth_token"];
    const missingCookies = requiredCookies.filter((name) => !cookies[name]);

    if (missingCookies.length > 0) {
      console.warn(`⚠️ 警告：未能获取到以下 Cookie: ${missingCookies.join(", ")}`);
    }

    if (Object.keys(cookies).length < 2) {
      console.warn("⚠️ 警告：获取到的 Cookie 数量较少，可能影响API调用");
    }
  }

  /**
   * 错误时截图
   */
  async takeErrorScreenshot() {
    if (this.page) {
      try {
        const filename = `error_screenshot_${Date.now()}.png`;
        await this.page.screenshot({ path: filename });
        console.log(`已保存错误截图到: ${filename}`);
      } catch (error) {
        console.warn("截图失败:", error.message);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    console.log("正在关闭浏览器...");
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * 批量处理多个auth_token
   * @param {Array} authTokens - auth_token数组
   * @returns {Promise<Array>} 处理结果数组
   */
  async batchExtractCookies(authTokens) {
    const results = [];

    for (const token of authTokens) {
      try {
        const result = await this.extractCookiesFromAuthToken(token);
        results.push({
          success: true,
          authToken: token,
          ...result,
        });
      } catch (error) {
        results.push({
          success: false,
          authToken: token,
          error: error.message,
        });
      }

      // 添加延迟避免过于频繁的请求
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return results;
  }
}
