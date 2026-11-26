import type { AddressInfo } from 'node:net';

import { serve, type ServerType } from '@hono/node-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../src/http.ts';
import { SERVER_NAME } from '../src/server.ts';

const PROTOCOL_VERSION = '2026-07-28';

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

interface RpcOptions {
  id?: number;
  params?: Record<string, unknown>;
  name?: string;
  version?: string;
  headers?: Record<string, string>;
}

function post(body: unknown, headers: Record<string, string>) {
  return fetch(`${base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: JSON.stringify(body),
  });
}

function rpc(method: string, { id = 1, params = {}, name, version = PROTOCOL_VERSION, headers = {} }: RpcOptions = {}) {
  const _meta = {
    'io.modelcontextprotocol/protocolVersion': version,
    'io.modelcontextprotocol/clientCapabilities': {},
    'io.modelcontextprotocol/clientInfo': { name: 'smoke', version: '0' },
  };
  return post(
    { jsonrpc: '2.0', id, method, params: { ...params, _meta } },
    {
      'MCP-Protocol-Version': version,
      'Mcp-Method': method,
      ...(name && { 'Mcp-Name': name }),
      ...headers,
    },
  );
}

describe('HTTP', () => {
  it('answers server/discover with plain JSON and no session', async () => {
    const res = await rpc('server/discover');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^application\/json/);
    expect(res.headers.get('mcp-session-id')).toBeNull();
    expect(await res.json()).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        resultType: 'complete',
        supportedVersions: [PROTOCOL_VERSION],
        _meta: { 'io.modelcontextprotocol/serverInfo': { name: SERVER_NAME } },
      },
    });
  });

  it('answers tools/list', async () => {
    const res = await rpc('tools/list', { id: 2 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: { resultType: string; tools: Array<{ name: string }> } };
    expect(body.result.resultType).toBe('complete');
    expect(body.result.tools.map((t) => t.name).sort()).toEqual(['get_planet', 'list_moons']);
  });

  it('answers tools/call', async () => {
    const res = await rpc('tools/call', {
      id: 3,
      name: 'get_planet',
      params: { name: 'get_planet', arguments: { name: 'Mars' } },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ result: { structuredContent: { name: 'Mars' } } });
  });

  it('rejects the 2025-era initialize handshake', async () => {
    const res = await post(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'initialize',
        params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'smoke', version: '0' } },
      },
      {},
    );
    expect(await res.json()).toMatchObject({ id: 4, error: { code: -32022, data: { supported: [PROTOCOL_VERSION] } } });
  });

  it('rejects an unknown protocol version', async () => {
    const res = await rpc('tools/list', { id: 5, version: '2099-01-01' });
    expect(await res.json()).toMatchObject({ id: 5, error: { code: -32022 } });
  });

  it('accepts a localhost Origin', async () => {
    const res = await rpc('server/discover', { headers: { Origin: 'http://localhost:6274' } });
    expect(res.status).toBe(200);
  });

  it('rejects a disallowed Origin with 403', async () => {
    const res = await rpc('server/discover', { headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
  });

  it('rejects a disallowed Host with 403', async () => {
    // fetch won't let us override Host, so call the app directly.
    const res = await createApp().request('/mcp', {
      method: 'POST',
      headers: { Host: 'evil.example', 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 6, method: 'server/discover' }),
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
