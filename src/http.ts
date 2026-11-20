import { createMcpHonoApp } from '@modelcontextprotocol/hono';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import type { Hono } from 'hono';
import { logger } from 'hono/logger';

import { createServer } from './server.ts';

export interface AppOptions {
  log?: boolean;
}

type McpEnv = { Variables: { parsedBody?: unknown } };

function jsonRpcError(code: number, message: string) {
  return { jsonrpc: '2.0', error: { code, message }, id: null } as const;
}

export function createApp(options: AppOptions = {}): Hono<McpEnv> {
  // The SDK returns an untyped Hono, but it does set `parsedBody`.
  const app = createMcpHonoApp() as unknown as Hono<McpEnv>;

  if (options.log)
    app.use(
      '*',
      logger((line) => console.error(line)),
    );

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.post('/mcp', async (c) => {
    const server = createServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    try {
      await server.connect(transport);
      return await transport.handleRequest(c.req.raw, { parsedBody: c.get('parsedBody') });
    } finally {
      await server.close();
    }
  });

  app.all('/mcp', (c) => {
    c.header('Allow', 'POST');
    return c.json(jsonRpcError(-32000, 'Method not allowed.'), 405);
  });

  app.onError((err, c) => {
    console.error('Unhandled error:', err);
    return c.json(jsonRpcError(-32603, 'Internal server error'), 500);
  });

  return app;
}
