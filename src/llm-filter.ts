/**
 * LLM 智能过滤模块
 */

import OpenAI from 'openai';
import type { LlmConfig, FilterConfig } from './config.js';

export class LlmFilter {
  private client: OpenAI | null = null;
  private config: LlmConfig;
  private filterConfig: FilterConfig;

  constructor(config: LlmConfig, filterConfig: FilterConfig) {
    this.config = config;
    this.filterConfig = filterConfig;

    if (config.apiKey) {
      this.client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      });
    }
  }

  /**
   * 过滤响应
   */
  async filter(content: string, context?: string): Promise<string> {
    // 如果内容较短，直接返回
    if (content.length <= this.filterConfig.maxResponseChars) {
      return content;
    }

    // 如果未启用过滤或没有 API Key，使用截断
    if (!this.filterConfig.enabled || !this.client) {
      return this.truncate(content);
    }

    // 如果内容低于摘要阈值，使用截断
    if (content.length < this.filterConfig.summarizeThreshold) {
      return this.truncate(content);
    }

    // 使用 LLM 智能摘要
    try {
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `你是一个专业的信息提取助手。请将以下内容精简为不超过 ${this.filterConfig.maxResponseChars} 字符的摘要。

要求：
1. 保留最关键的信息
2. 如果原始内容是 JSON，请输出精简后的 JSON 结构
3. 保持关键字段名称不变（如 id, name, libraryId 等）
4. 只输出摘要内容，不要解释`,
          },
          {
            role: 'user',
            content: context
              ? `上下文：${context}\n\n原始内容：\n${content}`
              : content,
          },
        ],
        max_tokens: Math.ceil(this.filterConfig.maxResponseChars / 2),
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content || '';
      return summary || this.truncate(content);
    } catch (error) {
      console.error('[LLM Filter] 摘要失败，使用截断:', error);
      return this.truncate(content);
    }
  }

  /**
   * 截断内容
   */
  private truncate(content: string): string {
    if (content.length <= this.filterConfig.maxResponseChars) {
      return content;
    }
    return content.slice(0, this.filterConfig.maxResponseChars) + '\n\n[截断，原始长度: ' + content.length + ' 字符]';
  }
}
