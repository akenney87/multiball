/**
 * Basketball Simulator - Possession Orchestration System
 *
 * Main orchestrator for complete possession flow:
 * 1. Possession start (select ball handler, turnover check)
 * 2. Shot attempt (shooter selection, defender assignment, shot type, attempt)
 * 3. Rebound flow (OREB/DREB, putback logic)
 * 4. Assist attribution
 * 5. Free throw handling
 * 6. Play-by-play generation
 *
 * Integrates: shooting, defense, turnovers, rebounding, fouls, free throws
 *
 * @module simulation/possession/possession
 */

import type { Player, TacticalSettings } from '../../data/types';
import { calculateComposite, weightedRandomChoice, rollSuccess, sigmoid } from '../core/probability';
import { playerToSimulationPlayer } from '../core/types';
import {
  USAGE_SCORING_OPTION_1,
  USAGE_SCORING_OPTION_2,
  USAGE_SCORING_OPTION_3,
  WEIGHTS_DRIVE_DUNK,
  WEIGHTS_DRIVE_LAYUP,
  WEIGHTS_DRIVE_KICKOUT,
  WEIGHTS_DRIVE_TURNOVER,
  WEIGHTS_BALL_HANDLING,
  WEIGHTS_FIND_OPEN_TEAMMATE,
  WEIGHTS_3PT,
  WEIGHTS_MIDRANGE,
  WEIGHTS_DUNK,
  WEIGHTS_LAYUP,
  SIGMOID_K,
  ASSIST_CONCENTRATION_EXPONENT,
} from '../constants';
import * as shooting from '../systems/shooting';
import * as defense from '../systems/defense';
import * as turnovers from '../systems/turnovers';
import * as rebounding from '../systems/rebounding';
import * as freeThrows from '../systems/freeThrows';
import * as endGameModes from '../systems/endGameModes';
import type { FoulSystem } from '../systems/fouls';

// =============================================================================
// SHOT ATTEMPT WRAPPER
// =============================================================================

/**
 * Wrapper for attemptShot that handles the full context needed at possession level.
 *
 * The core attemptShot function (shooting.ts) accepts 6 parameters and returns [made, debugInfo].
 * At the possession orchestration level, we need additional context (fouls, tactical settings)
 * and a unified return format with pointsScored calculated.
 *
 * This wrapper:
 * 1. Calls the validated core attemptShot with the 6 parameters it needs
 * 2. Calculates pointsScored from made/miss and shotType
 * 3. Returns unified result object for possession logic
 */
function attemptShotWithContext(
  shooter: Record<string, number>,
  shooterDefender: Record<string, number>,
  shotType: string,
  contestDistance: number,
  defenseType: string,
  possessionContext: PossessionContext,
  tacticalSettingsOffense: any,
  tacticalSettingsDefense: any,
  foulSystem: FoulSystem,
  quarter: number,
  gameTime: string,
  defendingTeamName: string
): {
  made: boolean;
  pointsScored: number;
  shotDetail: string;
  foulEvent: any | null;
  [key: string]: any;
} {
  // Call the validated core attemptShot function (6 parameters)
  const [made, debugInfo] = shooting.attemptShot(
    shooter,
    shooterDefender,
    shotType,
    contestDistance,
    possessionContext,
    defenseType
  );

  // Calculate points scored based on shot type and result
  let pointsScored = made ? (shotType === '3pt' ? 3 : 2) : 0;

  // Check for shooting foul
  let foulEvent = null;
  if (foulSystem) {
    foulEvent = foulSystem.checkShootingFoul(
      shooter,
      shooterDefender,
      contestDistance,
      shotType,
      made,
      defendingTeamName,
      quarter,
      gameTime
    );

    // If foul on made shot, it's an and-1 (already scored + 1 FT)
    // If foul on missed shot, award FTs but no points yet (FTs handled separately)
    if (foulEvent) {
      // Mark as and-1 if shot was made
      if (made) {
        foulEvent.and_one = true;
      }
    }
  }

  // Return unified result with pointsScored calculated
  return {
    made,
    pointsScored,
    shotDetail: debugInfo.shotDetail || shotType,
    foulEvent,
    contestDistance,
    defenseType,
    ...debugInfo  // Spread all debug info for compatibility
  };
}

// =============================================================================
// TYPES
// =============================================================================

export interface PossessionContext {
  isTransition: boolean;
  shotClock: number;
  scoreDifferential: number;
  gameTimeRemaining: number;
  quarter: number;
  offensiveTeam: 'home' | 'away';
}

export interface PossessionResult {
  playByPlayText: string;
  possessionOutcome: 'made_shot' | 'missed_shot' | 'offensive_rebound' | 'turnover' | 'foul';
  pointsScored: number;
  scoringPlayer: string | null;
  assistPlayer: string | null;
  reboundPlayer: string | null;
  foulEvent: any | null;
  freeThrowResult: any | null;
  offensiveTeam: 'home' | 'away';
  isAndOne?: boolean;
  elapsedTimeSeconds?: number;
  debug: Record<string, any>;
}

export interface DriveOutcome {
  outcome: 'dunk' | 'layup' | 'kickout' | 'turnover';
  finalDefender: Player | null;
  debug: Record<string, any>;
}

export interface AssistCheck {
  assistOccurred: boolean;
  assisterName: string | null;
  debug: Record<string, any>;
}

// =============================================================================
// USAGE DISTRIBUTION & SHOOTER SELECTION
// =============================================================================

/**
 * Calculate shot creation ability - capacity to GET shots, not just MAKE them.
 *
 * Traditional centers (Hassan) can FINISH at elite levels but can't CREATE shots.
 * Guards/wings with handles can create offense.
 *
 * Components:
 * 1. Ball Handling (40%): Deception 40%, Hand-eye 30%, Agility 30%
 * 2. Playmaking (40%): Awareness 30%, Creativity 30%, Patience 20%, Composure 20%
 * 3. Scoring Ability (20%): Best of 3PT/Mid/Rim composites
 */
export function calculateShotCreationAbility(player: Player): number {
  // Component 1: Ball Handling
  const ballHandling = (
    player.deception * 0.40 +
    player.hand_eye_coordination * 0.30 +
    player.agility * 0.30
  );

  // Component 2: Playmaking
  const playmaking = (
    player.awareness * 0.30 +
    player.creativity * 0.30 +
    player.patience * 0.20 +
    player.composure * 0.20
  );

  // Component 3: Best scoring composite
  const composite3pt = calculateComposite(player, WEIGHTS_3PT);
  const compositeMid = calculateComposite(player, WEIGHTS_MIDRANGE);
  const compositeDunk = calculateComposite(player, WEIGHTS_DUNK);
  const compositeLayup = calculateComposite(player, WEIGHTS_LAYUP);
  const compositeRim = (compositeDunk + compositeLayup) / 2.0;
  const bestScoring = Math.max(composite3pt, compositeMid, compositeRim);

  // Final: 40% ball handling + 40% playmaking + 20% scoring
  const shotCreation = ballHandling * 0.40 + playmaking * 0.40 + bestScoring * 0.20;

  return shotCreation;
}

/**
 * Build usage distribution for shooter selection.
 *
 * Assigns 30%/20%/15% to scoring options, remaining % weighted by shot creation ability.
 * Non-creators (Hassan ~45) get lower usage, shot creators (Chris ~80) get higher usage.
 */
export function buildUsageDistribution(
  team: Player[],
  tacticalSettings: TacticalSettings
): Record<string, number> {
  const usage: Record<string, number> = {};
  team.forEach(p => usage[p.name] = 0.0);

  const optionsAssigned = new Set<string>();
  let allocatedUsage = 0.0;

  // Extract scoring options from array (TacticalSettings uses scoringOptions array)
  const scoringOption1 = tacticalSettings.scoringOptions?.[0];
  const scoringOption2 = tacticalSettings.scoringOptions?.[1];
  const scoringOption3 = tacticalSettings.scoringOptions?.[2];

  // Option 1: 30%
  if (scoringOption1 && usage[scoringOption1] !== undefined) {
    usage[scoringOption1] = USAGE_SCORING_OPTION_1;
    optionsAssigned.add(scoringOption1);
    allocatedUsage += USAGE_SCORING_OPTION_1;
  }

  // Option 2: 20%
  if (scoringOption2 && usage[scoringOption2] !== undefined) {
    if (!optionsAssigned.has(scoringOption2)) {
      usage[scoringOption2] = USAGE_SCORING_OPTION_2;
      optionsAssigned.add(scoringOption2);
      allocatedUsage += USAGE_SCORING_OPTION_2;
    }
  }

  // Option 3: 15%
  if (scoringOption3 && usage[scoringOption3] !== undefined) {
    if (!optionsAssigned.has(scoringOption3)) {
      usage[scoringOption3] = USAGE_SCORING_OPTION_3;
      optionsAssigned.add(scoringOption3);
      allocatedUsage += USAGE_SCORING_OPTION_3;
    }
  }

  // Weight remaining by shot creation ability
  const others = team.filter(p => !optionsAssigned.has(p.name));

  if (others.length > 0) {
    const creationWeights: Record<string, number> = {};
    let totalWeighted = 0.0;

    others.forEach(player => {
      const creation = calculateShotCreationAbility(player);
      // Exponential penalty (^1.5) to concentrate usage
      const weight = Math.pow(creation / 100.0, 1.5);
      creationWeights[player.name] = weight;
      totalWeighted += weight;
    });

    const remainingUsage = 1.0 - allocatedUsage;

    if (totalWeighted > 0) {
      others.forEach(player => {
        const weightRatio = creationWeights[player.name] / totalWeighted;
        usage[player.name] = remainingUsage * weightRatio;
      });
    } else {
      // Fallback: equal split
      const othersShare = remainingUsage / others.length;
      others.forEach(player => usage[player.name] = othersShare);
    }
  }

  return usage;
}

/**
 * Select shooter using weighted usage distribution.
 */
export function selectShooter(
  team: Player[],
  usageDistribution: Record<string, number>
): Player {
  const playerNames = team.map(p => p.name);
  const weights = playerNames.map(name => usageDistribution[name]);
  const selectedName = weightedRandomChoice(playerNames, weights);

  return team.find(p => p.name === selectedName) || team[0];
}

/**
 * Select ball handler using weighted combination of usage and ball handling ability.
 * Better ball handlers get possession more often.
 * 60% usage + 40% ball handling composite.
 */
export function selectBallHandler(
  team: Player[],
  usageDistribution: Record<string, number>
): Player {
  const ballHandlingWeights: number[] = [];

  team.forEach(player => {
    const usageWeight = usageDistribution[player.name] || 0.2;
    const ballHandlingComposite = calculateComposite(player, WEIGHTS_BALL_HANDLING);
    const ballHandlingNormalized = ballHandlingComposite / 100.0;
    const combinedWeight = usageWeight * 0.60 + ballHandlingNormalized * 0.40;
    ballHandlingWeights.push(combinedWeight);
  });

  const playerNames = team.map(p => p.name);
  const selectedName = weightedRandomChoice(playerNames, ballHandlingWeights);

  return team.find(p => p.name === selectedName) || team[0];
}

// =============================================================================
// DRIVE-TO-RIM LOGIC
// =============================================================================

/**
 * Determine if rim attempt is a drive vs post-up.
 * Drive probability based on speed/agility.
 * Base: 70% drive, 30% post-up.
 * Transition: 95% drive.
 */
export function shouldAttemptDrive(
  player: Player,
  context: PossessionContext
): boolean {
  const driveComposite = (
    player.top_speed * 0.4 +
    player.agility * 0.3 +
    player.acceleration * 0.3
  );

  let driveProb = 0.70;
  const driveAdjustment = (driveComposite - 50) * 0.003; // ±0.15 for ±50
  driveProb += driveAdjustment;

  if (context.isTransition) {
    driveProb = 0.95;
  }

  driveProb = Math.max(0.0, Math.min(1.0, driveProb));
  return rollSuccess(driveProb);
}

/**
 * Simulate four-way drive outcome: dunk/layup/kickout/turnover.
 * Uses separate composites for each outcome, normalizes to probabilities.
 * Also determines if help defender "takes over" primary contest.
 */
export function simulateDriveOutcome(
  driver: Player,
  defender: Player,
  helpDefenders: Player[]
): DriveOutcome {
  // Calculate average defender composite
  const defenderComposite = calculateComposite(defender, WEIGHTS_DRIVE_DUNK);
  let avgDefender = defenderComposite;

  if (helpDefenders.length > 0) {
    const helpComposites = helpDefenders.map(h => calculateComposite(h, WEIGHTS_DRIVE_DUNK));
    const sumHelp = helpComposites.reduce((a, b) => a + b, 0);
    avgDefender = (defenderComposite + sumHelp) / (1 + helpDefenders.length);
  }

  // Four outcome composites
  const dunkComposite = calculateComposite(driver, WEIGHTS_DRIVE_DUNK);
  const layupComposite = calculateComposite(driver, WEIGHTS_DRIVE_LAYUP);
  const kickoutComposite = calculateComposite(driver, WEIGHTS_DRIVE_KICKOUT);
  const turnoverComposite = calculateComposite(driver, WEIGHTS_DRIVE_TURNOVER);

  // Sigmoid scores
  const dunkDiff = dunkComposite - avgDefender;
  const layupDiff = layupComposite - avgDefender;
  const kickoutDiff = kickoutComposite - avgDefender;
  const turnoverDiff = turnoverComposite - avgDefender;

  let dunkScore = sigmoid(SIGMOID_K * dunkDiff);
  let layupScore = sigmoid(SIGMOID_K * layupDiff);
  let kickoutScore = sigmoid(SIGMOID_K * kickoutDiff);
  let turnoverScore = sigmoid(SIGMOID_K * turnoverDiff);

  // INVERT turnover (lower composite = higher turnover chance)
  turnoverScore = (1.0 - turnoverScore) * 0.80;

  // Normalize to probabilities
  const totalScore = dunkScore + layupScore + kickoutScore + turnoverScore;
  let probabilities: number[];

  if (totalScore <= 0) {
    probabilities = [0.25, 0.25, 0.25, 0.25];
  } else {
    probabilities = [
      dunkScore / totalScore,
      layupScore / totalScore,
      kickoutScore / totalScore,
      turnoverScore / totalScore
    ];
  }

  const debug = {
    driverName: driver.name,
    defenderName: defender.name,
    numHelpDefenders: helpDefenders.length,
    avgDefenderComposite: avgDefender,
    dunkComposite,
    layupComposite,
    kickoutComposite,
    turnoverComposite,
    dunkProbability: probabilities[0],
    layupProbability: probabilities[1],
    kickoutProbability: probabilities[2],
    turnoverProbability: probabilities[3],
  };

  // Weighted selection
  const outcomes = ['dunk', 'layup', 'kickout', 'turnover'] as const;
  const outcome = weightedRandomChoice(outcomes, probabilities) as typeof outcomes[number];
  debug['selectedOutcome'] = outcome;

  // Determine final defender for shot attempts
  let finalDefender: Player | null = null;

  if (outcome === 'dunk' || outcome === 'layup') {
    if (helpDefenders.length > 0) {
      // Find best help defender (rim protection)
      const bestHelp = helpDefenders.reduce((best, curr) => {
        const currRim = (curr.jumping + curr.height + curr.reactions) / 3;
        const bestRim = (best.jumping + best.height + best.reactions) / 3;
        return currRim > bestRim ? curr : best;
      });

      const primaryRim = (defender.jumping + defender.height + defender.reactions) / 3;
      const helpRim = (bestHelp.jumping + bestHelp.height + bestHelp.reactions) / 3;

      let takeoverProb = 0.35;
      if (helpRim > primaryRim + 15) {
        takeoverProb = 0.60;
      } else if (primaryRim < 40) {
        takeoverProb = 0.50;
      }

      if (Math.random() < takeoverProb) {
        finalDefender = bestHelp;
        debug['helpTakeover'] = true;
        debug['finalDefender'] = bestHelp.name;
      } else {
        finalDefender = defender;
        debug['helpTakeover'] = false;
        debug['finalDefender'] = defender.name;
      }
    } else {
      finalDefender = defender;
      debug['helpTakeover'] = false;
      debug['finalDefender'] = defender.name;
    }
  }

  return { outcome, finalDefender, debug };
}

// =============================================================================
// ASSIST ATTRIBUTION
// =============================================================================

/**
 * Determine if assist is credited on made shot.
 *
 * Base probability by shot type:
 * - 3PT: 90%
 * - Midrange: 50%
 * - Rim: 65%
 *
 * Passer selected weighted by passing composite.
 * Assist probability adjusted ±15% based on passer quality.
 */
export function checkAssist(
  shotType: string,
  shooter: Player,
  teammates: Player[]
): AssistCheck {
  const assistProbs: Record<string, number> = {
    '3pt': 0.90,
    'midrange': 0.50,
    'rim': 0.65,
    'dunk': 0.65,
    'layup': 0.65,
    'midrange_short': 0.50,
    'midrange_long': 0.50,
  };

  const baseAssistProb = assistProbs[shotType] || 0.65;
  const debug: any = {
    shotType,
    shooterName: shooter.name,
    baseAssistProbability: baseAssistProb,
  };

  if (teammates.length === 0) {
    debug.assisterName = null;
    debug.assistOccurred = false;
    return { assistOccurred: false, assisterName: null, debug };
  }

  // Select passer weighted by passing composite
  const passingWeights = teammates.map(player => {
    const passingComposite = calculateComposite(player, WEIGHTS_FIND_OPEN_TEAMMATE);
    return passingComposite;
  });

  // Apply concentration exponent
  const concentratedWeights = passingWeights.map(w => Math.pow(w, ASSIST_CONCENTRATION_EXPONENT));
  const passer = weightedRandomChoice(teammates, concentratedWeights);

  // Calculate passer composite
  const passerComposite = calculateComposite(passer, WEIGHTS_FIND_OPEN_TEAMMATE);

  // Adjust assist probability
  const passerModifier = (passerComposite - 50) * 0.003; // ±15% for ±50
  let finalAssistProb = baseAssistProb + passerModifier;
  finalAssistProb = Math.max(0.0, Math.min(1.0, finalAssistProb));

  const rollValue = Math.random();
  const assistOccurred = rollValue < finalAssistProb;

  debug.passerName = passer.name;
  debug.passerComposite = passerComposite;
  debug.passerModifier = passerModifier;
  debug.finalAssistProbability = finalAssistProb;
  debug.rollValue = rollValue;
  debug.assistOccurred = assistOccurred;

  if (assistOccurred) {
    debug.assisterName = passer.name;
    return { assistOccurred: true, assisterName: passer.name, debug };
  } else {
    debug.assisterName = null;
    return { assistOccurred: false, assisterName: null, debug };
  }
}

// =============================================================================
// MAIN POSSESSION SIMULATION
// =============================================================================

/**
 * Simulate one complete possession.
 *
 * Main orchestrator that ties all systems together.
 *
 * Flow:
 * 1. Build usage distribution
 * 2. Select ball handler
 * 3. Check for end-game intentional fouling
 * 4. Check for holding/hand-checking fouls
 * 5. Check turnover
 * 6. Select shooter
 * 7. Assign defender
 * 8. Select shot type and attempt
 * 9. Handle rebound flow
 * 10. Check assist
 * 11. Generate play-by-play
 * 12. Return PossessionResult
 */
export function simulatePossession(
  offensiveTeam: Player[],
  defensiveTeam: Player[],
  tacticalSettingsOffense: TacticalSettings,
  tacticalSettingsDefense: TacticalSettings,
  possessionContext: PossessionContext,
  foulSystem: FoulSystem | null = null,
  quarter: number = 1,
  gameTime: string = "12:00",
  defendingTeamName: string = "Away",
  offensiveTeamName: string = "Home",
  originalOffensiveTeam: Player[] | null = null,
  originalDefensiveTeam: Player[] | null = null
): PossessionResult {
  const offensiveTeamNormalized = offensiveTeamName.toLowerCase() as 'home' | 'away';

  // Helper to get original player for FT shooting
  const getOriginalPlayer = (degradedPlayer: Player, isOffensive: boolean): Player => {
    if (isOffensive && originalOffensiveTeam) {
      const original = originalOffensiveTeam.find(p => p.name === degradedPlayer.name);
      if (original) return original;
    } else if (!isOffensive && originalDefensiveTeam) {
      const original = originalDefensiveTeam.find(p => p.name === degradedPlayer.name);
      if (original) return original;
    }
    return degradedPlayer;
  };

  const events: any[] = [];
  const debug: any = {
    possessionContext: {
      isTransition: possessionContext.isTransition,
      shotClock: possessionContext.shotClock,
    }
  };

  // Build usage distribution
  const usageDistribution = buildUsageDistribution(offensiveTeam, tacticalSettingsOffense);
  debug.usageDistribution = usageDistribution;

  // Select ball handler
  const ballHandler = selectBallHandler(offensiveTeam, usageDistribution);
  debug.ballHandler = ballHandler.name;

  // Detect end-game mode
  const endgameMods = endGameModes.detectEndGameMode(
    possessionContext.gameTimeRemaining,
    possessionContext.scoreDifferential,
    possessionContext.quarter,
    true,
    offensiveTeam,
    defensiveTeam
  );
  debug.endgameModes = endgameMods.activeModes;

  // Check intentional fouling (end-game scenario)
  if (endGameModes.shouldIntentionalFoul(
    possessionContext.gameTimeRemaining,
    possessionContext.scoreDifferential,
    possessionContext.quarter,
    possessionContext.scoreDifferential > 0
  )) {
    // Handle intentional foul (simplified for now - full implementation would match Python)
    // This is a critical end-game scenario

    const foulTarget = endGameModes.selectIntentionalFoulTarget(offensiveTeam);
    const fouler = endGameModes.selectFouler(defensiveTeam, foulSystem);

    if (foulSystem) {
      const foulEvent = foulSystem.triggerIntentionalFoul(
        fouler,
        foulTarget,
        defendingTeamName,
        quarter,
        gameTime
      );

      events.push({
        type: 'intentional_foul',
        foulingPlayer: foulEvent.fouling_player,
        fouledPlayer: foulEvent.fouled_player,
        foulType: 'intentional',
        freeThrows: foulEvent.free_throws_awarded,
        andOne: false,
        fouledOut: foulEvent.fouled_out,
      });

      // If FTs awarded, simulate them
      if (foulEvent.free_throws_awarded > 0) {
        const ftShooter = offensiveTeam.find(p => p.name === foulTarget);

        if (!ftShooter) {
          throw new Error(`Cannot find foul target ${foulTarget} in offensive team`);
        }

        const ftResult = freeThrows.simulateFreeThrowSequence(
          ftShooter as unknown as import('../core/types').SimulationPlayer,
          foulEvent.free_throws_awarded,
          false,
          quarter,
          possessionContext.gameTimeRemaining,
          possessionContext.scoreDifferential
        );

        events.push({
          type: 'free_throws',
          shooter: ftResult.shooter,
          made: ftResult.made,
          attempts: ftResult.attempts,
          results: ftResult.results
        });

        debug.freeThrowsMade = ftResult.made;
        debug.freeThrowsAttempted = foulEvent.free_throws_awarded;

        // Check if last FT was missed and simulate rebound
        const lastFTMissed = ftResult.results && ftResult.results.length > 0
          ? !ftResult.results[ftResult.results.length - 1]
          : ftResult.made < ftResult.attempts;

        if (lastFTMissed) {
          const reboundResult = rebounding.simulateRebound(
            offensiveTeam,
            defensiveTeam,
            tacticalSettingsOffense.reboundingStrategy,
            tacticalSettingsDefense.reboundingStrategy,
            'rim',
            false,
            foulSystem,
            quarter,
            gameTime,
            defendingTeamName
          );

          if (reboundResult.rebounder_name) {
            events.push({
              type: 'rebound',
              rebounder: reboundResult.rebounder_name,
              isOffensive: reboundResult.offensive_rebound,
            });
          }
        }

        return {
          playByPlayText: generatePlayByPlay(events, 'intentional_foul'),
          possessionOutcome: 'made_shot',
          pointsScored: ftResult.made,
          scoringPlayer: ftResult.made > 0 ? foulTarget : null,
          assistPlayer: null,
          reboundPlayer: null,
          foulEvent,
          freeThrowResult: ftResult,
          offensiveTeam: offensiveTeamNormalized,
          elapsedTimeSeconds: Math.random() * 2 + 1, // 1-3 seconds
          debug
        };
      }
    }
  }

  // Assign defender
  const zonePct = 100 - tacticalSettingsDefense.man_defense_pct;
  const defenseType = Math.random() < (zonePct / 100.0) ? 'zone' : 'man';
  debug.defenseType = defenseType;

  const ballHandlerDefender = defense.getPrimaryDefender(
    ballHandler,
    defensiveTeam,
    {},
    defenseType
  );

  // Check turnover
  const turnoverDebug = turnovers.checkTurnover(
    ballHandler,
    ballHandlerDefender,
    tacticalSettingsOffense,
    possessionContext,
    defenseType
  );

  const turnoverOccurred = turnoverDebug.turnover_occurred;
  debug.turnoverCheck = turnoverDebug;

  if (turnoverOccurred) {
    const turnoverType = turnoverDebug.turnover_type;
    events.push({
      type: 'turnover',
      ballHandler: ballHandler.name,
      turnoverType,
      stealCreditedTo: turnoverDebug.steal_credited_to,
      defender: ballHandlerDefender.name,
    });

    if (turnoverDebug.steal_credited_to) {
      debug.stealPlayer = turnoverDebug.steal_credited_to;
    }
    debug.turnoverType = turnoverType;

    return {
      playByPlayText: generatePlayByPlay(events, 'turnover'),
      possessionOutcome: 'turnover',
      pointsScored: 0,
      scoringPlayer: null,
      assistPlayer: null,
      reboundPlayer: null,
      foulEvent: null,
      freeThrowResult: null,
      offensiveTeam: offensiveTeamNormalized,
      debug
    };
  }

  // Select shooter (may be same as ball handler)
  const shooter = selectShooter(offensiveTeam, usageDistribution);
  debug.shooter = shooter.name;

  // Assign defender to shooter
  const shooterDefender = defense.getPrimaryDefender(
    shooter,
    defensiveTeam,
    {},
    defenseType
  );

  // Select shot type
  const shotType = shooting.selectShotType(
    shooter,
    tacticalSettingsOffense,
    possessionContext,
    defenseType
  );
  debug.shotType = shotType;  // Store at flat path for easy access
  debug.shotTypeSelection = { shotType: shotType };  // Keep nested path for compatibility

  // Calculate contest distance
  const contestResult = defense.calculateContestDistance(
    shooterDefender,
    shooter,
    shotType,
    defenseType,
    tacticalSettingsDefense.man_defense_pct
  );
  debug.contest = contestResult;

  // Attempt shot (using wrapper to handle context and calculate pointsScored)
  const shotAttemptResult = attemptShotWithContext(
    shooter,
    shooterDefender,
    shotType,
    contestResult.distance,
    defenseType,
    possessionContext,
    tacticalSettingsOffense,
    tacticalSettingsDefense,
    foulSystem,
    quarter,
    gameTime,
    defendingTeamName
  );

  debug.shotAttempt = shotAttemptResult;

  // Record shot attempt event
  events.push({
    type: 'shot_attempt',
    shooter: shooter.name,
    shotType,
    shotDetail: shotAttemptResult.shotDetail,
    defender: shooterDefender.name,
    contestDistance: contestResult.distance,
    defenseType,
    made: shotAttemptResult.made,
  });

  // Handle shooting foul if it occurred
  if (shotAttemptResult.foulEvent) {
    events.push({
      type: 'foul',
      foulType: 'shooting',
      fouledPlayer: shooter.name,
      foulingPlayer: shooterDefender.name,
      foulingTeam: defendingTeamName,
      teamFouls: shotAttemptResult.foulEvent.team_fouls_after,
      personalFouls: shotAttemptResult.foulEvent.personal_fouls_after,
      andOne: shotAttemptResult.foulEvent.and_one || false,
      freeThrows: shotAttemptResult.foulEvent.free_throws_awarded || 0,
    });
  }

  if (shotAttemptResult.made) {
    // Made shot
    events[events.length - 1].made = true;

    // Check assist
    const teammates = offensiveTeam.filter(p => p.name !== shooter.name);
    const assistResult = checkAssist(shotType, shooter, teammates);

    if (assistResult.assistOccurred && assistResult.assisterName) {
      events[events.length - 1].assistBy = assistResult.assisterName;
      debug.assist = assistResult.debug;
    }

    // Handle free throws if and-1 situation
    let freeThrowResult = null;
    let ftReboundResult = null;
    if (shotAttemptResult.foulEvent && shotAttemptResult.foulEvent.and_one) {
      freeThrowResult = freeThrows.simulateFreeThrowSequence(
        shooter as unknown as import('../core/types').SimulationPlayer,
        1,
        shotType
      );

      if (freeThrowResult) {
        events.push({
          type: 'free_throw',
          shooter: shooter.name,
          made: freeThrowResult.made,
          attempts: freeThrowResult.attempts,
          results: freeThrowResult.results,
        });

        // If the free throw was missed, simulate rebound
        if (freeThrowResult.made === 0) {
          ftReboundResult = rebounding.simulateRebound(
            offensiveTeam,
            defensiveTeam,
            tacticalSettingsOffense.reboundingStrategy,
            tacticalSettingsDefense.reboundingStrategy,
            shotType,
            false,
            foulSystem,
            quarter,
            gameTime,
            defendingTeamName
          );

          if (ftReboundResult.rebounder_name) {
            events.push({
              type: 'rebound',
              rebounder: ftReboundResult.rebounder_name,
              isOffensive: ftReboundResult.offensive_rebound,
            });
            debug.rebound = ftReboundResult;
          }
        }
      }
    }

    const totalPoints = shotAttemptResult.pointsScored + (freeThrowResult?.points_scored || 0);

    return {
      playByPlayText: generatePlayByPlay(events, 'made_shot'),
      possessionOutcome: 'made_shot',
      pointsScored: totalPoints,
      scoringPlayer: shooter.name,
      assistPlayer: assistResult.assisterName,
      reboundPlayer: ftReboundResult?.rebounder_name || null,
      foulEvent: shotAttemptResult.foulEvent,
      freeThrowResult,
      offensiveTeam: offensiveTeamNormalized,
      isAndOne: shotAttemptResult.foulEvent?.and_one || false,
      debug
    };
  } else {
    // Missed shot - check if there was a shooting foul (free throws without rebound)
    if (shotAttemptResult.foulEvent) {
      const numFreeThrows = shotAttemptResult.foulEvent.free_throws_awarded || (shotType === '3pt' ? 3 : 2);

      const freeThrowResult = freeThrows.simulateFreeThrowSequence(
        shooter as unknown as import('../core/types').SimulationPlayer,
        numFreeThrows,
        shotType
      );

      let ftReboundResult = null;
      if (freeThrowResult) {
        events.push({
          type: 'free_throw',
          shooter: shooter.name,
          made: freeThrowResult.points_scored,
          attempts: numFreeThrows,
          results: freeThrowResult.results,
        });

        // If the last free throw was missed, simulate rebound
        const lastFTMissed = freeThrowResult.results && freeThrowResult.results.length > 0
          ? !freeThrowResult.results[freeThrowResult.results.length - 1]
          : freeThrowResult.made < freeThrowResult.attempts;

        if (lastFTMissed) {
          ftReboundResult = rebounding.simulateRebound(
            offensiveTeam,
            defensiveTeam,
            tacticalSettingsOffense.reboundingStrategy,
            tacticalSettingsDefense.reboundingStrategy,
            shotType,
            false,
            foulSystem,
            quarter,
            gameTime,
            defendingTeamName
          );

          if (ftReboundResult.rebounder_name) {
            events.push({
              type: 'rebound',
              rebounder: ftReboundResult.rebounder_name,
              isOffensive: ftReboundResult.offensive_rebound,
            });
            debug.rebound = ftReboundResult;
          }
        }
      }

      return {
        playByPlayText: generatePlayByPlay(events, 'foul'),
        possessionOutcome: 'foul',
        pointsScored: freeThrowResult?.points_scored || 0,
        scoringPlayer: freeThrowResult && freeThrowResult.points_scored > 0 ? shooter.name : null,
        assistPlayer: null,
        reboundPlayer: ftReboundResult?.rebounder_name || null,
        foulEvent: shotAttemptResult.foulEvent,
        freeThrowResult,
        offensiveTeam: offensiveTeamNormalized,
        debug
      };
    }

    // Missed shot - simulate rebound
    const reboundResult = rebounding.simulateRebound(
      offensiveTeam,
      defensiveTeam,
      tacticalSettingsOffense.reboundingStrategy,
      tacticalSettingsDefense.reboundingStrategy,
      shotType,
      false,
      foulSystem,
      quarter,
      gameTime,
      defendingTeamName
    );

    debug.rebound = reboundResult;

    events.push({
      type: 'rebound',
      rebounder: reboundResult.rebounder_name,
      isOffensive: reboundResult.offensive_rebound,
    });

    // Handle foul after rebound if it occurred
    if (reboundResult.foul_occurred && reboundResult.loose_ball_foul) {
      const foul = reboundResult.loose_ball_foul;
      events.push({
        type: 'foul',
        foulType: 'non-shooting',  // After a rebound is secured, it's no longer a loose ball
        fouledPlayer: foul.fouled_player || reboundResult.rebounder_name,
        foulingPlayer: foul.fouling_player,
        foulingTeam: foul.fouling_team,
        teamFouls: foul.team_fouls_after,
        personalFouls: foul.personal_fouls_after,
        freeThrows: foul.free_throws_awarded || 0,
        andOne: false,
      });

      // If foul results in free throws
      if (foul.free_throws_awarded && foul.free_throws_awarded > 0) {
        const fouledPlayer = offensiveTeam.find(p => p.name === (foul.fouled_player || reboundResult.rebounder_name));
        if (fouledPlayer) {
          const ftResult = freeThrows.simulateFreeThrowSequence(fouledPlayer, foul.free_throws_awarded, shotType);
          if (ftResult) {
            events.push({
              type: 'free_throw',
              shooter: fouledPlayer.name,
              made: ftResult.points_scored,
              attempts: foul.free_throws_awarded,
            });

            // Check if last FT was missed and simulate rebound
            const lastFTMissed = ftResult.results && ftResult.results.length > 0
              ? !ftResult.results[ftResult.results.length - 1]
              : ftResult.made < ftResult.attempts;

            if (lastFTMissed) {
              const ftReboundResult = rebounding.simulateRebound(
                offensiveTeam,
                defensiveTeam,
                tacticalSettingsOffense.reboundingStrategy,
                tacticalSettingsDefense.reboundingStrategy,
                'rim',
                false,
                foulSystem,
                quarter,
                gameTime,
                defendingTeamName
              );

              if (ftReboundResult.rebounder_name) {
                events.push({
                  type: 'rebound',
                  rebounder: ftReboundResult.rebounder_name,
                  isOffensive: ftReboundResult.offensive_rebound,
                });
              }
            }

            return {
              playByPlayText: generatePlayByPlay(events, 'foul'),
              possessionOutcome: 'foul',
              pointsScored: ftResult.points_scored,
              scoringPlayer: ftResult.points_scored > 0 ? fouledPlayer.name : null,
              assistPlayer: null,
              reboundPlayer: reboundResult.rebounder_name,
              foulEvent: foul,
              freeThrowResult: ftResult,
              offensiveTeam: offensiveTeamNormalized,
              debug
            };
          }
        }
      }

      // No free throws, side out
      return {
        playByPlayText: generatePlayByPlay(events, 'foul'),
        possessionOutcome: 'foul',
        pointsScored: 0,
        scoringPlayer: null,
        assistPlayer: null,
        reboundPlayer: reboundResult.rebounder_name,
        foulEvent: foul,
        freeThrowResult: null,
        offensiveTeam: offensiveTeamNormalized,
        debug
      };
    }

    if (reboundResult.offensive_rebound) {
      // Offensive rebound
      if (reboundResult.putback_attempted) {
        events[events.length - 1].putbackAttempted = true;
        events[events.length - 1].putbackMade = reboundResult.putback_made;

        if (reboundResult.putback_made) {
          return {
            playByPlayText: generatePlayByPlay(events, 'made_shot'),
            possessionOutcome: 'made_shot',
            pointsScored: 2,
            scoringPlayer: reboundResult.rebounder_name,
            assistPlayer: null,
            reboundPlayer: reboundResult.rebounder_name,
            foulEvent: null,
            freeThrowResult: null,
            offensiveTeam: offensiveTeamNormalized,
            debug: {
              ...debug,
              shotType: 'rim'  // Putbacks are always at the rim, not the original shot type
            }
          };
        } else {
          // Missed putback - simulate rebound after the missed putback attempt
          const putbackReboundResult = rebounding.simulateRebound(
            offensiveTeam,
            defensiveTeam,
            tacticalSettingsOffense.reboundingStrategy,
            tacticalSettingsDefense.reboundingStrategy,
            'rim',  // Putbacks are always at the rim
            false,
            foulSystem,
            quarter,
            gameTime,
            defendingTeamName
          );

          // Add rebound event
          events.push({
            type: 'rebound',
            rebounder: putbackReboundResult.rebounder_name,
            isOffensive: putbackReboundResult.offensive_rebound,
          });

          return {
            playByPlayText: generatePlayByPlay(events, 'missed_shot'),
            possessionOutcome: putbackReboundResult.offensive_rebound ? 'offensive_rebound' : 'missed_shot',
            pointsScored: 0,
            scoringPlayer: null,
            assistPlayer: null,
            reboundPlayer: putbackReboundResult.rebounder_name,
            foulEvent: null,
            freeThrowResult: null,
            offensiveTeam: offensiveTeamNormalized,
            debug
          };
        }
      } else {
        return {
          playByPlayText: generatePlayByPlay(events, 'offensive_rebound'),
          possessionOutcome: 'offensive_rebound',
          pointsScored: 0,
          scoringPlayer: null,
          assistPlayer: null,
          reboundPlayer: reboundResult.rebounder_name,
          foulEvent: null,
          freeThrowResult: null,
          offensiveTeam: offensiveTeamNormalized,
          debug
        };
      }
    } else {
      // Defensive rebound
      return {
        playByPlayText: generatePlayByPlay(events, 'missed_shot'),
        possessionOutcome: 'missed_shot',
        pointsScored: 0,
        scoringPlayer: null,
        assistPlayer: null,
        reboundPlayer: reboundResult.rebounder_name,
        foulEvent: null,
        freeThrowResult: null,
        offensiveTeam: offensiveTeamNormalized,
        debug
      };
    }
  }
}

// =============================================================================
// PLAY-BY-PLAY GENERATION
// =============================================================================

/**
 * Generate human-readable play-by-play narrative.
 */
function generatePlayByPlay(
  possessionEvents: any[],
  finalOutcome: string
): string {
  const lines: string[] = [];

  for (const event of possessionEvents) {
    const eventType = event.type;

    if (eventType === 'turnover') {
      const turnoverDesc = turnovers.getTurnoverDescription(
        event.turnoverType,
        event.ballHandler,
        event.stealCreditedTo,
        event.defender,
        event.offensiveFoulEvent
      );
      lines.push(turnoverDesc);
    } else if (eventType === 'shot_attempt') {
      const shooter = event.shooter;
      const shotDetail = event.shotDetail || event.shotType;

      // Generate ESPN-style shot description with distance
      const getShotDescription = (detail: string, isBlocked: boolean = false): { action: string; distance: number } => {
        // Estimate distance based on shot type (with small random variance)
        let distance: number;
        let action: string;

        switch (detail) {
          case '3pt':
            distance = Math.floor(22 + Math.random() * 6); // 22-27 feet
            const threeTypes = ['three point jumper', 'three point shot', 'three pointer'];
            action = threeTypes[Math.floor(Math.random() * threeTypes.length)] || 'three pointer';
            break;
          case 'midrange_long':
          case 'midrange':
            distance = Math.floor(15 + Math.random() * 5); // 15-19 feet
            const longMidTypes = ['pull-up jumper', 'fadeaway jumper', 'jump shot'];
            action = longMidTypes[Math.floor(Math.random() * longMidTypes.length)] || 'jump shot';
            break;
          case 'midrange_short':
            distance = Math.floor(8 + Math.random() * 6); // 8-13 feet
            const shortMidTypes = ['floater', 'runner', 'short jumper', 'turnaround jumper'];
            action = shortMidTypes[Math.floor(Math.random() * shortMidTypes.length)] || 'floater';
            break;
          case 'layup':
            distance = Math.floor(2 + Math.random() * 4); // 2-5 feet
            const layupTypes = ['driving layup', 'layup', 'finger roll', 'reverse layup'];
            action = layupTypes[Math.floor(Math.random() * layupTypes.length)] || 'layup';
            break;
          case 'dunk':
            distance = 0; // At the rim
            const dunkTypes = ['dunk', 'slam dunk', 'one-handed dunk', 'two-handed dunk'];
            action = dunkTypes[Math.floor(Math.random() * dunkTypes.length)] || 'dunk';
            break;
          default:
            distance = 10;
            action = 'shot';
        }
        return { action, distance };
      };

      const { action, distance: shotDistance } = getShotDescription(shotDetail);
      const distanceText = shotDistance > 0 ? `${shotDistance}-foot ` : '';

      // Build the result line (ESPN style: "Player makes/misses X-foot shot type")
      if (event.made) {
        let resultLine = `${shooter} makes ${distanceText}${action}`;
        if (event.assistBy) {
          resultLine += ` (${event.assistBy} assists)`;
        }
        lines.push(resultLine);
      } else {
        // Check if blocked
        if (event.blocked && event.blockingPlayer) {
          lines.push(`${shooter}'s ${distanceText}${action} blocked by ${event.blockingPlayer}`);
        } else {
          lines.push(`${shooter} misses ${distanceText}${action}`);
        }
      }
    } else if (eventType === 'rebound') {
      const rebounder = event.rebounder;
      const isOffensive = event.isOffensive;

      if (isOffensive) {
        lines.push(`${rebounder} offensive rebound`);
        if (event.putbackAttempted) {
          if (event.putbackMade) {
            lines.push(`${rebounder} makes putback layup`);
          } else {
            lines.push(`${rebounder} misses putback attempt`);
          }
        }
      } else {
        lines.push(`${rebounder} defensive rebound`);
      }
    } else if (eventType === 'foul') {
      // ESPN-style foul description
      const foulType = event.foulType || 'personal';
      lines.push(`${event.foulingPlayer} ${foulType} foul`);
    } else if (eventType === 'free_throw' || eventType === 'free_throws') {
      const shooter = event.shooter;
      const attempts = event.attempts;

      // ESPN-style: "Player makes/misses free throw 1 of 2"
      if (event.results && Array.isArray(event.results) && event.results.length > 0) {
        event.results.forEach((ftMade: boolean, index: number) => {
          const ftNumber = index + 1;
          if (ftMade) {
            lines.push(`${shooter} makes free throw ${ftNumber} of ${attempts}`);
          } else {
            lines.push(`${shooter} misses free throw ${ftNumber} of ${attempts}`);
          }
        });
      } else {
        // Fallback to summary format
        const made = event.made;
        lines.push(`${shooter} ${made}/${attempts} from the line`);
      }
    } else if (eventType === 'intentional_foul') {
      lines.push(`${event.foulingPlayer} intentional foul on ${event.fouledPlayer}`);
    }
  }

  return lines.join('\n');
}
