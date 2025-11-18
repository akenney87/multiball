/**
 * Basketball Simulator - Defense System
 *
 * Handles defensive assignment, contest distance calculation, help defense,
 * and zone defense modifiers. All defensive mechanics flow through this module.
 *
 * CRITICAL: This is a direct translation from Python basketball-sim.
 * All formulas MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/systems/defense
 */

import { calculateComposite, sigmoid } from '../core/probability';
import {
  WEIGHTS_CONTEST,
  WEIGHTS_FIND_OPEN_TEAMMATE,
  WEIGHTS_SHOT_SEPARATION,
  WEIGHTS_HELP_DEFENSE_ROTATION,
  ZONE_DEFENSE_CONTEST_PENALTY,
  ZONE_DEFENSE_DRIVE_PENALTY,
  HELP_DEFENSE_AWARENESS_K,
  PATIENCE_DISTANCE_MODIFIER_SCALE,
  CONTEST_DISTANCE_SIGMA,
} from '../constants';

// =============================================================================
// POSITION COMPATIBILITY SCORES
// =============================================================================

/**
 * Position compatibility scores for defensive assignments
 */
const POSITION_COMPATIBILITY: Record<string, number> = {
  'PG_PG': 1.0,
  'PG_SG': 0.8,
  'PG_SF': 0.5,
  'PG_PF': 0.2,
  'PG_C': 0.1,
  'SG_PG': 0.8,
  'SG_SG': 1.0,
  'SG_SF': 0.8,
  'SG_PF': 0.4,
  'SG_C': 0.2,
  'SF_PG': 0.5,
  'SF_SG': 0.8,
  'SF_SF': 1.0,
  'SF_PF': 0.8,
  'SF_C': 0.5,
  'PF_PG': 0.2,
  'PF_SG': 0.4,
  'PF_SF': 0.8,
  'PF_PF': 1.0,
  'PF_C': 0.9,
  'C_PG': 0.1,
  'C_SG': 0.2,
  'C_SF': 0.5,
  'C_PF': 0.9,
  'C_C': 1.0,
};

// =============================================================================
// ZONE DEFENDER ASSIGNMENT
// =============================================================================

/**
 * Assign zone defender based on shot LOCATION, not shooter position.
 *
 * @param shotType - '3pt', 'midrange', 'rim', 'dunk', 'layup'
 * @param defensiveTeam - Full defensive team (5 players)
 * @returns Best defender for that shot location
 */
export function assignZoneDefenderByLocation(
  shotType: string,
  defensiveTeam: Record<string, number>[]
): Record<string, number> {
  // Normalize shot_type (dunk/layup → rim)
  const shotLocation = (shotType === 'dunk' || shotType === 'layup') ? 'rim' : shotType;

  if (shotLocation === '3pt') {
    // Perimeter defenders: prioritize guards and wings
    const perimeter = defensiveTeam.filter(p => {
      const pos = (p as any).position;
      return pos === 'PG' || pos === 'SG' || pos === 'SF' || pos === 'PF';
    });

    if (perimeter.length > 0) {
      // Weight by perimeter defensive attributes
      const weights = perimeter.map(p => (p.agility + p.top_speed + p.reactions) / 3);
      const bestIdx = weights.indexOf(Math.max(...weights));

      // 80% best, 20% variance
      if (Math.random() < 0.80) {
        return { ...perimeter[bestIdx] };
      } else {
        return { ...perimeter[Math.floor(Math.random() * perimeter.length)] };
      }
    } else {
      return { ...defensiveTeam[Math.floor(Math.random() * defensiveTeam.length)] };
    }
  } else if (shotLocation === 'rim') {
    // Paint defenders: prioritize bigs
    const bigs = defensiveTeam.filter(p => {
      const pos = (p as any).position;
      return pos === 'PF' || pos === 'C';
    });

    if (bigs.length > 0) {
      // Weight by rim protection attributes
      const weights = bigs.map(p => (p.jumping + p.height + p.reactions) / 3);
      const bestIdx = weights.indexOf(Math.max(...weights));

      // 85% best, 15% variance
      if (Math.random() < 0.85) {
        return { ...bigs[bestIdx] };
      } else {
        return { ...bigs[Math.floor(Math.random() * bigs.length)] };
      }
    } else {
      return { ...defensiveTeam[Math.floor(Math.random() * defensiveTeam.length)] };
    }
  } else {
    // Midrange: bias toward forwards
    const forwards = defensiveTeam.filter(p => {
      const pos = (p as any).position;
      return pos === 'SF' || pos === 'PF' || pos === 'SG';
    });

    if (forwards.length > 0 && Math.random() < 0.70) {
      return { ...forwards[Math.floor(Math.random() * forwards.length)] };
    } else {
      return { ...defensiveTeam[Math.floor(Math.random() * defensiveTeam.length)] };
    }
  }
}

// =============================================================================
// DEFENSIVE ASSIGNMENT
// =============================================================================

/**
 * Assignment debug info
 */
export interface AssignmentDebugInfo {
  offensivePlayer: string;
  offensivePosition: string;
  allScores: Record<string, any>;
  selected: string;
  selectedScore: number;
}

/**
 * Assign best available defender to offensive player.
 *
 * @param offensivePlayer - Offensive player object
 * @param defensiveTeam - Full defensive team (list of 5 players)
 * @param availableDefenders - List of defender names still available
 * @returns Defender object with debug info attached
 */
export function assignDefender(
  offensivePlayer: Record<string, number>,
  defensiveTeam: Record<string, number>[],
  availableDefenders: string[]
): Record<string, number> {
  if (availableDefenders.length === 0) {
    throw new Error('No available defenders to assign');
  }

  // Filter to available defenders only
  const available = defensiveTeam.filter(p =>
    availableDefenders.includes((p as any).name)
  );

  if (available.length === 0) {
    throw new Error(`None of the specified defenders found: ${availableDefenders}`);
  }

  const offensivePos = (offensivePlayer as any).position || 'SF';

  // Score each available defender
  let bestDefender: Record<string, number> | null = null;
  let bestScore = -1.0;
  const debugScores: Record<string, any> = {};

  for (const defender of available) {
    const defensivePos = (defender as any).position || 'SF';

    // Position compatibility
    const compKey = `${offensivePos}_${defensivePos}`;
    const compatibility = POSITION_COMPATIBILITY[compKey] ?? 0.5;

    // Calculate defensive composite
    const defensiveComposite = calculateComposite(defender, {
      reactions: 0.40,
      agility: 0.30,
      awareness: 0.20,
      height: 0.10,
    });

    // Combined score
    const score = compatibility * 0.6 + (defensiveComposite / 100.0) * 0.4;

    debugScores[(defender as any).name] = {
      position: defensivePos,
      compatibility: compatibility,
      defensiveComposite: defensiveComposite,
      combinedScore: score,
    };

    if (score > bestScore) {
      bestScore = score;
      bestDefender = defender;
    }
  }

  if (!bestDefender) {
    throw new Error('No best defender found');
  }

  // Attach debug info
  const result = { ...bestDefender };
  (result as any)._assignment_debug = {
    offensivePlayer: (offensivePlayer as any).name || 'Unknown',
    offensivePosition: offensivePos,
    allScores: debugScores,
    selected: (bestDefender as any).name,
    selectedScore: bestScore,
  };

  return result;
}

// =============================================================================
// CONTEST DISTANCE CALCULATION
// =============================================================================

/**
 * Calculate how close defender gets to contest the shot.
 *
 * @param defender - Defender object
 * @param isHelpDefense - If True, add +3 ft penalty
 * @param zonePct - Zone defense percentage (0-100), affects contest quality
 * @param passer - Optional passer object (for kickouts) - adds creativity bonus
 * @param shooter - Optional shooter object - adds deception/separation bonus
 * @param shotType - Type of shot ('3pt', 'midrange', 'rim', 'layup', 'dunk')
 * @returns Distance in feet (float)
 */
export function calculateContestDistance(
  defender: Record<string, number>,
  isHelpDefense: boolean = false,
  zonePct: number = 0.0,
  passer?: Record<string, number>,
  shooter?: Record<string, number>,
  shotType: string = 'midrange'
): number {
  // Calculate defender's contest composite
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);

  // Base distance formula
  let baseDistance = 10.0 - (defenderComposite / 10.0);

  // PHASE 1: Acceleration-based closeout modifier
  const defenderAcceleration = defender.acceleration ?? 50;
  const accelerationCloseoutModifier = (defenderAcceleration - 50) * -0.02;
  baseDistance += accelerationCloseoutModifier;

  // Apply help defense penalty
  if (isHelpDefense) {
    baseDistance += 3.0;
  }

  // M4.6 UPDATE: Zone defense affects perimeter and paint differently
  if (zonePct > 0) {
    const zoneModifier = zonePct / 100.0;

    // Normalize shot type
    const normalizedShotType = shotType.toLowerCase();
    const isRimShot = normalizedShotType === 'rim' || normalizedShotType === 'layup' || normalizedShotType === 'dunk';

    let zoneDistancePenalty: number;
    if (isRimShot) {
      // Zone packs the paint - STRONGER rim contest
      zoneDistancePenalty = -1.5 * zoneModifier;
    } else {
      // Zone leaves gaps on perimeter - WEAKER perimeter contest
      zoneDistancePenalty = 1.5 * zoneModifier;
    }

    baseDistance += zoneDistancePenalty;
  }

  // PHASE 3A: Patience Contest Distance Modifier
  if (shooter) {
    const patience = shooter.patience ?? 50;
    const patienceModifier = (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE;
    baseDistance += patienceModifier;
  }

  // Contest Distance Variance: Add Gaussian noise
  const variance = gaussianRandom(0, CONTEST_DISTANCE_SIGMA);
  baseDistance += variance;

  // Clamp to realistic range [0.5, 10.0 feet]
  const finalDistance = Math.max(0.5, Math.min(10.0, baseDistance));

  return finalDistance;
}

/**
 * Generate Gaussian random number using Box-Muller transform
 *
 * @param mean - Mean of the distribution
 * @param stdDev - Standard deviation
 * @returns Random number from Gaussian distribution
 */
function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

// =============================================================================
// HELP DEFENSE
// =============================================================================

/**
 * Help defense debug info
 */
export interface HelpDefenseDebugInfo {
  primaryDefender: string;
  allCandidates: Array<{
    name: string;
    composite: number;
    awareness: number;
    rotationProb: number;
    rotated: boolean;
  }>;
  selectedHelper: string;
  selectedComposite: number;
}

/**
 * Select best available help defender when primary defender is beaten.
 *
 * @param defensiveTeam - Full defensive team (list of 5 players)
 * @param primaryDefender - The primary defender who was beaten
 * @returns Best help defender object, or null if no valid help available
 */
export function selectHelpDefender(
  defensiveTeam: Record<string, number>[],
  primaryDefender: Record<string, number>
): Record<string, number> | null {
  // Filter out primary defender
  const availableHelpers = defensiveTeam.filter(
    p => (p as any).name !== (primaryDefender as any).name
  );

  if (availableHelpers.length === 0) {
    return null;
  }

  // Calculate help defense composite for each potential helper
  const helperCandidates: Array<{
    player: Record<string, number>;
    composite: number;
    awareness: number;
    rotationProb: number;
    rotates: boolean;
  }> = [];

  for (const helper of availableHelpers) {
    // Calculate help defense ability
    const helpComposite = calculateComposite(helper, WEIGHTS_HELP_DEFENSE_ROTATION);

    // Use awareness for rotation probability
    const awareness = helper.awareness ?? 50;
    const rotationProb = sigmoid(-HELP_DEFENSE_AWARENESS_K * (awareness - 50));

    // Roll to see if this defender rotates
    const rotates = Math.random() < rotationProb;

    helperCandidates.push({
      player: helper,
      composite: helpComposite,
      awareness: awareness,
      rotationProb: rotationProb,
      rotates: rotates,
    });
  }

  // Filter to only those who rotated
  const rotators = helperCandidates.filter(h => h.rotates);

  if (rotators.length === 0) {
    return null;
  }

  // Return best (highest composite) rotator
  const bestRotator = rotators.reduce((best, current) =>
    current.composite > best.composite ? current : best
  );

  // Attach debug info
  const result = { ...bestRotator.player };
  (result as any)._help_defense_debug = {
    primaryDefender: (primaryDefender as any).name,
    allCandidates: helperCandidates.map(h => ({
      name: (h.player as any).name,
      composite: h.composite,
      awareness: h.awareness,
      rotationProb: h.rotationProb,
      rotated: h.rotates,
    })),
    selectedHelper: (bestRotator.player as any).name,
    selectedComposite: bestRotator.composite,
  };

  return result;
}

// =============================================================================
// ZONE DEFENSE MODIFIERS
// =============================================================================

/**
 * Apply zone defense modifiers to contest effectiveness.
 *
 * @param baseContestEffectiveness - Base contest quality (0-1 scale)
 * @param zonePct - Zone defense percentage (0-100)
 * @returns Modified contest effectiveness
 */
export function applyZoneModifiers(
  baseContestEffectiveness: number,
  zonePct: number
): number {
  if (zonePct <= 0) {
    return baseContestEffectiveness;
  }

  // Convert zone_pct to 0-1 scale
  const zoneFactor = zonePct / 100.0;

  // Apply contest penalty proportionally
  const zonePenalty = ZONE_DEFENSE_CONTEST_PENALTY * zoneFactor;

  // Apply penalty (additive)
  const modifiedEffectiveness = baseContestEffectiveness + zonePenalty;

  // Clamp to [0, 1]
  return Math.max(0.0, Math.min(1.0, modifiedEffectiveness));
}

/**
 * Get drive success modifier based on zone defense percentage.
 *
 * @param zonePct - Zone defense percentage (0-100)
 * @returns Drive modifier as multiplier (e.g., 0.90 = -10% success)
 */
export function getZoneDriveModifier(zonePct: number): number {
  if (zonePct <= 0) {
    return 1.0;
  }

  // Convert zone_pct to 0-1 scale
  const zoneFactor = zonePct / 100.0;

  // ZONE_DEFENSE_DRIVE_PENALTY = -0.10
  const penalty = ZONE_DEFENSE_DRIVE_PENALTY * zoneFactor;

  // Return as multiplier (1.0 + negative penalty)
  return 1.0 + penalty;
}

// =============================================================================
// INTEGRATED DEFENSE COORDINATOR
// =============================================================================

/**
 * Determine primary contest defender based on defense type.
 *
 * @param shooter - Offensive player taking the shot
 * @param defensiveTeam - Full defensive team (5 players)
 * @param defensiveAssignments - Manual assignments dict {offensive_name: defensive_name}
 * @param defenseType - 'man' or 'zone'
 * @param shotType - Shot location ('3pt', 'midrange', 'rim', 'dunk', 'layup')
 * @returns Primary defender object with debug info
 */
export function getPrimaryDefender(
  shooter: Record<string, number>,
  defensiveTeam: Record<string, number>[],
  defensiveAssignments: Record<string, string>,
  defenseType: string,
  shotType?: string
): Record<string, number> {
  const shooterName = (shooter as any).name;

  if (defenseType === 'man') {
    // Check for manual assignment
    if (shooterName in defensiveAssignments) {
      const assignedDefenderName = defensiveAssignments[shooterName];

      // Find defender in defensiveTeam
      const assignedDefender = defensiveTeam.find(
        d => (d as any).name === assignedDefenderName
      );

      if (assignedDefender) {
        // Valid manual assignment
        const result = { ...assignedDefender };
        (result as any)._assignment_type = 'manual';
        (result as any)._assignment_debug = {
          shooter: shooterName,
          assignedDefender: assignedDefenderName,
          assignmentSource: 'manual',
        };
        return result;
      }
    }

    // Fallback to position-based
    const availableDefenders = defensiveTeam.map(p => (p as any).name);
    const defender = assignDefender(shooter, defensiveTeam, availableDefenders);
    (defender as any)._assignment_type = 'position_fallback';
    return defender;
  } else if (defenseType === 'zone') {
    // Zone defense: location-based matching if shot_type provided
    if (shotType) {
      const defender = assignZoneDefenderByLocation(shotType, defensiveTeam);
      (defender as any)._assignment_type = 'zone_location';
      return defender;
    } else {
      // Fallback to position-based if no shot type yet
      const availableDefenders = defensiveTeam.map(p => (p as any).name);
      const defender = assignDefender(shooter, defensiveTeam, availableDefenders);
      (defender as any)._assignment_type = 'zone_proximity';
      return defender;
    }
  } else {
    throw new Error(`Invalid defense_type: ${defenseType}. Must be 'man' or 'zone'`);
  }
}

/**
 * Calculate overall contest quality based on defender ability and distance.
 *
 * @param defender - Defender object
 * @param contestDistance - Distance in feet
 * @returns Contest quality score (0-1 scale)
 */
export function calculateContestQuality(
  defender: Record<string, number>,
  contestDistance: number
): number {
  // Calculate defender composite
  const defenderComposite = calculateComposite(defender, WEIGHTS_CONTEST);

  // Distance factor
  let distanceFactor: number;
  if (contestDistance < 2.0) {
    distanceFactor = 1.0; // Heavy contest
  } else if (contestDistance < 6.0) {
    distanceFactor = 0.5; // Contested
  } else {
    distanceFactor = 0.1; // Wide open
  }

  // Combined quality
  const quality = (defenderComposite / 100.0) * distanceFactor;

  return Math.max(0.0, Math.min(1.0, quality));
}

// =============================================================================
// DEBUG UTILITIES
// =============================================================================

/**
 * Extract and format all defensive debug information.
 *
 * @param defender - Defender object (may have debug keys attached)
 * @returns Formatted debug object
 */
export function formatDefenseDebug(defender: Record<string, number>): Record<string, any> {
  const debug: Record<string, any> = {
    defenderName: (defender as any).name,
    defenderPosition: (defender as any).position,
  };

  // Extract debug keys
  if ((defender as any)._assignment_type) {
    debug.assignmentType = (defender as any)._assignment_type;
  }

  if ((defender as any)._assignment_debug) {
    debug.assignmentDetails = (defender as any)._assignment_debug;
  }

  if ((defender as any)._help_defense_debug) {
    debug.helpDefense = (defender as any)._help_defense_debug;
  }

  return debug;
}
