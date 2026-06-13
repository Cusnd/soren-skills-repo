# MCP Authoring

MCP servers expose tools, resources, and prompts to MCP clients.

## SDK Choice

For TypeScript servers, prefer the stable v1 package line until v2 is production-ready:

```bash
npm install @modelcontextprotocol/sdk zod
```

The TypeScript template in this repository uses stdio because it is the simplest local transport for Codex, desktop clients, and other process-spawned integrations.

## Transport Guidelines

Use stdio when:

- the client launches the server as a local subprocess
- the server does not need to accept remote connections
- setup should remain simple

Use Streamable HTTP when:

- the server is remote
- multiple clients or sessions must connect
- you need HTTP auth, hosting, or deployment controls

For stdio:

- write MCP protocol messages only to stdout
- write logs only to stderr
- avoid interactive prompts

For HTTP:

- bind local dev servers to `127.0.0.1`
- validate `Origin` and host headers
- add authentication before exposing private data or side effects

## Tool Design

- Give every tool a clear name, title, description, and input schema.
- Keep tool side effects narrow and explicit.
- Return structured content when clients can benefit from machine-readable output.
- Use resources for read-only reference data.
- Use prompts for reusable model-facing workflows.

## Useful References

- MCP SDK overview: https://modelcontextprotocol.io/docs/sdk
- MCP TypeScript SDK v1 docs: https://ts.sdk.modelcontextprotocol.io/
- MCP transport specification: https://modelcontextprotocol.io/specification/2025-06-18/basic/transports
