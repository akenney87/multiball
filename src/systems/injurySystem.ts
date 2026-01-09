/**
 * Injury System
 *
 * Manages player injuries during matches and training.
 * - Durability-based injury probability
 * - Recovery time calculation (affected by medical budget)
 * - Doctor report generation
 * - Injury status tracking
 *
 * Design Principles:
 * - Simple durability-based probability (no complex formulas)
 * - Medical budget affects injury prevention and recovery speed
 * - Realistic injury types and recovery times
 * - Clear user-facing doctor reports
 */

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

// Base injury probabilities
export const BASE_INJURY_PROBABILITY_PER_MATCH = 0.05;     // 5% base chance per match
export const BASE_INJURY_PROBABILITY_PER_TRAINING = 0.01;  // 1% base chance per training

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
