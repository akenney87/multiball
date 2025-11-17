/**
 * Core Data Types for Multiball
 *
 * Complete TypeScript interface definitions for all game entities.
 * Aligned with basketball-sim Python data structures.
 *
 * @module data/types
 */

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
 * Mental attributes (7 total)
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
  /** Teamwork - willingness to pass, help defense */
  teamwork: number;
}

/**
 * Complete athlete attribute set (25 attributes)
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
 * Placeholder for future implementation
 */
export interface BaseballCareerStats {
  // TODO: Define baseball stats
  placeholder?: number;
}

/**
 * Soccer-specific career statistics
 * Placeholder for future implementation
 */
export interface SoccerCareerStats {
  // TODO: Define soccer stats
  placeholder?: number;
}

/**
 * Player season statistics (same structure as career, but for current season)
 */
export type PlayerSeasonStats = PlayerCareerStats;

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

  /** Date of birth */
  dateOfBirth: Date;

  /** Position (basketball: PG/SG/SF/PF/C) */
  position: string;

  /** All 25 attributes (1-100 scale) */
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

  /** Team assignment ('user' | AI team ID | 'free_agent' | 'youth_academy') */
  teamId: string;

  /** How player was acquired */
  acquisitionType: 'starter' | 'draft' | 'trade' | 'free_agent' | 'youth';

  /** When player was acquired */
  acquisitionDate: Date;
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
}

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
}

/**
 * Contract negotiation state
 */
export interface ContractNegotiation {
  /** Negotiation ID (UUID) */
  id: string;

  /** Player ID */
  playerId: string;

  /** Team ID */
  teamId: string;

  /** Current status */
  status: 'pending' | 'accepted' | 'rejected' | 'countered';

  /** Current offer */
  offer: ContractOffer;

  /** Counter offer (if player countered) */
  counterOffer?: ContractOffer;

  /** Negotiation history */
  negotiationHistory: Array<{
    offer: ContractOffer;
    from: 'team' | 'player';
    timestamp: Date;
  }>;
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
}

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
 * Franchise/Team entity
 */
export interface Franchise {
  /** Team ID ('user' for user's team) */
  id: string;

  /** Team name */
  name: string;

  /** Team colors */
  colors: TeamColors;

  /** Current division (1-5) */
  division: 1 | 2 | 3 | 4 | 5;

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
 * Team standing
 */
export interface TeamStanding {
  /** Team ID */
  teamId: string;

  /** Wins */
  wins: number;

  /** Losses */
  losses: number;

  /** Total points (combined across all sports) */
  points: number;

  /** Current rank (1-20) */
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
}

/**
 * Match entity
 */
export interface Match {
  /** Match ID (UUID) */
  id: string;

  /** Season ID */
  seasonId: string;

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
  type: 'injury' | 'contract' | 'scouting' | 'transfer' | 'match' | 'youth' | 'general';

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
