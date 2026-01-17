/**
 * Basketball Simulator - Constants and Configuration
 *
 * All BaseRates, attribute weights, and modifiers from basketball_sim.md Section 14.
 * Single source of truth for all magic numbers.
 *
 * CRITICAL: This is a direct translation from Python basketball-sim constants.py
 * All values MUST match exactly to ensure identical simulation outputs.
 *
 * @module simulation/constants
 */

// =============================================================================
// CORE PROBABILITY CONSTANTS
// =============================================================================

/**
 * Sigmoid steepness parameter (k)
 * M4 FIX PHASE 5B: Fine-tuning k for competitive balance
 * k=0.02: Too steep, 45% blowouts
 * k=0.01: Too flat, shooting percentages skyrocketed
 * k=0.015: Middle ground to balance advantage vs realism (CORRELATION TOO WEAK: r=0.054)
 * k=0.025: Increased to improve attribute correlation (Target: r > 0.25, spread 25-30pp)
 */
export const SIGMOID_K = 0.025; // Tuned for attribute correlation (1.67x signal increase from 0.015)

// =============================================================================
// BASE RATES (Uncontested Success Probabilities)
// From basketball_sim.md Section 14.1
// =============================================================================

/**
 * FORMULA FIX + RECALIBRATION: Final tuned base rates for centered sigmoid
 * After fixing the weighted sigmoid formula, contest penalties were reduced from
 * -35/-47% to -8/-15%, requiring base rate adjustments for NBA-realistic output.
 *
 * Tuning process:
 * 1. Started with spec original (0.30/0.62/0.80)
 * 2. Fixed formula + reduced contest penalties → stats 10-14% low
 * 3. Increased base rates by ~10% to hit NBA targets
 */
export const BASE_RATE_3PT = 0.28; // 3-point shot (wide open) - M4.5 PPG Fix: Increased from 0.23→0.28 to hit 36-37% league average
export const BASE_RATE_MIDRANGE_SHORT = 0.5; // 10-16 ft (open) - Tuned for ~40% midrange%
export const BASE_RATE_MIDRANGE_LONG = 0.41; // 16-23 ft (open) - Tuned for ~35% midrange%
export const BASE_RATE_DUNK = 0.87; // Dunk (uncontested) - M5.0: Reduced from 0.95→0.87 for better NBA realism
export const BASE_RATE_LAYUP = 0.62; // Layup (contested baseline) - M5.0: Reduced from 0.77→0.62 for better NBA realism
export const BASE_RATE_FREE_THROW = 0.5; // Free throw - Will be adjusted separately in free_throws.py

// =============================================================================
// ATTRIBUTE WEIGHT TABLES
// =============================================================================

/**
 * 3-Point Shooting (Section 14.2)
 */
export const WEIGHTS_3PT: Record<string, number> = {
  form_technique: 0.25,
  throw_accuracy: 0.2,
  finesse: 0.15,
  hand_eye_coordination: 0.12,
  balance: 0.1,
  composure: 0.08,
  consistency: 0.06,
  agility: 0.04,
};

/**
 * Midrange Shooting (Section 14.2)
 */
export const WEIGHTS_MIDRANGE: Record<string, number> = {
  form_technique: 0.23,
  throw_accuracy: 0.18,
  finesse: 0.2,
  hand_eye_coordination: 0.13,
  balance: 0.11,
  composure: 0.08,
  consistency: 0.05,
  agility: 0.02,
};

/**
 * Dunking (Section 14.2)
 */
export const WEIGHTS_DUNK: Record<string, number> = {
  jumping: 0.4,
  height: 0.3,
  bravery: 0.1, // attacking the rim through contact
  determination: 0.1, // finishing strong
  agility: 0.05,
  footwork: 0.05, // gather step, approach angle
};

/**
 * Layups (Section 14.2)
 * PHASE 2: Added core_strength (finishing through contact) and acceleration (first step)
 */
export const WEIGHTS_LAYUP: Record<string, number> = {
  finesse: 0.3, // touch and body control
  hand_eye_coordination: 0.15, // coordination and timing
  balance: 0.12, // staying upright on contact
  jumping: 0.13, // elevating over defenders
  acceleration: 0.12, // first step burst to the rim
  core_strength: 0.1, // finishing through contact at rim
  footwork: 0.08, // pivot moves, drop steps at rim
};

/**
 * Rebounding (Section 14.2)
 * PHASE 2: Added grip_strength (securing ball) and arm_strength (ripping/boxing out)
 */
export const WEIGHTS_REBOUND: Record<string, number> = {
  height: 0.2, // reach advantage
  jumping: 0.16, // elevating for ball
  core_strength: 0.08, // balance and positioning
  awareness: 0.17, // anticipating trajectory
  grip_strength: 0.1, // securing the ball
  arm_strength: 0.09, // ripping ball away, boxing out
  reactions: 0.05, // quick response to miss
  determination: 0.07, // hustle and effort
  footwork: 0.08, // positioning and boxing out
};

/**
 * Contest Defense (Section 14.2)
 * PHASE 2: Expanded from 3 to 5 attributes - added balance and determination
 */
export const WEIGHTS_CONTEST: Record<string, number> = {
  height: 0.25, // reach and size advantage
  reactions: 0.25, // quick closeout timing
  agility: 0.22, // lateral movement
  balance: 0.10, // staying in front, defensive stance
  determination: 0.1, // hustle, effort to contest
  footwork: 0.08, // defensive sliding, positioning
};

/**
 * Steal Defense (for steal credit on turnovers)
 * BUG FIX: Was incorrectly using WEIGHTS_CONTEST (height-based) for steal probability
 * Steals require grip strength, reactions, awareness, agility, determination
 */
export const WEIGHTS_STEAL_DEFENSE: Record<string, number> = {
  grip_strength: 0.3, // Most important - ability to grab/strip ball
  reactions: 0.25, // Quick hands and anticipation
  awareness: 0.2, // Reading passes, positioning
  agility: 0.15, // Quick movement to intercept
  determination: 0.1, // Hustle and effort
};

/**
 * Turnover Prevention (Section 14.2)
 * PHASE 2 (REVISED): Added grip_strength to very slightly help ball security
 * M5.0: Added throw_accuracy (prevents bad passes which are 40% of turnovers)
 */
export const WEIGHTS_TURNOVER_PREVENTION: Record<string, number> = {
  awareness: 0.33, // -0.05 - court awareness
  throw_accuracy: 0.2, // NEW - prevents bad passes
  composure: 0.23, // -0.05 - decision-making under pressure
  consistency: 0.14, // -0.05 - reliable ball control
  hand_eye_coordination: 0.05, // -0.05 - general coordination
  grip_strength: 0.05, // unchanged - ball security
};

/**
 * Ball Handling (for ball handler selection - M5.0)
 * Better ball handlers get possession more often
 */
export const WEIGHTS_BALL_HANDLING: Record<string, number> = {
  hand_eye_coordination: 0.3, // Dribbling coordination
  awareness: 0.25, // Court vision to run offense
  agility: 0.2, // Ability to handle with quick movements
  composure: 0.15, // Decision-making with ball
  grip_strength: 0.1, // Ball security
};

/**
 * Drive Outcomes - Dunk (Section 14.2)
 * PHASE 1: Added acceleration for first-step explosiveness to rim
 */
export const WEIGHTS_DRIVE_DUNK: Record<string, number> = {
  jumping: 0.4,
  height: 0.22, // Reduced from 0.30 to make room for acceleration
  bravery: 0.1, // attacking the rim through contact
  determination: 0.1, // finishing strong
  agility: 0.1,
  acceleration: 0.08, // First-step burst to beat defender
};

/**
 * Drive Outcomes - Layup (Section 14.2)
 * PHASE 1: Added acceleration for first-step quickness to rim
 * PHASE 2: Added core_strength (absorbing contact)
 */
export const WEIGHTS_DRIVE_LAYUP: Record<string, number> = {
  finesse: 0.22, // touch and body control
  acceleration: 0.19, // first-step burst critical for drives
  hand_eye_coordination: 0.15, // coordination while driving
  balance: 0.13, // staying upright through contact
  jumping: 0.13, // elevating in traffic
  core_strength: 0.1, // absorbing contact on drives
  footwork: 0.08, // euro-step, gather step
};

/**
 * Drive Outcomes - Kick-out (Section 14.2)
 * PHASE 2: Added throw_accuracy for accurate passes on kickouts
 */
export const WEIGHTS_DRIVE_KICKOUT: Record<string, number> = {
  teamwork: 0.35, // -0.05 - willingness to kick out
  awareness: 0.3, // -0.05 - finding open shooters
  composure: 0.2, // -0.05 - decision-making under pressure
  throw_accuracy: 0.15, // NEW - accurate passes while driving
};

/**
 * Drive Outcomes - Turnover (Section 14.2)
 */
export const WEIGHTS_DRIVE_TURNOVER: Record<string, number> = {
  awareness: 0.35, // -0.05 - reading defense
  composure: 0.25, // -0.05 - decision-making in traffic
  throw_accuracy: 0.2, // NEW - accurate kickout passes
  consistency: 0.15, // -0.05 - reliable execution
  hand_eye_coordination: 0.05, // -0.05 - general coordination
};

/**
 * PHASE 1 ATTRIBUTE INTEGRATION: Transition Success (acceleration + top_speed)
 * Added to honor Pillar #3 - all attributes must meaningfully impact gameplay
 * PHASE 3B: Removed stamina (now affects drain/recovery rate, not direct outcomes)
 * Redistributed weights to other attributes to sum to 1.0
 */
export const WEIGHTS_TRANSITION_SUCCESS: Record<string, number> = {
  acceleration: 0.28, // First step in open court (+0.03)
  top_speed: 0.23, // Ability to finish break (+0.03)
  awareness: 0.17, // Reading defense (+0.02)
  agility: 0.17, // Change of direction (+0.02)
  composure: 0.1, // Decision-making at speed (unchanged)
  hand_eye_coordination: 0.05, // Ball control (unchanged)
};

/**
 * ATTRIBUTE EXPANSION: Transition Defense (added top_speed)
 * Defensive ability to get back and stop fast breaks
 * TODO: Integrate into possession flow - calculate defensive team's ability to get back
 * and reduce/eliminate transition bonus if they successfully recover
 * PHASE 3B: Removed stamina (now affects drain/recovery rate, not direct outcomes)
 * Redistributed weights to other attributes to sum to 1.0
 */
export const WEIGHTS_TRANSITION_DEFENSE: Record<string, number> = {
  top_speed: 0.35, // Getting back quickly (+0.05)
  acceleration: 0.25, // First step back on defense (+0.05)
  awareness: 0.17, // Reading the break (+0.02)
  agility: 0.12, // Lateral movement (+0.02)
  reactions: 0.11, // Quick response (+0.01)
};

/**
 * ATTRIBUTE EXPANSION: Shot Separation (added deception)
 * Ability to create space and get better shot quality
 */
export const WEIGHTS_SHOT_SEPARATION: Record<string, number> = {
  deception: 0.35, // Fakes, hesitations
  agility: 0.25, // Lateral quickness
  acceleration: 0.2, // First step
  creativity: 0.1, // Unconventional moves
  composure: 0.1, // Patience to wait
};

/**
 * ATTRIBUTE EXPANSION: Finding Open Teammates (added creativity)
 * PHASE 2: Added throw_accuracy for delivering accurate passes
 * Ability to identify and deliver to wide open shooters
 */
export const WEIGHTS_FIND_OPEN_TEAMMATE: Record<string, number> = {
  creativity: 0.25, // -0.05 - seeing unconventional passes
  awareness: 0.25, // -0.05 - court vision
  teamwork: 0.2, // UNCHANGED - willingness to share
  throw_accuracy: 0.15, // NEW - delivering accurate passes
  composure: 0.1, // -0.02 - decision-making under pressure
  hand_eye_coordination: 0.05, // -0.03 - general coordination (throw_accuracy more specific)
};

/**
 * Assist Concentration - Power Law Exponent
 * Controls how concentrated assists are toward elite ball handlers
 * 1.0 = current behavior (linear)
 * 2.0 = squared (elite passers get ~15-20% of team assists)
 * 4.0 = more concentrated (elite passers get ~25-40% of team assists) - USER SELECTED
 * 5.0 = very concentrated (elite passers get ~35-50% of team assists)
 */
export const ASSIST_CONCENTRATION_EXPONENT = 4.0;

/**
 * ATTRIBUTE EXPANSION: Help Defense Rotation (added teamwork)
 * Willingness and ability to rotate and help teammates
 */
export const WEIGHTS_HELP_DEFENSE_ROTATION: Record<string, number> = {
  teamwork: 0.3, // Team-first mindset
  awareness: 0.3, // Reading help situations
  reactions: 0.2, // Quick rotation
  agility: 0.06, // Lateral movement
  determination: 0.08, // Effort and hustle
  footwork: 0.06, // Defensive sliding during rotation
};

/**
 * ATTRIBUTE EXPANSION: Patience modifier for contest reduction
 * Patient players handle defensive pressure better
 * Scale: (patience - 50) * PATIENCE_CONTEST_REDUCTION_SCALE
 * Example: patience=70 → +2% contest penalty reduction (makes -15% become -13%)
 */
export const PATIENCE_CONTEST_REDUCTION_SCALE = 0.001; // Max ±5% adjustment at extremes

/**
 * PHASE 3A: Patience Contest Distance Modifier
 * Patience should impact how closely contested shots are (positively)
 * Higher patience = defenders think shooter isn't ready, giving more space
 * Formula: effective_distance = base_distance + (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE
 * patience=90: +0.8ft (defenders give more space)
 * patience=50: +0.0ft (baseline)
 * patience=10: -0.8ft (rushed shots, defenders crowd more)
 */
export const PATIENCE_DISTANCE_MODIFIER_SCALE = 0.02; // ±0.8ft at ±40 patience difference

/**
 * Contest Distance Variance (Gaussian Noise)
 * Adds realistic variance to contest distances to achieve NBA playoff-intensity distribution
 * Target distribution: ~30% wide open (6+ ft), ~35% open (4-6 ft), ~25% tight (2-4 ft), ~10% very tight (<2 ft)
 * Without variance: 96.4% contested (deterministic outcomes)
 * With sigma=1.9: Achieves target distribution (27.8% / 33.2% / 27.6% / 11.4%)
 */
export const CONTEST_DISTANCE_SIGMA = 1.9; // Standard deviation in feet for Gaussian variance

/**
 * PHASE 3C: Bravery Drive Tendency Modifier
 * Bravery should impact whether player decides to drive vs shoot
 * Higher bravery = more likely to attack rim (drives/rim attempts)
 * Lower bravery = more likely to settle for perimeter shots
 * Formula: adjusted_rim_pct = base_rim_pct + (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE
 * bravery=90: +8% rim attempts (more aggressive)
 * bravery=50: +0% (baseline)
 * bravery=10: -8% rim attempts (settles for perimeter)
 */
export const BRAVERY_RIM_TENDENCY_SCALE = 0.002; // ±8% at ±40 bravery difference

/**
 * PHASE 3D: Consistency Variance Scale
 * Consistency should tighten/loosen variance for all dice rolls involving player's attributes
 * High consistency = tight variance (predictable performance)
 * Low consistency = wide variance (boom-or-bust)
 * Formula: variance = random.uniform(-variance_scale, variance_scale)
 *          where variance_scale = abs((consistency - 50) * CONSISTENCY_VARIANCE_SCALE)
 * consistency=90: ±0.8% variance (very consistent)
 * consistency=50: ±0% variance (baseline)
 * consistency=10: ±8% variance (wildly inconsistent)
 */
export const CONSISTENCY_VARIANCE_SCALE = 0.0002; // ±0.8% at consistency=90, ±8% at consistency=10

// =============================================================================
// SHOT SELECTION DISTRIBUTION
// =============================================================================

/**
 * Baseline shot distribution (Section 4.1)
 * M4.5 PHASE 1: Statistical tuning to reduce rim attempt rate
 * M4.5 PHASE 4: Fine-tune 3PT/midrange balance
 * M4.5 PHASE 5: Adjust for team composition variance (100-game validation)
 * Phase 4 (specialist teams): 3pt=43.5%, mid=19.5%, rim=36.9%
 * 100-game (diverse teams): 3pt=38.4%, mid=32.7%, rim=28.9%
 * Phase 5 adjustment: Shift 6% from midrange to rim to center averages
 * 100-game validation tuning: Shift 7% from rim to 3pt to increase 3PA (30.0 → 35.0 per team)
 */
export const SHOT_DISTRIBUTION_BASELINE = {
  '3pt': 0.47, // Increased from 0.40 (need to increase 3PA from 30.0 → 35.0 per team)
  midrange: 0.26, // Keep unchanged per user request
  rim: 0.27, // Decreased from 0.34 (shift 0.07 to 3pt)
};

/**
 * M4.7: Player attribute modifiers (increased from ±5% to ±15%)
 * PM Agent recommendation: Weak ±5% modifier insufficient for player differentiation
 * Elite vs poor shooter should differ 2-4x in shot selection, not just 10-15%
 */
export const SHOT_DISTRIBUTION_PLAYER_MOD = 0.15;

/**
 * Tactical modifiers (±10%)
 */
export const SHOT_DISTRIBUTION_TACTICAL_MOD = 0.1;

/**
 * Zone defense bonus to 3PT attempts
 */
export const ZONE_DEFENSE_3PT_ATTEMPT_BONUS = 0.05;

// =============================================================================
// USAGE DISTRIBUTION (Section 5.1)
// =============================================================================

export const USAGE_SCORING_OPTION_1 = 0.3;
export const USAGE_SCORING_OPTION_2 = 0.2;
export const USAGE_SCORING_OPTION_3 = 0.15;
export const USAGE_OTHERS = 0.35; // Divided equally among remaining players

// =============================================================================
// CONTEST PENALTIES (Section 4.5)
// =============================================================================

export const CONTEST_DISTANCE_WIDE_OPEN = 6.0; // feet
export const CONTEST_DISTANCE_CONTESTED = 2.0; // feet

/**
 * FORMULA FIX RECALIBRATION: Contest penalties for centered sigmoid
 * Previous penalties were calibrated for BROKEN formula that inflated base rates.
 * With FIXED formula (centered on base_rate), penalties must be much lighter.
 *
 * Target outcomes for NBA-average players (composite ~60):
 * - 3PT: ~30% wide open → ~22% contested → ~15% heavy
 * - Midrange: ~40% wide open → ~32% contested → ~25% heavy
 * - Rim: ~70% wide open → ~60% contested → ~50% heavy
 *
 * Real basketball contest sensitivity by shot type:
 * - 3PT shots: Highly contest-sensitive (need space and time)
 * - Midrange: Moderately contest-sensitive
 * - Rim (layups/dunks): Less sensitive (physicality can power through)
 */
export const CONTEST_PENALTIES = {
  '3PT': {
    wide_open: 0.0,
    contested: -0.048, // ~4.8% penalty (OPTION A: -40% reduction from -0.08)
    heavy: -0.09, // ~9% penalty (OPTION A: -40% reduction from -0.15)
  },
  midrange_short: {
    wide_open: 0.0,
    contested: -0.048, // ~4.8% penalty (OPTION A: -40% reduction from -0.08)
    heavy: -0.09, // ~9% penalty (OPTION A: -40% reduction from -0.15)
  },
  midrange_long: {
    wide_open: 0.0,
    contested: -0.048, // ~4.8% penalty (OPTION A: -40% reduction from -0.08)
    heavy: -0.09, // ~9% penalty (OPTION A: -40% reduction from -0.15)
  },
  rim: {
    // Layups and dunks
    wide_open: 0.0,
    contested: -0.036, // ~3.6% penalty (OPTION A: -40% reduction from -0.06)
    heavy: -0.12, // ~12% penalty (increased from -0.072 to reduce heavily contested rim FG%)
  },
};

/**
 * Defender composite modifier range (±2.5% with Option A)
 */
export const CONTEST_DEFENDER_MOD_SCALE = 0.0005; // OPTION A: -50% reduction from 0.001 → (composite - 50) * 0.0005 = ±0.025

// =============================================================================
// HELP DEFENSE (Section 4.6)
// =============================================================================

export const HELP_DEFENSE_TRIGGER_THRESHOLD = 0.3; // Contest quality < 30%
export const HELP_DEFENSE_AWARENESS_K = 0.05; // Sigmoid steepness for help rotation

// =============================================================================
// TRANSITION BONUSES (Section 4.8)
// =============================================================================

export const TRANSITION_BONUS_RIM = 0.2; // +20% success
export const TRANSITION_BONUS_MIDRANGE = 0.12; // +12% success
export const TRANSITION_BONUS_3PT = 0.08; // +8% success

// =============================================================================
// ZONE DEFENSE MODIFIERS (Section 12.2)
// =============================================================================

/**
 * REMOVED M4.6: ZONE_DEFENSE_TURNOVER_BONUS (was +0.03)
 * Zone defense is passive (protects paint), man defense is aggressive (forces turnovers)
 * Spec was backwards - zone should NOT increase turnovers
 */
export const ZONE_DEFENSE_CONTEST_PENALTY = -0.15; // -15% contest effectiveness on 3PT
export const ZONE_DEFENSE_DRIVE_PENALTY = -0.1; // -10% drive success

// =============================================================================
// PACE MODIFIERS (Section 10.1)
// =============================================================================

export const PACE_FAST_POSSESSION_MOD = 1.1; // +10% possessions
export const PACE_FAST_STAMINA_DRAIN = 1.15; // +15% stamina drain
export const PACE_SLOW_POSSESSION_MOD = 0.9; // -10% possessions
export const PACE_SLOW_STAMINA_DRAIN = 0.85; // -15% stamina drain
export const PACE_STANDARD_POSSESSION_MOD = 1.0;
export const PACE_STANDARD_STAMINA_DRAIN = 1.0;

// =============================================================================
// TURNOVER SYSTEM (Section 6)
// =============================================================================

/**
 * BUG FIX v2: Reduced from 0.10 to 0.06 after validation showed 19.2% actual rate
 * BUG FIX v4: Reduced from 0.06 to 0.04 after Team_002 showed 21.7% rate
 * BUG FIX v5: Increased from 0.04 to 0.12 after changing formula from multiplicative to additive
 * BUG FIX v6: Reduced from 0.12 to 0.05 - TWO TURNOVER MECHANISMS STACK (general + drive)
 * General turnover check + drive turnover selection = total rate
 * With 0.12 base, actual rates were 23-38% (way too high)
 * Previous formula: rate * sigmoid(composite) created 4.5x variance (elite 18%, poor 82%)
 * New formula: rate + ±3% adjustment creates balanced matchups
 * Target: 12-15% total turnover rate (general + drive combined)
 * REALISM FIX: Tuned from 0.05 → 0.03 (8.87%) → 0.04 (10.73%) → 0.045 → 0.08 (M4.6)
 * M4.6 RECALIBRATION: Increased from 0.045 to 0.08 after removing zone defense turnover bonus
 * Previous system: 0.045 base + up to 0.03 zone bonus = 0.075 effective
 * New system: 0.08 base (no artificial man/zone modifier)
 * Target: 14-15 total turnovers per game (general + drive combined)
 */
export const BASE_TURNOVER_RATE = 0.12; // 12% base rate for general possession turnovers (drive adds more)
// Increased from 0.08 to 0.12 - was producing only 9 turnovers per game, target is 14-15 per team

/**
 * Pace adjustments to turnover rate
 */
export const TURNOVER_PACE_FAST_BONUS = 0.025; // +2.5%
export const TURNOVER_PACE_SLOW_PENALTY = -0.025; // -2.5%

/**
 * Turnover type distribution (M5.0: Split violations into shot clock and other)
 */
export const TURNOVER_TYPE_BAD_PASS = 0.4;
export const TURNOVER_TYPE_LOST_BALL = 0.3;
export const TURNOVER_TYPE_OFFENSIVE_FOUL = 0.2;
export const TURNOVER_TYPE_SHOT_CLOCK = 0.05; // NEW - shot clock violations
export const TURNOVER_TYPE_OTHER_VIOLATION = 0.05; // Traveling, carries, etc.

/**
 * Shot clock violation pace modifiers
 */
export const SHOT_CLOCK_VIOLATION_SLOW_PACE_BONUS = 0.03; // +3% for slow pace
export const SHOT_CLOCK_VIOLATION_FAST_PACE_PENALTY = -0.02; // -2% for fast pace

// =============================================================================
// REBOUNDING STRATEGY (Section 10.4)
// =============================================================================

export const REBOUND_STRATEGY_CRASH_GLASS_COUNT = 5;
export const REBOUND_STRATEGY_STANDARD_COUNT = 4;
export const REBOUND_STRATEGY_PREVENT_TRANSITION_COUNT = 3;

/**
 * Defensive rebounding advantage (Section 7.1)
 */
export const DEFENSIVE_REBOUND_ADVANTAGE = 1.15; // 15% stronger

// =============================================================================
// STAMINA SYSTEM (Section 11)
// =============================================================================

export const STAMINA_THRESHOLD = 80; // Below this, attributes degrade
export const STAMINA_DEGRADATION_POWER = 1.3; // Exponential curve exponent
export const STAMINA_DEGRADATION_SCALE = 0.002; // penalty = 0.002 * (80 - stamina) ** 1.3 (decimal format)

/**
 * Stamina costs per possession (Section 11.2)
 */
export const STAMINA_COST_PER_POSSESSION_FAST = 1.5;
export const STAMINA_COST_PER_POSSESSION_STANDARD = 1.3;
export const STAMINA_COST_PER_POSSESSION_SLOW = 1.1;

/**
 * Stamina costs per action
 */
export const STAMINA_COST_DRIVE = 1.0;
export const STAMINA_COST_JUMP_SHOT = 0.5;
export const STAMINA_COST_REBOUND = 0.8;
export const STAMINA_COST_SPRINT_TRANSITION = 1.2;

/**
 * Recovery per minute on bench (Section 11.3)
 */
export const STAMINA_RECOVERY_RATE = 8; // 8 * (1 - current/100)

/**
 * PHASE 3B: Stamina Attribute Rate Modifiers
 * Stamina attribute now affects drain/recovery RATES, not direct outcomes
 * Formula: rate_modifier = 1.0 + ((50 - stamina_attribute) / 50) * MAX_MODIFIER
 * High stamina (90): drains slower, recovers faster
 * Low stamina (10): drains faster, recovers slower
 * USER FIX: Increased from ±15% to ±50% to create 4x larger spread between players
 */
export const STAMINA_DRAIN_RATE_MAX_MODIFIER = 0.5; // ±50% drain rate at extremes (4x spread)
export const STAMINA_RECOVERY_RATE_MAX_MODIFIER = 0.13; // ±13% recovery rate at extremes

// =============================================================================
// SHOT BLOCKING SYSTEM
// =============================================================================

/**
 * Block base rates by shot type (probability defender blocks the shot)
 * 100-game validation tuning: Increased by ~40% to boost blocks from 2.6 → 4.0 per team
 */
export const BLOCK_BASE_RATES: Record<string, number> = {
  dunk: 0.14, // 14% block rate on dunks [tuned: 0.08->0.10->0.14]
  layup: 0.22, // 22% block rate on layups (most blockable) [tuned: 0.12->0.16->0.22]
  midrange: 0.042, // 4.2% block rate on midrange (rare) [tuned: 0.03->0.042]
  midrange_short: 0.042,
  midrange_long: 0.042,
  '3pt': 0.014, // 1.4% block rate on 3PT (very rare) [tuned: 0.01->0.014]
  rim: 0.18, // 18% generic rim attempt (fallback) [tuned: 0.10->0.13->0.18]
};

/**
 * Distance modifiers for block probability
 */
export const BLOCK_DISTANCE_THRESHOLD_FAR = 6.0; // 6+ feet: cannot block (same as wide open threshold)
export const BLOCK_DISTANCE_THRESHOLD_MID = 3.0; // 3-6 feet: reduced block chance (50%)
// < 3 feet: full block chance (100%)

/**
 * Defender block ability weights
 */
export const WEIGHTS_BLOCK_DEFENDER: Record<string, number> = {
  jumping: 0.25, // Primary - reach and timing
  height: 0.2, // Taller players block better
  reactions: 0.15, // Timing the jump
  agility: 0.12, // Lateral movement to position
  awareness: 0.1, // Reading the shot
  bravery: 0.08, // Willingness to challenge
  hand_eye_coordination: 0.05, // Swatting accuracy
  balance: 0.05, // Staying vertical
};

/**
 * Shooter block avoidance weights
 */
export const WEIGHTS_BLOCK_SHOOTER: Record<string, number> = {
  height: 0.2, // Taller shooters harder to block
  finesse: 0.18, // Shot touch/angle to avoid blocks
  awareness: 0.15, // Sensing defender
  jumping: 0.12, // Shooting over defenders
  creativity: 0.1, // Shot variation
  composure: 0.1, // Not rushing shot
  agility: 0.08, // Body control
  deception: 0.07, // Pump fakes, shot fakes
};

/**
 * Block outcome probabilities (what happens after block occurs)
 * Based on NBA data: most blocks create scrambles, not immediate out of bounds
 */
export const BLOCK_OUTCOME_STAYS_IN_PLAY = 0.65; // 65% - becomes loose ball/rebound
export const BLOCK_OUTCOME_OUT_OFF_SHOOTER = 0.23; // 23% - out of bounds, defense possession
export const BLOCK_OUTCOME_OUT_OFF_BLOCKER = 0.12; // 12% - out of bounds, offense retains

/**
 * Defender's ability to control blocked shot (controlled deflection vs wild swat)
 */
export const WEIGHTS_BLOCK_CONTROL: Record<string, number> = {
  grip_strength: 0.3, // Hold onto deflected ball
  hand_eye_coordination: 0.25, // Clean contact
  reactions: 0.2, // Quick hands
  composure: 0.15, // Controlled motion
  awareness: 0.1, // Know where ball is going
};

/**
 * Shooter's ability to recover/redirect during block attempt
 */
export const WEIGHTS_BLOCK_SHOOTER_RECOVER: Record<string, number> = {
  hand_eye_coordination: 0.35, // Tip/redirect ability
  reactions: 0.25, // React to block attempt
  composure: 0.2, // Don't panic
  awareness: 0.1, // See block coming
  agility: 0.1, // Body control
};

/**
 * Defender aggression (increases likelihood of ball going out off shooter)
 */
export const WEIGHTS_OUT_OFF_SHOOTER: Record<string, number> = {
  jumping: 0.35, // High vertical = more forceful
  arm_strength: 0.3, // Power through shot
  height: 0.2, // Reach advantage
  bravery: 0.15, // Aggressive contest
};

/**
 * Shooter's redirect ability (increases likelihood of ball going out off blocker)
 */
export const WEIGHTS_OUT_OFF_BLOCKER: Record<string, number> = {
  finesse: 0.3, // Soft touch to redirect
  hand_eye_coordination: 0.3, // Quick hands
  awareness: 0.2, // See opportunity
  deception: 0.2, // Misdirect defender
};

// =============================================================================
// OFFENSIVE REBOUND LOGIC (Section 7.4)
// =============================================================================

export const OREB_PUTBACK_HEIGHT_THRESHOLD = 75; // Height > 75 → putback attempt
export const OREB_SHOT_CLOCK_RESET = 14; // Seconds

// =============================================================================
// ASSIST TIMING (Section 8)
// =============================================================================

export const ASSIST_TIME_THRESHOLD = 2.0; // seconds since last pass

// =============================================================================
// PLAYER ATTRIBUTES (Reference)
// =============================================================================

export const ALL_ATTRIBUTES = [
  // Physical (12)
  'grip_strength',
  'arm_strength',
  'core_strength',
  'agility',
  'acceleration',
  'top_speed',
  'jumping',
  'reactions',
  'stamina',
  'balance',
  'height',
  'durability',

  // Mental (8)
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
  'teamwork',

  // Technical (6)
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'footwork',
];

export const ATTRIBUTE_COUNT = 26;

// =============================================================================
// VALIDATION CONSTANTS
// =============================================================================

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 100;
export const MINUTES_ALLOTMENT_TOTAL = 240; // 5 players × 48 minutes
export const MINUTES_ALLOTMENT_MAX_PER_PLAYER = 48;
