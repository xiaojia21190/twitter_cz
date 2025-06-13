# 多群组监听配置指南

本指南将帮助您配置和管理多个群组的监听功能。

## 🎯 **多群组监听方案**

### **方案1：多个群组监控账号（推荐）**
每个群组使用独立的监控账号，可以并行监听，提供最佳性能和稳定性。

### **方案2：单账号多群组轮询**
使用一个账号轮询监听多个群组（暂未实现）。

### **方案3：混合模式**
重要群组使用独立账号，其他群组共享账号（暂未实现）。

## 📋 **配置文件结构**

### **新的多群组配置格式**

```json
{
  "groupMonitorAccounts": [
    {
      "id": "group_monitor_1",
      "authToken": "your_token_here",
      "description": "主要群组监控账号",
      "type": "group_monitor",
      "enabled": true,
      "polling_interval": 60000,
      "features": ["notifications", "group_activity", "timeline_monitoring"],
      "groupMessageUrl": "https://x.com/messages/1933360709339131974",
      "groupName": "主要交流群",
      "priority": 1,
      "saveEnhancedToken": true
    },
    {
      "id": "group_monitor_2",
      "authToken": "your_second_token_here",
      "description": "第二个群组监控账号",
      "type": "group_monitor",
      "enabled": true,
      "polling_interval": 90000,
      "features": ["notifications", "group_activity"],
      "groupMessageUrl": "https://x.com/messages/your_second_group_id",
      "groupName": "备用交流群",
      "priority": 2,
      "saveEnhancedToken": true
    }
  ],
  "accounts": [
    // 评论账号配置保持不变
  ]
}
```

### **配置字段说明**

| 字段 | 说明 | 必需 | 默认值 |
|------|------|------|--------|
| `id` | 群组监控账号唯一标识 | ✅ | - |
| `authToken` | 账号认证Token | ✅ | - |
| `groupMessageUrl` | 群组消息链接 | ✅ | - |
| `groupName` | 群组显示名称 | ❌ | `群组 ${id}` |
| `enabled` | 是否启用 | ❌ | `true` |
| `polling_interval` | 轮询间隔(ms) | ❌ | `60000` |
| `priority` | 优先级(数字越小优先级越高) | ❌ | `999` |
| `description` | 账号描述 | ❌ | - |
| `features` | 支持的功能列表 | ❌ | `["notifications"]` |
| `saveEnhancedToken` | 是否保存增强Token | ❌ | `true` |

## 🛠️ **命令行管理**

### **查看群组列表**

```bash
# 查看所有群组
npm run groups:list

# 或使用完整命令
npm run accounts group-list
```

### **添加群组监控账号**

```bash
# 基本用法
npm run accounts group-add <id> <token> <url> <name>

# 示例
npm run accounts group-add group_3 "auth_token=your_token" "https://x.com/messages/123456" "测试群组"
```

### **更新群组配置**

```bash
# 更新轮询间隔
npm run accounts group-update group_1 polling_interval=45000

# 更新优先级
npm run accounts group-update group_2 priority=1

# 更新群组名称
npm run accounts group-update group_3 groupName="新的群组名称"

# 启用/禁用群组
npm run accounts group-update group_1 enabled=true
npm run accounts group-update group_2 enabled=false
```

### **删除群组监控账号**

```bash
npm run accounts group-remove group_3
```

### **更新群组链接**

```bash
npm run accounts group-url group_1 "https://x.com/messages/new_group_id"
```

## 🚀 **快速设置示例**

### **1. 添加第一个群组**

```bash
npm run accounts group-add main_group "auth_token=your_main_token" "https://x.com/messages/1933360709339131974" "主要交流群"
```

### **2. 添加第二个群组**

```bash
npm run accounts group-add backup_group "auth_token=your_backup_token" "https://x.com/messages/1234567890" "备用群组"
```

### **3. 设置优先级**

```bash
# 主要群组设为最高优先级
npm run accounts group-update main_group priority=1

# 备用群组设为较低优先级
npm run accounts group-update backup_group priority=2
```

### **4. 调整轮询间隔**

```bash
# 主要群组更频繁检查
npm run accounts group-update main_group polling_interval=30000

# 备用群组较少检查
npm run accounts group-update backup_group polling_interval=120000
```

## 📊 **监控和状态**

### **查看系统状态**

```bash
# 完整系统检查
npm run setup

# 查看所有账号状态
npm run accounts:list
```

### **运行时监控**

启动系统后，您将看到类似输出：

```
🔄 初始化多群组监听器...
📊 配置的群组数量: 2, 启用的群组: 2
✅ 多群组监听器初始化完成
📊 活跃群组: 2/2
   • 主要交流群 (main_group) - 优先级: 1, 状态: active
   • 备用群组 (backup_group) - 优先级: 2, 状态: active
```

### **日志监控**

系统会为每个群组生成独立的日志：

```
[MultiGroupListener] 群组 主要交流群 发现 3 个新推文
[MultiGroupListener] 群组 备用群组 发现 1 个新推文
```

## 🔧 **高级配置**

### **优先级策略**

- **优先级 1-10**: 高优先级群组，重要消息源
- **优先级 11-50**: 中等优先级群组，常规监控
- **优先级 51+**: 低优先级群组，备用或测试

### **轮询间隔建议**

- **高活跃群组**: 30-60秒
- **中等活跃群组**: 60-120秒
- **低活跃群组**: 120-300秒

### **性能优化**

1. **合理设置轮询间隔**：避免过于频繁的检查
2. **优先级排序**：重要群组设置更高优先级
3. **禁用不需要的群组**：临时禁用而不删除配置

## 🔄 **从单群组迁移**

如果您之前使用单群组配置，系统会自动兼容：

### **自动迁移**

系统启动时会自动检测旧配置并转换：

```
🔄 检测到旧的单群组配置，自动转换为多群组格式
```

### **手动迁移**

您也可以手动迁移配置：

1. **备份现有配置**：
```bash
npm run accounts:backup
```

2. **添加新的群组配置**：
```bash
npm run accounts group-add migrated_group "your_old_token" "your_old_url" "迁移的群组"
```

3. **验证配置**：
```bash
npm run groups:list
```

## 🛡️ **故障排除**

### **常见问题**

1. **群组监听器启动失败**
   - 检查Token是否有效
   - 验证群组链接是否正确
   - 确认网络连接正常

2. **部分群组无法监听**
   - 检查账号权限
   - 验证群组是否存在
   - 查看错误日志

3. **性能问题**
   - 调整轮询间隔
   - 减少同时监听的群组数量
   - 检查系统资源使用

### **调试命令**

```bash
# 检查系统配置
npm run setup

# 验证Chrome配置
npm run chrome:config

# 查看详细状态
npm run accounts:list
```

## 📈 **最佳实践**

1. **群组分类管理**：按重要性和活跃度分类
2. **合理设置优先级**：重要群组优先级更高
3. **定期检查状态**：监控群组监听器健康状态
4. **备份配置**：定期备份账号配置
5. **逐步扩展**：从少数群组开始，逐步增加

## 🔮 **未来功能**

- [ ] 群组监听器负载均衡
- [ ] 智能轮询间隔调整
- [ ] 群组活跃度分析
- [ ] 自动故障恢复
- [ ] Web管理界面

## 💡 **技巧和建议**

1. **测试新群组**：先禁用状态添加，测试无误后启用
2. **监控资源使用**：过多群组可能影响性能
3. **合理分配Token**：避免单个账号负载过重
4. **定期更新Token**：保持账号认证有效性
