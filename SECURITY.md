# Security

## Supported Content

This repository is intended for public skills, templates, examples, and MCP server code.

Do not commit:

- API keys, access tokens, cookies, or private credentials
- private customer, company, or personal data
- local environment files except safe `.env.example` files
- generated artifacts that contain sensitive prompt history or tool output

## MCP Server Safety

- For stdio servers, send protocol messages only on stdout and logs only on stderr.
- For HTTP servers, bind local development servers to `127.0.0.1` by default.
- Validate `Origin` and host headers on HTTP transports.
- Require authentication for remote MCP servers that can access private data or perform side effects.
- Treat tool inputs as untrusted.

## Reporting

If you find a security issue, avoid opening a public issue with sensitive details. Contact the repository owner privately first.
