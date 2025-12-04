# utcp-mcp-gateway

<p align="center">
  <strong>🚀 The Smarter Way to Use MCP — Save 90%+ Tokens with Code Mode</strong>
</p>

<p align="center">
  <a href="#english">English</a> | <a href="#中文">中文</a>
</p>

<p align="center">
  <em>Inspired by Claude Skills' Progressive Disclosure</em>
</p>

<p align="center">
  <code>claude skills alternative</code> · <code>mcp token optimization</code> · <code>progressive tool discovery</code> · <code>mcp response filtering</code>
</p>

---

<a name="english"></a>

## The Story / 故事

> I noticed [Claude Skills](https://claude.com/blog/skills-explained) works amazingly well — Claude dynamically discovers and loads only the skills it needs, avoiding context overload.
>
> But most agent frameworks? They dump 500+ tool definitions into the context at once. And MCP responses? Often 10,000+ chars of raw data that waste your tokens.
>
> Then I discovered [UTCP](https://github.com/anthropics/utcp) — exactly what I needed! Progressive tool discovery built-in. And [Cloudflare's Code Mode](https://blog.cloudflare.com/code-mode/)? One code block executes everything. Brilliant!
>
> So I built on top of UTCP: **Progressive Discovery + Code Mode + LLM Filtering** — the smarter way to use MCP.
>
> The best part? Just add one config block. Works with Claude Desktop, Windsurf, Cursor, Dify, and any MCP-compatible client. No extra servers needed.

## Looking for...?

- ✅ **Claude Skills alternative** for your MCP setup
- ✅ **Better MCP tool management** without context overload
- ✅ **Progressive tool discovery** — load tools on demand
- ✅ **OpenAPI/Swagger to tools** — register REST APIs as tools
- ✅ **MCP token optimization** — reduce 90%+ token waste
- ✅ **MCP response filtering** — smart summarization

**You're in the right place.**

## What is this?

**LLMs are great at writing code, but terrible at tool calling.**

Traditional MCP exposes tools directly to LLMs — but LLMs struggle with:
- Too many tools (500+ definitions = confusion)
- Huge responses (10,000+ chars = wasted tokens)  
- Multiple round trips (15+ API calls = slow & expensive)

**`utcp-mcp-gateway` fixes all of this:**

| Problem | Solution |
|---------|----------|
| 500+ tool definitions | **Progressive Discovery** — load only what's needed |
| 10,000+ char responses | **LLM Filtering** — smart summarization (97% smaller!) |
| 15+ API round trips | **Code Mode** — one code block, one execution |

```
Traditional:  User → LLM → Tool1 → LLM → Tool2 → LLM → Tool3 → Result
              (15+ calls, $26/day, slow)

Code Mode:    User → LLM writes code → Execute all at once → Result  
              (1 call, $0.87/day, fast)
```

**Result: $9,536/year savings** ([benchmark source](https://github.com/imran31415/codemode_python_benchmark))

## Features

| Feature | Description |
|---------|-------------|
| 🔌 **Universal MCP** | Connect any HTTP or stdio MCP server |
| 📜 **OpenAPI Support** | Register REST APIs directly from OpenAPI/Swagger specs |
| 🧠 **LLM Filtering** | Intelligent summarization (97% response reduction!) |
| 🔍 **Progressive Discovery** | `search_tools` - find tools without loading all 500 definitions |
| ⚡ **Code Mode** | Execute TypeScript tool chains in one call |
| 🔒 **Secure Sandbox** | Code runs in isolated environment |
| 📦 **Zero Config** | Environment variables only, no config files |

## Quick Start

**Zero config files needed!** Just add to Claude Desktop config:

### Mode 1: HTTP MCP (Remote)

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_URL": "https://mcp.context7.com/mcp",
        "MCP_NAME": "context7",
        "LLM_API_KEY": "sk-xxx",
        "LLM_BASE_URL": "https://api.openai.com/v1",
        "LLM_MODEL": "gpt-4o-mini"
      }
    }
  }
}
```

### Mode 2: stdio MCP (Local)

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_COMMAND": "npx",
        "MCP_ARGS": "-y,@anthropic/mcp-server-filesystem",
        "MCP_NAME": "filesystem",
        "MCP_TRANSPORT": "stdio",
        "LLM_API_KEY": "sk-xxx"
      }
    }
  }
}
```

> ⚠️ **Windows Users:** Use `cmd /c npx` instead of `npx`:
> ```json
> "command": "cmd",
> "args": ["/c", "npx", "-y", "utcp-mcp-gateway"]
> ```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MCP_URL` | HTTP mode | MCP server URL |
| `MCP_COMMAND` | stdio mode | Command to run MCP |
| `MCP_ARGS` | stdio mode | Arguments (comma-separated) |
| `MCP_NAME` | ✅ | MCP namespace |
| `MCP_TRANSPORT` | No | `http` (default) or `stdio` |
| `LLM_API_KEY` | For filtering | Any OpenAI-compatible API key |
| `LLM_BASE_URL` | For filtering | API endpoint (default: OpenAI) |
| `LLM_MODEL` | For filtering | Model name (default: gpt-4o-mini) |

That's it! Restart Claude Desktop and try: *"Search for React useState examples"*

## How It Works

```
┌──────────────┐     ┌─────────────────────────────────┐     ┌─────────────┐
│   Your AI    │────▶│      utcp-mcp-gateway           │────▶│ Any MCP     │
│ (Claude etc) │     │  ┌─────────┐  ┌─────────────┐   │     │ (Context7)  │
└──────────────┘     │  │  UTCP   │  │ LLM Filter  │   │     └─────────────┘
                     │  │ search  │  │ 10K→300char │   │
                     │  └─────────┘  └─────────────┘   │
                     └─────────────────────────────────┘
```

**Gateway exposes 4 tools to your AI:**

| Tool | Parameters | What it does |
|------|------------|--------------|
| `search_tools` | `query`, `limit` | Find tools by keyword. Returns tools with TypeScript interfaces |
| `list_tools` | - | List all registered tools from connected MCPs |
| `tool_info` | `tool_name` | Get detailed TypeScript interface for a specific tool |
| `call_tool_chain` | `code`, `timeout`, `max_output_size`, `filter_response`, `purpose` | Execute TypeScript code that calls multiple tools in one shot |

### Context-Aware Summarization

When using `call_tool_chain` with `filter_response: true`, you can provide a `purpose` parameter to guide the LLM summarization:

```typescript
call_tool_chain({
  code: "const docs = await context7.context7_get_library_docs({...}); return docs;",
  filter_response: true,
  purpose: "Find React useState usage examples"
})
```

The LLM will extract only information relevant to your purpose, instead of generic summarization.

### Example Flow

```
User: "How do I use React useState?"

1. AI calls search_tools("react")        → Returns tools with TypeScript interfaces
2. AI calls call_tool_chain with code:
   const id = await context7.context7_resolve_library_id({ libraryName: "react" });
   const docs = await context7.context7_get_library_docs({ libraryId: id, topic: "useState" });
   return docs;
3. Gateway executes code and returns result
4. AI receives structured response
```

## Token Savings Benchmarks

| MCP Service | Original | Filtered | Savings |
|-------------|----------|----------|---------|
| Context7 (docs) | 10,625 chars | 326 chars | **97%** |
| DeepWiki (wiki) | 3,318 chars | 400 chars | **88%** |

## Configuration

### Single MCP

```bash
MCP_URL=https://mcp.context7.com/mcp
MCP_NAME=context7
```

### Multiple MCPs (Recommended: Numbered Style)

Use numbered environment variables for clear configuration:

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_1_NAME": "context7",
        "MCP_1_URL": "https://mcp.context7.com/mcp",
        
        "MCP_2_NAME": "filesystem",
        "MCP_2_COMMAND": "npx",
        "MCP_2_ARGS": "-y,@anthropic/mcp-server-filesystem,/path/to/dir",
        
        "LLM_API_KEY": "sk-xxx",
        "MAX_RESPONSE_CHARS": "10000"
      }
    }
  }
}
```

**Numbered variables:**
- `MCP_1_NAME`, `MCP_1_URL` - First MCP (HTTP mode)
- `MCP_2_NAME`, `MCP_2_COMMAND`, `MCP_2_ARGS` - Second MCP (stdio mode)
- Up to `MCP_20_*` supported

### Multiple MCPs (Alternative: Semicolon Style)

```json
{
  "env": {
    "MCP_URL": "https://mcp.context7.com/mcp;https://mcp.deepwiki.com/mcp",
    "MCP_NAME": "context7;deepwiki"
  }
}
```

### LLM Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `LLM_API_KEY` | - | OpenAI/OpenRouter API key |
| `LLM_BASE_URL` | OpenAI | Custom endpoint (OpenAI-compatible) |
| `LLM_MODEL` | gpt-4o-mini | Model for summarization |
| `ENABLE_LLM_FILTER` | true | Enable/disable filtering |
| `MAX_RESPONSE_CHARS` | 10000 | Max response length before LLM summarization |
| `FORCE_LLM_FILTER` | false | Force LLM summarization for all responses |

### Smart Router Settings (v0.1.20+)

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_LLM_SEARCH` | true | Use LLM for intelligent tool search |
| `ROUTER_MODEL` | (uses LLM_MODEL) | Model for tool routing (recommend faster model) |

**How it works:**
- `list_tools` returns brief summaries instead of full schemas (saves tokens)
- `search_tools` uses LLM to understand intent and recommend relevant tools (uses full descriptions for accuracy)
- Falls back to keyword search if LLM is unavailable
- Fuzzy matching for tool names in case LLM returns slightly different names
- Pre-truncates large responses (>200k chars) before LLM summarization

### OpenAPI Settings (v0.1.24+)

Register REST APIs directly from OpenAPI/Swagger specs:

```bash
# Example: APIs.guru (public API directory)
OPENAPI_1_NAME=apisguru
OPENAPI_1_URL=https://api.apis.guru/v2/openapi.yaml

# Example with authentication
OPENAPI_2_NAME=my_api
OPENAPI_2_URL=https://api.example.com/openapi.json
OPENAPI_2_AUTH_TYPE=api-key
OPENAPI_2_AUTH_TOKEN=sk-xxx
OPENAPI_2_AUTH_VAR=X-Api-Key
OPENAPI_2_AUTH_LOCATION=header
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAPI_N_NAME` | ✅ | Tool source name |
| `OPENAPI_N_URL` | ✅ | OpenAPI spec URL |
| `OPENAPI_N_AUTH_TYPE` | ❌ | `api-key`, `bearer`, `basic`, or `none` |
| `OPENAPI_N_AUTH_TOKEN` | ❌ | Auth token/key |
| `OPENAPI_N_AUTH_VAR` | ❌ | Header name (default: `Authorization`) |
| `OPENAPI_N_AUTH_LOCATION` | ❌ | `header`, `query`, or `cookie` |

**How it works:**
- Downloads and parses OpenAPI 2.0/3.0 specifications
- Converts each operation to a UTCP tool
- Tool name = operationId from OpenAPI spec
- Tool description = summary or description from OpenAPI spec
- Supports API Key, Bearer, Basic, and OAuth2 authentication

**Requirements:**
- Each API operation must have an `operationId` (operations without it are skipped)
- File upload parameters (`type: file`) are not supported by UTCP SDK

---

<a name="中文"></a>

## 故事

> 我发现 [Claude Skills](https://claude.com/blog/skills-explained) 效果惊人 — Claude 动态发现并只加载需要的技能，避免上下文过载。
>
> 但大多数 Agent 框架？一次性把 500+ 工具定义塞进上下文。而且 MCP 响应？经常是 10,000+ 字符的原始数据，白白浪费 Token。
>
> 然后我惊喜地发现了 [UTCP](https://github.com/anthropics/utcp) — 正是我需要的！内置渐进式工具发现。还有 [Cloudflare 的 Code Mode](https://blog.cloudflare.com/code-mode/)？一段代码执行全部。太妙了！
>
> 于是我在 UTCP 基础上做了这个：**渐进式发现 + Code Mode + LLM 过滤** — 更聪明的 MCP 使用方式。
>
> 最棒的是？只需加一段配置。兼容 Claude Desktop、Windsurf、Cursor、Dify 等所有 MCP 客户端。无需额外服务器。

## 你在找...？

- ✅ **Claude Skills 替代方案** — 用于你的 MCP 配置
- ✅ **更好的 MCP 工具管理** — 无上下文过载
- ✅ **渐进式工具发现** — 按需加载工具
- ✅ **OpenAPI 转工具** — 直接从 OpenAPI/Swagger 注册 REST API
- ✅ **MCP Token 优化** — 减少 90%+ Token 浪费
- ✅ **MCP 响应过滤** — 智能摘要

**你来对地方了。**

## 这是什么？

**LLM 擅长写代码，但不擅长调用工具。**

传统 MCP 直接把工具暴露给 LLM — 但 LLM 面临：
- 工具太多（500+ 定义 = 困惑）
- 响应太大（10,000+ 字符 = 浪费 Token）
- 往返太多（15+ 次 API 调用 = 慢且贵）

**`utcp-mcp-gateway` 一次解决所有问题：**

| 问题 | 解决方案 |
|------|----------|
| 500+ 工具定义 | **渐进式发现** — 只加载需要的 |
| 10,000+ 字符响应 | **LLM 过滤** — 智能摘要（缩小 97%！）|
| 15+ 次 API 往返 | **Code Mode** — 一段代码，一次执行 |

```
传统方式:   用户 → LLM → 工具1 → LLM → 工具2 → LLM → 工具3 → 结果
            (15+ 次调用, $26/天, 慢)

Code Mode:  用户 → LLM 写代码 → 一次执行全部 → 结果
            (1 次调用, $0.87/天, 快)
```

**结果：每年节省 $9,536** ([基准测试来源](https://github.com/imran31415/codemode_python_benchmark))

## 核心功能

| 功能 | 说明 |
|------|------|
| 🔌 **通用 MCP** | 连接任意 HTTP 或 stdio MCP |
| 📜 **OpenAPI 支持** | 直接从 OpenAPI/Swagger 规范注册 REST API |
| 🧠 **LLM 过滤** | 智能摘要（响应缩小 97%！）|
| 🔍 **渐进式发现** | `search_tools` - 按需搜索，无需加载全部 500 个工具 |
| ⚡ **Code Mode** | 一次调用执行 TypeScript 代码链 |
| 🔒 **安全沙箱** | 代码在隔离环境运行 |
| 📦 **零配置** | 只需环境变量，无需配置文件 |

## 快速开始

**零配置文件！** 直接添加到 Claude Desktop 配置：

### 模式 1：HTTP MCP（远程）

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_URL": "https://mcp.context7.com/mcp",
        "MCP_NAME": "context7",
        "LLM_API_KEY": "sk-xxx",
        "LLM_BASE_URL": "https://api.openai.com/v1",
        "LLM_MODEL": "gpt-4o-mini"
      }
    }
  }
}
```

### 模式 2：stdio MCP（本地）

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_COMMAND": "npx",
        "MCP_ARGS": "-y,@anthropic/mcp-server-filesystem",
        "MCP_NAME": "filesystem",
        "MCP_TRANSPORT": "stdio",
        "LLM_API_KEY": "sk-xxx"
      }
    }
  }
}
```

> ⚠️ **Windows 用户：** 使用 `cmd /c npx` 代替 `npx`：
> ```json
> "command": "cmd",
> "args": ["/c", "npx", "-y", "utcp-mcp-gateway"]
> ```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `MCP_URL` | HTTP 模式 | MCP 服务器 URL |
| `MCP_COMMAND` | stdio 模式 | 运行 MCP 的命令 |
| `MCP_ARGS` | stdio 模式 | 参数（逗号分隔）|
| `MCP_NAME` | ✅ | MCP 命名空间 |
| `MCP_TRANSPORT` | 否 | `http`（默认）或 `stdio` |
| `LLM_API_KEY` | 过滤用 | 任意 OpenAI 兼容的 API Key |
| `LLM_BASE_URL` | 过滤用 | API 端点（默认 OpenAI）|
| `LLM_MODEL` | 过滤用 | 模型名称（默认 gpt-4o-mini）|

配置好后重启 Claude Desktop，试试：*"搜索 React useState 用法"*

## 工作原理

```
┌──────────────┐     ┌─────────────────────────────────┐     ┌─────────────┐
│   你的 AI    │────▶│      utcp-mcp-gateway           │────▶│  任意 MCP   │
│ (Claude 等)  │     │  ┌─────────┐  ┌─────────────┐   │     │ (Context7)  │
└──────────────┘     │  │  UTCP   │  │ LLM 过滤器  │   │     └─────────────┘
                     │  │  搜索   │  │ 10K→300字符 │   │
                     │  └─────────┘  └─────────────┘   │
                     └─────────────────────────────────┘
```

**Gateway 向你的 AI 暴露 4 个工具：**

| 工具 | 参数 | 作用 |
|------|------|------|
| `search_tools` | `query`, `limit` | 按关键词搜索工具，返回带 TypeScript 接口的工具列表 |
| `list_tools` | - | 列出所有已注册的工具 |
| `tool_info` | `tool_name` | 获取特定工具的详细 TypeScript 接口 |
| `call_tool_chain` | `code`, `timeout`, `max_output_size`, `filter_response`, `purpose` | 执行 TypeScript 代码，一次调用多个工具 |

### 上下文感知摘要

使用 `call_tool_chain` 时，设置 `filter_response: true` 并提供 `purpose` 参数，LLM 会根据你的目的智能提取相关信息：

```typescript
call_tool_chain({
  code: "const docs = await context7.context7_get_library_docs({...}); return docs;",
  filter_response: true,
  purpose: "查找 React useState 的用法示例"
})
```

LLM 会只提取与你目的相关的信息，而不是泛泛的摘要。

### 调用流程示例

```
用户: "React useState 怎么用？"

1. AI 调用 search_tools("react")        → 返回带 TypeScript 接口的工具
2. AI 调用 call_tool_chain 执行代码：
   const id = await context7.context7_resolve_library_id({ libraryName: "react" });
   const docs = await context7.context7_get_library_docs({ libraryId: id, topic: "useState" });
   return docs;
3. Gateway 执行代码并返回结果
4. AI 收到结构化响应
```

## Token 节省实测

| MCP 服务 | 原始响应 | 过滤后 | 节省 |
|----------|----------|--------|------|
| Context7 | 10,625 字符 | 326 字符 | **97%** |
| DeepWiki | 3,318 字符 | 400 字符 | **88%** |

## 配置说明

### 单个 MCP

```bash
MCP_URL=https://mcp.context7.com/mcp
MCP_NAME=context7
```

### 多个 MCP（推荐：编号方式）

使用编号环境变量进行清晰配置：

```json
{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["-y", "utcp-mcp-gateway"],
      "env": {
        "MCP_1_NAME": "context7",
        "MCP_1_URL": "https://mcp.context7.com/mcp",
        
        "MCP_2_NAME": "filesystem",
        "MCP_2_COMMAND": "npx",
        "MCP_2_ARGS": "-y,@anthropic/mcp-server-filesystem,/path/to/dir",
        
        "LLM_API_KEY": "sk-xxx",
        "MAX_RESPONSE_CHARS": "10000"
      }
    }
  }
}
```

**编号变量：**
- `MCP_1_NAME`, `MCP_1_URL` - 第一个 MCP（HTTP 模式）
- `MCP_2_NAME`, `MCP_2_COMMAND`, `MCP_2_ARGS` - 第二个 MCP（stdio 模式）
- 最多支持 `MCP_20_*`

### 多个 MCP（备选：分号方式）

```json
{
  "env": {
    "MCP_URL": "https://mcp.context7.com/mcp;https://mcp.deepwiki.com/mcp",
    "MCP_NAME": "context7;deepwiki"
  }
}
```

### LLM 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `LLM_API_KEY` | - | OpenAI/OpenRouter API 密钥 |
| `LLM_BASE_URL` | OpenAI | 自定义端点（兼容 OpenAI 格式）|
| `LLM_MODEL` | gpt-4o-mini | 摘要用的模型 |
| `ENABLE_LLM_FILTER` | true | 开启/关闭过滤 |
| `MAX_RESPONSE_CHARS` | 10000 | 超过此长度时使用 LLM 摘要 |
| `FORCE_LLM_FILTER` | false | 强制所有响应都经过 LLM 摘要 |

### 智能路由配置 (v0.1.20+)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ENABLE_LLM_SEARCH` | true | 使用 LLM 智能搜索工具 |
| `ROUTER_MODEL` | (复用 LLM_MODEL) | 路由用的模型（建议用更快的模型）|

**工作原理：**
- `list_tools` 返回精简摘要而非完整 schema（节省 token）
- `search_tools` 使用 LLM 理解意图并推荐相关工具（使用全量描述确保准确性）
- LLM 不可用时回退到关键词搜索
- 工具名模糊匹配，容错 LLM 返回格式不完全一致的情况
- 超大响应（>200k 字符）预截断后再进行 LLM 摘要

### OpenAPI 配置 (v0.1.24+)

直接从 OpenAPI/Swagger 规范注册 REST API：

```bash
# 示例：APIs.guru（公开的 API 目录）
OPENAPI_1_NAME=apisguru
OPENAPI_1_URL=https://api.apis.guru/v2/openapi.yaml

# 带认证的示例
OPENAPI_2_NAME=my_api
OPENAPI_2_URL=https://api.example.com/openapi.json
OPENAPI_2_AUTH_TYPE=api-key
OPENAPI_2_AUTH_TOKEN=sk-xxx
OPENAPI_2_AUTH_VAR=X-Api-Key
OPENAPI_2_AUTH_LOCATION=header
```

| 变量 | 必填 | 说明 |
|------|------|------|
| `OPENAPI_N_NAME` | ✅ | 工具源名称 |
| `OPENAPI_N_URL` | ✅ | OpenAPI 规范地址 |
| `OPENAPI_N_AUTH_TYPE` | ❌ | `api-key`、`bearer`、`basic` 或 `none` |
| `OPENAPI_N_AUTH_TOKEN` | ❌ | 认证令牌/密钥 |
| `OPENAPI_N_AUTH_VAR` | ❌ | 头名称（默认 `Authorization`）|
| `OPENAPI_N_AUTH_LOCATION` | ❌ | `header`、`query` 或 `cookie` |

**工作原理：**
- 下载并解析 OpenAPI 2.0/3.0 规范
- 每个操作转换为一个 UTCP 工具
- 工具名 = OpenAPI 规范中的 operationId
- 工具描述 = OpenAPI 规范中的 summary 或 description
- 支持 API Key、Bearer、Basic 和 OAuth2 认证

**注意事项：**
- API 操作必须有 `operationId`（没有的会被跳过）
- 文件上传参数（`type: file`）不被 UTCP SDK 支持

---

## Credits / 致谢

This project is built on top of amazing open-source work:

- **[UTCP (Universal Tool Calling Protocol)](https://github.com/anthropics/utcp)** - The protocol that makes this possible
- **[@utcp/code-mode](https://www.npmjs.com/package/@utcp/code-mode)** - Code execution capabilities
- **[@utcp/sdk](https://www.npmjs.com/package/@utcp/sdk)** - UTCP SDK
- **[@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk)** - MCP SDK by Anthropic

## License

MIT © 2025 reinn
