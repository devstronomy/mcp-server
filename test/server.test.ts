import { Client, InMemoryTransport, ProtocolError } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { planetNames, satellites } from '../src/data.ts';
import { createServer, SERVER_NAME } from '../src/server.ts';

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await createServer().connect(serverTransport);
  client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterAll(async () => {
  await client.close();
});

function textOf(result: { content?: unknown }): string {
  const content = result.content as Array<{ type: string; text?: string }>;
  return content.map((c) => c.text ?? '').join('\n');
}

describe('server info', () => {
  it('identifies itself by SERVER_NAME without listChanged', () => {
    expect(client.getServerVersion()?.name).toBe(SERVER_NAME);
    const caps = client.getServerCapabilities();
    expect(caps?.tools?.listChanged).toBe(false);
    expect(caps?.resources?.listChanged).toBe(false);
    expect(caps?.prompts?.listChanged).toBe(false);
  });
});

describe('tools', () => {
  it('lists get_planet and list_moons with input and output schemas', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['get_planet', 'list_moons']);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
    const getPlanet = tools.find((t) => t.name === 'get_planet');
    expect(getPlanet?.description).toContain('Pluto');
    expect(getPlanet?.description).toContain('kg/m³');
  });

  it('get_planet returns structured content and text with units, case-insensitively', async () => {
    const result = await client.callTool({ name: 'get_planet', arguments: { name: 'eArTh' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ name: 'Earth', mass: 5.97, density: 5514, numberOfMoons: 1 });
    const text = textOf(result);
    expect(text).toContain('mass: 5.97 10²⁴ kg');
    expect(text).toContain('density: 5514 kg/m³');
  });

  it('get_planet reports unknown surface pressure as null', async () => {
    const result = await client.callTool({ name: 'get_planet', arguments: { name: 'Jupiter' } });
    expect(result.structuredContent).toMatchObject({ surfacePressure: null });
    expect(textOf(result)).toContain('surfacePressure: unknown');
  });

  it('get_planet with an unknown name is a tool execution error listing valid names', async () => {
    const result = await client.callTool({ name: 'get_planet', arguments: { name: 'Vulcan' } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    const text = textOf(result);
    expect(text).toContain('Vulcan');
    for (const name of planetNames) expect(text).toContain(name);
  });

  it('list_moons returns the moons with satellite units (density in g/cm³)', async () => {
    const result = await client.callTool({ name: 'list_moons', arguments: { planet: 'mars' } });
    expect(result.isError).toBeFalsy();
    const { planet, moons } = result.structuredContent as { planet: string; moons: Array<{ name: string }> };
    expect(planet).toBe('Mars');
    expect(moons.map((m) => m.name)).toEqual(['Phobos', 'Deimos']);
    expect(textOf(result)).toContain('density: 1.872 g/cm³');
  });

  it('list_moons lists only the satellites in the dataset (fewer than numberOfMoons)', async () => {
    const result = await client.callTool({ name: 'list_moons', arguments: { planet: 'Jupiter' } });
    const { moons } = result.structuredContent as { moons: unknown[] };
    expect(moons).toHaveLength(satellites.filter((s) => s.planetId === 5).length);
    expect(moons).toHaveLength(67);
  });

  it('list_moons for a planet without moons is an empty list, not an error', async () => {
    const result = await client.callTool({ name: 'list_moons', arguments: { planet: 'Venus' } });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ planet: 'Venus', moons: [] });
  });

  it('list_moons with an unknown planet is a tool execution error', async () => {
    const result = await client.callTool({ name: 'list_moons', arguments: { planet: 'Vulcan' } });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Valid names: Mercury');
  });

  it('arguments that violate the input schema are reported as a tool execution error (SDK behavior)', async () => {
    const result = await client.callTool({ name: 'get_planet', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/validation/i);
  });

  it('calling a tool that does not exist is a protocol (JSON-RPC) error', async () => {
    await expect(client.callTool({ name: 'no_such_tool', arguments: {} })).rejects.toBeInstanceOf(ProtocolError);
  });
});

describe('resources', () => {
  it('lists the planets resource and one entry per planet from the template', async () => {
    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri);
    expect(uris).toContain('devstronomy://planets');
    expect(uris).toContain('devstronomy://planets/earth');
    expect(resources).toHaveLength(1 + planetNames.length);
  });

  it('lists the planet resource template', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((t) => t.uriTemplate)).toEqual(['devstronomy://planets/{name}']);
  });

  it('reads all planets as JSON', async () => {
    const { contents } = await client.readResource({ uri: 'devstronomy://planets' });
    expect(contents).toHaveLength(1);
    expect(contents[0]?.mimeType).toBe('application/json');
    const planets = JSON.parse((contents[0] as { text: string }).text) as Array<{ name: string }>;
    expect(planets.map((p) => p.name)).toEqual(planetNames);
  });

  it('reads one planet through the template, case-insensitively', async () => {
    const { contents } = await client.readResource({ uri: 'devstronomy://planets/SATURN' });
    expect(contents[0]?.uri).toBe('devstronomy://planets/SATURN');
    expect(JSON.parse((contents[0] as { text: string }).text)).toMatchObject({ name: 'Saturn', hasRingSystem: true });
  });

  it('reading an unknown planet is a resource-not-found protocol error', async () => {
    await expect(client.readResource({ uri: 'devstronomy://planets/vulcan' })).rejects.toThrow(/Valid names/);
  });
});

describe('prompts', () => {
  it('lists compare_planets with its two arguments', async () => {
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toEqual(['compare_planets']);
    expect(prompts[0]?.arguments?.map((a) => [a.name, a.required])).toEqual([
      ['a', true],
      ['b', true],
    ]);
  });

  it('gets compare_planets as a user message that points at the tools', async () => {
    const { messages } = await client.getPrompt({ name: 'compare_planets', arguments: { a: 'Earth', b: 'Mars' } });
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    const text = (messages[0]?.content as { text: string }).text;
    expect(text).toContain('Earth');
    expect(text).toContain('Mars');
    expect(text).toContain('get_planet');
    expect(text).toContain('list_moons');
  });
});
