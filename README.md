# Twitter监控系统

基于Rettiwt-API构建的Twitter私信群组监控系统，通过通知轮询机制监听群组中分享的推文，自动生成AI回复。

## 功能特性

- 🔍 **多账户监控**: 支持同时监控多个Twitter账户
- 🌐 **多群组支持**: 同时监听多个群组，支持优先级管理
- 🎯 **智能负载均衡**: 多账号轮换评论，避免单账号限制
- 🤖 **AI自动回复**: 集成OpenAI生成智能回复内容
- 📱 **群组消息识别**: 智能识别私信群组中的推文分享
- ⚡ **实时监控**: 可配置轮询间隔，及时响应新消息
- 🔄 **去重机制**: 避免重复处理同一推文
- 📊 **状态监控**: 实时显示系统运行状态和统计信息
- 🛡️ **错误恢复**: 自动重连和错误重试机制
- 🛠️ **命令行管理**: 便捷的账号和群组管理工具

## 技术栈

- **Node.js** >= 18.0.0
- **Rettiwt-API** v5.0.1 - Twitter交互
- **axios** - HTTP客户端
- **node-cron** - 任务调度
- **fs-extra** - 文件系统操作

## 项目结构

```
twitter_monitor/
├── src/
│   ├── auth/              # 认证管理
│   │   └── RettwitAuth.js
│   ├── notification/      # 通知处理
│   │   └── NotificationProcessor.js
│   ├── ai/               # AI回复生成
│   │   └── OpenAIClient.js
│   ├── scheduler/        # 任务调度
│   │   └── MonitorScheduler.js
│   ├── config/           # 配置管理
│   │   └── ConfigLoader.js
│   ├── index.js          # 应用入口
│   └── test.js           # 测试套件
├── config/               # 配置文件
│   ├── accounts.json     # 账户配置
│   └── settings.json     # 应用设置
├── data/                 # 数据存储
├── logs/                 # 日志文件
├── issues/               # 项目记录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置 Chrome 路径（重要）

本项目使用 `puppeteer-core`，需要配置 Chrome 浏览器路径：

```bash
# 自动检测并配置 Chrome 路径（推荐）
npm run chrome:auto

# 或手动检测 Chrome 路径
npm run chrome:detect

# 验证配置
npm run chrome:config
```

详细配置说明请参考：[Puppeteer 配置指南](docs/puppeteer-setup.md)

### 3. 配置系统

#### 配置OpenAI代理（必需）

编辑 `config/settings.json` 中的OpenAI配置：

```json
{
  "openai": {
    "proxy_url": "http://your-openai-proxy.com/v1",
    "api_key": "your-openai-api-key",
    "model": "gpt-3.5-turbo"
  }
}
```

或通过环境变量：

```bash
export OPENAI_PROXY_URL="http://your-openai-proxy.com/v1"
export OPENAI_API_KEY="your-openai-api-key"
```

#### 配置Twitter账户（已预配置）

账户配置已包含在 `config/accounts.json` 中：
- 5个Twitter账户的认证令牌
- 2个S5代理服务器配置
- 个性化轮询间隔设置

### 3. 测试配置

```bash
# 运行配置测试
npm run test

# 或
node src/test.js
```

### 4. 启动系统

```bash
# 生产模式
npm start

# 或开发模式
npm run dev
```

## 使用指南

### 命令行选项

```bash
# 显示帮助
node src/index.js --help

# 查看版本
node src/index.js --version

# 测试配置
node src/index.js --test

# 启动监控
node src/index.js
```

### 多群组管理

系统支持同时监听多个群组，每个群组使用独立的监控账号：

```bash
# 查看所有群组
npm run groups:list

# 添加新群组
npm run accounts group-add <id> <token> <url> <name>

# 更新群组配置
npm run accounts group-update <id> <字段=值>

# 删除群组
npm run accounts group-remove <id>

# 更新群组链接
npm run accounts group-url <groupId> <url>
```

**示例**：
```bash
# 添加主要群组
npm run accounts group-add main_group "auth_token=your_token" "https://x.com/messages/123456" "主要交流群"

# 设置优先级
npm run accounts group-update main_group priority=1

# 调整轮询间隔
npm run accounts group-update main_group polling_interval=30000
```

详细配置说明请参考：[多群组配置指南](docs/multi-group-setup.md)

### 代理配置管理

系统支持为每个账号配置独立的代理，提高稳定性和避免IP限制：

```bash
# 查看所有代理配置
npm run proxy:list

# 为所有账号设置代理
npm run proxy:set-all "http://127.0.0.1:7890"

# 为特定账号设置代理
npm run proxy set-account account_1 "http://127.0.0.1:7890"

# 测试代理连接
npm run proxy:test "http://127.0.0.1:7890"
```

详细配置说明请参考：[代理配置指南](docs/proxy-setup.md)

### 环境变量

| 变量名                     | 说明             | 默认值     |
| -------------------------- | ---------------- | ---------- |
| `OPENAI_PROXY_URL`         | OpenAI代理地址   | 配置文件值 |
| `OPENAI_API_KEY`           | OpenAI API密钥   | 配置文件值 |
| `LOG_LEVEL`                | 日志级别         | info       |
| `DEFAULT_POLLING_INTERVAL` | 默认轮询间隔(ms) | 30000      |

### 监控机制说明

系统通过以下方式工作：

1. **通知轮询**: 定期获取各账户的Twitter通知
2. **群组识别**: 过滤出来自私信群组的通知
3. **推文提取**: 从通知中提取分享的推文URL
4. **去重处理**: 避免重复处理同一推文
5. **AI回复**: 调用OpenAI生成智能回复内容
6. **自动发送**: 将AI生成的回复发送到原推文

### 配置文件详解

#### accounts.json

```json
{
  "accounts": [
    {
      "id": "account_1",
      "authToken": "your-auth-token",
      "proxy": {
        "host": "proxy-host",
        "port": 15308,
        "username": "proxy-user",
        "password": "proxy-pass",
        "protocol": "http"
      },
      "enabled": true,
      "polling_interval": 30000
    }
  ]
}
```

#### settings.json

```json
{
  "openai": {
    "proxy_url": "http://your-openai-proxy.com/v1",
    "api_key": "your-api-key",
    "model": "gpt-3.5-turbo",
    "max_tokens": 280,
    "temperature": 0.7
  },
  "monitoring": {
    "tweet_url_regex": "正则表达式",
    "processed_tweets_file": "data/processed_tweets.json",
    "max_processed_tweets_cache": 10000
  },
  "notifications": {
    "filter_keywords": ["群聊", "group", "dm", "私信"],
    "ignore_own_tweets": true,
    "min_tweet_age_seconds": 60
  }
}
```

## 监控状态

系统运行时会定期显示状态信息：

```
[15:30:25] 运行中 | 活跃账户: 5/5 | 运行时间: 45分钟 | 总轮询: 150 | 回复: 12

📈 系统状态报告:
   运行时间: 45 分钟
   活跃账户: 5/5
   总轮询次数: 150
   总通知数: 1,245
   发现推文: 23
   发送回复: 12
   错误次数: 0

📱 账户状态:
   account_1: active (最后轮询: 15:30:20)
   account_2: active (最后轮询: 15:30:18)
   ...
```

## 故障排除

### 常见问题

1. **认证失败**
   - 检查authToken是否有效
   - 确认代理配置正确
   - 验证网络连接

2. **OpenAI API错误**
   - 确认代理URL可访问
   - 检查API密钥格式
   - 验证模型名称正确

3. **通知获取失败**
   - 当前Rettiwt-API版本可能不支持直接的通知接口
   - 系统会尝试使用替代方案

### 日志查看

系统日志存储在 `logs/` 目录下：

```bash
# 查看最新日志
tail -f logs/twitter-monitor.log

# 查看错误日志
grep ERROR logs/twitter-monitor.log
```

## 开发说明

### 技术限制

目前Rettiwt-API v5.0.1的已知限制：

1. **DM功能**: 缺乏完整的私信群组监控API
2. **通知接口**: 通知接口可能不包含完整的群组消息信息
3. **解决方案**: 系统使用通知轮询+关键词过滤的变通方案

### 扩展开发

如需扩展功能，可以：

1. **增强通知处理**: 改进群组消息识别逻辑
2. **优化AI回复**: 调整提示词和回复策略
3. **添加新功能**: 支持媒体文件、表情回应等
4. **监控界面**: 开发Web控制台

### 贡献指南

1. Fork项目仓库
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

MIT License

## 支持

如遇问题，请：

1. 查看日志文件
2. 运行测试套件
3. 检查配置文件
4. 提交Issue报告

---

**注意**: 本系统需要有效的Twitter账户认证和OpenAI API访问权限。请确保遵守相关服务的使用条款。
