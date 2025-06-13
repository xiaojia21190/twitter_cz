#!/usr/bin/env node

import { ChromePathDetector } from "../utils/ChromePathDetector.js";
import { AccountManager } from "../config/AccountManager.js";
import fs from "fs-extra";
import path from "path";

/**
 * 系统设置检查工具
 * 检查所有必要的配置是否正确
 */
class SetupChecker {
  constructor() {
    this.chromeDetector = new ChromePathDetector();
    this.accountManager = new AccountManager();
    this.issues = [];
    this.warnings = [];
  }

  /**
   * 运行完整的设置检查
   */
  async runFullCheck() {
    console.log("🔍 Twitter监控系统 - 设置检查\n");
    console.log("正在检查系统配置...\n");

    // 检查各个组件
    await this.checkNodeVersion();
    await this.checkDependencies();
    await this.checkConfigFiles();
    await this.checkChromeSetup();
    await this.checkAccountConfig();
    await this.checkOpenAIConfig();
    await this.checkDirectories();

    // 显示结果
    this.displayResults();

    return this.issues.length === 0;
  }

  /**
   * 检查 Node.js 版本
   */
  async checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split(".")[0]);

    if (majorVersion >= 18) {
      console.log(`✅ Node.js 版本: ${nodeVersion}`);
    } else {
      this.issues.push(`Node.js 版本过低: ${nodeVersion}，需要 18.0.0 或更高版本`);
      console.log(`❌ Node.js 版本: ${nodeVersion} (需要 18+)`);
    }
  }

  /**
   * 检查依赖包
   */
  async checkDependencies() {
    try {
      const packagePath = path.join(process.cwd(), "package.json");
      const packageJson = await fs.readJson(packagePath);

      const requiredDeps = ["puppeteer-core", "rettiwt-api", "fs-extra", "axios"];

      let missingDeps = [];

      for (const dep of requiredDeps) {
        if (!packageJson.dependencies[dep]) {
          missingDeps.push(dep);
        }
      }

      if (missingDeps.length === 0) {
        console.log("✅ 依赖包检查通过");
      } else {
        this.issues.push(`缺少依赖包: ${missingDeps.join(", ")}`);
        console.log(`❌ 缺少依赖包: ${missingDeps.join(", ")}`);
      }
    } catch (error) {
      this.issues.push(`无法检查依赖包: ${error.message}`);
      console.log(`❌ 依赖包检查失败: ${error.message}`);
    }
  }

  /**
   * 检查配置文件
   */
  async checkConfigFiles() {
    const configFiles = ["config/accounts.json", "config/settings.json"];

    for (const configFile of configFiles) {
      const filePath = path.join(process.cwd(), configFile);

      if (await fs.pathExists(filePath)) {
        try {
          await fs.readJson(filePath);
          console.log(`✅ 配置文件: ${configFile}`);
        } catch (error) {
          this.issues.push(`配置文件格式错误: ${configFile} - ${error.message}`);
          console.log(`❌ 配置文件格式错误: ${configFile}`);
        }
      } else {
        this.issues.push(`配置文件不存在: ${configFile}`);
        console.log(`❌ 配置文件不存在: ${configFile}`);
      }
    }
  }

  /**
   * 检查 Chrome 设置
   */
  async checkChromeSetup() {
    try {
      const settingsPath = path.join(process.cwd(), "config/settings.json");

      if (await fs.pathExists(settingsPath)) {
        const settings = await fs.readJson(settingsPath);

        if (settings.puppeteer && settings.puppeteer.executablePath) {
          const validation = await this.chromeDetector.validatePath(settings.puppeteer.executablePath);

          if (validation.valid) {
            console.log(`✅ Chrome 配置: ${settings.puppeteer.executablePath}`);
            console.log(`   版本: ${validation.version}`);
          } else {
            this.issues.push(`Chrome 路径无效: ${validation.message}`);
            console.log(`❌ Chrome 路径无效: ${settings.puppeteer.executablePath}`);
          }
        } else {
          this.warnings.push("未配置 Chrome 路径，将尝试自动检测");
          console.log("⚠️ 未配置 Chrome 路径");

          // 尝试自动检测
          const recommended = await this.chromeDetector.getRecommendedPath();
          if (recommended) {
            console.log(`   💡 建议使用: ${recommended.path}`);
          }
        }
      }
    } catch (error) {
      this.issues.push(`Chrome 配置检查失败: ${error.message}`);
      console.log(`❌ Chrome 配置检查失败: ${error.message}`);
    }
  }

  /**
   * 检查账号配置
   */
  async checkAccountConfig() {
    try {
      const accounts = await this.accountManager.listAccounts();

      // 检查群组监控账号
      if (accounts.groupAccount) {
        if (accounts.groupAccount.enabled) {
          console.log(`✅ 群组监控账号: ${accounts.groupAccount.id}`);

          if (!accounts.groupAccount.groupMessageUrl) {
            this.warnings.push("群组监控账号未配置群组链接");
            console.log("   ⚠️ 未配置群组链接");
          }
        } else {
          this.warnings.push("群组监控账号已禁用");
          console.log("   ⚠️ 群组监控账号已禁用");
        }
      } else {
        this.issues.push("未配置群组监控账号");
        console.log("❌ 未配置群组监控账号");
      }

      // 检查评论账号
      if (accounts.summary.totalCommentAccounts > 0) {
        console.log(`✅ 评论账号: ${accounts.summary.enabledCommentAccounts}/${accounts.summary.totalCommentAccounts} 个启用`);

        if (accounts.summary.enabledCommentAccounts === 0) {
          this.warnings.push("所有评论账号都已禁用");
        }

        // 检查代理配置
        const accountsWithoutProxy = accounts.commentAccounts.filter((acc) => !acc.proxyUrl);
        if (accountsWithoutProxy.length > 0) {
          this.warnings.push(`${accountsWithoutProxy.length} 个评论账号未配置代理`);
          console.log(`⚠️ ${accountsWithoutProxy.length} 个评论账号未配置代理`);
        }
      } else {
        this.warnings.push("未配置评论账号");
        console.log("⚠️ 未配置评论账号");
      }

      // 检查群组账号代理配置
      if (accounts.groupAccounts && accounts.groupAccounts.length > 0) {
        const groupsWithoutProxy = accounts.groupAccounts.filter((group) => !group.proxyUrl);
        if (groupsWithoutProxy.length > 0) {
          this.warnings.push(`${groupsWithoutProxy.length} 个群组监控账号未配置代理`);
          console.log(`⚠️ ${groupsWithoutProxy.length} 个群组监控账号未配置代理`);
        }
      }
    } catch (error) {
      this.issues.push(`账号配置检查失败: ${error.message}`);
      console.log(`❌ 账号配置检查失败: ${error.message}`);
    }
  }

  /**
   * 检查 OpenAI 配置
   */
  async checkOpenAIConfig() {
    try {
      const settingsPath = path.join(process.cwd(), "config/settings.json");
      const settings = await fs.readJson(settingsPath);

      if (settings.openai) {
        if (settings.openai.api_key) {
          console.log("✅ OpenAI API 密钥已配置");
        } else {
          this.warnings.push("未配置 OpenAI API 密钥");
          console.log("⚠️ 未配置 OpenAI API 密钥");
        }

        if (settings.openai.proxy_url) {
          console.log(`✅ OpenAI 代理: ${settings.openai.proxy_url}`);
        }
      } else {
        this.warnings.push("未配置 OpenAI 设置");
        console.log("⚠️ 未配置 OpenAI 设置");
      }
    } catch (error) {
      this.warnings.push(`OpenAI 配置检查失败: ${error.message}`);
      console.log(`⚠️ OpenAI 配置检查失败: ${error.message}`);
    }
  }

  /**
   * 检查必要目录
   */
  async checkDirectories() {
    const requiredDirs = ["data", "logs"];

    for (const dir of requiredDirs) {
      const dirPath = path.join(process.cwd(), dir);

      if (await fs.pathExists(dirPath)) {
        console.log(`✅ 目录: ${dir}/`);
      } else {
        try {
          await fs.ensureDir(dirPath);
          console.log(`✅ 目录: ${dir}/ (已创建)`);
        } catch (error) {
          this.warnings.push(`无法创建目录: ${dir}`);
          console.log(`⚠️ 无法创建目录: ${dir}`);
        }
      }
    }
  }

  /**
   * 显示检查结果
   */
  displayResults() {
    console.log("\n" + "=".repeat(50));
    console.log("📊 检查结果汇总");
    console.log("=".repeat(50));

    if (this.issues.length === 0 && this.warnings.length === 0) {
      console.log("🎉 所有检查都通过了！系统已准备就绪。");
      console.log("\n🚀 可以运行以下命令启动系统:");
      console.log("   npm start");
    } else {
      if (this.issues.length > 0) {
        console.log("\n❌ 发现以下问题需要解决:");
        this.issues.forEach((issue, index) => {
          console.log(`   ${index + 1}. ${issue}`);
        });
      }

      if (this.warnings.length > 0) {
        console.log("\n⚠️ 警告 (可选修复):");
        this.warnings.forEach((warning, index) => {
          console.log(`   ${index + 1}. ${warning}`);
        });
      }

      console.log("\n💡 修复建议:");

      if (this.issues.some((i) => i.includes("Chrome"))) {
        console.log("   • 运行 'npm run chrome:auto' 自动配置 Chrome");
      }

      if (this.issues.some((i) => i.includes("账号"))) {
        console.log("   • 运行 'npm run accounts:list' 查看账号配置");
        console.log("   • 编辑 config/accounts.json 添加账号");
      }

      if (this.issues.some((i) => i.includes("配置文件"))) {
        console.log("   • 检查 config/ 目录下的配置文件");
      }
    }

    console.log("\n📚 更多帮助:");
    console.log("   • Chrome 配置: npm run chrome");
    console.log("   • 账号管理: npm run accounts");
    console.log("   • 查看文档: docs/puppeteer-setup.md");
  }

  /**
   * 快速修复
   */
  async quickFix() {
    console.log("🔧 尝试快速修复常见问题...\n");

    // 自动配置 Chrome
    if (this.issues.some((i) => i.includes("Chrome")) || this.warnings.some((w) => w.includes("Chrome"))) {
      console.log("🔍 自动配置 Chrome...");
      const suggestion = await this.chromeDetector.generateConfigSuggestion();

      if (suggestion.success) {
        await this.chromeDetector.updateConfigFile(suggestion.executablePath);
        console.log("✅ Chrome 配置已修复");
      } else {
        console.log("❌ Chrome 自动配置失败，请手动配置");
      }
    }

    // 创建必要目录
    const dirs = ["data", "logs"];
    for (const dir of dirs) {
      await fs.ensureDir(path.join(process.cwd(), dir));
    }
    console.log("✅ 必要目录已创建");

    console.log("\n🔄 重新运行检查...");
    await this.runFullCheck();
  }
}

// 运行检查
async function main() {
  const args = process.argv.slice(2);
  const checker = new SetupChecker();

  if (args.includes("--fix")) {
    await checker.quickFix();
  } else {
    const success = await checker.runFullCheck();

    if (!success && args.includes("--auto-fix")) {
      console.log("\n🔧 检测到问题，尝试自动修复...");
      await checker.quickFix();
    }

    process.exit(success ? 0 : 1);
  }
}

main().catch((error) => {
  console.error("❌ 检查过程出错:", error.message);
  process.exit(1);
});
