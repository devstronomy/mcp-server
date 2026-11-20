import { serve } from '@hono/node-server';

import { createApp } from './http.ts';
import { SERVER_NAME } from './server.ts';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}

const app = createApp({ log: true });

serve({ fetch: app.fetch, hostname: host, port }, (info) => {
  console.error(`${SERVER_NAME} MCP server listening on http://${info.address}:${info.port}/mcp`);
});
