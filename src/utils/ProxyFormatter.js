/**
 * 代理格式转换工具
 * 支持多种代理格式的解析和转换
 */
export class ProxyFormatter {
  /**
   * 解析代理字符串
   * 支持多种格式：
   * - http://127.0.0.1:7890
   * - http://username:password@proxy.com:8080
   * - 142.173.139.108:15308:E3oeIbOnIC:qIEmVMinlF (IP:端口:用户名:密码)
   * - proxy.com:8080:username:password
   */
  static parseProxy(proxyString) {
    if (!proxyString) {
      return null;
    }

    // 如果已经是标准URL格式，直接返回
    if (proxyString.startsWith('http://') || proxyString.startsWith('https://')) {
      try {
        const url = new URL(proxyString);
        return {
          protocol: url.protocol.replace(':', ''),
          host: url.hostname,
          port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
          username: url.username || null,
          password: url.password || null,
          url: proxyString
        };
      } catch (error) {
        throw new Error(`无效的代理URL格式: ${proxyString}`);
      }
    }

    // 解析 IP:端口:用户名:密码 格式
    const parts = proxyString.split(':');
    
    if (parts.length === 2) {
      // 格式: host:port
      const [host, port] = parts;
      return {
        protocol: 'http',
        host: host.trim(),
        port: parseInt(port.trim()),
        username: null,
        password: null,
        url: `http://${host.trim()}:${port.trim()}`
      };
    } else if (parts.length === 4) {
      // 格式: host:port:username:password
      const [host, port, username, password] = parts;
      const cleanHost = host.trim();
      const cleanPort = port.trim();
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      
      return {
        protocol: 'http',
        host: cleanHost,
        port: parseInt(cleanPort),
        username: cleanUsername,
        password: cleanPassword,
        url: `http://${encodeURIComponent(cleanUsername)}:${encodeURIComponent(cleanPassword)}@${cleanHost}:${cleanPort}`
      };
    } else {
      throw new Error(`不支持的代理格式: ${proxyString}。支持的格式: http://host:port 或 host:port:username:password`);
    }
  }

  /**
   * 转换为标准URL格式
   */
  static toStandardUrl(proxyString) {
    const parsed = this.parseProxy(proxyString);
    return parsed ? parsed.url : null;
  }

  /**
   * 验证代理格式
   */
  static isValidProxy(proxyString) {
    try {
      const parsed = this.parseProxy(proxyString);
      return parsed && parsed.host && parsed.port && parsed.port > 0 && parsed.port <= 65535;
    } catch (error) {
      return false;
    }
  }

  /**
   * 格式化代理信息用于显示
   */
  static formatForDisplay(proxyString) {
    try {
      const parsed = this.parseProxy(proxyString);
      if (!parsed) return '未设置';
      
      const authInfo = parsed.username ? `${parsed.username}:***` : '无认证';
      return `${parsed.protocol}://${parsed.host}:${parsed.port} (${authInfo})`;
    } catch (error) {
      return `格式错误: ${proxyString}`;
    }
  }

  /**
   * 批量转换代理列表
   */
  static convertProxyList(proxyList) {
    const results = {
      success: [],
      failed: []
    };

    proxyList.forEach((proxy, index) => {
      try {
        const standardUrl = this.toStandardUrl(proxy);
        results.success.push({
          original: proxy,
          converted: standardUrl,
          index: index
        });
      } catch (error) {
        results.failed.push({
          original: proxy,
          error: error.message,
          index: index
        });
      }
    });

    return results;
  }

  /**
   * 从文件读取代理列表并转换
   */
  static async convertProxyFile(filePath) {
    try {
      const fs = await import('fs-extra');
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      return this.convertProxyList(lines);
    } catch (error) {
      throw new Error(`读取代理文件失败: ${error.message}`);
    }
  }

  /**
   * 生成代理配置示例
   */
  static getExamples() {
    return {
      'HTTP代理': 'http://127.0.0.1:7890',
      'HTTPS代理': 'https://proxy.example.com:8080',
      '带认证的HTTP代理': 'http://username:password@proxy.example.com:8080',
      'IP:端口:用户名:密码格式': '142.173.139.108:15308:E3oeIbOnIC:qIEmVMinlF',
      '简单IP:端口格式': '192.168.1.100:8080'
    };
  }

  /**
   * 测试代理连接
   */
  static async testProxyConnection(proxyString, testUrl = 'https://httpbin.org/ip', timeout = 10000) {
    try {
      const parsed = this.parseProxy(proxyString);
      if (!parsed) {
        throw new Error('无效的代理格式');
      }

      const axios = await import('axios');
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      
      const agent = new HttpsProxyAgent(parsed.url);
      
      const startTime = Date.now();
      const response = await axios.default.get(testUrl, {
        httpsAgent: agent,
        timeout: timeout,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      const endTime = Date.now();
      
      return {
        success: true,
        responseTime: endTime - startTime,
        statusCode: response.status,
        data: response.data,
        proxyInfo: this.formatForDisplay(proxyString)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        proxyInfo: this.formatForDisplay(proxyString)
      };
    }
  }

  /**
   * 批量测试代理列表
   */
  static async testProxyList(proxyList, options = {}) {
    const { 
      testUrl = 'https://httpbin.org/ip', 
      timeout = 10000, 
      concurrent = 3 
    } = options;

    const results = [];
    
    // 分批并发测试
    for (let i = 0; i < proxyList.length; i += concurrent) {
      const batch = proxyList.slice(i, i + concurrent);
      const batchPromises = batch.map(async (proxy, index) => {
        const result = await this.testProxyConnection(proxy, testUrl, timeout);
        return {
          index: i + index,
          proxy: proxy,
          ...result
        };
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 避免过于频繁的请求
      if (i + concurrent < proxyList.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * 生成代理统计报告
   */
  static generateProxyReport(testResults) {
    const total = testResults.length;
    const successful = testResults.filter(r => r.success).length;
    const failed = total - successful;
    
    const avgResponseTime = successful > 0 
      ? testResults
          .filter(r => r.success)
          .reduce((sum, r) => sum + r.responseTime, 0) / successful
      : 0;

    const fastestProxy = testResults
      .filter(r => r.success)
      .sort((a, b) => a.responseTime - b.responseTime)[0];

    return {
      total,
      successful,
      failed,
      successRate: ((successful / total) * 100).toFixed(2) + '%',
      avgResponseTime: Math.round(avgResponseTime) + 'ms',
      fastestProxy: fastestProxy ? {
        proxy: fastestProxy.proxy,
        responseTime: fastestProxy.responseTime + 'ms'
      } : null,
      failedProxies: testResults.filter(r => !r.success).map(r => ({
        proxy: r.proxy,
        error: r.error
      }))
    };
  }
}
