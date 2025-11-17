/**
 * Test Data Factories for Multiball
 *
 * Factory functions for generating test/mock data.
 * Useful for testing, development, and generating initial game state.
 *
 * @module data/factories
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Player,
  PlayerAttributes,
  PlayerPotentials,
  PeakAges,
  TrainingFocus,
  WeeklyXP,
  PlayerCareerStats,
  Contract,
  Injury,
  Franchise,
  TacticalSettings,
  Budget,
  BudgetAllocation,
  TeamColors,
  Season,
  Match,
  TeamStanding,
  ScoutingReport,
  ScoutingTarget,
  YouthProspect,
  TransferOffer,
  NewsItem,
  GameSave,
  AIPersonality,
} from './types';

// =============================================================================
// RANDOM UTILITIES
// =============================================================================

/**
 * Generate random number between min and max (inclusive)
 */
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate random float between min and max
 */
function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Pick random element from array
 */
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Generate random hex color
 */
function randomHexColor(): string {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

/**
 * Generate random name
 */
function randomName(): string {
  const firstNames = [
    'James', 'John', 'Michael', 'David', 'Chris', 'Tyler', 'Marcus', 'Kevin',
    'Stephen', 'Anthony', 'Paul', 'Jason', 'Brandon', 'Ryan', 'Eric', 'Jordan',
  ];
  const lastNames = [
    'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
    'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
  ];

  return `${randomElement(firstNames)} ${randomElement(lastNames)}`;
}

/**
 * Generate random team name
 */
function randomTeamName(): string {
  const cities = [
    'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
    'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
    'Seattle', 'Denver', 'Boston', 'Portland', 'Miami', 'Atlanta',
  ];
  const nicknames = [
    'Warriors', 'Lakers', 'Bulls', 'Celtics', 'Rockets', 'Thunder', 'Blazers',
    'Mavericks', 'Spurs', 'Heat', 'Suns', 'Knicks', 'Hawks', 'Wizards', 'Kings',
  ];

  return `${randomElement(cities)} ${randomElement(nicknames)}`;
}

// =============================================================================
// ATTRIBUTE FACTORIES
// =============================================================================

/**
 * Create random player attributes
 *
 * @param min - Minimum attribute value (default: 1)
 * @param max - Maximum attribute value (default: 100)
 * @param archetype - Optional archetype for realistic correlations
 */
export function createRandomAttributes(
  min: number = 1,
  max: number = 100,
  archetype?: 'tall' | 'quick' | 'strong' | 'balanced'
): PlayerAttributes {
  // Generate base attributes
  const base: PlayerAttributes = {
    // Physical
    grip_strength: randomInt(min, max),
    arm_strength: randomInt(min, max),
    core_strength: randomInt(min, max),
    agility: randomInt(min, max),
    acceleration: randomInt(min, max),
    top_speed: randomInt(min, max),
    jumping: randomInt(min, max),
    reactions: randomInt(min, max),
    stamina: randomInt(min, max),
    balance: randomInt(min, max),
    height: randomInt(min, max),
    durability: randomInt(min, max),

    // Mental
    awareness: randomInt(min, max),
    creativity: randomInt(min, max),
    determination: randomInt(min, max),
    bravery: randomInt(min, max),
    consistency: randomInt(min, max),
    composure: randomInt(min, max),
    patience: randomInt(min, max),

    // Technical
    hand_eye_coordination: randomInt(min, max),
    throw_accuracy: randomInt(min, max),
    form_technique: randomInt(min, max),
    finesse: randomInt(min, max),
    deception: randomInt(min, max),
    teamwork: randomInt(min, max),
  };

  // Apply archetype correlations
  if (archetype === 'tall') {
    base.height = randomInt(80, max);
    base.agility = Math.max(min, base.agility - 20); // Taller = less agile
    base.acceleration = Math.max(min, base.acceleration - 15);
    base.jumping = randomInt(60, max); // Tall can still jump well
  } else if (archetype === 'quick') {
    base.agility = randomInt(70, max);
    base.acceleration = randomInt(70, max);
    base.top_speed = randomInt(70, max);
    base.height = randomInt(min, 60); // Smaller = quicker
  } else if (archetype === 'strong') {
    base.core_strength = randomInt(70, max);
    base.arm_strength = randomInt(70, max);
    base.grip_strength = randomInt(70, max);
    base.agility = Math.max(min, randomInt(min, 50)); // Strong = less agile
  }

  return base;
}

/**
 * Create random potentials
 *
 * @param currentAttributes - Current attributes (potentials should be >= current)
 */
export function createRandomPotentials(currentAttributes?: PlayerAttributes): PlayerPotentials {
  if (!currentAttributes) {
    return {
      physical: randomInt(50, 100),
      mental: randomInt(50, 100),
      technical: randomInt(50, 100),
    };
  }

  // Calculate average current values
  const physicalAvg = Math.floor(
    (currentAttributes.grip_strength +
      currentAttributes.arm_strength +
      currentAttributes.core_strength +
      currentAttributes.agility +
      currentAttributes.acceleration +
      currentAttributes.top_speed +
      currentAttributes.jumping +
      currentAttributes.reactions +
      currentAttributes.stamina +
      currentAttributes.balance +
      currentAttributes.height +
      currentAttributes.durability) /
      12
  );

  const mentalAvg = Math.floor(
    (currentAttributes.awareness +
      currentAttributes.creativity +
      currentAttributes.determination +
      currentAttributes.bravery +
      currentAttributes.consistency +
      currentAttributes.composure +
      currentAttributes.patience) /
      7
  );

  const technicalAvg = Math.floor(
    (currentAttributes.hand_eye_coordination +
      currentAttributes.throw_accuracy +
      currentAttributes.form_technique +
      currentAttributes.finesse +
      currentAttributes.deception +
      currentAttributes.teamwork) /
      6
  );

  return {
    physical: randomInt(physicalAvg, 100),
    mental: randomInt(mentalAvg, 100),
    technical: randomInt(technicalAvg, 100),
  };
}

/**
 * Create random peak ages
 */
export function createRandomPeakAges(): PeakAges {
  return {
    physical: randomInt(22, 30),
    technical: randomInt(24, 32),
    mental: randomInt(26, 34),
  };
}

/**
 * Create balanced training focus (33/33/34)
 */
export function createBalancedTrainingFocus(): TrainingFocus {
  return {
    physical: 33,
    mental: 33,
    technical: 34,
  };
}

/**
 * Create random training focus
 */
export function createRandomTrainingFocus(): TrainingFocus {
  const physical = randomInt(0, 100);
  const mental = randomInt(0, 100 - physical);
  const technical = 100 - physical - mental;

  return { physical, mental, technical };
}

/**
 * Create empty weekly XP
 */
export function createEmptyWeeklyXP(): WeeklyXP {
  return {
    physical: 0,
    mental: 0,
    technical: 0,
  };
}

/**
 * Create empty career stats
 */
export function createEmptyCareerStats(): PlayerCareerStats {
  return {
    gamesPlayed: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    totalPoints: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    minutesPlayed: {
      basketball: 0,
      baseball: 0,
      soccer: 0,
    },
    basketball: {
      fieldGoalsMade: 0,
      fieldGoalsAttempted: 0,
      threePointersMade: 0,
      threePointersAttempted: 0,
      freeThrowsMade: 0,
      freeThrowsAttempted: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
      turnovers: 0,
    },
  };
}

// =============================================================================
// PLAYER FACTORIES
// =============================================================================

/**
 * Create starter player (attributes 1-25, poor quality)
 */
export function createStarterPlayer(overrides?: Partial<Player>): Player {
  const attributes = createRandomAttributes(1, 25, randomElement(['tall', 'quick', 'balanced']));
  const potentials = createRandomPotentials(attributes);
  const peakAges = createRandomPeakAges();

  return {
    id: uuidv4(),
    name: randomName(),
    age: randomInt(20, 28),
    dateOfBirth: new Date(Date.now() - randomInt(20, 28) * 365 * 24 * 60 * 60 * 1000),
    position: randomElement(['PG', 'SG', 'SF', 'PF', 'C']),
    attributes,
    potentials,
    peakAges,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    teamId: 'user',
    acquisitionType: 'starter',
    acquisitionDate: new Date(),
    ...overrides,
  };
}

/**
 * Create random player (any attribute range)
 */
export function createRandomPlayer(
  attributeMin: number = 1,
  attributeMax: number = 100,
  overrides?: Partial<Player>
): Player {
  const attributes = createRandomAttributes(attributeMin, attributeMax);
  const potentials = createRandomPotentials(attributes);
  const peakAges = createRandomPeakAges();

  return {
    id: uuidv4(),
    name: randomName(),
    age: randomInt(18, 35),
    dateOfBirth: new Date(Date.now() - randomInt(18, 35) * 365 * 24 * 60 * 60 * 1000),
    position: randomElement(['PG', 'SG', 'SF', 'PF', 'C']),
    attributes,
    potentials,
    peakAges,
    contract: null,
    injury: null,
    trainingFocus: null,
    weeklyXP: createEmptyWeeklyXP(),
    careerStats: createEmptyCareerStats(),
    currentSeasonStats: createEmptyCareerStats(),
    teamId: 'free_agent',
    acquisitionType: 'free_agent',
    acquisitionDate: new Date(),
    ...overrides,
  };
}

/**
 * Create elite player (attributes 70-100)
 */
export function createElitePlayer(overrides?: Partial<Player>): Player {
  return createRandomPlayer(70, 100, {
    age: randomInt(25, 30),
    acquisitionType: 'trade',
    ...overrides,
  });
}

// =============================================================================
// CONTRACT FACTORIES
// =============================================================================

/**
 * Create random contract
 */
export function createRandomContract(
  playerId: string,
  teamId: string,
  overrides?: Partial<Contract>
): Contract {
  const contractLength = randomInt(1, 5);
  const startDate = new Date();
  const expiryDate = new Date(startDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + contractLength);

  return {
    id: uuidv4(),
    playerId,
    teamId,
    salary: randomInt(50000, 500000),
    signingBonus: randomInt(0, 100000),
    contractLength,
    startDate,
    expiryDate,
    performanceBonuses: {},
    releaseClause: Math.random() > 0.5 ? randomInt(100000, 1000000) : null,
    salaryIncreases: Array(contractLength).fill(randomInt(0, 10)),
    ...overrides,
  };
}

// =============================================================================
// INJURY FACTORIES
// =============================================================================

/**
 * Create random injury
 */
export function createRandomInjury(playerId: string, overrides?: Partial<Injury>): Injury {
  const injuryType = randomElement(['minor', 'moderate', 'severe'] as const);
  const recoveryWeeks = injuryType === 'minor' ? randomInt(1, 2) : injuryType === 'moderate' ? randomInt(3, 6) : randomInt(7, 12);
  const occurredDate = new Date();
  const returnDate = new Date(occurredDate);
  returnDate.setDate(returnDate.getDate() + recoveryWeeks * 7);

  const injuryNames: Record<string, string[]> = {
    minor: ['Sprained Ankle', 'Bruised Knee', 'Minor Strain'],
    moderate: ['Hamstring Strain', 'Shoulder Sprain', 'Groin Pull'],
    severe: ['Torn ACL', 'Fractured Wrist', 'Herniated Disc'],
  };

  return {
    id: uuidv4(),
    playerId,
    injuryType,
    injuryName: randomElement(injuryNames[injuryType]),
    occurredDate,
    recoveryWeeks,
    returnDate,
    doctorReport: `Player suffered ${injuryType} injury. Expected recovery: ${recoveryWeeks} weeks.`,
    ...overrides,
  };
}

// =============================================================================
// FRANCHISE FACTORIES
// =============================================================================

/**
 * Create default tactical settings
 */
export function createDefaultTacticalSettings(): TacticalSettings {
  return {
    pace: 'standard',
    manDefensePct: 50,
    scoringOptions: [],
    minutesAllotment: {},
    reboundingStrategy: 'standard',
    closers: [],
    timeoutStrategy: 'standard',
  };
}

/**
 * Create random team colors
 */
export function createRandomTeamColors(): TeamColors {
  return {
    primary: randomHexColor(),
    secondary: randomHexColor(),
  };
}

/**
 * Create starting budget ($1M total)
 */
export function createStartingBudget(): Budget {
  return {
    total: 1000000,
    allocated: {
      salaries: 0,
      coaching: 100000,
      medical: 50000,
      youthAcademy: 100000,
      scouting: 50000,
      freeAgentTryouts: 20000,
    },
    available: 680000,
  };
}

/**
 * Create random AI personality
 */
export function createRandomAIPersonality(): AIPersonality {
  const personalities = [
    {
      name: 'Develops Youth',
      traits: {
        youth_development_focus: randomInt(70, 90),
        spending_aggression: randomInt(20, 40),
        defensive_preference: randomInt(40, 60),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(30, 50),
        player_loyalty: randomInt(60, 80),
      },
    },
    {
      name: 'Splashes Cash',
      traits: {
        youth_development_focus: randomInt(10, 30),
        spending_aggression: randomInt(80, 100),
        defensive_preference: randomInt(30, 50),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(70, 90),
        player_loyalty: randomInt(30, 50),
      },
    },
    {
      name: 'Defensive Minded',
      traits: {
        youth_development_focus: randomInt(40, 60),
        spending_aggression: randomInt(40, 60),
        defensive_preference: randomInt(80, 100),
        multi_sport_specialist: false,
        risk_tolerance: randomInt(20, 40),
        player_loyalty: randomInt(50, 70),
      },
    },
    {
      name: 'Multi-Sport Specialists',
      traits: {
        youth_development_focus: randomInt(50, 70),
        spending_aggression: randomInt(50, 70),
        defensive_preference: randomInt(40, 60),
        multi_sport_specialist: true,
        risk_tolerance: randomInt(60, 80),
        player_loyalty: randomInt(40, 60),
      },
    },
  ];

  return randomElement(personalities);
}

/**
 * Create user franchise
 */
export function createUserFranchise(
  name: string = 'My Team',
  colors?: TeamColors
): Franchise {
  return {
    id: 'user',
    name,
    colors: colors || createRandomTeamColors(),
    division: 5,
    divisionHistory: [],
    budget: createStartingBudget(),
    rosterIds: [],
    youthAcademyIds: [],
    tacticalSettings: createDefaultTacticalSettings(),
    trainingSettings: {
      teamWide: createBalancedTrainingFocus(),
    },
    scoutingSettings: {
      budgetAllocation: 5, // 5%
      depthVsBreadth: 50, // Balanced
      targets: [],
    },
    aiPersonality: null,
    createdDate: new Date(),
    currentSeason: 1,
  };
}

/**
 * Create AI franchise
 */
export function createAIFranchise(division: 1 | 2 | 3 | 4 | 5): Franchise {
  return {
    id: uuidv4(),
    name: randomTeamName(),
    colors: createRandomTeamColors(),
    division,
    divisionHistory: [],
    budget: createStartingBudget(),
    rosterIds: [],
    youthAcademyIds: [],
    tacticalSettings: createDefaultTacticalSettings(),
    trainingSettings: {
      teamWide: createRandomTrainingFocus(),
    },
    scoutingSettings: {
      budgetAllocation: randomInt(3, 10),
      depthVsBreadth: randomInt(30, 70),
      targets: [],
    },
    aiPersonality: createRandomAIPersonality(),
    createdDate: new Date(),
    currentSeason: 1,
  };
}

// =============================================================================
// SEASON FACTORIES
// =============================================================================

/**
 * Create new season
 */
export function createNewSeason(seasonNumber: number): Season {
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + 6); // 6-month season

  return {
    id: uuidv4(),
    seasonNumber,
    startDate,
    endDate,
    status: 'pre_season',
    matches: [],
    standings: {},
    transferWindowOpen: true,
    currentWeek: 0,
  };
}

// =============================================================================
// YOUTH PROSPECT FACTORIES
// =============================================================================

/**
 * Create random youth prospect (15-18 years old)
 */
export function createYouthProspect(academyId: string): YouthProspect {
  const age = randomInt(15, 18);
  const attributes = createRandomAttributes(10, 40); // Lower than main roster
  const potentials = createRandomPotentials(attributes);
  const joinedDate = new Date();
  const mustPromoteBy = new Date();
  mustPromoteBy.setFullYear(mustPromoteBy.getFullYear() + (19 - age));

  return {
    id: uuidv4(),
    name: randomName(),
    age,
    dateOfBirth: new Date(Date.now() - age * 365 * 24 * 60 * 60 * 1000),
    attributes,
    potentials,
    joinedAcademyDate: joinedDate,
    mustPromoteBy,
    trainingFocus: null,
    academyId,
  };
}

// =============================================================================
// NEWS FACTORIES
// =============================================================================

/**
 * Create news item
 */
export function createNewsItem(
  type: NewsItem['type'],
  priority: NewsItem['priority'],
  title: string,
  message: string
): NewsItem {
  return {
    id: uuidv4(),
    type,
    priority,
    title,
    message,
    timestamp: new Date(),
    read: false,
  };
}

// =============================================================================
// GAME SAVE FACTORIES
// =============================================================================

/**
 * Create new game save with initial state
 *
 * @param saveName - Save name
 * @param teamName - User's team name
 * @param teamColors - User's team colors
 */
export function createNewGameSave(
  saveName: string,
  teamName: string,
  teamColors?: TeamColors
): GameSave {
  // Create user franchise
  const franchise = createUserFranchise(teamName, teamColors);

  // Create 50 starter players
  const players: Player[] = [];
  for (let i = 0; i < 50; i++) {
    const player = createStarterPlayer();
    players.push(player);
    franchise.rosterIds.push(player.id);
  }

  // Create 19 AI teams in Division 5
  const aiTeams: Franchise[] = [];
  for (let i = 0; i < 19; i++) {
    const team = createAIFranchise(5);
    // Give each AI team 50 players
    for (let j = 0; j < 50; j++) {
      const player = createStarterPlayer({ teamId: team.id });
      players.push(player);
      team.rosterIds.push(player.id);
    }
    aiTeams.push(team);
  }

  // Create initial season
  const season = createNewSeason(1);

  // Initialize standings
  const allTeams = [franchise, ...aiTeams];
  for (const team of allTeams) {
    season.standings[team.id] = {
      teamId: team.id,
      wins: 0,
      losses: 0,
      points: 0,
      rank: 0,
    };
  }

  // Create welcome news
  const newsItems: NewsItem[] = [
    createNewsItem(
      'general',
      'important',
      'Welcome to Multiball!',
      `Welcome to your new franchise, the ${teamName}! You start in Division 5 with 50 athletes. Good luck!`
    ),
  ];

  return {
    version: '0.1.0',
    saveId: uuidv4(),
    saveName,
    lastSaved: new Date(),
    franchise,
    players,
    youthProspects: [],
    season,
    aiTeams,
    transferOffers: [],
    contractNegotiations: [],
    scoutingReports: [],
    scoutingTargets: [],
    newsItems,
    seasonHistory: [],
  };
}
