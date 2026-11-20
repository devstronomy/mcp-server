import { McpServer, ResourceNotFoundError, ResourceTemplate, type CallToolResult } from '@modelcontextprotocol/server';
import * as z from 'zod';

import {
  findPlanet,
  moonsOf,
  PlanetSchema,
  planetNames,
  planets,
  planetUnits,
  SatelliteSchema,
  satelliteUnits,
} from './data.ts';
import { describeUnits, formatPlanet, formatSatellite } from './format.ts';

export const SERVER_NAME = 'Devstronomy';
export const SERVER_VERSION = '0.1.0';

const PLANETS_URI = 'devstronomy://planets';
const PLANET_URI_TEMPLATE = 'devstronomy://planets/{name}';

const validNames = planetNames.join(', ');
const planetNote = `Planets: ${validNames}. Pluto is included, as in the NASA Planetary Fact Sheet.`;

function unknownPlanet(name: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: `Unknown planet "${name}". Valid names: ${validNames}.` }],
  };
}

const planetNameInput = (what: string) => z.string().min(1).describe(`${what} (case-insensitive). ${planetNote}`);

const readOnly = { readOnlyHint: true, openWorldHint: false } as const;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      // McpServer defaults to `listChanged: true`, but nothing here ever changes.
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
        prompts: { listChanged: false },
      },
    },
  );

  server.registerTool(
    'get_planet',
    {
      title: 'Get planet',
      description:
        `Physical and orbital data for one Solar System planet (NASA Planetary Fact Sheet, 2019). ${planetNote} ` +
        `Units: ${describeUnits(planetUnits)}. surfacePressure is null for the gas giants (unknown).`,
      inputSchema: z.object({ name: planetNameInput('Planet name') }),
      outputSchema: PlanetSchema,
      annotations: readOnly,
    },
    async ({ name }) => {
      const planet = findPlanet(name);
      if (!planet) return unknownPlanet(name);
      return {
        content: [{ type: 'text', text: formatPlanet(planet) }],
        structuredContent: planet,
      };
    },
  );

  server.registerTool(
    'list_moons',
    {
      title: 'List moons',
      description:
        `Physical parameters of a planet's moons (NASA/JPL, 2019). A planet without moons returns an empty list. ` +
        `Only moons with known physical parameters are listed, so the count can be lower than the planet's numberOfMoons. ` +
        `${planetNote} Units: ${describeUnits(satelliteUnits)}. Some values are null where the source had "?".`,
      inputSchema: z.object({ planet: planetNameInput('Planet whose moons to list') }),
      outputSchema: z.object({
        planet: z.string(),
        moons: z.array(SatelliteSchema),
      }),
      annotations: readOnly,
    },
    async ({ planet: name }) => {
      const planet = findPlanet(name);
      if (!planet) return unknownPlanet(name);
      const moons = moonsOf(planet);
      const header =
        moons.length === 0
          ? `${planet.name} has no moons.`
          : `${planet.name}: ${moons.length} ${moons.length === 1 ? 'moon' : 'moons'} listed (numberOfMoons in the fact sheet: ${planet.numberOfMoons}).`;
      return {
        content: [{ type: 'text', text: [header, ...moons.map(formatSatellite)].join('\n') }],
        structuredContent: { planet: planet.name, moons },
      };
    },
  );

  server.registerResource(
    'planets',
    PLANETS_URI,
    {
      title: 'All planets',
      description: `All planets as a JSON array. ${planetNote} Units: ${describeUnits(planetUnits)}.`,
      mimeType: 'application/json',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(planets, null, 2) }],
    }),
  );

  server.registerResource(
    'planet',
    new ResourceTemplate(PLANET_URI_TEMPLATE, {
      list: async () => ({
        resources: planets.map((p) => ({
          uri: `${PLANETS_URI}/${p.name.toLowerCase()}`,
          name: p.name,
          mimeType: 'application/json',
        })),
      }),
    }),
    {
      title: 'One planet',
      description: `One planet as a JSON object; {name} is case-insensitive. ${planetNote} Units: ${describeUnits(planetUnits)}.`,
      mimeType: 'application/json',
    },
    async (uri, { name }) => {
      const planet = typeof name === 'string' ? findPlanet(decodeURIComponent(name)) : undefined;
      if (!planet)
        throw new ResourceNotFoundError(uri.href, `Unknown planet in ${uri.href}. Valid names: ${validNames}.`);
      return {
        contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(planet, null, 2) }],
      };
    },
  );

  server.registerPrompt(
    'compare_planets',
    {
      title: 'Compare two planets',
      description: `Ask the model to compare two planets using this server's data. ${planetNote}`,
      argsSchema: z.object({
        a: z.string().describe('First planet name'),
        b: z.string().describe('Second planet name'),
      }),
    },
    ({ a, b }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Compare the planets ${a} and ${b}.\n\n` +
              `Get the data with the devstronomy tools: call get_planet for each planet and list_moons for each planet ` +
              `(or read the ${PLANET_URI_TEMPLATE} resource). ` +
              `Cover size and mass, gravity, density, orbit (distance from the Sun, period, eccentricity), ` +
              `rotation and day length, temperature and atmosphere, rings, magnetic field, and moons. ` +
              `Always state units as given in the tool output, point out the most striking differences, ` +
              `and say so when a value is unknown.`,
          },
        },
      ],
    }),
  );

  return server;
}
