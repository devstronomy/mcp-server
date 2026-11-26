# Devstronomy MCP Server

An MCP server for Solar System planets and their moons.

As with the rest of [Devstronomy](https://github.com/devstronomy/), this project serves mainly for learning purposes - in this case, the [MCP](https://modelcontextprotocol.io).

The data comes via [`devstronomy/nasa-data-scraper`](https://github.com/devstronomy/nasa-data-scraper) (see [`data/README.md`](data/README.md)).

## Feature Set

| Kind              | Name                           | Description                                                   |
| ----------------- | ------------------------------ | ------------------------------------------------------------- |
| Tool              | `get_planet(name)`             | One planet: structured data plus a text block with units      |
| Tool              | `list_moons(planet)`           | A planet's moons. A planet with no moons gives an empty list. |
| Resource          | `devstronomy://planets`        | All planets as JSON                                           |
| Resource template | `devstronomy://planets/{name}` | One planet as JSON                                            |
| Prompt            | `compare_planets(a, b)`        | Asks the model to compare two planets using the tools above   |

Names are case-insensitive (`earth` = `Earth`). Pluto is included, as in the NASA fact sheet.

## Run

Requires Node 24 (`nvm use`).

```sh
npm install
npm run dev
npm run build && npm start
```

The server listens on `http://127.0.0.1:3000/mcp`. Set `HOST` and `PORT` to change that. `GET /health` returns `{"status":"ok"}`.

## Connect a client

**Claude Code:**

```sh
claude mcp add --transport http devstronomy http://127.0.0.1:3000/mcp
```

**MCP Inspector:**

```sh
npx @modelcontextprotocol/inspector
```

Choose the "Streamable HTTP" transport and enter `http://127.0.0.1:3000/mcp`.

## Raw JSON-RPC with curl

This shows the protocol with nothing in between. Every MCP message is a JSON-RPC 2.0 request sent with `POST /mcp`.

The server speaks MCP `2026-07-28` (no handshake).

**1. Discover the server** (optional: supported versions, capabilities, identity):

```sh
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: server/discover' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "server/discover",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
          "name": "curl",
          "version": "0"
        }
      }
    }
  }'
```

**2. List tools:**

```sh
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/list' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
          "name": "curl",
          "version": "0"
        }
      }
    }
  }'
```

**3. Call a tool:**

```sh
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: get_planet' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "get_planet",
      "arguments": {
        "name": "mars"
      },
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        "io.modelcontextprotocol/clientInfo": {
          "name": "curl",
          "version": "0"
        }
      }
    }
  }'
```

## Data notes

- Units come from the [Planetary Fact Sheet notes](https://nssdc.gsfc.nasa.gov/planetary/factsheet/planetfact_notes.html) and the [JPL satellite page](https://ssd.jpl.nasa.gov/sats/phys_par/). They're defined once in `src/data.ts`, and appear in the tool descriptions and text output. Structured values are plain numbers.
- Satellite `density` is in g/cm³, while planet `density` is in kg/m³.
- Some values are `null`: `surfacePressure` for the gas giants, and a few satellite values the source marks as unknown.
- `numberOfMoons` (e.g. Jupiter 79) can be larger than the number of moons `list_moons` returns (Jupiter 67). JPL lists only moons with known physical parameters, and the data is from 2019.

## License

[MIT](LICENSE) for the code. The data is courtesy of NASA/NSSDCA and NASA/JPL-Caltech (see [`data/README.md`](data/README.md)).
