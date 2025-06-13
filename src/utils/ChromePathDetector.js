import fs from "fs-extra";
import path from "path";
import { execSync } from "child_process";

/**
 * Chrome路径检测工具
 * 自动检测系统中的Chrome安装路径
 */
export class ChromePathDetector {
  constructor() {
    this.platform = process.platform;
    this.commonPaths = this.getCommonPaths();
  }

  /**
   * 获取不同平台的常见Chrome路径
   */
  getCommonPaths() {
    switch (this.platform) {
      case "win32":
        return [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          path.join(process.env.LOCALAPPDATA || "", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env.PROGRAMFILES || "", "Google\\Chrome\\Application\\chrome.exe"),
          path.join(process.env["PROGRAMFILES(X86)"] || "", "Google\\Chrome\\Application\\chrome.exe"),
        ];
      case "darwin":
        return [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          path.join(process.env.HOME || "", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        ];
      case "linux":
        return [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/snap/bin/chromium",
          "/opt/google/chrome/chrome",
        ];
      default:
        return [];
    }
  }

  /**
   * 检测Chrome是否存在于指定路径
   */
  async checkPath(chromePath) {
    try {
      if (await fs.pathExists(chromePath)) {
        // 尝试获取版本信息来验证是否为有效的Chrome
        const version = await this.getChromeVersion(chromePath);
        return {
          exists: true,
          path: chromePath,
          version: version,
          valid: !!version,
        };
      }
      return {
        exists: false,
        path: chromePath,
        version: null,
        valid: false,
      };
    } catch (error) {
      return {
        exists: false,
        path: chromePath,
        version: null,
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取Chrome版本信息
   */
  async getChromeVersion(chromePath) {
    try {
      let command;
      switch (this.platform) {
        case "win32":
          command = `"${chromePath}" --version`;
          break;
        case "darwin":
          command = `"${chromePath}" --version`;
          break;
        case "linux":
          command = `"${chromePath}" --version`;
          break;
        default:
          return null;
      }

      const output = execSync(command, { 
        encoding: "utf8", 
        timeout: 5000,
        stdio: ["ignore", "pipe", "ignore"] 
      });
      
      const versionMatch = output.match(/(\d+\.\d+\.\d+\.\d+)/);
      return versionMatch ? versionMatch[1] : output.trim();
    } catch (error) {
      return null;
    }
  }

  /**
   * 自动检测所有可能的Chrome路径
   */
  async detectAllPaths() {
    console.log(`检测平台: ${this.platform}`);
    console.log(`检查 ${this.commonPaths.length} 个常见路径...`);

    const results = [];
    
    for (const chromePath of this.commonPaths) {
      const result = await this.checkPath(chromePath);
      results.push(result);
      
      if (result.exists) {
        console.log(`✅ 找到: ${chromePath} ${result.version ? `(版本: ${result.version})` : ""}`);
      } else {
        console.log(`❌ 未找到: ${chromePath}`);
      }
    }

    return results;
  }

  /**
   * 获取推荐的Chrome路径
   */
  async getRecommendedPath() {
    const results = await this.detectAllPaths();
    
    // 优先选择有效的Chrome路径
    const validPaths = results.filter(r => r.exists && r.valid);
    
    if (validPaths.length > 0) {
      // 按优先级排序（通常第一个是最常见的路径）
      return validPaths[0];
    }

    // 如果没有找到有效路径，返回存在的路径
    const existingPaths = results.filter(r => r.exists);
    if (existingPaths.length > 0) {
      return existingPaths[0];
    }

    return null;
  }

  /**
   * 生成配置建议
   */
  async generateConfigSuggestion() {
    const recommended = await this.getRecommendedPath();
    
    if (recommended) {
      return {
        success: true,
        executablePath: recommended.path,
        version: recommended.version,
        config: {
          puppeteer: {
            executablePath: recommended.path,
            headless: true,
            timeout: 50000,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox", 
              "--disable-blink-features=AutomationControlled",
              "--disable-gpu",
              "--disable-dev-shm-usage",
              "--no-first-run",
              "--no-zygote",
              "--start-maximized",
              "--use-gl=swiftshader",
              "--disable-gl-drawing-for-tests"
            ]
          }
        }
      };
    } else {
      return {
        success: false,
        message: "未找到Chrome安装，请手动安装Chrome或设置正确的路径",
        suggestions: this.getInstallSuggestions()
      };
    }
  }

  /**
   * 获取安装建议
   */
  getInstallSuggestions() {
    switch (this.platform) {
      case "win32":
        return [
          "从 https://www.google.com/chrome/ 下载并安装Chrome",
          "或者使用 winget install Google.Chrome",
          "安装后Chrome通常位于: C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        ];
      case "darwin":
        return [
          "从 https://www.google.com/chrome/ 下载并安装Chrome",
          "或者使用 brew install --cask google-chrome",
          "安装后Chrome通常位于: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        ];
      case "linux":
        return [
          "Ubuntu/Debian: sudo apt install google-chrome-stable",
          "CentOS/RHEL: sudo yum install google-chrome-stable", 
          "或从 https://www.google.com/chrome/ 下载deb/rpm包",
          "安装后Chrome通常位于: /usr/bin/google-chrome"
        ];
      default:
        return ["请访问 https://www.google.com/chrome/ 下载适合您系统的Chrome"];
    }
  }

  /**
   * 验证指定路径的Chrome
   */
  async validatePath(chromePath) {
    if (!chromePath) {
      return {
        valid: false,
        message: "Chrome路径不能为空"
      };
    }

    const result = await this.checkPath(chromePath);
    
    if (!result.exists) {
      return {
        valid: false,
        message: `Chrome文件不存在: ${chromePath}`
      };
    }

    if (!result.valid) {
      return {
        valid: false,
        message: `无法验证Chrome版本，可能不是有效的Chrome可执行文件: ${chromePath}`
      };
    }

    return {
      valid: true,
      message: `Chrome验证成功: ${chromePath} (版本: ${result.version})`,
      version: result.version
    };
  }

  /**
   * 更新配置文件中的Chrome路径
   */
  async updateConfigFile(chromePath, configPath = "config/settings.json") {
    try {
      const validation = await this.validatePath(chromePath);
      if (!validation.valid) {
        throw new Error(validation.message);
      }

      const configFilePath = path.join(process.cwd(), configPath);
      const config = await fs.readJson(configFilePath);
      
      if (!config.puppeteer) {
        config.puppeteer = {};
      }
      
      config.puppeteer.executablePath = chromePath;
      
      await fs.writeJson(configFilePath, config, { spaces: 2 });
      
      return {
        success: true,
        message: `Chrome路径已更新到配置文件: ${chromePath}`,
        version: validation.version
      };
    } catch (error) {
      return {
        success: false,
        message: `更新配置文件失败: ${error.message}`
      };
    }
  }
}
