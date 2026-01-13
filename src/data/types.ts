/**
 * Core Data Types for Multiball
 *
 * Complete TypeScript interface definitions for all game entities.
 * Aligned with basketball-sim Python data structures.
 *
 * @module data/types
 */

// =============================================================================
// NATIONALITY
// =============================================================================

/**
 * Player nationality
 */
export type Nationality = string;

/**
 * Available nationalities for prospect generation
 */
export const NATIONALITIES: Nationality[] = [
  'American', 'Canadian', 'Mexican', 'Brazilian', 'Argentine',
  'Spanish', 'French', 'German', 'Italian', 'British',
  'Serbian', 'Croatian', 'Greek', 'Turkish', 'Lithuanian',
  'Australian', 'Nigerian', 'Cameroonian', 'Senegalese', 'South Sudanese',
  'Chinese', 'Japanese', 'Korean', 'Filipino', 'Taiwanese',
  'Dominican', 'Puerto Rican', 'Jamaican', 'Bahamian', 'Venezuelan',
];

// =============================================================================
// MORALE SYSTEM
// =============================================================================

/**
 * Match outcome for morale tracking
 */
export type MatchOutcome = 'win' | 'loss' | 'draw';

// =============================================================================
// PLAYER / ATHLETE
// =============================================================================

/**
 * Physical attributes (12 total)
 * All attributes rated 1-100 scale
 */
export interface PhysicalAttributes {
  /** Grip strength - ball security, rebounding */
  grip_strength: number;
  /** Arm strength - throwing power, boxing out */
  arm_strength: number;
  /** Core strength - balance, finishing through contact */
  core_strength: number;
  /** Agility - lateral movement, change of direction */
  agility: number;
  /** Acceleration - first step quickness */
  acceleration: number;
  /** Top speed - sprint speed in open court */
  top_speed: number;
  /** Jumping - vertical leap for shots, rebounds, blocks */
  jumping: number;
  /** Reactions - quick response to game situations */
  reactions: number;
  /** Stamina - energy level, affects drain/recovery rates */
  stamina: number;
  /** Balance - staying upright, defensive stance */
  balance: number;
  /** Height - normalized 1-100 (impacts reach, rebounds, blocks) */
  height: number;
  /** Durability - injury resistance */
  durability: number;
}

/**
 * Mental attributes (8 total)
 * All attributes rated 1-100 scale
 */
export interface MentalAttributes {
  /** Awareness - court vision, reading defense */
  awareness: number;
  /** Creativity - unconventional plays, creative solutions */
  creativity: number;
  /** Determination - hustle, effort, work ethic */
  determination: number;
  /** Bravery - willingness to attack rim, challenge shots */
  bravery: number;
  /** Consistency - predictable performance, reliability */
  consistency: number;
  /** Composure - decision-making under pressure */
  composure: number;
  /** Patience - shot selection, waiting for opportunities */
  patience: number;
  /** Teamwork - willingness to pass, help defense */
  teamwork: number;
}

/**
 * Technical attributes (6 total)
 * All attributes rated 1-100 scale
 */
export interface TechnicalAttributes {
  /** Hand-eye coordination - dribbling, catching, timing */
  hand_eye_coordination: number;
  /** Throw accuracy - shooting accuracy, passing precision */
  throw_accuracy: number;
  /** Form technique - shooting mechanics, fundamentals */
  form_technique: number;
  /** Finesse - touch, body control, soft hands */
  finesse: number;
  /** Deception - fakes, pump fakes, misdirection */
  deception: number;
  /** Footwork - proper foot positioning, pivot moves, defensive sliding */
  footwork: number;
}

/**
 * Complete athlete attribute set (26 attributes)
 * Visible to user
 */
export interface PlayerAttributes extends PhysicalAttributes, MentalAttributes, TechnicalAttributes {}

/**
 * Hidden potential ceilings by category
 * Not visible to user - determines training effectiveness
 */
export interface PlayerPotentials {
  /** Physical potential ceiling (1-100) */
  physical: number;
  /** Mental potential ceiling (1-100) */
  mental: number;
  /** Technical potential ceiling (1-100) */
  technical: number;
}

/**
 * Peak age ranges for attribute categories
 * Randomly determined at player creation
 */
export interface PeakAges {
  /** Physical peak age (22-30, highest probability at 26) */
  physical: number;
  /** Technical peak age (24-32, highest probability at 28) */
  technical: number;
  /** Mental peak age (26-34, highest probability at 30) */
  mental: number;
}

/**
 * Training focus allocation
 * Percentages must sum to 100
 */
export interface TrainingFocus {
  /** Physical training percentage (0-100) */
  physical: number;
  /** Mental training percentage (0-100) */
  mental: number;
  /** Technical training percentage (0-100) */
  technical: number;
}

/**
 * Weekly training XP accumulation
 */
export interface WeeklyXP {
  /** Physical XP earned this week */
  physical: number;
  /** Mental XP earned this week */
  mental: number;
  /** Technical XP earned this week */
  technical: number;
}

/**
 * Player awards tracking
 * Used to calculate performance-based transfer value modifiers
 */
export interface PlayerAwards {
  /** Player of the Week awards (any sport) */
  playerOfTheWeek: number;
  /** Player of the Month awards (any sport) */
  playerOfTheMonth: number;
  /** Basketball Player of the Year awards */
  basketballPlayerOfTheYear: number;
  /** Baseball Player of the Year awards */
  baseballPlayerOfTheYear: number;
  /** Soccer Player of the Year awards */
  soccerPlayerOfTheYear: number;
  /** Rookie of the Year awards */
  rookieOfTheYear: number;
  /** Championship wins */
  championships: number;
}

/**
 * Player career statistics across all sports
 */
export interface PlayerCareerStats {
  /** Games played by sport */
  gamesPlayed: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Total points scored by sport */
  totalPoints: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Minutes played by sport */
  minutesPlayed: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Sport-specific stats (extensible for future sports) */
  basketball?: BasketballCareerStats;
  baseball?: BaseballCareerStats;
  soccer?: SoccerCareerStats;
}

/**
 * Basketball-specific career statistics
 */
export interface BasketballCareerStats {
  /** Field goals made */
  fieldGoalsMade: number;
  /** Field goals attempted */
  fieldGoalsAttempted: number;
  /** 3-pointers made */
  threePointersMade: number;
  /** 3-pointers attempted */
  threePointersAttempted: number;
  /** Free throws made */
  freeThrowsMade: number;
  /** Free throws attempted */
  freeThrowsAttempted: number;
  /** Total rebounds */
  rebounds: number;
  /** Assists */
  assists: number;
  /** Steals */
  steals: number;
  /** Blocks */
  blocks: number;
  /** Turnovers */
  turnovers: number;
}

/**
 * Baseball-specific career statistics
 */
export interface BaseballCareerStats {
  // Batting (accumulated totals)
  /** At bats */
  atBats: number;
  /** Runs scored */
  runs: number;
  /** Hits */
  hits: number;
  /** Doubles */
  doubles: number;
  /** Triples */
  triples: number;
  /** Home runs */
  homeRuns: number;
  /** Runs batted in */
  rbi: number;
  /** Walks (bases on balls) */
  walks: number;
  /** Strikeouts */
  strikeouts: number;
  /** Stolen bases */
  stolenBases: number;
  /** Caught stealing */
  caughtStealing: number;

  // Pitching (if player has pitched)
  /** Games started as pitcher */
  gamesStarted: number;
  /** Innings pitched (stored as thirds, e.g., 6.2 IP = 20) */
  inningsPitched: number;
  /** Hits allowed */
  hitsAllowed: number;
  /** Runs allowed */
  runsAllowed: number;
  /** Earned runs */
  earnedRuns: number;
  /** Walks allowed */
  walksAllowed: number;
  /** Strikeouts thrown */
  strikeoutsThrown: number;
  /** Home runs allowed */
  homeRunsAllowed: number;
  /** Wins */
  wins: number;
  /** Losses */
  losses: number;
  /** Saves */
  saves: number;

  // Fielding
  /** Putouts */
  putouts: number;
  /** Assists */
  assists: number;
  /** Errors */
  errors: number;
}

/**
 * Soccer-specific career statistics
 */
export interface SoccerCareerStats {
  /** Goals scored */
  goals: number;
  /** Assists */
  assists: number;
  /** Total shots */
  shots: number;
  /** Shots on target */
  shotsOnTarget: number;
  /** Minutes played */
  minutesPlayed: number;
  /** Yellow cards received */
  yellowCards: number;
  /** Red cards received */
  redCards: number;
  /** Saves (goalkeeper only) */
  saves?: number;
  /** Clean sheets (goalkeeper only) */
  cleanSheets?: number;
  /** Goals conceded (goalkeeper only) */
  goalsAgainst?: number;
}

/**
 * Player season statistics (same structure as career, but for current season)
 */
export type PlayerSeasonStats = PlayerCareerStats;

/**
 * Historical record of a single season's statistics
 * Used for year-by-year stat display on player detail screen
 */
export interface PlayerSeasonRecord {
  /** Season number (1, 2, 3, etc.) */
  seasonNumber: number;
  /** Display label for the season (e.g., "2024-25") */
  yearLabel: string;
  /** Team ID the player was on during this season */
  teamId: string;
  /** Games played by sport during this season */
  gamesPlayed: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Total points scored by sport */
  totalPoints: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Minutes played by sport */
  minutesPlayed: {
    basketball: number;
    baseball: number;
    soccer: number;
  };
  /** Basketball stats for this season */
  basketball?: BasketballCareerStats;
  /** Baseball stats for this season */
  baseball?: BaseballCareerStats;
  /** Soccer stats for this season */
  soccer?: SoccerCareerStats;
}

// =============================================================================
// YOUTH PHYSICAL DEVELOPMENT
// =============================================================================

/**
 * Growth pattern determines timing of physical development
 */
export type GrowthPattern = 'early' | 'average' | 'late';

/**
 * Youth physical development tracking
 *
 * Players grow in height until age 18 and weight until age 24.
 * This interface tracks projected adult measurements and growth progress.
 * Only exists for players under age 24.
 */
export interface YouthPhysicalDevelopment {
  /** Projected adult height in inches */
  projectedAdultHeight: number;

  /** Height projection variance (typically ±2 inches) */
  heightVariance: number;

  /** Target adult BMI (used to calculate projected weight) */
  targetAdultBMI: number;

  /** Growth pattern affects timing of development */
  growthPattern: GrowthPattern;

  /** Game day number of last growth check */
  lastGrowthGameDay: number;

  /** Height percentile (0-100) for lookup in growth tables */
  heightPercentile: number;
}

/**
 * Complete Player/Athlete entity
 * Aligned with basketball-sim Player dictionary structure
 */
export interface Player {
  /** Unique identifier (UUID) */
  id: string;

  /** Player name */
  name: string;

  /** Player age */
  age: number;

  /** Age when player turned professional (18-22) */
  careerStartAge: number;

  /** Date of birth */
  dateOfBirth: Date;

  /** Position (basketball: PG/SG/SF/PF/C) */
  position: string;

  /** Height in inches (e.g., 72 = 6'0", 78 = 6'6") */
  height: number;

  /** Weight in pounds (e.g., 185, 220) */
  weight: number;

  /** Nationality/Country (e.g., "USA", "Spain", "France") */
  nationality: string;

  /** All 26 attributes (1-100 scale) */
  attributes: PlayerAttributes;

  /** Hidden potential ceilings (not visible to user) */
  potentials: PlayerPotentials;

  /** Peak ages for each attribute category */
  peakAges: PeakAges;

  /** Current contract (null if free agent) */
  contract: Contract | null;

  /** Current injury status (null if healthy) */
  injury: Injury | null;

  /** Individual training focus (null = use team default) */
  trainingFocus: TrainingFocus | null;

  /** Weekly XP accumulation */
  weeklyXP: WeeklyXP;

  /** Career statistics */
  careerStats: PlayerCareerStats;

  /** Current season statistics */
  currentSeasonStats: PlayerSeasonStats;

  /**
   * Historical season-by-season statistics
   * Each entry represents one completed season
   * Empty array for new players, populated at end of each season
   */
  seasonHistory: PlayerSeasonRecord[];

  /**
   * Awards won throughout career
   * Used for performance-based transfer value calculation
   */
  awards: PlayerAwards;

  /** Team assignment ('user' | AI team ID | 'free_agent' | 'youth_academy') */
  teamId: string;

  /** How player was acquired */
  acquisitionType: 'starter' | 'draft' | 'trade' | 'free_agent' | 'youth';

  /** When player was acquired */
  acquisitionDate: Date;

  /**
   * Snapshot of attributes at start of season (for progress tracking)
   * Used to display attribute changes like "Speed: 45 (+8)"
   * Optional - null if not yet set (e.g., mid-season acquisition)
   */
  seasonStartAttributes?: PlayerAttributes;

  /**
   * Sport-specific metadata (optional)
   * Contains data that only applies to specific sports
   */
  sportMetadata?: {
    baseball?: {
      /** Batting hand: L=Left, R=Right, S=Switch */
      bats: 'L' | 'R' | 'S';
      /** Throwing hand: L=Left, R=Right */
      throws: 'L' | 'R';
      /** Preferred position (if user-assigned) */
      preferredPosition?: 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH';
    };
    soccer?: {
      /** Preferred foot: L=Left, R=Right, B=Both */
      preferredFoot: 'L' | 'R' | 'B';
      /** Preferred position (if user-assigned) */
      preferredPosition?: 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST';
    };
  };

  // =========================================================================
  // MATCH FITNESS (Persistent stamina between matches)
  // =========================================================================

  /**
   * Match fitness level (0-100, default 100)
   * Depletes after matches, recovers over time.
   * Distinct from in-match stamina (StaminaTracker) and stamina attribute.
   */
  matchFitness: number;

  /**
   * Date of last match played (for recovery calculation)
   * null if player hasn't played a match yet
   */
  lastMatchDate: Date | null;

  /**
   * Sport of last match played
   * Used to track which sport caused the fatigue
   */
  lastMatchSport: 'basketball' | 'baseball' | 'soccer' | null;

  // =========================================================================
  // YOUTH PHYSICAL DEVELOPMENT
  // =========================================================================

  /**
   * Youth physical development data (only for players under 24)
   * Tracks projected adult height/weight and growth progress.
   * Set to undefined when player reaches age 24.
   */
  youthDevelopment?: YouthPhysicalDevelopment;

  // =========================================================================
  // MORALE SYSTEM
  // =========================================================================

  /**
   * Player morale level (0-100, default 75)
   * Affected by playing time vs squad role and match results.
   * Low morale degrades mental attributes and increases transfer request risk.
   */
  morale: number;

  /**
   * Rolling window of last 20 match results for morale calculation
   * Used with weighted windows: last 1 (40%), last 3 (30%), last 10 (20%), last 20 (10%)
   */
  recentMatchResults: MatchOutcome[];

  /**
   * Has player publicly requested a transfer?
   * Triggered when morale stays below 40 for consecutive weeks.
   */
  transferRequestActive: boolean;

  /**
   * Date when transfer request was made (null if no active request)
   */
  transferRequestDate: Date | null;

  /**
   * Consecutive weeks player has been disgruntled (morale < 40)
   * Used to calculate transfer request probability
   */
  weeksDisgruntled: number;

  /**
   * Player's self-assessment multiplier (0.85-1.15)
   * Affects expected squad role relative to division quality
   * 1.0 = realistic, >1.0 = overestimates ability, <1.0 = humble
   */
  ambition: number;
}

// =============================================================================
// CONTRACT
// =============================================================================

/**
 * Performance bonus structure
 */
export interface PerformanceBonuses {
  /** Points per game bonus (threshold and payout) */
  pointsPerGame?: {
    threshold: number;
    bonus: number;
  };
  /** Championship bonus */
  championships?: number;
  /** Playing time bonus (threshold and payout) */
  playingTime?: {
    threshold: number;
    bonus: number;
  };
  /** Appearances bonus (games played threshold and payout) */
  appearances?: {
    threshold: number;
    bonus: number;
  };
  /** Assists per game bonus */
  assistsPerGame?: {
    threshold: number;
    bonus: number;
  };
  /** Rebounds per game bonus */
  reboundsPerGame?: {
    threshold: number;
    bonus: number;
  };
  /** Team makes playoffs bonus */
  playoffQualification?: number;
  /** Player makes All-Star team */
  allStar?: number;
  /** MVP award bonus */
  mvp?: number;
}

/**
 * Contract clause types (FM-style)
 */
export type ContractClauseType =
  | 'squad_role'              // Guaranteed role (starter, rotation, etc.)
  | 'no_release_clause'       // Player refuses release clause
  | 'optional_extension'      // Team option to extend
  | 'player_extension_option' // Player option for 1 year extension
  | 'highest_paid'            // Guaranteed highest paid player at club
  | 'relegation_termination'; // Player may terminate if club is relegated

/**
 * Individual contract clause
 */
export interface ContractClause {
  /** Clause type */
  type: ContractClauseType;
  /** Value (percentage, years, etc. depending on type) */
  value: number;
  /** Human-readable description */
  description: string;
}

/**
 * Squad role for contract negotiations
 */
export type SquadRole =
  | 'star_player'           // Top option, 32+ minutes
  | 'important_player'      // Key rotation piece, 24-32 minutes
  | 'rotation_player'       // Regular rotation, 16-24 minutes
  | 'squad_player'          // Depth, 8-16 minutes
  | 'youth_prospect'        // Development focus
  | 'backup';               // Emergency depth

/**
 * Player's negotiation demands
 */
export interface ContractDemands {
  /** Minimum acceptable salary */
  minSalary: number;
  /** Ideal salary */
  idealSalary: number;
  /** Minimum contract length */
  minContractLength: number;
  /** Maximum contract length */
  maxContractLength: number;
  /** Desired squad role */
  desiredRole: SquadRole;
  /** Expected signing bonus */
  signingBonus: number;
  /** Expected agent fee */
  agentFee: number;
  /** Required release clause amount (null if will accept any) */
  releaseClause: number | null;
  /** Required clauses */
  requiredClauses: ContractClauseType[];
  /** How flexible the player is (0-100, higher = more willing to negotiate) */
  flexibility: number;
  /**
   * How much the player/agent prioritizes upfront money vs salary (0-1)
   * Higher = cares more about bonus/agent fee, lower = prioritizes salary
   * Creates variance so some players accept low bonuses if salary is high
   */
  upfrontPriority: number;
}

/**
 * Negotiation strategy
 */
export type NegotiationStrategy =
  | 'aggressive'    // Push hard, less flexibility, higher demands
  | 'moderate'      // Balanced approach
  | 'passive'       // Accommodating, more flexible
  | 'desperate';    // Will accept lower terms (contract expiring soon)

/**
 * Player contract
 */
export interface Contract {
  /** Contract ID (UUID) */
  id: string;

  /** Player ID */
  playerId: string;

  /** Team ID */
  teamId: string;

  /** Annual salary */
  salary: number;

  /** Signing bonus (one-time payment) */
  signingBonus: number;

  /** Contract length in years (1-5) */
  contractLength: number;

  /** Contract start date */
  startDate: Date;

  /** Contract expiry date */
  expiryDate: Date;

  /** Performance bonuses */
  performanceBonuses: PerformanceBonuses;

  /** Release clause amount (null if none) */
  releaseClause: number | null;

  /** Annual salary increases (percentage per year) */
  salaryIncreases: number[];

  /** Agent fee (one-time payment to agent) */
  agentFee: number;

  /** Contract clauses (FM-style) */
  clauses: ContractClause[];

  /** Promised squad role */
  squadRole: SquadRole;

  /** Loyalty bonus (paid if player completes full contract) */
  loyaltyBonus: number;
}

/**
 * Contract offer (for negotiations)
 */
export interface ContractOffer {
  /** Annual salary */
  salary: number;

  /** Contract length in years */
  contractLength: number;

  /** Signing bonus */
  signingBonus: number;

  /** Performance bonuses */
  performanceBonuses: PerformanceBonuses;

  /** Release clause (null if none) */
  releaseClause: number | null;

  /** Agent fee offered */
  agentFee: number;

  /** Contract clauses offered */
  clauses: ContractClause[];

  /** Squad role offered */
  squadRole: SquadRole;

  /** Loyalty bonus offered */
  loyaltyBonus: number;

  /** Annual wage rise percentage */
  yearlyWageRise: number;
}

/**
 * Negotiation round outcome
 */
export type NegotiationOutcome =
  | 'accepted'           // Player accepts the offer
  | 'rejected'           // Player rejects outright (deal off)
  | 'countered'          // Player makes counter-offer
  | 'considering';       // Player is thinking (used between rounds)

/**
 * Individual negotiation round
 */
export interface NegotiationRound {
  /** Round number (1, 2, 3, etc.) */
  round: number;
  /** The offer made this round */
  offer: ContractOffer;
  /** Who made the offer */
  from: 'team' | 'player';
  /** Outcome of this round */
  outcome: NegotiationOutcome;
  /** Player's response message */
  responseMessage?: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Contract negotiation state (FM-style)
 */
export interface ContractNegotiation {
  /** Negotiation ID (UUID) */
  id: string;

  /** Player ID */
  playerId: string;

  /** Team ID */
  teamId: string;

  /** Current status */
  status: 'in_progress' | 'accepted' | 'rejected' | 'expired';

  /** Current round number */
  currentRound: number;

  /** Maximum rounds before negotiation fails */
  maxRounds: number;

  /** Player's demands (generated at start) */
  playerDemands: ContractDemands;

  /** Player's negotiation strategy */
  playerStrategy: NegotiationStrategy;

  /** Team's current offer */
  currentOffer: ContractOffer;

  /** Player's counter offer (if they countered) */
  counterOffer?: ContractOffer;

  /** Full negotiation history */
  history: NegotiationRound[];

  /** Deadline week (negotiation expires) */
  deadlineWeek: number;

  /** Is this for a new signing or contract renewal? */
  negotiationType: 'new_signing' | 'renewal' | 'transfer';

  /** Transfer fee (if this is a transfer negotiation) */
  transferFee?: number;
}

// =============================================================================
// INJURY
// =============================================================================

/**
 * Player injury
 */
export interface Injury {
  /** Injury ID (UUID) */
  id: string;

  /** Player ID */
  playerId: string;

  /** Injury severity */
  injuryType: 'minor' | 'moderate' | 'severe';

  /** Injury name (e.g., "Sprained Ankle") */
  injuryName: string;

  /** When injury occurred */
  occurredDate: Date;

  /** Recovery time in weeks */
  recoveryWeeks: number;

  /** Expected return date */
  returnDate: Date;

  /** Doctor's report (visible to user) */
  doctorReport: string;
}

// =============================================================================
// FRANCHISE / TEAM
// =============================================================================

/**
 * Team colors
 */
export interface TeamColors {
  /** Primary color (hex) */
  primary: string;

  /** Secondary color (hex) */
  secondary: string;
}

/**
 * Budget allocation
 */
export interface BudgetAllocation {
  /** Player salaries */
  salaries: number;

  /** Coaching allocation */
  coaching: number;

  /** Medical/injury prevention allocation */
  medical: number;

  /** Youth academy allocation */
  youthAcademy: number;

  /** Scouting allocation */
  scouting: number;

  /** Free agent tryouts allocation */
  freeAgentTryouts: number;
}

/**
 * Team budget
 */
export interface Budget {
  /** Total budget */
  total: number;

  /** Budget allocations */
  allocated: BudgetAllocation;

  /** Available funds (mid-season transfers, etc.) */
  available: number;
}

/**
 * Division history entry
 */
export interface DivisionHistoryEntry {
  /** Season number */
  season: number;

  /** Division (1-5) */
  division: number;

  /** Final position (1-20) */
  finish: number;
}

/**
 * Tactical settings for basketball
 * Aligned with basketball-sim TacticalSettings
 */
export interface TacticalSettings {
  /** Game pace */
  pace: 'fast' | 'standard' | 'slow';

  /** Man defense percentage (0-100) */
  manDefensePct: number;

  /** Priority scoring options (player IDs) */
  scoringOptions: [string?, string?, string?];

  /** Minutes allocation (player ID -> minutes, must sum to 240) */
  minutesAllotment: Record<string, number>;

  /** Rebounding strategy */
  reboundingStrategy: 'crash_glass' | 'standard' | 'prevent_transition';

  /** Closers for end-game situations (player IDs) */
  closers: string[];

  /** Timeout strategy */
  timeoutStrategy: 'aggressive' | 'standard' | 'conservative';

  // ==========================================================================
  // SOCCER TACTICAL SETTINGS
  // ==========================================================================

  /** Soccer attacking style */
  soccerAttackingStyle?: 'possession' | 'direct' | 'counter';

  /** Soccer pressing intensity */
  soccerPressing?: 'high' | 'balanced' | 'low';

  /** Soccer formation width */
  soccerWidth?: 'wide' | 'balanced' | 'tight';
}

/**
 * Tactical settings for baseball
 */
export interface BaseballTacticalSettings {
  /** Batting order (9 player IDs in order) */
  lineup: [string, string, string, string, string, string, string, string, string];

  /** Defensive positions (player ID -> position) */
  defensivePositions: Record<string, 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'DH'>;

  /** Starting pitcher (player ID) */
  startingPitcher: string;

  /** Bullpen order (relief pitchers in preferred usage order) */
  bullpenOrder: string[];

  /** Bullpen usage strategy */
  bullpenStrategy: 'aggressive' | 'standard' | 'conservative';

  /** Use designated hitter */
  useDH: boolean;

  /** Baserunning aggression */
  baserunningAggression: 'aggressive' | 'standard' | 'conservative';

  /** Steal attempt frequency (0-1) */
  stealFrequency: number;

  /** Sacrifice bunt frequency (0-1) */
  sacrificeBuntFrequency: number;
}

/**
 * Tactical settings for soccer
 * Placeholder for future implementation
 */
export interface SoccerTacticalSettings {
  /** Formation (e.g., "4-3-3", "4-4-2") */
  formation: string;

  /** Starting XI (11 player IDs) */
  startingXI: string[];

  /** Position assignments */
  positions: Record<string, 'GK' | 'CB' | 'LB' | 'RB' | 'CDM' | 'CM' | 'CAM' | 'LW' | 'RW' | 'ST'>;

  /** Attacking style */
  attackingStyle: 'possession' | 'direct' | 'counter';

  /** Defensive line */
  defensiveLine: 'high' | 'medium' | 'low';

  /** Pressing intensity */
  pressingIntensity: 'high' | 'medium' | 'low';
}

/**
 * Sport-aware tactical settings union type
 */
export type SportTacticalSettings =
  | { sport: 'basketball'; settings: TacticalSettings }
  | { sport: 'baseball'; settings: BaseballTacticalSettings }
  | { sport: 'soccer'; settings: SoccerTacticalSettings };

/**
 * Scouting settings
 */
export interface ScoutingSettings {
  /** Budget allocation percentage */
  budgetAllocation: number;

  /** Depth vs breadth slider (0-100) */
  depthVsBreadth: number;

  /** Active scouting targets */
  targets: ScoutingTarget[];
}

/**
 * Team-wide training settings
 */
export interface TrainingSettings {
  /** Team-wide default training focus */
  teamWide: TrainingFocus;
}

/**
 * AI personality traits
 * Null for user team
 */
export interface AIPersonality {
  /** Personality name */
  name: string;

  /** Personality traits (0-100 scale) */
  traits: {
    /** Focus on youth development */
    youth_development_focus: number;

    /** Spending aggression */
    spending_aggression: number;

    /** Defensive preference */
    defensive_preference: number;

    /** Multi-sport specialist */
    multi_sport_specialist: boolean;

    /** Risk tolerance */
    risk_tolerance: number;

    /** Loyalty to players */
    player_loyalty: number;
  };
}

/**
 * Country code type (re-exported from countries module)
 */
export type FranchiseCountryCode = 'US' | 'UK' | 'DE' | 'FR' | 'ES' | 'IT' | 'CA' | 'AU';

/**
 * Franchise/Team entity
 */
export interface Franchise {
  /** Team ID ('user' for user's team) */
  id: string;

  /** Team name */
  name: string;

  /** Team colors */
  colors: TeamColors;

  /** Country code for the league */
  country: FranchiseCountryCode;

  /** Home city name */
  city: string;

  /** Home city region (state/province for disambiguation) */
  cityRegion?: string;

  /** Current division (1-10) */
  division: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

  /** Division history */
  divisionHistory: DivisionHistoryEntry[];

  /** Team budget */
  budget: Budget;

  /** Main roster (player IDs) */
  rosterIds: string[];

  /** Youth academy prospects (player IDs) */
  youthAcademyIds: string[];

  /** Tactical settings */
  tacticalSettings: TacticalSettings;

  /** Training settings */
  trainingSettings: TrainingSettings;

  /** Scouting settings */
  scoutingSettings: ScoutingSettings;

  /** AI personality (null for user team) */
  aiPersonality: AIPersonality | null;

  /** Creation date */
  createdDate: Date;

  /** Current season number */
  currentSeason: number;
}

// =============================================================================
// SEASON & SCHEDULE
// =============================================================================

/**
 * Sport-specific record
 */
export interface SportRecord {
  wins: number;
  losses: number;
}

/**
 * Team standing
 */
export interface TeamStanding {
  /** Team ID */
  teamId: string;

  /** Total wins (all sports) */
  wins: number;

  /** Total losses (all sports) */
  losses: number;

  /** Basketball record */
  basketball: SportRecord;

  /** Baseball record */
  baseball: SportRecord;

  /** Soccer record */
  soccer: SportRecord;

  /** Current rank (1-20) - sorted by total W-L% */
  rank: number;
}

/**
 * Match result
 */
export interface MatchResult {
  /** Match ID */
  matchId: string;

  /** Home team score */
  homeScore: number;

  /** Away team score */
  awayScore: number;

  /** Winner team ID */
  winner: string;

  /** Detailed box score */
  boxScore: any; // Sport-specific

  /** Play-by-play log */
  playByPlay: string[];

  /** Penalty shootout result (soccer only, when regulation ends in draw) */
  penaltyShootout?: {
    homeScore: number;
    awayScore: number;
  };
}

/**
 * Match entity
 */
export interface Match {
  /** Match ID (UUID) */
  id: string;

  /** Season ID */
  seasonId: string;

  /** Week number in the season */
  week: number;

  /** Home team ID */
  homeTeamId: string;

  /** Away team ID */
  awayTeamId: string;

  /** Sport */
  sport: 'basketball' | 'baseball' | 'soccer';

  /** Scheduled date/time */
  scheduledDate: Date;

  /** Match status */
  status: 'scheduled' | 'in_progress' | 'completed';

  /** Match result (null if not completed) */
  result: MatchResult | null;
}

/**
 * Season entity
 */
export interface Season {
  /** Season ID (UUID) */
  id: string;

  /** Season number */
  seasonNumber: number;

  /** Season start date */
  startDate: Date;

  /** Season end date */
  endDate: Date;

  /** Current season status */
  status: 'pre_season' | 'regular_season' | 'post_season' | 'off_season';

  /** All scheduled matches */
  matches: Match[];

  /** Current standings (team ID -> standing) */
  standings: Record<string, TeamStanding>;

  /** Is transfer window open? */
  transferWindowOpen: boolean;

  /** Current week number */
  currentWeek: number;
}

/**
 * Historical season data
 */
export interface SeasonHistory {
  /** Season number */
  seasonNumber: number;

  /** Division (1-5) */
  division: number;

  /** Final position (1-20) */
  finish: number;

  /** Total wins */
  wins: number;

  /** Total losses */
  losses: number;

  /** Total revenue */
  revenue: number;

  /** Championship won? */
  championshipWon: boolean;
}

// =============================================================================
// TROPHY CASE & MANAGER CAREER
// =============================================================================

/**
 * Record of a championship or promotion achievement
 */
export interface TrophyRecord {
  /** Type of trophy */
  type: 'championship' | 'promotion';

  /** Season number when achieved */
  seasonNumber: number;

  /** Division at time of achievement */
  division: number;

  /** Final record (wins-losses) */
  record: { wins: number; losses: number };

  /** Date achieved */
  date: Date;
}

/**
 * Record of a player award received by user's team
 */
export interface PlayerAwardRecord {
  /** Type of award */
  type: 'playerOfTheYear' | 'playerOfTheMonth' | 'playerOfTheWeek';

  /** Sport the award was for */
  sport: 'basketball' | 'baseball' | 'soccer';

  /** Player ID who received the award */
  playerId: string;

  /** Player name at time of award */
  playerName: string;

  /** Season number */
  seasonNumber: number;

  /** Week or month number (for weekly/monthly awards) */
  period?: number;

  /** Date received */
  date: Date;
}

/**
 * Single season's manager rating data
 */
export interface SeasonRating {
  /** Season number */
  seasonNumber: number;

  /** Division played in */
  division: number;

  /** Final position (1-20) */
  finishPosition: number;

  /** Base points from finish (20 for 1st, 1 for 20th) */
  basePoints: number;

  /** Division multiplier applied */
  divisionMultiplier: number;

  /** Bonus points (championship, promotion) */
  bonusPoints: number;

  /** Penalty points (relegation) */
  penaltyPoints: number;

  /** Total points for this season */
  totalPoints: number;
}

/**
 * Manager career tracking for leaderboards
 */
export interface ManagerCareer {
  /** Manager/save name */
  name: string;

  /** Unique career ID */
  id: string;

  /** Season ratings history */
  seasonRatings: SeasonRating[];

  /** Total career points */
  totalPoints: number;

  /** Best single season points */
  bestSeasonPoints: number;

  /** Best single season number */
  bestSeasonNumber: number;

  /** Total championships won */
  championships: number;

  /** Total promotions */
  promotions: number;

  /** Total relegations */
  relegations: number;

  /** Highest division reached */
  highestDivision: number;

  /** Current division */
  currentDivision: number;

  /** Total seasons played */
  seasonsPlayed: number;

  /** Date career started */
  startDate: Date;

  /** Date of last update */
  lastUpdated: Date;
}

/**
 * Leaderboard entry for comparison
 */
export interface LeaderboardEntry {
  /** Manager name */
  name: string;

  /** Career ID */
  id: string;

  /** Points for this leaderboard category */
  points: number;

  /** Rank in leaderboard */
  rank: number;

  /** Additional context (e.g., division, season) */
  context?: string;

  /** Is this the current user's career? */
  isUser: boolean;
}

// =============================================================================
// SCOUTING
// =============================================================================

/**
 * Attribute range (for scouting reports)
 */
export interface AttributeRange {
  /** Minimum value */
  min: number;

  /** Maximum value */
  max: number;
}

/**
 * Overall sport rating range
 */
export interface OverallRatings {
  basketball: AttributeRange;
  baseball: AttributeRange;
  soccer: AttributeRange;
}

/**
 * Player snapshot for scouting report
 */
export interface PlayerSnapshot {
  /** Player name */
  name: string;

  /** Player age */
  age: number;

  /** Current team ('free_agent' or team ID) */
  currentTeam: string;

  /** Contract status */
  contractStatus: 'free_agent' | 'under_contract' | 'youth';
}

/**
 * Scouting report
 */
export interface ScoutingReport {
  /** Report ID (UUID) */
  id: string;

  /** Player ID */
  playerId: string;

  /** When scouting was completed */
  scoutedDate: Date;

  /** Scouting quality (0-100, affects range accuracy) */
  scoutingQuality: number;

  /** Attribute ranges (attribute name -> range) */
  attributeRanges: Record<string, AttributeRange>;

  /** Overall sport ratings */
  overallRatings: OverallRatings;

  /** Player snapshot at time of scouting */
  playerSnapshot: PlayerSnapshot;
}

/**
 * Scouting target filters
 */
export interface ScoutingFilters {
  /** Minimum age */
  ageMin?: number;

  /** Maximum age */
  ageMax?: number;

  /** Attribute filters (attribute name -> range) */
  attributeFilters?: Record<string, AttributeRange>;

  /** Minimum height */
  heightMin?: number;

  /** Maximum height */
  heightMax?: number;

  /** Target specific teams */
  teams?: string[];
}

/**
 * Scouting target
 */
export interface ScoutingTarget {
  /** Target ID (UUID) */
  id: string;

  /** Target type */
  targetType: 'free_agent' | 'team_player' | 'general';

  /** Search filters */
  filters: ScoutingFilters;

  /** Current status */
  status: 'active' | 'completed';
}

// =============================================================================
// YOUTH ACADEMY
// =============================================================================

/**
 * Youth prospect (15-18 years old)
 */
export interface YouthProspect {
  /** Prospect ID (UUID) */
  id: string;

  /** Prospect name */
  name: string;

  /** Prospect age (15-18) */
  age: number;

  /** Date of birth */
  dateOfBirth: Date;

  /** Position (PG, SG, SF, PF, C) */
  position: string;

  /** Height in inches (e.g., 72 = 6'0", 78 = 6'6") */
  height: number;

  /** Weight in pounds (e.g., 185, 220) */
  weight: number;

  /** Nationality/Country (e.g., "USA", "Spain", "France") */
  nationality: string;

  /** Attributes (generally lower than main roster) */
  attributes: PlayerAttributes;

  /** Potentials (hidden, generally higher than current) */
  potentials: PlayerPotentials;

  /** When joined academy */
  joinedAcademyDate: Date;

  /** Must be promoted by this date (19th birthday) */
  mustPromoteBy: Date;

  /** Individual training focus (null = default academy training) */
  trainingFocus: TrainingFocus | null;

  /** Which team's academy */
  academyId: string;
}

// =============================================================================
// TRANSFERS
// =============================================================================

/**
 * Transfer offer counter-offer
 */
export interface TransferCounterOffer {
  /** Counter amount */
  amount: number;

  /** Team that countered */
  counteredBy: string;

  /** When countered */
  counteredDate: Date;
}

/**
 * Transfer negotiation entry
 */
export interface TransferNegotiationEntry {
  /** Offer amount */
  amount: number;

  /** Team making offer */
  from: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Transfer offer
 */
export interface TransferOffer {
  /** Offer ID (UUID) */
  id: string;

  /** Team making offer */
  offeringTeamId: string;

  /** Team receiving offer */
  receivingTeamId: string;

  /** Player ID */
  playerId: string;

  /** Transfer fee */
  transferFee: number;

  /** Current status */
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';

  /** Creation date */
  createdDate: Date;

  /** Expiry date */
  expiryDate: Date;

  /** Counter offer (if countered) */
  counterOffer?: TransferCounterOffer;

  /** Negotiation history */
  negotiationHistory: TransferNegotiationEntry[];
}

// =============================================================================
// NEWS / ALERTS
// =============================================================================

/**
 * News item / alert
 */
export interface NewsItem {
  /** News ID (UUID) */
  id: string;

  /** News type */
  type: 'injury' | 'contract' | 'scouting' | 'transfer' | 'match' | 'youth' | 'general' | 'award' | 'progression' | 'stat_line' | 'window' | 'league' | 'finance';

  /** Priority level */
  priority: 'critical' | 'important' | 'info';

  /** Title */
  title: string;

  /** Message body */
  message: string;

  /** Timestamp */
  timestamp: Date;

  /** Has been read? */
  read: boolean;

  /** Related entity ID (player, match, etc.) */
  relatedEntityId?: string;

  /** Scope - which filter shows this event */
  scope: 'team' | 'division' | 'global';

  /** Team ID this event relates to (for division-level filtering) */
  teamId?: string;

  /** Sport this event relates to (for sport-specific events) */
  sport?: 'basketball' | 'baseball' | 'soccer';

  /** Stat type for notable stat lines */
  statType?: string;
}

// =============================================================================
// GAME SAVE STATE
// =============================================================================

/**
 * Complete game save state
 */
export interface GameSave {
  /** Save version (for migrations) */
  version: string;

  /** Save ID (UUID) */
  saveId: string;

  /** Save name */
  saveName: string;

  /** Last saved timestamp */
  lastSaved: Date;

  // Core game state

  /** User's franchise */
  franchise: Franchise;

  /** All players (user, AI, free agents, youth) */
  players: Player[];

  /** Youth prospects */
  youthProspects: YouthProspect[];

  /** Current season */
  season: Season;

  /** AI teams */
  aiTeams: Franchise[];

  // Active negotiations

  /** Active transfer offers */
  transferOffers: TransferOffer[];

  /** Active contract negotiations */
  contractNegotiations: ContractNegotiation[];

  // Scouting

  /** Completed scouting reports */
  scoutingReports: ScoutingReport[];

  /** Active scouting targets */
  scoutingTargets: ScoutingTarget[];

  // News

  /** News items / alerts */
  newsItems: NewsItem[];

  // Historical data

  /** Season history */
  seasonHistory: SeasonHistory[];
}

// =============================================================================
// CLOUD SAVE (Future Compatibility)
// =============================================================================

/**
 * Cloud save metadata (for future cloud saves)
 * Not implemented in MVP, but architecture supports it
 */
export interface CloudSaveMetadata {
  /** Save ID */
  saveId: string;

  /** User ID (future cloud save system) */
  userId: string;

  /** Platform */
  platform: 'ios' | 'android';

  /** Last synced timestamp */
  lastSyncedAt: Date;

  /** Local version number */
  localVersion: number;

  /** Cloud version number */
  cloudVersion: number;
}

/**
 * Conflict resolution strategy (for future cloud saves)
 */
export enum ConflictResolution {
  USE_LOCAL = 'USE_LOCAL',
  USE_CLOUD = 'USE_CLOUD',
  MANUAL = 'MANUAL',
}

// =============================================================================
// TYPE GUARDS
// =============================================================================

/**
 * Type guard: Check if player is a youth prospect
 */
export function isYouthProspect(player: Player | YouthProspect): player is YouthProspect {
  return 'joinedAcademyDate' in player && 'mustPromoteBy' in player;
}

/**
 * Type guard: Check if player is free agent
 */
export function isFreeAgent(player: Player): boolean {
  return player.teamId === 'free_agent';
}

/**
 * Type guard: Check if player is on user team
 */
export function isUserPlayer(player: Player): boolean {
  return player.teamId === 'user';
}

/**
 * Type guard: Check if team is AI team
 */
export function isAITeam(franchise: Franchise): boolean {
  return franchise.id !== 'user';
}
