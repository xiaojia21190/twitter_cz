import axios from "axios";

export class OpenAIClient {
  constructor(config) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.proxy_url,
      headers: {
        Authorization: `Bearer ${config.api_key}`,
        "Content-Type": "application/json",
      },
      timeout: 30000,
    });
  }

  /**
   * 生成推文回复
   */
  async generateReply(tweetContent, context = {}) {
    try {
      const prompt = this.buildPrompt(tweetContent, context);

      const response = await this.client.post("/chat/completions", {
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: this.config.max_tokens,
        temperature: this.config.temperature,
        stream: false,
      });

      const reply = response.data.choices[0].message.content.trim();

      // 确保回复不超过Twitter限制
      const sanitizedReply = this.sanitizeReply(reply);

      console.log("AI回复生成成功:", sanitizedReply);
      return {
        success: true,
        reply: sanitizedReply,
        original_tweet: tweetContent,
        tokens_used: response.data.usage?.total_tokens || 0,
      };
    } catch (error) {
      console.error("AI回复生成失败:", error.message);
      return {
        success: false,
        error: error.message,
        reply: null,
      };
    }
  }

  /**
   * 构建提示词
   */
  buildPrompt(tweetContent, context) {
    let prompt = `请为以下推文生成一个有趣、自然的回复：

推文内容：
${tweetContent}`;

    if (context.author) {
      prompt += `\n\n作者：${context.author}`;
    }

    if (context.hashtags && context.hashtags.length > 0) {
      prompt += `\n\n相关标签：${context.hashtags.join(", ")}`;
    }

    if (context.mentions && context.mentions.length > 0) {
      prompt += `\n\n提及用户：${context.mentions.join(", ")}`;
    }

    prompt += `\n\n要求：
1. 回复应该自然、有趣，避免过于正式
2. 长度控制在280字符以内
3. 可以使用emoji，但不要过度
4. 避免争议性话题
5. 展现积极友好的态度
6. 如果推文包含问题，尝试给出有用的回答
7. 如果是观点类推文，可以表达不同角度的看法
8. 保持简洁明了`;

    return prompt;
  }

  /**
   * 获取系统提示词
   */
  getSystemPrompt() {
    return `你是一个友好、智能的Twitter用户，擅长与人互动。你的回复应该：

1. 自然而有趣，就像真人在回复一样
2. 根据推文内容调整语调（幽默的推文用轻松语调，严肃的用认真语调）
3. 简洁明了，不要长篇大论
4. 积极正面，避免负面情绪
5. 如果推文是中文，用中文回复；如果是英文，用英文回复
6. 可以适当使用网络用语和表情符号
7. 避免复制推文内容，要有自己的观点
8. 对于明显的营销或垃圾推文，可以礼貌地忽略或给出简短回复

记住：你的目标是建立真实的社交互动，而不是显得像机器人。`;
  }

  /**
   * 清理和验证回复内容
   */
  sanitizeReply(reply) {
    // 移除多余的空白字符
    let sanitized = reply.replace(/\s+/g, " ").trim();

    // 移除引号（如果回复被包装在引号中）
    if (sanitized.startsWith('"') && sanitized.endsWith('"')) {
      sanitized = sanitized.slice(1, -1);
    }
    if (sanitized.startsWith('"') && sanitized.endsWith('"')) {
      sanitized = sanitized.slice(1, -1);
    }

    // 确保不超过Twitter字符限制（考虑表情符号）
    if (this.getCharacterCount(sanitized) > 280) {
      sanitized = this.truncateToLimit(sanitized, 280);
    }

    // 移除可能的敏感内容标记
    sanitized = sanitized.replace(/\[回复\]|\[Reply\]/gi, "");

    return sanitized;
  }

  /**
   * 计算推文的实际字符数（考虑表情符号）
   */
  getCharacterCount(text) {
    // Twitter的字符计算比较复杂，这里简化处理
    // 实际应用中可能需要使用twitter-text库
    return [...text].length;
  }

  /**
   * 截断文本到指定长度
   */
  truncateToLimit(text, limit) {
    if (this.getCharacterCount(text) <= limit) {
      return text;
    }

    const chars = [...text];
    let truncated = "";

    for (let i = 0; i < chars.length && this.getCharacterCount(truncated + chars[i]) < limit - 3; i++) {
      truncated += chars[i];
    }

    return truncated + "...";
  }

  /**
   * 批量生成回复
   */
  async generateBatchReplies(tweets, maxConcurrent = 3) {
    const results = [];

    // 分批处理，避免过多并发请求
    for (let i = 0; i < tweets.length; i += maxConcurrent) {
      const batch = tweets.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (tweet) => {
        try {
          const result = await this.generateReply(tweet.content, tweet.context);
          return {
            tweet_id: tweet.id,
            ...result,
          };
        } catch (error) {
          return {
            tweet_id: tweet.id,
            success: false,
            error: error.message,
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // 添加延迟，避免API限流
      if (i + maxConcurrent < tweets.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * 测试API连接
   */
  async testConnection() {
    try {
      const response = await this.generateReply("测试推文：今天天气真好！", {});
      return {
        success: response.success,
        message: response.success ? "API连接正常" : `连接失败: ${response.error}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
      };
    }
  }

  /**
   * 获取配置信息
   */
  getConfig() {
    return {
      proxy_url: this.config.proxy_url,
      model: this.config.model,
      max_tokens: this.config.max_tokens,
      temperature: this.config.temperature,
      has_api_key: !!this.config.api_key,
    };
  }
}
