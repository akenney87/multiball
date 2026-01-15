/**
 * Injury System
 *
 * Manages player injuries during matches and training.
 * - Durability-based injury probability
 * - Recovery time calculation (affected by medical budget)
 * - Doctor report generation
 * - Injury status tracking
 * - In-game injuries (momentary, temporary, game-ending)
 * - Sport-specific injury rules
 *
 * Design Principles:
 * - Simple durability-based probability (no complex formulas)
 * - Medical budget affects recovery speed (not injury rate)
 * - Realistic injury types and recovery times
 * - Clear user-facing doctor reports
 *
 * Sport-Specific Rules:
 * - Basketball: Injured player subbed out, can return later
 * - Baseball: Injured player removed, cannot return to game
 * - Soccer: If out >2 minutes, must be substituted
 */

export type Sport = 'basketball' | 'baseball' | 'soccer';

/**
 * In-game injury outcomes - determined during simulation
 */
export enum InGameInjuryOutcome {
  /** Player shakes it off, continues playing */
  MOMENTARY = 'momentary',
  /** Out for rest of play/possession, can return later (not baseball) */
  TEMPORARY = 'temporary',
  /** Out for remainder of game, may have recovery period */
  GAME_ENDING = 'game_ending',
}

/**
 * In-game injury result
 */
export interface InGameInjuryResult {
  injured: boolean;
  outcome: InGameInjuryOutcome | null;
  /** Minutes until player can return (for TEMPORARY injuries) */
  minutesOut: number;
  /** Post-game injury to apply (for GAME_ENDING injuries that persist) */
  postGameInjury: InjuryData | null;
  /** Description of what happened */
  description: string;
}

/**
 * Injury types with realistic medical conditions
 */
export enum InjuryType {
  // Minor injuries (1-2 weeks)
  ANKLE_SPRAIN = 'Ankle Sprain',
  HAMSTRING_STRAIN = 'Hamstring Strain',
  BRUISED_RIBS = 'Bruised Ribs',
  MINOR_CONCUSSION = 'Minor Concussion',

  // Moderate injuries (2-6 weeks)
  GROIN_PULL = 'Groin Pull',
  SHOULDER_STRAIN = 'Shoulder Strain',
  KNEE_SPRAIN = 'Knee Sprain',
  WRIST_SPRAIN = 'Wrist Sprain',

  // Major injuries (6-12 weeks)
  STRESS_FRACTURE = 'Stress Fracture',
  TORN_MENISCUS = 'Torn Meniscus',
  SHOULDER_SEPARATION = 'Shoulder Separation',

  // Season-ending injuries (12+ weeks)
  ACL_TEAR = 'ACL Tear',
  ACHILLES_RUPTURE = 'Achilles Rupture',
  COMPOUND_FRACTURE = 'Compound Fracture',
}

/**
 * Injury severity levels
 */
export enum InjurySeverity {
  MINOR = 'Minor',
  MODERATE = 'Moderate',
  MAJOR = 'Major',
  SEASON_ENDING = 'Season Ending',
}

/**
 * Complete injury data structure
 */
export interface InjuryData {
  type: InjuryType;
  severity: InjurySeverity;
  injuryDate: Date;
  recoveryWeeks: number;        // Base recovery time (before medical budget impact)
  actualRecoveryWeeks: number;  // Adjusted for medical budget
  weeksMissed: number;          // Tracks recovery progress
  isActive: boolean;            // Is player currently injured?
  doctorReport: string;         // User-facing injury description
}

/**
 * Result of injury probability check
 */
export interface InjuryProbabilityResult {
  injured: boolean;
  injury: InjuryData | null;
}

// Base injury probabilities (post-game / weekly)
export const BASE_INJURY_PROBABILITY_PER_MATCH = 0.05;     // 5% base chance per match
export const BASE_INJURY_PROBABILITY_PER_TRAINING = 0.01;  // 1% base chance per training

// =============================================================================
// IN-GAME INJURY RATES (per player per game)
// =============================================================================
// Based on research: NBA ~7%, MLB ~4%, Soccer ~5%

export const IN_GAME_INJURY_RATES: Record<Sport, number> = {
  basketball: 0.07,  // 7% per player per game
  baseball: 0.04,    // 4% per player per game
  soccer: 0.05,      // 5% per player per game
};

// Outcome probabilities by sport (must sum to 1.0 when injury occurs)
// Basketball: Can return from temporary injuries
// Baseball: No temporary - if you're hurt, you're out
// Soccer: Temporary but must sub if >2min
export const IN_GAME_OUTCOME_PROBABILITIES: Record<Sport, Record<InGameInjuryOutcome, number>> = {
  basketball: {
    [InGameInjuryOutcome.MOMENTARY]: 0.60,     // 60% shake it off
    [InGameInjuryOutcome.TEMPORARY]: 0.25,     // 25% need rest but can return
    [InGameInjuryOutcome.GAME_ENDING]: 0.15,   // 15% out for game
  },
  baseball: {
    [InGameInjuryOutcome.MOMENTARY]: 0.50,     // 50% shake it off
    [InGameInjuryOutcome.TEMPORARY]: 0.00,     // No temporary in baseball
    [InGameInjuryOutcome.GAME_ENDING]: 0.50,   // 50% out for game (if not momentary)
  },
  soccer: {
    [InGameInjuryOutcome.MOMENTARY]: 0.55,     // 55% shake it off
    [InGameInjuryOutcome.TEMPORARY]: 0.20,     // 20% need treatment but can continue
    [InGameInjuryOutcome.GAME_ENDING]: 0.25,   // 25% must substitute
  },
};

// Of game-ending injuries, what % result in post-game recovery time
export const POST_GAME_INJURY_PROBABILITY: Record<Sport, number> = {
  basketball: 0.35,  // 35% of game-ending injuries persist
  baseball: 0.40,    // 40% - pitchers especially
  soccer: 0.35,      // 35% of game-ending injuries persist
};

// Minutes out for temporary injuries
export const TEMPORARY_INJURY_MINUTES: Record<Sport, { min: number; max: number }> = {
  basketball: { min: 2, max: 8 },    // 2-8 minutes on bench
  baseball: { min: 0, max: 0 },      // N/A - no temporary in baseball
  soccer: { min: 1, max: 3 },        // 1-3 minutes of treatment on field
};

// Injury severity probabilities (must sum to 1.0)
const INJURY_TYPE_PROBABILITIES = {
  [InjurySeverity.MINOR]: 0.60,        // 60% of injuries are minor
  [InjurySeverity.MODERATE]: 0.25,      // 25% are moderate
  [InjurySeverity.MAJOR]: 0.12,         // 12% are major
  [InjurySeverity.SEASON_ENDING]: 0.03, // 3% are season-ending
};

// Injury types grouped by severity
const INJURY_TYPES_BY_SEVERITY: Record<InjurySeverity, InjuryType[]> = {
  [InjurySeverity.MINOR]: [
    InjuryType.ANKLE_SPRAIN,
    InjuryType.HAMSTRING_STRAIN,
    InjuryType.BRUISED_RIBS,
    InjuryType.MINOR_CONCUSSION,
  ],
  [InjurySeverity.MODERATE]: [
    InjuryType.GROIN_PULL,
    InjuryType.SHOULDER_STRAIN,
    InjuryType.KNEE_SPRAIN,
    InjuryType.WRIST_SPRAIN,
  ],
  [InjurySeverity.MAJOR]: [
    InjuryType.STRESS_FRACTURE,
    InjuryType.TORN_MENISCUS,
    InjuryType.SHOULDER_SEPARATION,
  ],
  [InjurySeverity.SEASON_ENDING]: [
    InjuryType.ACL_TEAR,
    InjuryType.ACHILLES_RUPTURE,
    InjuryType.COMPOUND_FRACTURE,
  ],
};

// Recovery time ranges by severity (in weeks)
const RECOVERY_TIME_RANGES: Record<InjurySeverity, { min: number; max: number }> = {
  [InjurySeverity.MINOR]: { min: 1, max: 2 },
  [InjurySeverity.MODERATE]: { min: 2, max: 6 },
  [InjurySeverity.MAJOR]: { min: 6, max: 12 },
  [InjurySeverity.SEASON_ENDING]: { min: 12, max: 24 },
};

// Condition (matchFitness) penalty by injury severity
// When injured, player's condition drops significantly
const CONDITION_PENALTY_BY_SEVERITY: Record<InjurySeverity, number> = {
  [InjurySeverity.MINOR]: 30,         // Drop ~30 points (e.g., 100 -> 70)
  [InjurySeverity.MODERATE]: 50,      // Drop ~50 points (e.g., 100 -> 50)
  [InjurySeverity.MAJOR]: 70,         // Drop ~70 points (e.g., 100 -> 30)
  [InjurySeverity.SEASON_ENDING]: 90, // Drop ~90 points (e.g., 100 -> 10)
};

/**
 * Gets the condition (matchFitness) penalty for an injury severity.
 * This is subtracted from the player's matchFitness when injured.
 *
 * @param severity - Injury severity level
 * @returns Condition penalty (points to subtract from matchFitness)
 */
export function getInjuryConditionPenalty(severity: InjurySeverity): number {
  return CONDITION_PENALTY_BY_SEVERITY[severity] ?? 30;
}

/**
 * Calculates injury probability multiplier based on durability attribute
 *
 * Scale:
 * - Durability 0: 2.0x multiplier (very injury prone)
 * - Durability 50: 1.1x multiplier (average)
 * - Durability 100: 0.2x multiplier (very durable, 80% reduction)
 *
 * @param durability - Player's durability attribute (0-100)
 * @returns Injury probability multiplier
 */
export function calculateInjuryProbabilityMultiplier(durability: number): number {
  // Linear scale from 2.0x at durability 0 to 0.2x at durability 100
  return 2.0 - (durability / 100) * 1.8;
}

/**
 * Checks if a player gets injured during a match
 *
 * @param durability - Player's durability attribute (0-100)
 * @param medicalMultiplier - Medical budget impact (0.5x to 2.0x, lower = better prevention)
 * @param seed - Random seed for deterministic results
 * @param fitnessMultiplier - Match fitness impact (1.0x at 100% fitness, up to 2.0x at 0% fitness)
 * @returns Injury result
 */
export function checkMatchInjury(
  durability: number,
  medicalMultiplier: number,
  seed: number,
  fitnessMultiplier: number = 1.0
): InjuryProbabilityResult {
  const durabilityMultiplier = calculateInjuryProbabilityMultiplier(durability);
  // Low fitness increases injury risk
  const injuryChance = BASE_INJURY_PROBABILITY_PER_MATCH * durabilityMultiplier * medicalMultiplier * fitnessMultiplier;

  // Use seed for deterministic randomness
  const random = Math.abs(Math.sin(seed)) % 1;

  if (random < injuryChance) {
    return {
      injured: true,
      injury: generateInjury(medicalMultiplier, seed),
    };
  }

  return {
    injured: false,
    injury: null,
  };
}

/**
 * Checks if a player gets injured during training
 *
 * @param durability - Player's durability attribute (0-100)
 * @param medicalMultiplier - Medical budget impact (0.5x to 2.0x, lower = better prevention)
 * @param seed - Random seed for deterministic results
 * @param fitnessMultiplier - Match fitness impact (1.0x at 100% fitness, up to 2.0x at 0% fitness)
 * @returns Injury result
 */
export function checkTrainingInjury(
  durability: number,
  medicalMultiplier: number,
  seed: number,
  fitnessMultiplier: number = 1.0
): InjuryProbabilityResult {
  const durabilityMultiplier = calculateInjuryProbabilityMultiplier(durability);
  // Low fitness increases injury risk during training too
  const injuryChance = BASE_INJURY_PROBABILITY_PER_TRAINING * durabilityMultiplier * medicalMultiplier * fitnessMultiplier;

  // Use seed for deterministic randomness
  const random = Math.abs(Math.sin(seed)) % 1;

  if (random < injuryChance) {
    return {
      injured: true,
      injury: generateInjury(medicalMultiplier, seed),
    };
  }

  return {
    injured: false,
    injury: null,
  };
}

/**
 * Generates a random injury with severity and recovery time
 *
 * @param recoverySpeedMultiplier - Medical budget impact on recovery (1.0x to 2.0x, higher = faster)
 * @param seed - Random seed for deterministic results
 * @returns Injury data
 */
function generateInjury(recoverySpeedMultiplier: number, seed: number): InjuryData {
  // Determine severity
  const severityRandom = Math.abs(Math.sin(seed * 1.1)) % 1;
  let severity: InjurySeverity = InjurySeverity.MINOR;
  let cumulativeProbability = 0;

  for (const [sev, prob] of Object.entries(INJURY_TYPE_PROBABILITIES)) {
    cumulativeProbability += prob;
    if (severityRandom < cumulativeProbability) {
      severity = sev as InjurySeverity;
      break;
    }
  }

  // Select random injury type within severity
  const injuryTypes = INJURY_TYPES_BY_SEVERITY[severity];
  const typeRandom = Math.abs(Math.sin(seed * 1.2)) % 1;
  const typeIndex = Math.floor(typeRandom * injuryTypes.length);
  const injuryType = injuryTypes[typeIndex];

  // Calculate recovery time
  const recoveryRange = RECOVERY_TIME_RANGES[severity];
  const recoveryRandom = Math.abs(Math.sin(seed * 1.3)) % 1;
  const baseRecoveryWeeks = recoveryRange.min + Math.floor(recoveryRandom * (recoveryRange.max - recoveryRange.min + 1));

  // Apply medical budget impact on recovery speed
  // recoverySpeedMultiplier: 1.0x (poor medical) to 2.0x (elite medical)
  // Higher multiplier = faster recovery = fewer weeks
  const actualRecoveryWeeks = Math.max(1, Math.round(baseRecoveryWeeks / recoverySpeedMultiplier));

  // Generate doctor report
  const doctorReport = generateDoctorReport(injuryType, severity, actualRecoveryWeeks);

  return {
    type: injuryType,
    severity,
    injuryDate: new Date(),
    recoveryWeeks: baseRecoveryWeeks,
    actualRecoveryWeeks,
    weeksMissed: 0,
    isActive: true,
    doctorReport,
  };
}

/**
 * Generates a user-facing doctor report
 *
 * @param injuryType - Type of injury
 * @param severity - Injury severity
 * @param recoveryWeeks - Expected recovery time
 * @returns Doctor report text
 */
function generateDoctorReport(
  injuryType: InjuryType,
  severity: InjurySeverity,
  recoveryWeeks: number
): string {
  const reports: Record<InjuryType, string> = {
    [InjuryType.ANKLE_SPRAIN]: `Mild ankle sprain detected. Ligament damage is minor. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.HAMSTRING_STRAIN]: `Hamstring strain confirmed. Grade I tear. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.BRUISED_RIBS]: `Bruised ribs confirmed via X-ray. No fractures detected. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.MINOR_CONCUSSION]: `Minor concussion confirmed. Will need to pass concussion protocol. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.GROIN_PULL]: `Groin strain confirmed. Grade II tear in adductor muscle. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.SHOULDER_STRAIN]: `Shoulder strain confirmed. Rotator cuff inflammation detected. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.KNEE_SPRAIN]: `Knee sprain confirmed. MCL strain detected. No structural damage. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.WRIST_SPRAIN]: `Wrist sprain confirmed. Ligament damage detected. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.STRESS_FRACTURE]: `Stress fracture confirmed in lower leg. Requires immobilization and rest. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.TORN_MENISCUS]: `Torn meniscus confirmed via MRI. Surgery recommended. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.SHOULDER_SEPARATION]: `Shoulder separation confirmed. Grade II AC joint separation. Expected to miss ${recoveryWeeks} week(s).`,
    [InjuryType.ACL_TEAR]: `Complete ACL tear confirmed. Surgery required. Expected to miss ${recoveryWeeks} week(s). Season likely over.`,
    [InjuryType.ACHILLES_RUPTURE]: `Complete Achilles tendon rupture. Emergency surgery required. Expected to miss ${recoveryWeeks} week(s). Season over.`,
    [InjuryType.COMPOUND_FRACTURE]: `Compound fracture confirmed. Immediate surgery required. Expected to miss ${recoveryWeeks} week(s). Season over.`,
  };

  return reports[injuryType];
}

/**
 * Updates injury status after a week passes
 *
 * @param injury - Current injury data
 * @returns Updated injury data (or null if recovered)
 */
export function progressInjury(injury: InjuryData): InjuryData | null {
  if (!injury.isActive) {
    return null;
  }

  const weeksMissed = injury.weeksMissed + 1;

  if (weeksMissed >= injury.actualRecoveryWeeks) {
    // Player has recovered
    return {
      ...injury,
      weeksMissed,
      isActive: false,
    };
  }

  // Still injured
  return {
    ...injury,
    weeksMissed,
  };
}

/**
 * Checks if a player is currently injured
 *
 * @param injury - Injury data (or null if never injured)
 * @returns True if player is currently injured
 */
export function isPlayerInjured(injury: InjuryData | null): boolean {
  return injury !== null && injury.isActive;
}

/**
 * Gets remaining recovery time
 *
 * @param injury - Injury data
 * @returns Weeks remaining (0 if not injured)
 */
export function getRemainingRecoveryTime(injury: InjuryData | null): number {
  if (!injury || !injury.isActive) {
    return 0;
  }

  return Math.max(0, injury.actualRecoveryWeeks - injury.weeksMissed);
}

// =============================================================================
// IN-GAME INJURY SYSTEM
// =============================================================================

// In-game injury descriptions by sport and outcome
const IN_GAME_INJURY_DESCRIPTIONS: Record<Sport, Record<InGameInjuryOutcome, string[]>> = {
  basketball: {
    [InGameInjuryOutcome.MOMENTARY]: [
      'takes an elbow but shakes it off',
      'lands awkwardly but gets back up',
      'grabs their wrist briefly but continues',
      'takes a hard foul but stays in',
      'tweaks something but waves off the trainer',
    ],
    [InGameInjuryOutcome.TEMPORARY]: [
      'is helped to the bench after tweaking their ankle',
      'heads to the locker room for evaluation',
      'is subbed out after taking a hard hit',
      'needs to sit after a collision',
      'is being looked at by the trainer',
    ],
    [InGameInjuryOutcome.GAME_ENDING]: [
      'goes down and can\'t put weight on their leg',
      'is helped off the court and won\'t return',
      'is being taken to the locker room',
      'suffers what looks like a serious injury',
      'is ruled out for the remainder of the game',
    ],
  },
  baseball: {
    [InGameInjuryOutcome.MOMENTARY]: [
      'takes a ball off the body but stays in',
      'dives for a ball and pops right back up',
      'gets tangled with a runner but brushes it off',
      'shakes off a hard swing and stays in the box',
      'gets hit by a pitch but jogs to first',
    ],
    [InGameInjuryOutcome.TEMPORARY]: [], // Baseball has no temporary injuries
    [InGameInjuryOutcome.GAME_ENDING]: [
      'exits the game with apparent arm discomfort',
      'is removed after grabbing their hamstring',
      'leaves the game after an awkward swing',
      'comes out after a collision on the basepaths',
      'signals to the dugout and heads off the field',
    ],
  },
  soccer: {
    [InGameInjuryOutcome.MOMENTARY]: [
      'goes down but gets back up quickly',
      'takes a knock but plays on',
      'is clipped but waves away the physio',
      'shakes off a challenge',
      'takes a moment but continues',
    ],
    [InGameInjuryOutcome.TEMPORARY]: [
      'receives treatment on the pitch',
      'is being looked at by the physio',
      'is down and needs attention',
      'is slow to get up after the tackle',
      'needs a moment to recover',
    ],
    [InGameInjuryOutcome.GAME_ENDING]: [
      'is stretchered off the pitch',
      'cannot continue and must be substituted',
      'is helped off by the medical team',
      'signals to the bench that they can\'t go on',
      'suffers what looks like a serious injury',
    ],
  },
};

/**
 * Checks for an in-game injury during simulation
 *
 * Call this during key moments:
 * - Basketball: Each possession or high-impact play
 * - Baseball: Each at-bat or defensive play
 * - Soccer: Each minute or key action
 *
 * @param sport - Sport being played
 * @param durability - Player's durability attribute (0-100)
 * @param staminaPercent - Player's current stamina (0-100), lower = higher risk
 * @param seed - Random seed for deterministic results
 * @param checksPerGame - How many injury checks happen per game (to scale probability)
 * @returns In-game injury result
 */
export function checkInGameInjury(
  sport: Sport,
  durability: number,
  staminaPercent: number,
  seed: number,
  checksPerGame: number = 100
): InGameInjuryResult {
  // Base injury rate for this sport
  const baseRate = IN_GAME_INJURY_RATES[sport];

  // Scale down by number of checks per game
  // If we check 200 times in basketball, each check is 0.07/200 = 0.035%
  const perCheckRate = baseRate / checksPerGame;

  // Durability reduces injury chance (0.2x at 100 durability, 2.0x at 0)
  const durabilityMultiplier = calculateInjuryProbabilityMultiplier(durability);

  // Low stamina increases injury risk (1.0x at 100%, 2.0x at 0%)
  const staminaMultiplier = 1.0 + (1.0 - staminaPercent / 100);

  // Final injury probability for this check
  const injuryChance = perCheckRate * durabilityMultiplier * staminaMultiplier;

  // Use seed for deterministic randomness
  const random = Math.abs(Math.sin(seed)) % 1;

  if (random >= injuryChance) {
    return {
      injured: false,
      outcome: null,
      minutesOut: 0,
      postGameInjury: null,
      description: '',
    };
  }

  // Injury occurred - determine outcome
  const outcomeProbs = IN_GAME_OUTCOME_PROBABILITIES[sport];
  const outcomeRandom = Math.abs(Math.sin(seed * 1.1)) % 1;

  let outcome: InGameInjuryOutcome = InGameInjuryOutcome.MOMENTARY;
  let cumulative = 0;

  for (const [out, prob] of Object.entries(outcomeProbs)) {
    cumulative += prob;
    if (outcomeRandom < cumulative) {
      outcome = out as InGameInjuryOutcome;
      break;
    }
  }

  // Calculate minutes out for temporary injuries
  let minutesOut = 0;
  if (outcome === InGameInjuryOutcome.TEMPORARY) {
    const range = TEMPORARY_INJURY_MINUTES[sport];
    const minutesRandom = Math.abs(Math.sin(seed * 1.2)) % 1;
    minutesOut = range.min + Math.floor(minutesRandom * (range.max - range.min + 1));
  }

  // Check for post-game injury (only for game-ending injuries)
  let postGameInjury: InjuryData | null = null;
  if (outcome === InGameInjuryOutcome.GAME_ENDING) {
    const postGameRandom = Math.abs(Math.sin(seed * 1.3)) % 1;
    if (postGameRandom < POST_GAME_INJURY_PROBABILITY[sport]) {
      // Generate a post-game injury (medical multiplier doesn't affect generation)
      postGameInjury = generateInjury(1.0, seed * 1.4);
    }
  }

  // Get description
  const descriptions = IN_GAME_INJURY_DESCRIPTIONS[sport][outcome];
  const descIndex = Math.floor((Math.abs(Math.sin(seed * 1.5)) % 1) * descriptions.length);
  const description = descriptions[descIndex] || 'is injured';

  return {
    injured: true,
    outcome,
    minutesOut,
    postGameInjury,
    description,
  };
}

/**
 * Determines if a player with a temporary injury can return
 *
 * @param sport - Sport being played
 * @param minutesElapsed - Minutes since injury
 * @param minutesOut - Originally assigned minutes out
 * @returns True if player can return
 */
export function canReturnFromInjury(
  sport: Sport,
  minutesElapsed: number,
  minutesOut: number
): boolean {
  // Baseball players never return
  if (sport === 'baseball') {
    return false;
  }

  return minutesElapsed >= minutesOut;
}

/**
 * For soccer: determines if injured player must be substituted
 *
 * @param minutesOut - Minutes of treatment needed
 * @returns True if substitution required
 */
export function soccerMustSubstitute(minutesOut: number): boolean {
  // If treatment takes more than 2 minutes, must substitute
  return minutesOut > 2;
}

/**
 * Track in-game injured players
 */
export interface InGameInjuredPlayer {
  playerId: string;
  outcome: InGameInjuryOutcome;
  injuredAtMinute: number;
  minutesOut: number;
  canReturn: boolean;
  postGameInjury: InjuryData | null;
}

/**
 * Creates an in-game injured player record
 */
export function createInGameInjuredPlayer(
  playerId: string,
  result: InGameInjuryResult,
  currentMinute: number,
  sport: Sport
): InGameInjuredPlayer {
  const canReturn = result.outcome === InGameInjuryOutcome.TEMPORARY &&
    sport !== 'baseball' &&
    (sport !== 'soccer' || !soccerMustSubstitute(result.minutesOut));

  return {
    playerId,
    outcome: result.outcome!,
    injuredAtMinute: currentMinute,
    minutesOut: result.minutesOut,
    canReturn,
    postGameInjury: result.postGameInjury,
  };
}

// =============================================================================
// IN-GAME INJURY TRACKER
// =============================================================================

/**
 * Tracks in-game injuries for a single game.
 * Similar to FoulSystem but for injuries.
 */
export class InGameInjuryTracker {
  private sport: Sport;
  private injuredPlayers: Map<string, InGameInjuredPlayer> = new Map();
  private removedPlayers: Set<string> = new Set(); // Players who can't return
  private checksPerGame: number;

  constructor(sport: Sport, checksPerGame: number = 100) {
    this.sport = sport;
    this.checksPerGame = checksPerGame;
  }

  /**
   * Check if a player gets injured during this moment.
   * Call this during high-action moments (shots, drives, tackles, etc.)
   *
   * @param playerName Player name
   * @param durability Player's durability attribute
   * @param staminaPercent Player's current stamina percentage
   * @param seed Random seed
   * @param currentMinute Current game minute (for tracking return time)
   * @returns Injury result, or null if no injury
   */
  checkInjury(
    playerName: string,
    durability: number,
    staminaPercent: number,
    seed: number,
    currentMinute: number
  ): InGameInjuryResult | null {
    // Skip if player already injured and removed
    if (this.removedPlayers.has(playerName)) {
      return null;
    }

    // Skip if player has temporary injury and hasn't recovered yet
    const existing = this.injuredPlayers.get(playerName);
    if (existing && existing.canReturn) {
      // Check if they can return now
      const minutesElapsed = currentMinute - existing.injuredAtMinute;
      if (!canReturnFromInjury(this.sport, minutesElapsed, existing.minutesOut)) {
        return null; // Still recovering
      }
      // Player has recovered from temporary injury
      this.injuredPlayers.delete(playerName);
    }

    const result = checkInGameInjury(
      this.sport,
      durability,
      staminaPercent,
      seed,
      this.checksPerGame
    );

    if (!result.injured) {
      return null;
    }

    // Track the injury
    const injuredPlayer = createInGameInjuredPlayer(
      playerName,
      result,
      currentMinute,
      this.sport
    );

    this.injuredPlayers.set(playerName, injuredPlayer);

    // If game-ending or can't return, add to removed set
    if (!injuredPlayer.canReturn) {
      this.removedPlayers.add(playerName);
    }

    return result;
  }

  /**
   * Check if a player is currently injured and cannot play.
   */
  isInjuredOut(playerName: string): boolean {
    return this.removedPlayers.has(playerName);
  }

  /**
   * Check if a player has a temporary injury but can potentially return.
   */
  hasTemporaryInjury(playerName: string): boolean {
    const injury = this.injuredPlayers.get(playerName);
    return injury !== undefined && injury.canReturn;
  }

  /**
   * Check if a player with temporary injury can now return.
   */
  canPlayerReturn(playerName: string, currentMinute: number): boolean {
    const injury = this.injuredPlayers.get(playerName);
    if (!injury || !injury.canReturn) {
      return false;
    }

    const minutesElapsed = currentMinute - injury.injuredAtMinute;
    return canReturnFromInjury(this.sport, minutesElapsed, injury.minutesOut);
  }

  /**
   * Get the injury record for a player.
   */
  getInjury(playerName: string): InGameInjuredPlayer | undefined {
    return this.injuredPlayers.get(playerName);
  }

  /**
   * Get all post-game injuries to apply after the game.
   */
  getPostGameInjuries(): Array<{ playerId: string; injury: InjuryData }> {
    const postGame: Array<{ playerId: string; injury: InjuryData }> = [];

    for (const [playerId, record] of this.injuredPlayers) {
      if (record.postGameInjury) {
        postGame.push({
          playerId,
          injury: record.postGameInjury,
        });
      }
    }

    return postGame;
  }

  /**
   * Get all removed (cannot return) players.
   */
  getRemovedPlayers(): string[] {
    return Array.from(this.removedPlayers);
  }

  /**
   * Get all injuries that occurred during the game.
   */
  getAllInjuries(): InGameInjuredPlayer[] {
    return Array.from(this.injuredPlayers.values());
  }
}
