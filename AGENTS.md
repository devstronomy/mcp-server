# Devstronomy MCP Server

An MCP server for Solar System planets and moons, in TypeScript over Streamable HTTP. It's a learning project, so favor clarity and spec-correctness over cleverness.

## Rules for agents

- Use MCP TypeScript SDK **v2** (`@modelcontextprotocol/server`, `/hono`, `/client`) with zod 4. Never the legacy `@modelcontextprotocol/sdk` (imports like `@modelcontextprotocol/sdk/server/mcp.js`). When unsure about an API, read the installed types in `node_modules`.
- `createServer()` stays transport-independent. HTTP concerns live in the Hono layer only.
- The HTTP transport is stateless with plain JSON responses: no sessions, no SSE.
- Bind to `127.0.0.1` by default and always validate `Origin`/`Host`.
- Units come only from the units map in `src/data.ts`. Satellite `density` is g/cm³, planet `density` is kg/m³.
- An unknown planet name is a tool execution error (`isError: true`, listing valid names), not a protocol error.
- `data/*.json` are snapshots from `devstronomy/nasa-data-scraper`. Never edit values by hand, and keep `data/README.md` attribution.
- Log to stderr, never stdout.
