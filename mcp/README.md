# MCP Servers

Put production MCP servers in `mcp/servers/<server-name>/`.

Each server should document:

- what it exposes
- which transport it uses
- how to run it locally
- how to connect from an MCP client
- what environment variables are required

Use `templates/mcp-server-typescript/` as a starting point for a local stdio TypeScript server.
