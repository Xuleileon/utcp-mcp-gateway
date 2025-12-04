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
  maxResponseChars: z.number().default(10000),
  summarizeThreshold: z.number().default(5000),
  forceLlmFilter: z.boolean().default(false),
});

// 路由配置 schema
const RouterConfigSchema = z.object({
  enabled: z.boolean().default(true),
  model: z.string().optional(),  // 不填则复用 LLM_MODEL
});

// OpenAPI 配置 schema
const OpenapiConfigSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  authType: z.enum(['none', 'api-key', 'bearer', 'basic']).default('none'),
  authToken: z.string().optional(),
  authVar: z.string().default('Authorization'),
  authLocation: z.enum(['header', 'query', 'cookie']).default('header'),
});

// 完整配置 schema
const ConfigSchema = z.object({
  mcps: z.array(McpConfigSchema),
  openapis: z.array(OpenapiConfigSchema),
  llm: LlmConfigSchema,
  filter: FilterConfigSchema,
  router: RouterConfigSchema,
});

export type McpConfig = z.infer<typeof McpConfigSchema>;
export type LlmConfig = z.infer<typeof LlmConfigSchema>;
export type FilterConfig = z.infer<typeof FilterConfigSchema>;
export type RouterConfig = z.infer<typeof RouterConfigSchema>;
export type OpenapiConfig = z.infer<typeof OpenapiConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

/**
 * 从环境变量解析配置
 * 
 * 支持三种配置方式：
 * 1. 单个 MCP：MCP_URL, MCP_NAME
 * 2. 多个 MCP（分号分隔）：MCP_URL="url1;url2", MCP_NAME="name1;name2"
 * 3. 多个 MCP（编号方式）：MCP_1_URL, MCP_1_NAME, MCP_2_URL, MCP_2_NAME...
 */
export function loadConfig(): Config {
  const mcps: McpConfig[] = [];

  // 方式 3：编号方式配置 MCP_1_*, MCP_2_*, ...
  const numberedMcps = parseNumberedMcpConfig();
  if (numberedMcps.length > 0) {
    mcps.push(...numberedMcps);
  } else {
    // 方式 1 和 2：使用分号分隔的配置
    const legacyMcps = parseLegacyMcpConfig();
    mcps.push(...legacyMcps);
  }

  // 解析 LLM 配置
  const llm: LlmConfig = {
    apiKey: process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || (process.env.OPENROUTER_API_KEY ? 'https://openrouter.ai/api/v1' : undefined),
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
  };

  // 解析过滤配置（布尔值不区分大小写）
  const filter: FilterConfig = {
    enabled: process.env.ENABLE_LLM_FILTER?.toLowerCase() !== 'false',
    maxResponseChars: parseInt(process.env.MAX_RESPONSE_CHARS || '10000', 10),
    summarizeThreshold: parseInt(process.env.SUMMARIZE_THRESHOLD || '5000', 10),
    forceLlmFilter: process.env.FORCE_LLM_FILTER?.toLowerCase() === 'true',
  };

  // 解析路由配置
  const router: RouterConfig = {
    enabled: process.env.ENABLE_LLM_SEARCH?.toLowerCase() !== 'false',
    model: process.env.ROUTER_MODEL || undefined,
  };

  // 解析 OpenAPI 配置
  const openapis = parseOpenapiConfig();

  return { mcps, openapis, llm, filter, router };
}

/**
 * 解析编号方式的 MCP 配置
 * MCP_1_NAME, MCP_1_URL, MCP_2_NAME, MCP_2_COMMAND, ...
 */
function parseNumberedMcpConfig(): McpConfig[] {
  const mcps: McpConfig[] = [];
  
  // 查找所有 MCP_N_NAME 环境变量
  for (let i = 1; i <= 20; i++) { // 最多支持 20 个
    const prefix = `MCP_${i}_`;
    const name = process.env[`${prefix}NAME`];
    
    if (!name) continue; // 没有这个编号的配置
    
    const url = process.env[`${prefix}URL`];
    const command = process.env[`${prefix}COMMAND`];
    const argsStr = process.env[`${prefix}ARGS`];
    const transport = process.env[`${prefix}TRANSPORT`] as 'http' | 'stdio' | undefined;
    const authType = process.env[`${prefix}AUTH_TYPE`] as 'none' | 'bearer' | 'api-key' | undefined;
    const authToken = process.env[`${prefix}AUTH_TOKEN`];
    
    // 自动判断 transport 类型
    const isStdio = transport === 'stdio' || !!command;
    
    mcps.push({
      name,
      url,
      transport: isStdio ? 'stdio' : 'http',
      command,
      args: argsStr ? argsStr.split(',') : undefined,
      authType: authType || 'none',
      authToken,
    });
  }
  
  return mcps;
}

/**
 * 解析旧版分号分隔方式的 MCP 配置（向后兼容）
 */
function parseLegacyMcpConfig(): McpConfig[] {
  // 解析 MCP 配置（支持分号分隔）
  const mcpUrls = process.env.MCP_URL?.split(';') || [];
  const mcpNames = process.env.MCP_NAME?.split(';') || [];
  const mcpTransports = process.env.MCP_TRANSPORT?.split(';') || [];
  const mcpAuthTypes = process.env.MCP_AUTH_TYPE?.split(';') || [];
  const mcpAuthTokens = process.env.MCP_AUTH_TOKEN?.split(';') || [];
  
  // stdio 模式配置
  const mcpCommands = process.env.MCP_COMMAND?.split(';') || [];
  const mcpArgsArray = process.env.MCP_ARGS?.split(';') || [];

  // 确定 MCP 数量
  const mcpCount = Math.max(mcpUrls.length, mcpCommands.length, mcpNames.length);
  
  if (mcpCount === 0) return [];
  
  const mcps: McpConfig[] = [];
  for (let i = 0; i < mcpCount; i++) {
    const transport = (mcpTransports[i] || 'http') as 'http' | 'stdio';
    const command = mcpCommands[i];
    const isStdio = transport === 'stdio' || !!command;
    
    const name = mcpNames[i];
    if (!name) continue; // 跳过没有名称的配置
    
    mcps.push({
      url: mcpUrls[i],
      name,
      transport: isStdio ? 'stdio' : 'http',
      command,
      args: mcpArgsArray[i]?.split(','),
      authType: (mcpAuthTypes[i] || 'none') as 'none' | 'bearer' | 'api-key',
      authToken: mcpAuthTokens[i],
    });
  }
  
  return mcps;
}

/**
 * 解析 OpenAPI 配置
 * OPENAPI_1_NAME, OPENAPI_1_URL, OPENAPI_1_AUTH_TYPE, ...
 */
function parseOpenapiConfig(): OpenapiConfig[] {
  const openapis: OpenapiConfig[] = [];
  
  for (let i = 1; i <= 20; i++) {
    const prefix = `OPENAPI_${i}_`;
    const name = process.env[`${prefix}NAME`];
    
    if (!name) continue;
    
    const url = process.env[`${prefix}URL`];
    if (!url) {
      console.warn(`[WARN] OPENAPI_${i} 配置了 NAME 但缺少 URL，跳过`);
      continue;
    }
    
    const authType = process.env[`${prefix}AUTH_TYPE`] as 'none' | 'api-key' | 'bearer' | 'basic' | undefined;
    const authToken = process.env[`${prefix}AUTH_TOKEN`];
    const authVar = process.env[`${prefix}AUTH_VAR`] || 'Authorization';
    const authLocation = process.env[`${prefix}AUTH_LOCATION`] as 'header' | 'query' | 'cookie' | undefined;
    
    openapis.push({
      name,
      url,
      authType: authType || 'none',
      authToken,
      authVar,
      authLocation: authLocation || 'header',
    });
  }
  
  return openapis;
}

/**
 * 验证配置
 */
export function validateConfig(config: Config): void {
  if (config.mcps.length === 0 && config.openapis.length === 0) {
    throw new Error('至少需要配置一个 MCP 或 OpenAPI 工具源。');
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
