/**
 * Country Configuration System
 *
 * Defines available countries, their cities, and team naming conventions.
 * Each country has 200 cities assigned to 10 divisions by population.
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Supported country codes
 */
export type CountryCode = 'US' | 'UK' | 'DE' | 'FR' | 'ES' | 'IT' | 'CA' | 'AU';

/**
 * Team naming style by culture
 */
export type NamingStyle = 'american' | 'english' | 'german' | 'french' | 'spanish' | 'italian';

/**
 * City data for team generation
 */
export interface CityData {
  name: string;
  population: number;
  region?: string; // State/Province for disambiguation
}

/**
 * Country configuration
 */
export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  namingStyle: NamingStyle;
  /** Budget multiplier relative to USA (1.0) */
  budgetMultiplier: number;
}

/**
 * Team name components for generation
 */
export interface TeamNameComponents {
  prefixes: string[];
  suffixes: string[];
  standalone: string[]; // Names that work alone (e.g., "Juventus")
}

// =============================================================================
// COUNTRY CONFIGURATIONS
// =============================================================================

export const COUNTRY_CONFIGS: Record<CountryCode, CountryConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    flag: '\u{1F1FA}\u{1F1F8}',
    currency: 'USD',
    currencySymbol: '$',
    namingStyle: 'american',
    budgetMultiplier: 1.0,
  },
  UK: {
    code: 'UK',
    name: 'England',
    flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}',
    currency: 'GBP',
    currencySymbol: '\u{00A3}',
    namingStyle: 'english',
    budgetMultiplier: 1.0,
  },
  DE: {
    code: 'DE',
    name: 'Germany',
    flag: '\u{1F1E9}\u{1F1EA}',
    currency: 'EUR',
    currencySymbol: '\u{20AC}',
    namingStyle: 'german',
    budgetMultiplier: 0.95,
  },
  FR: {
    code: 'FR',
    name: 'France',
    flag: '\u{1F1EB}\u{1F1F7}',
    currency: 'EUR',
    currencySymbol: '\u{20AC}',
    namingStyle: 'french',
    budgetMultiplier: 0.9,
  },
  ES: {
    code: 'ES',
    name: 'Spain',
    flag: '\u{1F1EA}\u{1F1F8}',
    currency: 'EUR',
    currencySymbol: '\u{20AC}',
    namingStyle: 'spanish',
    budgetMultiplier: 0.85,
  },
  IT: {
    code: 'IT',
    name: 'Italy',
    flag: '\u{1F1EE}\u{1F1F9}',
    currency: 'EUR',
    currencySymbol: '\u{20AC}',
    namingStyle: 'italian',
    budgetMultiplier: 0.85,
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    flag: '\u{1F1E8}\u{1F1E6}',
    currency: 'CAD',
    currencySymbol: '$',
    namingStyle: 'american', // Similar to US
    budgetMultiplier: 0.9,
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    flag: '\u{1F1E6}\u{1F1FA}',
    currency: 'AUD',
    currencySymbol: '$',
    namingStyle: 'english', // Similar to UK
    budgetMultiplier: 0.85,
  },
};

// =============================================================================
// TEAM NAMING COMPONENTS BY STYLE
// =============================================================================

/**
 * Team naming components by style (sport-neutral)
 * Used for reference/display - actual generation is in teamNameGenerator.ts
 *
 * Removed football-specific terms:
 * - FC (Football Club)
 * - CF (Club de Fútbol)
 * - FSV (Fußball- und Sportverein)
 * - Calcio (Italian for football)
 * - Foot (French for football)
 * - AC (Associazione Calcio)
 * - UC (Unione Calcio)
 * - Balompie (Spanish for football)
 */
export const NAMING_COMPONENTS: Record<NamingStyle, TeamNameComponents> = {
  american: {
    prefixes: [],
    suffixes: [
      'SC', 'United', 'City', 'Athletic', 'Sporting',
      'Union', 'Real', 'Inter', 'Olympic', 'Metro',
    ],
    standalone: [],
  },
  english: {
    prefixes: [],
    suffixes: [
      'United', 'City', 'Town', 'Rovers', 'Wanderers',
      'Athletic', 'Albion', 'Wednesday', 'Forest', 'Villa',
      'Hotspur', 'Rangers', 'County', 'Palace', 'Argyle',
    ],
    standalone: [],
  },
  german: {
    prefixes: [
      'TSV', 'VfB', 'VfL', 'SV', 'SC', 'SpVgg',
      'Borussia', 'Eintracht', 'Fortuna', 'Hertha', 'Arminia',
    ],
    suffixes: ['04', '05', '09', '1860', '1899', '1900'],
    standalone: [],
  },
  french: {
    prefixes: [
      'Olympique', 'AS', 'SC', 'Stade', 'Racing',
      'Girondins de', 'OGC', 'AJ', 'US', 'Entente',
    ],
    suffixes: ['SC', 'Olympique', 'Sport'],
    standalone: [],
  },
  spanish: {
    prefixes: [
      'Real', 'Atletico', 'Deportivo', 'Sporting', 'Racing',
      'CD', 'UD', 'SD', 'RCD', 'CA', 'CE',
    ],
    suffixes: ['Deportivo', 'Atletico'],
    standalone: ['Sevilla', 'Valencia', 'Betis', 'Celta', 'Getafe'],
  },
  italian: {
    prefixes: [
      'AS', 'Inter', 'US', 'SS', 'SC', 'Hellas',
      'Atalanta', 'Torino', 'Genoa', 'Parma', 'Bologna',
    ],
    suffixes: ['Sport', '1913', '1909', '1907'],
    standalone: ['Juventus', 'Lazio', 'Fiorentina', 'Napoli', 'Sampdoria'],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get all available country codes
 */
export function getAvailableCountries(): CountryCode[] {
  return Object.keys(COUNTRY_CONFIGS) as CountryCode[];
}

/**
 * Get country config by code
 */
export function getCountryConfig(code: CountryCode): CountryConfig {
  return COUNTRY_CONFIGS[code];
}

/**
 * Get naming components for a country
 */
export function getNamingComponents(code: CountryCode): TeamNameComponents {
  const style = COUNTRY_CONFIGS[code].namingStyle;
  return NAMING_COMPONENTS[style];
}

/**
 * Calculate division for a city based on its population rank
 * Cities are sorted by population, then assigned to divisions
 * Rank 1-20 = Division 1, Rank 21-40 = Division 2, etc.
 */
export function getDivisionForRank(rank: number): number {
  return Math.min(10, Math.max(1, Math.ceil(rank / 20)));
}

/**
 * Get division range description
 */
export function getDivisionDescription(division: number): string {
  const descriptions: Record<number, string> = {
    1: 'Elite - Largest markets, highest budgets',
    2: 'Premier - Major metropolitan areas',
    3: 'First - Large cities',
    4: 'Second - Mid-size cities',
    5: 'Third - Regional centers',
    6: 'Fourth - Growing markets',
    7: 'Fifth - Small cities',
    8: 'Sixth - Towns',
    9: 'Seventh - Small towns',
    10: 'Eighth - Developing markets',
  };
  return descriptions[division] || 'Unknown';
}

// =============================================================================
// CITY DATA IMPORTS
// =============================================================================

import { US_CITIES } from './us';
import { UK_CITIES } from './uk';
import { DE_CITIES } from './de';
import { FR_CITIES } from './fr';
import { ES_CITIES } from './es';
import { IT_CITIES } from './it';
import { CA_CITIES } from './ca';
import { AU_CITIES } from './au';

/**
 * Get cities for a country, sorted by population
 */
export function getCitiesForCountry(code: CountryCode): CityData[] {
  const cityMap: Record<CountryCode, CityData[]> = {
    US: US_CITIES,
    UK: UK_CITIES,
    DE: DE_CITIES,
    FR: FR_CITIES,
    ES: ES_CITIES,
    IT: IT_CITIES,
    CA: CA_CITIES,
    AU: AU_CITIES,
  };

  return [...cityMap[code]].sort((a, b) => b.population - a.population);
}

/**
 * Get cities grouped by division for a country
 */
export function getCitiesByDivision(code: CountryCode): Map<number, CityData[]> {
  const cities = getCitiesForCountry(code);
  const byDivision = new Map<number, CityData[]>();

  for (let div = 1; div <= 10; div++) {
    byDivision.set(div, []);
  }

  cities.slice(0, 200).forEach((city, index) => {
    const division = getDivisionForRank(index + 1);
    byDivision.get(division)?.push(city);
  });

  return byDivision;
}

/**
 * Get a specific city's division based on its population rank
 * @param code - Country code
 * @param cityName - City name
 * @param cityRegion - Optional region for disambiguation (e.g., "IL" vs "CO" for Aurora)
 */
export function getCityDivision(code: CountryCode, cityName: string, cityRegion?: string): number {
  const cities = getCitiesForCountry(code);

  // If region provided, match both name and region to handle duplicate city names
  const index = cityRegion
    ? cities.findIndex(c => c.name === cityName && c.region === cityRegion)
    : cities.findIndex(c => c.name === cityName);

  if (index === -1) return 7; // Default to Division 7 if not found

  return getDivisionForRank(index + 1);
}

// Re-export city data for direct access if needed
export { US_CITIES, UK_CITIES, DE_CITIES, FR_CITIES, ES_CITIES, IT_CITIES, CA_CITIES, AU_CITIES };
