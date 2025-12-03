/**
 * 配置模块 - 从环境变量读取配置
 */

import { z } from 'zod';

// MCP 配置 schema
const McpConfigSchema = z.object({
  url: z.string().url().optional(),
  name: z.string(),
  transport: z.enum(['http', 'stdio']).default('http'),
  // stdio 配置
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  // 认证
  authType: z.enum(['none', 'bearer', 'api-key']).default('none'),
  authToken: z.string().optional(),
});

// LLM 配置 schema
const LlmConfigSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().default('gpt-4o-mini'),
});

// 过滤配置 schema
const FilterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  maxResponseChars: z.number().default(2000),
  summarizeThreshold: z.number().default(5000),
});

// 完整配置 schema
const ConfigSchema = z.object({
  mcps: z.array(McpConfigSchema),
  llm: LlmConfigSchema,
  filter: FilterConfigSchema,
});

export type McpConfig = z.infer<typeof McpConfigSchema>;
export type LlmConfig = z.infer<typeof LlmConfigSchema>;
export type FilterConfig = z.infer<typeof FilterConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * 从环境变量解析配置
 */
export function loadConfig(): Config {
  // 解析 MCP 配置
  const mcpUrls = process.env.MCP_URLS?.split(',') || [process.env.MCP_URL].filter(Boolean);
  const mcpNames = process.env.MCP_NAMES?.split(',') || [process.env.MCP_NAME].filter(Boolean);
  const mcpTransports = process.env.MCP_TRANSPORTS?.split(',') || [process.env.MCP_TRANSPORT || 'http'];
  const mcpAuthTypes = process.env.MCP_AUTH_TYPES?.split(',') || [process.env.MCP_AUTH_TYPE || 'none'];
  const mcpAuthTokens = process.env.MCP_AUTH_TOKENS?.split(',') || [process.env.MCP_AUTH_TOKEN].filter(Boolean);
  
  // stdio 模式配置
  const mcpCommands = process.env.MCP_COMMANDS?.split(',') || [process.env.MCP_COMMAND].filter(Boolean);
  const mcpArgsArray = process.env.MCP_ARGS_LIST?.split(';') || [process.env.MCP_ARGS].filter(Boolean);

  // 确定 MCP 数量
  const mcpCount = Math.max(mcpUrls.length, mcpCommands.length, mcpNames.length);
  
  const mcps: McpConfig[] = [];
  for (let i = 0; i < mcpCount; i++) {
    const transport = (mcpTransports[i] || 'http') as 'http' | 'stdio';
    const isStdio = transport === 'stdio' || mcpCommands[i];
    
    mcps.push({
      url: mcpUrls[i],
      name: mcpNames[i] || `mcp-${i}`,
      transport: isStdio ? 'stdio' : 'http',
      command: mcpCommands[i],
      args: mcpArgsArray[i]?.split(','),
      authType: (mcpAuthTypes[i] || 'none') as 'none' | 'bearer' | 'api-key',
      authToken: mcpAuthTokens[i],
    });
  }

  // 解析 LLM 配置
  const llm: LlmConfig = {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined),
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  };

  // 解析过滤配置
  const filter: FilterConfig = {
    enabled: process.env.ENABLE_LLM_FILTER !== 'false',
    maxResponseChars: parseInt(process.env.MAX_RESPONSE_CHARS || '2000', 10),
    summarizeThreshold: parseInt(process.env.SUMMARIZE_THRESHOLD || '5000', 10),
  };

  return { mcps, llm, filter };
}

/**
 * 验证配置
 */
export function validateConfig(config: Config): void {
  if (config.mcps.length === 0) {
    throw new Error('至少需要配置一个 MCP 服务。设置 MCP_URL 和 MCP_NAME 环境变量。');
  }

  for (const mcp of config.mcps) {
    if (mcp.transport === 'stdio') {
      if (!mcp.command) {
        throw new Error(`MCP "${mcp.name}" 是 stdio 模式但缺少 MCP_COMMAND 配置`);
      }
    } else {
      if (!mcp.url) {
        throw new Error(`MCP "${mcp.name}" 是 http 模式但缺少 MCP_URL 配置`);
      }
    }
  }

  if (config.filter.enabled && !config.llm.apiKey) {
    console.warn('[WARN] LLM 过滤已启用但未配置 API Key，将使用截断模式');
  }
}
