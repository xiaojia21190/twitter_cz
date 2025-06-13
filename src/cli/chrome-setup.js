#!/usr/bin/env node

import { ChromePathDetector } from "../utils/ChromePathDetector.js";

/**
 * Chrome路径设置命令行工具
 */
class ChromeSetupCLI {
  constructor() {
    this.detector = new ChromePathDetector();
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
Twitter监控系统 - Chrome路径设置工具

用法:
  node src/cli/chrome-setup.js <命令> [选项]

命令:
  detect                  自动检测Chrome路径
  validate <path>         验证指定的Chrome路径
  set <path>              设置Chrome路径到配置文件
  auto                    自动检测并设置推荐路径
  help                    显示帮助信息

示例:
  # 自动检测Chrome路径
  node src/cli/chrome-setup.js detect

  # 验证Chrome路径
  node src/cli/chrome-setup.js validate "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

  # 设置Chrome路径
  node src/cli/chrome-setup.js set "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"

  # 自动检测并设置
  node src/cli/chrome-setup.js auto
`);
  }

  /**
   * 检测Chrome路径
   */
  async detectChrome() {
    console.log("🔍 正在检测Chrome安装路径...\n");
    
    try {
      const results = await this.detector.detectAllPaths();
      const validPaths = results.filter(r => r.exists && r.valid);
      const existingPaths = results.filter(r => r.exists);

      console.log("\n📊 检测结果:");
      console.log(`总共检查: ${results.length} 个路径`);
      console.log(`找到文件: ${existingPaths.length} 个`);
      console.log(`有效Chrome: ${validPaths.length} 个\n`);

      if (validPaths.length > 0) {
        console.log("✅ 找到的有效Chrome路径:");
        validPaths.forEach((result, index) => {
          console.log(`${index + 1}. ${result.path}`);
          console.log(`   版本: ${result.version}`);
          console.log("");
        });

        const recommended = validPaths[0];
        console.log(`🎯 推荐使用: ${recommended.path}`);
        console.log(`   版本: ${recommended.version}`);
      } else if (existingPaths.length > 0) {
        console.log("⚠️ 找到文件但无法验证版本:");
        existingPaths.forEach((result, index) => {
          console.log(`${index + 1}. ${result.path}`);
        });
      } else {
        console.log("❌ 未找到Chrome安装");
        console.log("\n💡 安装建议:");
        const suggestions = this.detector.getInstallSuggestions();
        suggestions.forEach(suggestion => {
          console.log(`   • ${suggestion}`);
        });
      }
    } catch (error) {
      console.error("❌ 检测失败:", error.message);
    }
  }

  /**
   * 验证Chrome路径
   */
  async validateChrome(chromePath) {
    console.log(`🔍 验证Chrome路径: ${chromePath}\n`);
    
    try {
      const result = await this.detector.validatePath(chromePath);
      
      if (result.valid) {
        console.log("✅ 验证成功!");
        console.log(`   路径: ${chromePath}`);
        console.log(`   版本: ${result.version}`);
        console.log(`   消息: ${result.message}`);
      } else {
        console.log("❌ 验证失败!");
        console.log(`   消息: ${result.message}`);
      }
    } catch (error) {
      console.error("❌ 验证过程出错:", error.message);
    }
  }

  /**
   * 设置Chrome路径
   */
  async setChrome(chromePath) {
    console.log(`⚙️ 设置Chrome路径: ${chromePath}\n`);
    
    try {
      const result = await this.detector.updateConfigFile(chromePath);
      
      if (result.success) {
        console.log("✅ 设置成功!");
        console.log(`   ${result.message}`);
        console.log(`   版本: ${result.version}`);
        console.log("\n📝 配置文件已更新: config/settings.json");
      } else {
        console.log("❌ 设置失败!");
        console.log(`   ${result.message}`);
      }
    } catch (error) {
      console.error("❌ 设置过程出错:", error.message);
    }
  }

  /**
   * 自动检测并设置
   */
  async autoSetup() {
    console.log("🚀 自动检测并设置Chrome路径...\n");
    
    try {
      const suggestion = await this.detector.generateConfigSuggestion();
      
      if (suggestion.success) {
        console.log("✅ 找到推荐的Chrome路径:");
        console.log(`   路径: ${suggestion.executablePath}`);
        console.log(`   版本: ${suggestion.version}`);
        
        console.log("\n⚙️ 正在更新配置文件...");
        const updateResult = await this.detector.updateConfigFile(suggestion.executablePath);
        
        if (updateResult.success) {
          console.log("✅ 自动设置完成!");
          console.log("📝 配置文件已更新: config/settings.json");
          console.log("\n🎉 现在可以正常使用Puppeteer功能了!");
        } else {
          console.log("❌ 更新配置文件失败:");
          console.log(`   ${updateResult.message}`);
        }
      } else {
        console.log("❌ 自动设置失败:");
        console.log(`   ${suggestion.message}`);
        console.log("\n💡 建议:");
        suggestion.suggestions.forEach(s => {
          console.log(`   • ${s}`);
        });
      }
    } catch (error) {
      console.error("❌ 自动设置过程出错:", error.message);
    }
  }

  /**
   * 显示当前配置
   */
  async showCurrentConfig() {
    try {
      const fs = await import('fs-extra');
      const path = await import('path');
      const configPath = path.join(process.cwd(), 'config', 'settings.json');
      
      if (await fs.pathExists(configPath)) {
        const config = await fs.readJson(configPath);
        
        console.log("📋 当前Puppeteer配置:");
        if (config.puppeteer) {
          console.log(`   Chrome路径: ${config.puppeteer.executablePath || '未设置'}`);
          console.log(`   无头模式: ${config.puppeteer.headless !== false ? '启用' : '禁用'}`);
          console.log(`   超时时间: ${config.puppeteer.timeout || '默认'}ms`);
          
          if (config.puppeteer.executablePath) {
            console.log("\n🔍 验证当前配置的Chrome路径...");
            await this.validateChrome(config.puppeteer.executablePath);
          }
        } else {
          console.log("   未配置Puppeteer设置");
        }
      } else {
        console.log("❌ 配置文件不存在: config/settings.json");
      }
    } catch (error) {
      console.error("❌ 读取配置失败:", error.message);
    }
  }

  /**
   * 运行CLI
   */
  async run() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
      this.showHelp();
      return;
    }

    const command = args[0];

    try {
      switch (command) {
        case 'detect':
          await this.detectChrome();
          break;

        case 'validate':
          if (args.length < 2) {
            console.error("❌ 用法: validate <chrome路径>");
            return;
          }
          await this.validateChrome(args[1]);
          break;

        case 'set':
          if (args.length < 2) {
            console.error("❌ 用法: set <chrome路径>");
            return;
          }
          await this.setChrome(args[1]);
          break;

        case 'auto':
          await this.autoSetup();
          break;

        case 'config':
          await this.showCurrentConfig();
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
const cli = new ChromeSetupCLI();
cli.run().catch(error => {
  console.error("❌ CLI运行失败:", error.message);
  process.exit(1);
});
