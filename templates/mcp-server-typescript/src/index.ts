#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "mcp-server-template",
  version: "0.1.0"
});

server.registerTool(
  "echo",
  {
    title: "Echo",
    description: "Return the provided message.",
    inputSchema: {
      message: z.string().min(1)
    },
    outputSchema: {
      message: z.string()
    }
  },
  async ({ message }) => {
    const output = { message };

    return {
      content: [{ type: "text", text: message }],
      structuredContent: output
    };
  }
);

server.registerResource(
  "about",
  "repo://about",
  {
    title: "About This Server",
    description: "Static metadata for the template MCP server.",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        text: "A starter MCP server for Soren Skills Repo."
      }
    ]
  })
);

server.registerPrompt(
  "summarize-skill",
  {
    title: "Summarize Skill",
    description: "Create a concise review prompt for a Codex skill.",
    argsSchema: {
      skillName: z.string().min(1)
    }
  },
  ({ skillName }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Summarize the ${skillName} skill and identify its required resources.`
        }
      }
    ]
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
