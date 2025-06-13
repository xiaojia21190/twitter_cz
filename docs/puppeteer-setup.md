# Puppeteer-Core 配置指南

本项目已升级为使用 `puppeteer-core`，需要手动配置 Chrome 浏览器路径。

## 🔧 快速设置

### 1. 自动检测并配置（推荐）

```bash
npm run chrome:auto
```

这个命令会：
- 自动检测系统中的 Chrome 安装
- 验证 Chrome 版本
- 自动更新配置文件

### 2. 手动检测 Chrome 路径

```bash
npm run chrome:detect
```

查看所有可能的 Chrome 安装路径和版本信息。

### 3. 验证特定路径

```bash
npm run chrome validate "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 4. 手动设置路径

```bash
npm run chrome set "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

### 5. 查看当前配置

```bash
npm run chrome:config
```

## 📍 常见 Chrome 路径

### Windows
```
C:\Program Files\Google\Chrome\Application\chrome.exe
C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe
```

### macOS
```
/Applications/Google Chrome.app/Contents/MacOS/Google Chrome
/Applications/Chromium.app/Contents/MacOS/Chromium
```

### Linux
```
/usr/bin/google-chrome
/usr/bin/google-chrome-stable
/usr/bin/chromium
/usr/bin/chromium-browser
/snap/bin/chromium
```

## 🛠️ 手动配置

如果自动检测失败，可以手动编辑 `config/settings.json`：

```json
{
  "puppeteer": {
    "executablePath": "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "headless": true,
    "timeout": 50000,
    "args": [
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
```

## 📦 安装 Chrome

如果系统中没有 Chrome，请按以下方式安装：

### Windows
```bash
# 使用 winget
winget install Google.Chrome

# 或从官网下载
# https://www.google.com/chrome/
```

### macOS
```bash
# 使用 Homebrew
brew install --cask google-chrome

# 或从官网下载
# https://www.google.com/chrome/
```

### Linux (Ubuntu/Debian)
```bash
# 添加 Google 仓库
wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | sudo apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list

# 安装
sudo apt update
sudo apt install google-chrome-stable
```

### Linux (CentOS/RHEL)
```bash
# 添加仓库
sudo tee /etc/yum.repos.d/google-chrome.repo <<EOF
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF

# 安装
sudo yum install google-chrome-stable
```

## 🔍 故障排除

### 1. Chrome 路径错误
```bash
# 检测所有可能的路径
npm run chrome:detect

# 验证特定路径
npm run chrome validate "你的Chrome路径"
```

### 2. 权限问题
确保 Chrome 可执行文件有执行权限：

```bash
# Linux/macOS
chmod +x /usr/bin/google-chrome

# Windows - 以管理员身份运行命令提示符
```

### 3. 版本兼容性
确保使用的是较新版本的 Chrome（建议 90+ 版本）。

### 4. 网络代理问题
如果在企业网络环境中，可能需要配置代理：

```json
{
  "puppeteer": {
    "args": [
      "--proxy-server=http://your-proxy:port",
      "--no-sandbox",
      "--disable-setuid-sandbox"
    ]
  }
}
```

## 🧪 测试配置

配置完成后，可以运行测试验证：

```bash
# 测试 Puppeteer 功能
npm run test:puppeteer

# 测试增强认证
npm run test:enhanced

# 完整系统测试
npm test
```

## 📝 配置选项说明

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `executablePath` | Chrome 可执行文件路径 | 自动检测 |
| `headless` | 是否无头模式运行 | `true` |
| `timeout` | 页面加载超时时间(ms) | `50000` |
| `args` | Chrome 启动参数 | 见配置文件 |

## 🔄 升级说明

从 `puppeteer` 升级到 `puppeteer-core` 的主要变化：

1. **不再自动下载 Chrome**：需要手动指定 Chrome 路径
2. **更小的包体积**：不包含 Chrome 二进制文件
3. **更好的控制**：可以使用系统已安装的 Chrome
4. **更稳定**：避免了 Chrome 版本冲突问题

## 💡 最佳实践

1. **使用系统 Chrome**：推荐使用系统已安装的 Chrome 而不是下载独立版本
2. **定期更新**：保持 Chrome 版本更新以获得最佳兼容性
3. **备份配置**：在修改配置前先备份 `config/settings.json`
4. **测试验证**：每次修改配置后都要测试功能是否正常

## 🆘 获取帮助

如果遇到问题，可以：

1. 运行 `npm run chrome` 查看帮助信息
2. 检查 Chrome 是否正确安装
3. 验证配置文件格式是否正确
4. 查看系统日志获取详细错误信息
