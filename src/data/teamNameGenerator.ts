/**
 * Team Name Generator
 *
 * Generates authentic-sounding team names based on city and country naming style.
 */

import type { CountryCode, CityData } from './countries';
import { COUNTRY_CONFIGS, getCitiesForCountry, getDivisionForRank } from './countries';

// =============================================================================
// TEAM NAME SUFFIXES/PREFIXES BY STYLE
// =============================================================================

/**
 * American-style team names (sport-neutral, club-style)
 * Format: [City] [Suffix]
 * Uses traditional club naming conventions, no mascots/nicknames
 */
const AMERICAN_SUFFIXES = [
  'SC', 'United', 'Athletic', 'Sporting', 'City',
  'Union', 'Real', 'Inter', 'Olympic', 'Metro',
  'Central', 'Premier', 'Academy', 'Alliance',
];

/**
 * English-style team names (sport-neutral)
 * Format: [City] [Suffix]
 * Removed: FC (Football Club)
 */
const ENGLISH_SUFFIXES = [
  'United', 'City', 'Town', 'Rovers', 'Wanderers',
  'Athletic', 'Albion', 'Wednesday', 'Forest', 'Villa', 'Rangers',
  'County', 'Palace', 'Argyle', 'Hotspur', 'Orient', 'Stanley',
  'Olympic', 'Academical', 'Thistle', 'Celtic', 'Hearts', 'Sporting',
];

/**
 * German-style team names (sport-neutral)
 * Format: [Prefix] [City] or [City] [Year]
 * TSV = Turn- und Sportverein (Gymnastics and Sports Club)
 * VfB = Verein für Bewegungsspiele (Club for Movement Games)
 * VfL = Verein für Leibesübungen (Club for Physical Exercise)
 * SV = Sportverein (Sports Club)
 * SpVgg = Spielvereinigung (Playing Association)
 * Removed: FC, 1. FC (Football Club), FSV (Fußball- und Sportverein)
 */
const GERMAN_PREFIXES = [
  'TSV', 'VfB', 'VfL', 'SV', 'SC', 'SpVgg',
  'Borussia', 'Eintracht', 'Fortuna', 'Hertha', 'Arminia',
  'Alemannia', 'Preussen', 'Dynamo', 'Energie', 'Hansa',
];
const GERMAN_SUFFIXES = ['04', '05', '09', '1860', '1899', '1900', '1903', '1907', '1909'];

/**
 * French-style team names (sport-neutral)
 * Format: [Prefix] [City] or [City] [Suffix]
 * AS = Association Sportive (Sports Association)
 * Removed: FC (Football Club), Foot (Football)
 */
const FRENCH_PREFIXES = [
  'Olympique', 'AS', 'SC', 'Stade', 'Racing', 'Girondins de',
  'OGC', 'AJ', 'EA', 'US', 'Entente',
];
const FRENCH_SUFFIXES = ['SC', 'Olympique', 'Sport'];

/**
 * Spanish-style team names (sport-neutral)
 * Format: [Prefix] [City] or [City] [Suffix]
 * CD = Club Deportivo (Sports Club)
 * UD = Unión Deportiva (Sports Union)
 * SD = Sociedad Deportiva (Sports Society)
 * CA = Club Atlético (Athletic Club)
 * CE = Club Esportiu (Sports Club in Catalan)
 * Removed: CF (Club de Fútbol), FC (Football Club), Balompie (football)
 */
const SPANISH_PREFIXES = [
  'Real', 'Atletico', 'Deportivo', 'Sporting', 'Racing',
  'CD', 'UD', 'SD', 'RCD', 'CA', 'CE',
];
const SPANISH_SUFFIXES = ['Deportivo', 'Atletico'];

/**
 * Italian-style team names (sport-neutral)
 * Format: [Prefix] [City] or standalone
 * AS = Associazione Sportiva (Sports Association)
 * US = Unione Sportiva (Sports Union)
 * SS = Società Sportiva (Sports Society)
 * Removed: AC (Associazione Calcio), FC, UC (Unione Calcio), Calcio (football)
 */
const ITALIAN_PREFIXES = [
  'AS', 'Inter', 'US', 'SS', 'SC', 'Hellas',
  'Atalanta', 'Torino', 'Genoa', 'Parma', 'Bologna', 'Virtus',
];
const ITALIAN_SUFFIXES = ['Sport', '1913', '1909', '1907'];

// =============================================================================
// NAME GENERATION FUNCTIONS
// =============================================================================

/**
 * Simple seeded random number generator for deterministic names
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff;
  };
}

/**
 * Pick a random element from array using seeded random
 */
function pickRandom<T>(arr: readonly T[], random: () => number): T {
  const index = Math.floor(random() * arr.length);
  return arr[index] as T;
}

/**
 * Generate American-style team name
 */
function generateAmericanName(city: string, random: () => number): string {
  const suffix = pickRandom(AMERICAN_SUFFIXES, random);

  // Some special cases for realism
  if (city === 'Los Angeles' && random() > 0.5) return 'LA United';
  if (city === 'New York' && random() > 0.5) return 'New York City';
  if (city === 'Kansas City' && random() > 0.5) return 'Sporting Kansas City';

  return `${city} ${suffix}`;
}

/**
 * Generate English-style team name
 */
function generateEnglishName(city: string, random: () => number): string {
  const suffix = pickRandom(ENGLISH_SUFFIXES, random);

  // Some cities work better with certain suffixes
  if (city === 'Sheffield' && random() > 0.5) return 'Sheffield Wednesday';
  if (city === 'West Bromwich' || city.includes('West')) return `${city} Albion`;
  if (city === 'Aston' || city.includes('Villa')) return 'Aston Villa';

  return `${city} ${suffix}`;
}

/**
 * Generate German-style team name
 */
function generateGermanName(city: string, random: () => number): string {
  const usePrefix = random() > 0.4;

  if (usePrefix) {
    const prefix = pickRandom(GERMAN_PREFIXES, random);

    // Special cases
    if (prefix === 'Borussia') return `Borussia ${city}`;
    if (prefix === 'Eintracht') return `Eintracht ${city}`;
    if (prefix === 'Fortuna') return `Fortuna ${city}`;
    if (prefix === 'Hertha') return `Hertha ${city}`;

    return `${prefix} ${city}`;
  } else {
    // Year suffix style
    const year = pickRandom(GERMAN_SUFFIXES, random);
    return `${city} ${year}`;
  }
}

/**
 * Generate French-style team name
 */
function generateFrenchName(city: string, random: () => number): string {
  const usePrefix = random() > 0.3;

  if (usePrefix) {
    const prefix = pickRandom(FRENCH_PREFIXES, random);

    if (prefix === 'Olympique') return `Olympique ${city}`;
    if (prefix === 'Stade') return `Stade ${city}`;
    if (prefix === 'Racing') return `Racing ${city}`;
    if (prefix === 'Girondins de') return `Girondins de ${city}`;

    return `${prefix} ${city}`;
  } else {
    const suffix = pickRandom(FRENCH_SUFFIXES, random);
    return `${city} ${suffix}`;
  }
}

/**
 * Generate Spanish-style team name
 */
function generateSpanishName(city: string, random: () => number): string {
  const usePrefix = random() > 0.3;

  if (usePrefix) {
    const prefix = pickRandom(SPANISH_PREFIXES, random);

    // Real + city is classic
    if (prefix === 'Real') return `Real ${city}`;
    if (prefix === 'Atletico') return `Atletico ${city}`;
    if (prefix === 'Deportivo') return `Deportivo ${city}`;
    if (prefix === 'Sporting') return `Sporting ${city}`;
    if (prefix === 'Racing') return `Racing ${city}`;

    return `${prefix} ${city}`;
  } else {
    const suffix = pickRandom(SPANISH_SUFFIXES, random);
    return `${city} ${suffix}`;
  }
}

/**
 * Generate Italian-style team name
 */
function generateItalianName(city: string, random: () => number): string {
  const usePrefix = random() > 0.4;

  if (usePrefix) {
    const prefix = pickRandom(ITALIAN_PREFIXES, random);

    if (prefix === 'Inter') return `Inter ${city}`;
    if (prefix === 'AS') return `AS ${city}`;
    if (prefix === 'US') return `US ${city}`;
    if (prefix === 'SS') return `SS ${city}`;

    return `${prefix} ${city}`;
  } else {
    // Some Italian teams just use city name or city + suffix
    if (random() > 0.5) {
      const suffix = pickRandom(ITALIAN_SUFFIXES, random);
      return `${city} ${suffix}`;
    }
    return city;
  }
}

/**
 * Generate a team name based on city and country naming style
 */
export function generateTeamName(
  city: string,
  countryCode: CountryCode,
  seed?: string
): string {
  const random = seededRandom(seed || city + countryCode);
  const style = COUNTRY_CONFIGS[countryCode].namingStyle;

  switch (style) {
    case 'american':
      return generateAmericanName(city, random);
    case 'english':
      return generateEnglishName(city, random);
    case 'german':
      return generateGermanName(city, random);
    case 'french':
      return generateFrenchName(city, random);
    case 'spanish':
      return generateSpanishName(city, random);
    case 'italian':
      return generateItalianName(city, random);
    default:
      return `${city} SC`; // SC = Sports Club (sport-neutral)
  }
}

/**
 * Generate a variant name for multi-team cities
 * Uses directional prefixes (North, South, East, West) or area names
 */
export function generateVariantName(
  city: string,
  countryCode: CountryCode,
  variantIndex: number
): string {
  const directions = ['North', 'South', 'East', 'West'];
  const areas = ['Central', 'Metropolitan', 'Greater', 'United'];

  // First team gets regular name
  if (variantIndex === 0) {
    return generateTeamName(city, countryCode, city);
  }

  // Subsequent teams get directional or area variants
  if (variantIndex <= 4) {
    const direction = directions[variantIndex - 1];
    return generateTeamName(`${direction} ${city}`, countryCode, `${city}${variantIndex}`);
  }

  // Beyond 4 variants, use area names
  const area = areas[(variantIndex - 5) % areas.length];
  return generateTeamName(`${area} ${city}`, countryCode, `${city}${variantIndex}`);
}

// =============================================================================
// TEAM GENERATION FOR FULL LEAGUE
// =============================================================================

/**
 * Team assignment info
 */
export interface TeamAssignment {
  city: CityData;
  teamName: string;
  division: number;
  isMultiTeamCity: boolean;
  variantIndex: number;
}

/**
 * Generate all 200 teams for a country
 * Large cities may get multiple teams
 */
export function generateLeagueTeams(countryCode: CountryCode): TeamAssignment[] {
  const cities = getCitiesForCountry(countryCode);
  const teams: TeamAssignment[] = [];
  const cityTeamCounts = new Map<string, number>();

  // Population thresholds for multi-team cities
  const MULTI_TEAM_THRESHOLD = 2000000; // 2M+ gets 2 teams
  const TRIPLE_TEAM_THRESHOLD = 5000000; // 5M+ gets 3 teams

  let teamIndex = 0;

  // First pass: assign teams to cities based on population
  for (const city of cities) {
    if (teamIndex >= 200) break;

    // Determine how many teams this city should have
    let teamCount = 1;
    if (city.population >= TRIPLE_TEAM_THRESHOLD) {
      teamCount = Math.min(3, 200 - teamIndex);
    } else if (city.population >= MULTI_TEAM_THRESHOLD) {
      teamCount = Math.min(2, 200 - teamIndex);
    }

    for (let i = 0; i < teamCount; i++) {
      const variantIndex = cityTeamCounts.get(city.name) || 0;
      const teamName = variantIndex === 0
        ? generateTeamName(city.name, countryCode, city.name)
        : generateVariantName(city.name, countryCode, variantIndex);

      teams.push({
        city,
        teamName,
        division: getDivisionForRank(teamIndex + 1),
        isMultiTeamCity: teamCount > 1,
        variantIndex,
      });

      cityTeamCounts.set(city.name, variantIndex + 1);
      teamIndex++;
    }
  }

  // If we don't have 200 teams yet, fill with remaining cities
  while (teams.length < 200 && teams.length < cities.length) {
    const cityIndex = teams.length;
    const city = cities[cityIndex];

    if (!city) break;

    const variantIndex = cityTeamCounts.get(city.name) || 0;
    const teamName = generateTeamName(city.name, countryCode, `${city.name}${variantIndex}`);

    teams.push({
      city,
      teamName,
      division: getDivisionForRank(teams.length + 1),
      isMultiTeamCity: false,
      variantIndex,
    });

    cityTeamCounts.set(city.name, variantIndex + 1);
  }

  return teams;
}

/**
 * Get teams for a specific division
 */
export function getTeamsForDivision(
  countryCode: CountryCode,
  division: number
): TeamAssignment[] {
  const allTeams = generateLeagueTeams(countryCode);
  return allTeams.filter(t => t.division === division);
}

/**
 * Find team assignment for a specific city
 */
export function findTeamForCity(
  countryCode: CountryCode,
  cityName: string
): TeamAssignment | undefined {
  const allTeams = generateLeagueTeams(countryCode);
  return allTeams.find(t => t.city.name === cityName && t.variantIndex === 0);
}
