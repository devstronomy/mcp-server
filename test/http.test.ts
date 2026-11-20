import type { AddressInfo } from 'node:net';

import { serve, type ServerType } from '@hono/node-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/http.ts';
import { SERVER_NAME } from '../src/server.ts';

const PROTOCOL_VERSION = '2025-11-25';

let httpServer: ServerType;
let base: string;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    httpServer = serve({ fetch: createApp().fetch, hostname: '127.0.0.1', port: 0 }, (info: AddressInfo) => {
      base = `http://127.0.0.1:${info.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise((resolve) => httpServer.close(resolve));
});

function rpc(body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('HTTP', () => {
  it('answers initialize with plain JSON and no session', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'smoke', version: '0' } },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('mcp-session-id')).toBeNull();
    const body = await res.json();
    expect(body).toMatchObject({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: SERVER_NAME } } });
  });

  it('answers tools/list in a separate, stateless request', async () => {
    const res = await rpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { 'MCP-Protocol-Version': PROTOCOL_VERSION },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { tools: Array<{ name: string }> } };
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(['get_planet', 'list_moons']);
  });

  it('accepts a localhost Origin', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 3, method: 'ping' }, { Origin: 'http://localhost:6274' });
    expect(res.status).toBe(200);
  });

  it('rejects a disallowed Origin with 403', async () => {
    const res = await rpc({ jsonrpc: '2.0', id: 4, method: 'ping' }, { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('rejects a disallowed Host with 403', async () => {
    // fetch won't let us override Host, so call the app directly.
    const res = await createApp().request('/mcp', {
      method: 'POST',
      headers: { Host: 'evil.example', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 5, method: 'ping' }),
    });
    expect(res.status).toBe(403);
  });

  it('answers every method other than POST on /mcp with 405', async () => {
    for (const method of ['GET', 'DELETE', 'PUT', 'PATCH']) {
      const res = await fetch(`${base}/mcp`, { method });
      expect(res.status, method).toBe(405);
      expect(res.headers.get('allow'), method).toBe('POST');
      expect(await res.json(), method).toMatchObject({ jsonrpc: '2.0', error: { code: -32000 } });
    }
  });

  it('serves GET /health', async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });
});
