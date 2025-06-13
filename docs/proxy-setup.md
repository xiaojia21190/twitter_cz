# 代理配置指南

本指南将帮助您为 Twitter 监控系统配置代理，提高系统稳定性和避免IP限制。

## 🎯 **为什么需要代理**

1. **避免IP限制**: Twitter对单个IP的请求频率有限制
2. **提高稳定性**: 分散请求来源，减少被封禁风险
3. **地理位置**: 某些地区可能需要代理访问Twitter
4. **负载分散**: 多账号使用不同代理，提高并发性能

## 📋 **代理配置结构**

### **配置文件格式**

每个账号都可以配置独立的代理：

```json
{
  "groupMonitorAccounts": [
    {
      "id": "group_monitor_1",
      "authToken": "your_token_here",
      "proxyUrl": "http://127.0.0.1:7890",
      "groupMessageUrl": "https://x.com/messages/123456",
      "groupName": "主要交流群"
    }
  ],
  "accounts": [
    {
      "id": "account_1",
      "authToken": "your_token_here",
      "proxyUrl": "http://127.0.0.1:7890",
      "enabled": true
    }
  ]
}
```

### **支持的代理格式**

- **HTTP代理**: `http://proxy-server:port`
- **HTTPS代理**: `https://proxy-server:port`
- **带认证的代理**: `http://username:password@proxy-server:port`

## 🛠️ **命令行管理**

### **查看代理配置**

```bash
# 查看所有账号的代理配置
npm run proxy:list

# 或使用完整命令
npm run proxy list
```

### **设置代理**

```bash
# 为所有账号设置相同代理
npm run proxy:set-all "http://127.0.0.1:7890"

# 为特定评论账号设置代理
npm run proxy set-account account_1 "http://127.0.0.1:7890"

# 为特定群组账号设置代理
npm run proxy set-group group_monitor_1 "http://127.0.0.1:7890"
```

### **测试代理**

```bash
# 测试代理连接
npm run proxy:test "http://127.0.0.1:7890"
```

### **清除代理**

```bash
# 清除特定账号的代理
npm run proxy clear account_1

# 清除所有账号的代理
npm run proxy clear-all
```

## 🚀 **快速设置示例**

### **1. 设置本地代理**

如果您使用本地代理软件（如 Clash、V2Ray 等）：

```bash
# 设置所有账号使用本地代理
npm run proxy:set-all "http://127.0.0.1:7890"

# 测试代理连接
npm run proxy:test "http://127.0.0.1:7890"
```

### **2. 设置不同代理**

为不同账号设置不同代理以分散负载：

```bash
# 群组监控账号使用代理1
npm run proxy set-group group_monitor_1 "http://proxy1.example.com:8080"

# 评论账号使用代理2
npm run proxy set-account account_1 "http://proxy2.example.com:8080"
npm run proxy set-account account_2 "http://proxy3.example.com:8080"
```

### **3. 带认证的代理**

```bash
# 设置需要用户名密码的代理
npm run proxy:set-all "http://username:password@proxy.example.com:8080"
```

## 📊 **代理状态监控**

### **查看代理配置状态**

运行 `npm run proxy:list` 会显示：

```
=== 代理配置列表 ===

📡 群组监控账号:
1. group_monitor_1 (主要交流群)
   代理: http://127.0.0.1:7890
   状态: ✅ 启用

💬 评论账号:
1. account_1
   代理: http://127.0.0.1:7890
   状态: ✅ 启用

📊 代理配置统计:
   总账号数: 6
   已配置代理: 6
   未配置代理: 0
```

### **系统检查**

```bash
# 完整系统检查（包括代理配置）
npm run setup

# 查看账号详细信息
npm run accounts:list
```

## 🔧 **常见代理软件配置**

### **Clash**

默认本地代理端口：`7890`

```bash
npm run proxy:set-all "http://127.0.0.1:7890"
```

### **V2Ray**

默认本地代理端口：`1080` (SOCKS) 或 `8080` (HTTP)

```bash
# HTTP代理
npm run proxy:set-all "http://127.0.0.1:8080"

# 如果只有SOCKS代理，需要转换为HTTP
```

### **Shadowsocks**

通常需要配合本地HTTP代理工具：

```bash
# 使用Privoxy等工具转换SOCKS为HTTP
npm run proxy:set-all "http://127.0.0.1:8118"
```

## 🛡️ **故障排除**

### **代理连接失败**

1. **检查代理服务状态**：
```bash
npm run proxy:test "your_proxy_url"
```

2. **常见错误及解决方案**：

- `ECONNREFUSED`: 代理服务未运行或端口错误
- `ETIMEDOUT`: 网络连接超时或代理服务器无响应
- `407 Proxy Authentication Required`: 代理需要认证

### **性能问题**

1. **代理响应慢**：
   - 测试代理延迟：`npm run proxy:test`
   - 更换更快的代理服务器
   - 选择地理位置更近的代理

2. **请求失败率高**：
   - 检查代理稳定性
   - 为不同账号配置不同代理
   - 调整轮询间隔

### **配置验证**

```bash
# 检查所有配置
npm run setup

# 查看代理配置
npm run proxy:list

# 测试特定代理
npm run proxy:test "http://your-proxy:port"
```

## 📈 **最佳实践**

### **1. 代理分配策略**

- **高优先级群组**: 使用最稳定的代理
- **评论账号**: 分散使用不同代理
- **测试账号**: 使用备用代理

### **2. 监控和维护**

- 定期测试代理连接
- 监控账号状态和错误率
- 及时更换失效的代理

### **3. 安全考虑**

- 使用可信的代理服务
- 避免在代理URL中暴露敏感信息
- 定期更换代理配置

## 🔄 **配置更新**

### **批量更新**

```bash
# 备份当前配置
npm run accounts:backup

# 批量设置新代理
npm run proxy:set-all "http://new-proxy:port"

# 验证配置
npm run proxy:list
```

### **逐步迁移**

```bash
# 先更新群组账号
npm run proxy set-group group_monitor_1 "http://new-proxy:port"

# 逐个更新评论账号
npm run proxy set-account account_1 "http://new-proxy:port"
npm run proxy set-account account_2 "http://new-proxy:port"
```

## 💡 **高级配置**

### **负载均衡**

为不同账号配置不同代理实现负载均衡：

```bash
# 脚本示例：轮换代理配置
for i in {1..5}; do
  proxy_port=$((7890 + i))
  npm run proxy set-account "account_$i" "http://127.0.0.1:$proxy_port"
done
```

### **故障转移**

配置备用代理，当主代理失效时自动切换（需要自定义脚本）。

## 🆘 **获取帮助**

如果遇到代理配置问题：

1. 查看代理管理工具帮助：`npm run proxy`
2. 测试代理连接：`npm run proxy:test`
3. 检查系统配置：`npm run setup`
4. 查看系统日志获取详细错误信息

## 📝 **配置模板**

### **单代理配置**

所有账号使用相同代理：

```bash
npm run proxy:set-all "http://127.0.0.1:7890"
```

### **多代理配置**

不同账号使用不同代理：

```bash
npm run proxy set-group group_monitor_1 "http://proxy1:port"
npm run proxy set-account account_1 "http://proxy2:port"
npm run proxy set-account account_2 "http://proxy3:port"
```

### **无代理配置**

清除所有代理配置：

```bash
npm run proxy clear-all
```

---

**注意**: 代理配置会影响所有网络请求，包括 Puppeteer 和 Rettiwt-API 的请求。请确保代理服务稳定可靠。
