# TypeScript MCP Server Template

A minimal stdio MCP server template for local process-spawned integrations.

## Setup

```bash
npm install
npm run build
npm start
```

For development:

```bash
npm run dev
```

## Client Configuration

Example local MCP client entry:

```json
{
  "mcpServers": {
    "mcp-server-template": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

## Contents

- `echo` tool - returns the provided message.
- `about` resource - exposes static server metadata.
- `summarize-skill` prompt - creates a reusable skill review prompt.

Rename the server and replace these examples before publishing.
