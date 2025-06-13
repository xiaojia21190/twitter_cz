import { EventEmitter } from "events";
import { GroupMessageListener } from "./GroupMessageListener.js";

/**
 * 多群组监听管理器
 * 管理多个群组的并行监听
 */
export class MultiGroupListener extends EventEmitter {
  constructor(groupConfigs, settings) {
    super();
    this.groupConfigs = groupConfigs || [];
    this.settings = settings;
    this.groupListeners = new Map(); // 存储各个群组监听器
    this.isRunning = false;
    this.stats = {
      totalGroups: 0,
      activeGroups: 0,
      totalTweetsFound: 0,
      totalErrors: 0,
      groupStats: {},
      startTime: null,
    };
  }

  /**
   * 启动所有群组监听器
   */
  async start() {
    if (this.isRunning) {
      console.log("[MultiGroupListener] 多群组监听器已在运行中");
      return;
    }

    try {
      console.log("[MultiGroupListener] 启动多群组监听器...");
      console.log(`[MultiGroupListener] 配置了 ${this.groupConfigs.length} 个群组`);

      this.isRunning = true;
      this.stats.startTime = new Date().toISOString();
      this.stats.totalGroups = this.groupConfigs.length;

      // 过滤启用的群组
      const enabledGroups = this.groupConfigs.filter(config => config.enabled);
      console.log(`[MultiGroupListener] 启用的群组: ${enabledGroups.length} 个`);

      // 为每个启用的群组创建监听器
      const initPromises = enabledGroups.map(async (groupConfig) => {
        return await this.initializeGroupListener(groupConfig);
      });

      await Promise.all(initPromises);

      this.stats.activeGroups = this.groupListeners.size;
      console.log(`[MultiGroupListener] 多群组监听器启动成功，活跃群组: ${this.stats.activeGroups}`);
      
      this.emit("multiGroupStarted", {
        totalGroups: this.stats.totalGroups,
        activeGroups: this.stats.activeGroups,
        groupIds: Array.from(this.groupListeners.keys()),
      });
    } catch (error) {
      console.error("[MultiGroupListener] 启动失败:", error.message);
      this.isRunning = false;
      this.emit("multiGroupError", { error: error.message });
      throw error;
    }
  }

  /**
   * 初始化单个群组监听器
   */
  async initializeGroupListener(groupConfig) {
    try {
      console.log(`[MultiGroupListener] 初始化群组监听器: ${groupConfig.id} (${groupConfig.groupName || 'Unknown'})`);

      const groupListener = new GroupMessageListener(groupConfig, this.settings);
      
      // 设置事件监听
      this.setupGroupListenerEvents(groupListener, groupConfig);
      
      // 启动监听器
      await groupListener.start();
      
      // 存储监听器
      this.groupListeners.set(groupConfig.id, {
        listener: groupListener,
        config: groupConfig,
        status: "active",
        startTime: new Date().toISOString(),
      });

      // 初始化统计
      this.stats.groupStats[groupConfig.id] = {
        groupName: groupConfig.groupName || groupConfig.id,
        tweetsFound: 0,
        errors: 0,
        lastCheck: null,
        status: "active",
        priority: groupConfig.priority || 999,
      };

      console.log(`[MultiGroupListener] 群组监听器 ${groupConfig.id} 初始化成功`);
    } catch (error) {
      console.error(`[MultiGroupListener] 初始化群组监听器 ${groupConfig.id} 失败:`, error.message);
      
      // 记录失败的群组
      this.stats.groupStats[groupConfig.id] = {
        groupName: groupConfig.groupName || groupConfig.id,
        tweetsFound: 0,
        errors: 1,
        lastCheck: null,
        status: "failed",
        priority: groupConfig.priority || 999,
        error: error.message,
      };
      
      this.emit("groupInitError", { 
        groupId: groupConfig.id, 
        groupName: groupConfig.groupName,
        error: error.message 
      });
    }
  }

  /**
   * 设置群组监听器事件
   */
  setupGroupListenerEvents(groupListener, groupConfig) {
    const groupId = groupConfig.id;
    const groupName = groupConfig.groupName || groupId;

    // 新推文发现事件
    groupListener.on("newTweetsFound", (data) => {
      console.log(`[MultiGroupListener] 群组 ${groupName} 发现 ${data.tweets.length} 个新推文`);
      
      // 为推文添加群组信息
      const tweetsWithGroupInfo = data.tweets.map(tweet => ({
        ...tweet,
        sourceGroup: {
          id: groupId,
          name: groupName,
          priority: groupConfig.priority || 999,
        }
      }));

      this.stats.totalTweetsFound += data.tweets.length;
      this.stats.groupStats[groupId].tweetsFound += data.tweets.length;

      // 转发事件
      this.emit("newTweetsFound", { 
        tweets: tweetsWithGroupInfo,
        sourceGroup: { id: groupId, name: groupName }
      });
    });

    // 检查完成事件
    groupListener.on("messageCheckCompleted", (data) => {
      this.stats.groupStats[groupId].lastCheck = data.timestamp;
      
      this.emit("groupCheckCompleted", {
        groupId,
        groupName,
        ...data
      });
    });

    // 错误事件
    groupListener.on("messageCheckError", (data) => {
      console.error(`[MultiGroupListener] 群组 ${groupName} 检查错误:`, data.error);
      
      this.stats.totalErrors++;
      this.stats.groupStats[groupId].errors++;
      
      this.emit("groupCheckError", {
        groupId,
        groupName,
        ...data
      });
    });

    // 认证恢复事件
    groupListener.on("authRecovered", () => {
      console.log(`[MultiGroupListener] 群组 ${groupName} 认证已恢复`);
      this.stats.groupStats[groupId].status = "active";
      
      this.emit("groupAuthRecovered", { groupId, groupName });
    });

    // 认证失败事件
    groupListener.on("authFailed", (data) => {
      console.error(`[MultiGroupListener] 群组 ${groupName} 认证失败`);
      this.stats.groupStats[groupId].status = "auth_failed";
      
      this.emit("groupAuthFailed", { groupId, groupName, ...data });
    });

    // 监听器停止事件
    groupListener.on("listenerStopped", () => {
      console.log(`[MultiGroupListener] 群组 ${groupName} 监听器已停止`);
      this.stats.groupStats[groupId].status = "stopped";
      
      this.emit("groupStopped", { groupId, groupName });
    });
  }

  /**
   * 停止所有群组监听器
   */
  async stop() {
    if (!this.isRunning) {
      console.log("[MultiGroupListener] 多群组监听器未在运行");
      return;
    }

    try {
      console.log("[MultiGroupListener] 停止多群组监听器...");
      this.isRunning = false;

      // 停止所有群组监听器
      const stopPromises = Array.from(this.groupListeners.values()).map(async (groupData) => {
        try {
          await groupData.listener.stop();
          console.log(`[MultiGroupListener] 群组监听器 ${groupData.config.id} 已停止`);
        } catch (error) {
          console.error(`[MultiGroupListener] 停止群组监听器 ${groupData.config.id} 时出错:`, error.message);
        }
      });

      await Promise.all(stopPromises);

      // 清理资源
      this.groupListeners.clear();
      
      console.log("[MultiGroupListener] 多群组监听器已停止");
      this.emit("multiGroupStopped");
    } catch (error) {
      console.error("[MultiGroupListener] 停止多群组监听器时出错:", error.message);
      this.emit("multiGroupError", { error: error.message });
    }
  }

  /**
   * 重启特定群组监听器
   */
  async restartGroup(groupId) {
    const groupData = this.groupListeners.get(groupId);
    if (!groupData) {
      throw new Error(`群组监听器 ${groupId} 不存在`);
    }

    try {
      console.log(`[MultiGroupListener] 重启群组监听器: ${groupId}`);
      
      // 停止现有监听器
      await groupData.listener.stop();
      
      // 重新初始化
      await this.initializeGroupListener(groupData.config);
      
      console.log(`[MultiGroupListener] 群组监听器 ${groupId} 重启成功`);
      this.emit("groupRestarted", { groupId });
    } catch (error) {
      console.error(`[MultiGroupListener] 重启群组监听器 ${groupId} 失败:`, error.message);
      this.emit("groupRestartError", { groupId, error: error.message });
      throw error;
    }
  }

  /**
   * 添加新的群组监听器
   */
  async addGroup(groupConfig) {
    if (this.groupListeners.has(groupConfig.id)) {
      throw new Error(`群组监听器 ${groupConfig.id} 已存在`);
    }

    try {
      console.log(`[MultiGroupListener] 添加新群组监听器: ${groupConfig.id}`);
      
      if (this.isRunning && groupConfig.enabled) {
        await this.initializeGroupListener(groupConfig);
        this.stats.activeGroups = this.groupListeners.size;
      }
      
      // 添加到配置列表
      this.groupConfigs.push(groupConfig);
      this.stats.totalGroups = this.groupConfigs.length;
      
      console.log(`[MultiGroupListener] 群组监听器 ${groupConfig.id} 添加成功`);
      this.emit("groupAdded", { groupId: groupConfig.id, groupName: groupConfig.groupName });
    } catch (error) {
      console.error(`[MultiGroupListener] 添加群组监听器 ${groupConfig.id} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 移除群组监听器
   */
  async removeGroup(groupId) {
    const groupData = this.groupListeners.get(groupId);
    
    try {
      if (groupData) {
        console.log(`[MultiGroupListener] 移除群组监听器: ${groupId}`);
        await groupData.listener.stop();
        this.groupListeners.delete(groupId);
      }
      
      // 从配置列表中移除
      this.groupConfigs = this.groupConfigs.filter(config => config.id !== groupId);
      
      // 清理统计
      delete this.stats.groupStats[groupId];
      
      this.stats.totalGroups = this.groupConfigs.length;
      this.stats.activeGroups = this.groupListeners.size;
      
      console.log(`[MultiGroupListener] 群组监听器 ${groupId} 移除成功`);
      this.emit("groupRemoved", { groupId });
    } catch (error) {
      console.error(`[MultiGroupListener] 移除群组监听器 ${groupId} 失败:`, error.message);
      throw error;
    }
  }

  /**
   * 获取多群组监听器状态
   */
  getStatus() {
    const groupStatuses = {};
    
    for (const [groupId, groupData] of this.groupListeners) {
      groupStatuses[groupId] = {
        ...this.stats.groupStats[groupId],
        listenerStatus: groupData.listener.getStatus(),
        config: {
          groupName: groupData.config.groupName,
          priority: groupData.config.priority,
          polling_interval: groupData.config.polling_interval,
          enabled: groupData.config.enabled,
        }
      };
    }

    return {
      isRunning: this.isRunning,
      stats: this.stats,
      groups: groupStatuses,
      summary: {
        totalGroups: this.stats.totalGroups,
        activeGroups: this.stats.activeGroups,
        totalTweetsFound: this.stats.totalTweetsFound,
        totalErrors: this.stats.totalErrors,
        uptime: this.stats.startTime ? Date.now() - new Date(this.stats.startTime).getTime() : 0,
      }
    };
  }

  /**
   * 获取群组优先级排序
   */
  getGroupsByPriority() {
    return Array.from(this.groupListeners.values())
      .sort((a, b) => (a.config.priority || 999) - (b.config.priority || 999))
      .map(groupData => ({
        id: groupData.config.id,
        name: groupData.config.groupName,
        priority: groupData.config.priority,
        status: this.stats.groupStats[groupData.config.id]?.status || 'unknown'
      }));
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats.totalTweetsFound = 0;
    this.stats.totalErrors = 0;
    
    for (const groupId in this.stats.groupStats) {
      this.stats.groupStats[groupId].tweetsFound = 0;
      this.stats.groupStats[groupId].errors = 0;
    }
    
    console.log("[MultiGroupListener] 统计信息已重置");
  }
}
