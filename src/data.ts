import * as z from 'zod';

import planetsJson from '../data/planets.json' with { type: 'json' };
import satellitesJson from '../data/satellites.json' with { type: 'json' };

export const planetUnits = {
  mass: '10²⁴ kg',
  diameter: 'km',
  density: 'kg/m³',
  gravity: 'm/s²',
  escapeVelocity: 'km/s',
  rotationPeriod: 'hours (negative = retrograde)',
  lengthOfDay: 'hours',
  distanceFromSun: '10⁶ km',
  perihelion: '10⁶ km',
  aphelion: '10⁶ km',
  orbitalPeriod: 'days',
  orbitalVelocity: 'km/s',
  orbitalInclination: 'degrees',
  orbitalEccentricity: 'dimensionless',
  obliquityToOrbit: 'degrees',
  meanTemperature: '°C',
  surfacePressure: 'bars',
} as const;

export const satelliteUnits = {
  gm: 'km³/s²',
  radius: 'km (mean)',
  density: 'g/cm³',
  magnitude: 'mean opposition magnitude (V or R band)',
  albedo: 'geometric albedo, dimensionless',
} as const;

const measured = (unit: string) => z.number().describe(unit);

export const PlanetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  mass: measured(planetUnits.mass),
  diameter: measured(planetUnits.diameter),
  density: measured(planetUnits.density),
  gravity: measured(planetUnits.gravity),
  escapeVelocity: measured(planetUnits.escapeVelocity),
  rotationPeriod: measured(planetUnits.rotationPeriod),
  lengthOfDay: measured(planetUnits.lengthOfDay),
  distanceFromSun: measured(planetUnits.distanceFromSun),
  perihelion: measured(planetUnits.perihelion),
  aphelion: measured(planetUnits.aphelion),
  orbitalPeriod: measured(planetUnits.orbitalPeriod),
  orbitalVelocity: measured(planetUnits.orbitalVelocity),
  orbitalInclination: measured(planetUnits.orbitalInclination),
  orbitalEccentricity: measured(planetUnits.orbitalEccentricity),
  obliquityToOrbit: measured(planetUnits.obliquityToOrbit),
  meanTemperature: measured(planetUnits.meanTemperature),
  surfacePressure: measured(planetUnits.surfacePressure)
    .nullable()
    .describe(`${planetUnits.surfacePressure}; null when unknown (gas giants)`),
  numberOfMoons: z.number().int().describe('IAU-confirmed moons (2019); may exceed the satellites listed'),
  hasRingSystem: z.boolean(),
  hasGlobalMagneticField: z.boolean(),
});

export const SatelliteSchema = z.object({
  id: z.number().int(),
  planetId: z.number().int(),
  name: z.string(),
  gm: measured(satelliteUnits.gm),
  radius: measured(satelliteUnits.radius),
  density: measured(satelliteUnits.density).nullable(),
  magnitude: measured(satelliteUnits.magnitude).nullable(),
  albedo: measured(satelliteUnits.albedo).nullable(),
});

export type Planet = z.infer<typeof PlanetSchema>;
export type Satellite = z.infer<typeof SatelliteSchema>;

export const planets: readonly Planet[] = z.array(PlanetSchema).parse(planetsJson);
export const satellites: readonly Satellite[] = z.array(SatelliteSchema).parse(satellitesJson);

export const planetNames: readonly string[] = planets.map((p) => p.name);

export function findPlanet(name: string): Planet | undefined {
  const wanted = name.toLowerCase();
  return planets.find((p) => p.name.toLowerCase() === wanted);
}

export function moonsOf(planet: Planet): Satellite[] {
  return satellites.filter((s) => s.planetId === planet.id);
}
