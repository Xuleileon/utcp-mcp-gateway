/**
 * MCP stdio 服务器
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { CodeModeUtcpClient } from '@utcp/code-mode';
import { McpCallTemplateSerializer } from '@utcp/mcp';
import type { Tool } from '@utcp/sdk';
import OpenAI from 'openai';
import type { Config, McpConfig } from './config.js';
import { LlmFilter } from './llm-filter.js';

interface ToolSummary {
  name: string;
  brief: string;
}

export class GatewayServer {
  private server: Server;
  private utcpClient: CodeModeUtcpClient | null = null;
  private llmFilter: LlmFilter;
  private config: Config;
  private capabilitySummary: string = '';
  private toolSummaries: ToolSummary[] = [];
  private toolFullDefs: Map<string, Tool> = new Map();
  private routerClient: OpenAI | null = null;

  constructor(config: Config) {
    this.config = config;
    this.llmFilter = new LlmFilter(config.llm, config.filter);

    // 初始化路由 LLM 客户端（复用 LLM 配置）
    if (config.llm.apiKey && config.router.enabled) {
      this.routerClient = new OpenAI({
        apiKey: config.llm.apiKey,
        baseURL: config.llm.baseUrl,
      });
    }

    this.server = new Server(
      { 
        name: 'universal-tools', 
        version: '0.1.23',
      },
      { capabilities: { tools: {} } }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // 列出工具（动态生成带能力描述的工具定义）
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      // 动态获取能力摘要
      const summary = this.capabilitySummary || '（服务尚未初始化）';

      return {
        tools: [
          {
            name: 'search_tools',
            description: `[Universal Tools Gateway] Search 100+ tools from connected MCP services. Always call this first to discover available capabilities. ${summary}`,
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: '搜索查询（如 "search", "file", "memory"）' },
                limit: { type: 'number', description: '返回数量限制', default: 10 },
              },
              required: ['query'],
            },
          },
          {
            name: 'list_tools',
            description: `List all registered tools from connected MCP services. ${summary}`,
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'tool_info',
            description: '获取工具的详细 TypeScript 接口定义',
            inputSchema: {
              type: 'object',
              properties: {
                tool_name: { type: 'string', description: '工具名称' },
              },
              required: ['tool_name'],
            },
          },
          this.buildCallToolChainDefinition(),
        ],
      };
    });

    // 调用工具
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_tools':
            return await this.searchTools(args?.query as string, args?.limit as number);

          case 'list_tools':
            return await this.listTools();

          case 'tool_info':
            return await this.toolInfo(args?.tool_name as string);

          case 'call_tool_chain':
            return await this.callToolChain(
              args?.code as string,
              args?.timeout as number,
              args?.max_output_size as number,
              args?.filter_response as boolean,
              args?.purpose as string
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error}` }],
          isError: true,
        };
      }
    });
  }

  private async getUtcpClient(): Promise<CodeModeUtcpClient> {
    if (!this.utcpClient) {
      this.utcpClient = await CodeModeUtcpClient.create();
      
      // 注册配置的 MCP 服务
      for (const mcp of this.config.mcps) {
        await this.registerMcp(mcp, this.utcpClient);
      }

      // 生成能力摘要
      await this.updateCapabilitySummary();
    }
    return this.utcpClient;
  }

  /**
   * 从已注册的工具生成能力摘要和工具缓存
   */
  private async updateCapabilitySummary(): Promise<void> {
    if (!this.utcpClient) return;

    const tools = await this.utcpClient.getTools();
    if (tools.length === 0) {
      this.capabilitySummary = '';
      this.toolSummaries = [];
      this.toolFullDefs.clear();
      return;
    }

    // 缓存完整定义和生成精简摘要
    this.toolSummaries = [];
    this.toolFullDefs.clear();
    for (const tool of tools) {
      const tsName = this.utcpNameToTsName(tool.name);
      this.toolFullDefs.set(tsName, tool);
      this.toolSummaries.push({
        name: tsName,
        brief: tool.description?.slice(0, 100) || '',
      });
    }

    // 按 manual 分组（用于能力摘要）
    const byManual = new Map<string, Array<{ name: string; description: string }>>();
    for (const tool of tools) {
      // tool.name 格式: "manual.server.tool" 或 "manual.tool"
      const parts = tool.name.split('.');
      const manual = parts[0];
      const toolName = parts.slice(1).join('.');

      if (!byManual.has(manual)) {
        byManual.set(manual, []);
      }
      byManual.get(manual)!.push({
        name: toolName,
        description: tool.description,
      });
    }

    // 生成能力摘要
    const lines: string[] = ['已连接服务:'];
    for (const [manual, toolList] of byManual) {
      // 取前 2 个工具名
      const toolNames = toolList.slice(0, 2).map(t => t.name).join(', ');
      const suffix = toolList.length > 2 ? ` 等${toolList.length}个工具` : '';
      lines.push(`- ${manual}: ${toolNames}${suffix}`);
    }

    this.capabilitySummary = lines.join('\n');
    console.error(`[Gateway] 能力摘要已生成:\n${this.capabilitySummary}`);
    console.error(`[Gateway] 已缓存 ${this.toolSummaries.length} 个工具摘要`);
  }

  private async registerMcp(mcp: McpConfig, client: CodeModeUtcpClient): Promise<void> {
    const mcpServerConfig = mcp.transport === 'http'
      ? {
          transport: 'http' as const,
          url: mcp.url,
          ...(mcp.authToken && { headers: { Authorization: `Bearer ${mcp.authToken}` } }),
        }
      : {
          transport: 'stdio' as const,
          command: mcp.command!,
          args: mcp.args || [],
        };

    const serializer = new McpCallTemplateSerializer();
    const template = serializer.validateDict({
      name: mcp.name,
      call_template_type: 'mcp',
      config: {
        mcpServers: {
          [mcp.name]: mcpServerConfig,
        },
      },
    });

    await client.registerManual(template);
    console.error(`[Gateway] Registered MCP: ${mcp.name}`);
  }

  /**
   * 将 UTCP 工具名转换为 TypeScript 函数名
   * 例: "context7.context7.resolve-library-id" -> "context7_context7_resolve_library_id"
   */
  private utcpNameToTsName(name: string): string {
    return name.replace(/[.-]/g, '_');
  }

  private async searchTools(query: string, limit = 10) {
    const client = await this.getUtcpClient();
    
    // 如果启用了 LLM 路由且有客户端
    if (this.config.router.enabled && this.routerClient && this.toolSummaries.length > 0) {
      return this.llmSearchTools(query, limit, client);
    }
    
    // 回退到原有的关键词搜索
    const tools = await client.searchTools(query, limit);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tools: tools.map(t => ({
            name: this.utcpNameToTsName(t.name),
            description: t.description,
            typescript_interface: client.toolToTypeScriptInterface(t),
          }))
        }, null, 2),
      }],
    };
  }

  /**
   * 使用 LLM 智能搜索工具
   */
  private async llmSearchTools(query: string, limit: number, client: CodeModeUtcpClient) {
    if (!this.routerClient) {
      throw new Error('Router client not initialized');
    }

    // 使用全量描述（更准确的推荐）
    const toolDescriptions = Array.from(this.toolFullDefs.entries())
      .map(([name, tool]) => `- ${name}: ${tool.description || '(无描述)'}`)
      .join('\n');

    const model = this.config.router.model || this.config.llm.model;
    
    try {
      const response = await this.routerClient.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `你是一个工具推荐专家。根据用户的需求，推荐最合适的工具。

可用工具：
${toolDescriptions}

推荐原则：
1. 优先推荐最匹配用户需求的工具
2. 如果需求涉及多个方面，可以推荐多个互补的工具
3. 即使没有完全匹配，也可以推荐"可能有用"的工具
4. 只有在完全没有相关工具时才返回 "none"

输出格式：
- 只返回工具名，用逗号分隔
- 最多返回 ${limit} 个工具
- 不要解释，只输出工具名`
          },
          { role: 'user', content: query }
        ],
        max_tokens: 200,
        temperature: 0.3,
      });

      const resultText = response.choices[0]?.message?.content || 'none';
      console.error(`[Gateway] LLM 推荐结果: ${resultText}`);

      if (resultText.toLowerCase().trim() === 'none') {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ tools: [], message: '未找到匹配的工具' }, null, 2),
          }],
        };
      }

      // 解析推荐的工具名
      const recommendedNames = resultText
        .split(',')
        .map(n => n.trim())
        .filter(n => n && n !== 'none');

      console.error(`[Gateway] 解析的工具名: ${recommendedNames.join(', ')}`);

      // 获取推荐工具的完整定义（支持模糊匹配）
      const recommendedTools: Tool[] = [];
      for (const name of recommendedNames) {
        // 先精确匹配
        let tool = this.toolFullDefs.get(name);
        
        // 如果没找到，尝试模糊匹配（工具名包含推荐名，或推荐名包含工具名）
        if (!tool) {
          for (const [toolName, t] of this.toolFullDefs) {
            if (toolName.includes(name) || name.includes(toolName)) {
              tool = t;
              console.error(`[Gateway] 模糊匹配: "${name}" -> "${toolName}"`);
              break;
            }
          }
        }
        
        if (tool) {
          recommendedTools.push(tool);
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tools: recommendedTools.map(t => ({
              name: this.utcpNameToTsName(t.name),
              description: t.description,
              typescript_interface: client.toolToTypeScriptInterface(t),
            }))
          }, null, 2),
        }],
      };
    } catch (error) {
      console.error('[Gateway] LLM 搜索失败，回退到关键词搜索:', error);
      // 回退到原有搜索
      const tools = await client.searchTools(query, limit);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tools: tools.map(t => ({
              name: this.utcpNameToTsName(t.name),
              description: t.description,
              typescript_interface: client.toolToTypeScriptInterface(t),
            }))
          }, null, 2),
        }],
      };
    }
  }

  private async toolInfo(toolName: string) {
    const client = await this.getUtcpClient();
    
    // 先尝试直接查找
    let tool = await client.getTool(toolName);
    
    if (!tool) {
      // 遍历所有工具，使用多种格式匹配
      const tools = await client.getTools();
      const normalizedInput = this.utcpNameToTsName(toolName);
      
      const found = tools.find(t => {
        const normalizedTool = this.utcpNameToTsName(t.name);
        // 支持多种匹配方式
        return t.name === toolName ||                    // 完全匹配
               normalizedTool === toolName ||            // 原名已是转换格式
               normalizedTool === normalizedInput;       // 都转换后比较
      });
      
      if (!found) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: `Tool '${toolName}' not found` }) }],
          isError: true,
        };
      }
      tool = found;
    }
    
    return {
      content: [{
        type: 'text',
        text: client.toolToTypeScriptInterface(tool),
      }],
    };
  }

  private async listTools() {
    // 优先使用缓存的精简摘要
    if (this.toolSummaries.length > 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            tools: this.toolSummaries,
            hint: '使用 tool_info(name) 获取完整接口定义'
          }, null, 2),
        }],
      };
    }
    
    // 回退到原有逻辑
    const client = await this.getUtcpClient();
    const tools = await client.getTools();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          tools: tools.map(t => ({
            name: this.utcpNameToTsName(t.name),
            brief: t.description?.slice(0, 100) || ''
          })),
          hint: '使用 tool_info(name) 获取完整接口定义'
        }, null, 2),
      }],
    };
  }

  /**
   * 动态生成 call_tool_chain 工具定义
   * 当 FORCE_LLM_FILTER=true 时，隐藏 filter_response 参数
   */
  private buildCallToolChainDefinition() {
    const forceLlmFilter = this.config.filter.forceLlmFilter;
    
    // 基础描述
    let description = `执行 TypeScript 代码链。工具已注册为全局对象，直接用 await manual.tool(args) 调用。

## 可用运行时变量
- __interfaces: 所有工具的 TypeScript 接口定义
- __getToolInterface(name): 获取特定工具接口
- console.log/error/warn: 输出会被捕获并返回

## 建议流程
1. 先 console.log(__interfaces) 了解接口
2. 调用工具并 console.log(result) 查看返回结构
3. 根据实际结构处理数据
`;

    // 根据是否强制过滤添加不同说明
    if (forceLlmFilter) {
      description += `
## ⚡ 当前已强制开启 LLM 过滤
所有响应都会自动经过 LLM 智能摘要，请提供 purpose 参数以获得更精准的结果。
`;
    } else {
      description += `
## filter_response 参数使用场景
- false（默认）：保留原始 JSON 结构，适合后续代码处理
- true：使用 LLM 摘要，适合结果直接展示给用户或输出过大时
`;
    }

    description += `
## 示例
\`\`\`typescript
// 不要用 import/require，工具已是全局对象
const result = await context7.context7_resolve_library_id({ libraryName: "react" });
console.log(result);  // 先看结构
return result;  // 再处理
\`\`\``;

    // 基础属性
    const properties: Record<string, unknown> = {
      code: { type: 'string', description: 'TypeScript 代码，使用 await manual.tool(args) 调用工具' },
      timeout: { type: 'number', description: '超时时间(ms)', default: 30000 },
      max_output_size: { type: 'number', description: '最大输出字符数', default: 5000 },
      purpose: { type: 'string', description: '用户的请求目的（LLM 会根据此目的提取相关信息）' },
    };

    // 只有未强制过滤时才暴露 filter_response 参数
    if (!forceLlmFilter) {
      properties.filter_response = { 
        type: 'boolean', 
        description: '是否使用 LLM 智能摘要（默认 false）', 
        default: false 
      };
    }

    return {
      name: 'call_tool_chain',
      description,
      inputSchema: {
        type: 'object',
        properties,
        required: ['code'],
      },
    };
  }

  private async callToolChain(
    code: string,
    timeout = 30000,
    maxOutputSize = 5000,
    filterResponse = false,
    purpose?: string
  ) {
    const client = await this.getUtcpClient();
    const { result, logs } = await client.callToolChain(code, timeout);
    
    // 构建完整结果（包含 logs 方便调试）
    const fullResult = { success: true, result, logs };
    const content = JSON.stringify(fullResult, null, 2);
    
    // 使用配置的强制过滤选项或调用方指定的过滤选项
    const shouldFilter = filterResponse || this.config.filter.forceLlmFilter;
    
    // 检查输出大小
    if (content.length > maxOutputSize) {
      // 如果超限且开启了过滤，尝试用 LLM 压缩
      if (shouldFilter && purpose) {
        const filtered = await this.llmFilter.filter(content, purpose);
        return {
          content: [{ type: 'text', text: filtered }],
        };
      }
      const truncated = content.slice(0, maxOutputSize) + '\n...\n[max_output_size exceeded, 请在代码中过滤数据后再 return]';
      return {
        content: [{ type: 'text', text: truncated }],
      };
    }
    
    // 根据 shouldFilter 决定是否过滤
    if (shouldFilter) {
      const filtered = await this.llmFilter.filter(content, purpose);
      return {
        content: [{ type: 'text', text: filtered }],
      };
    }
    
    return {
      content: [{ type: 'text', text: content }],
    };
  }

  async run(): Promise<void> {
    // 先初始化 UTCP 客户端并注册服务，生成能力摘要
    await this.getUtcpClient();

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Gateway] UTCP Gateway started');
  }
}
