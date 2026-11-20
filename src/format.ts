import { type Planet, planetUnits, type Satellite, satelliteUnits } from './data.ts';

export function describeUnits(units: Record<string, string>): string {
  return Object.entries(units)
    .map(([field, unit]) => `${field}: ${unit}`)
    .join('; ');
}

function withUnit(value: number | null, unit: string | undefined): string {
  if (value === null) return 'unknown';
  return unit === undefined || unit === 'dimensionless' ? String(value) : `${value} ${unit}`;
}

function formatFields(record: Record<string, unknown>, units: Record<string, string>, skip: string[]): string[] {
  return Object.entries(record)
    .filter(([key]) => !skip.includes(key))
    .map(([key, value]) => {
      const rendered = typeof value === 'number' || value === null ? withUnit(value, units[key]) : String(value);
      return `${key}: ${rendered}`;
    });
}

export function formatPlanet(planet: Planet): string {
  return [`${planet.name}`, ...formatFields(planet, planetUnits, ['id', 'name']).map((l) => `  ${l}`)].join('\n');
}

export function formatSatellite(satellite: Satellite): string {
  return `${satellite.name}: ${formatFields(satellite, satelliteUnits, ['id', 'planetId', 'name']).join(', ')}`;
}
