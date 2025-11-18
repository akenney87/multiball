/**
 * Basketball Simulator - Substitution System
 *
 * Manages player substitutions based on:
 * 1. Stamina thresholds (< 75 triggers immediate substitution)
 * 2. Minutes allocation (from tactical settings)
 * 3. Position matching (prefer position-compatible subs)
 *
 * Key Logic:
 * - Check after EVERY possession
 * - Substitution priority: stamina < 75 overrides minutes allocation
 * - Edge cases: all bench exhausted, no valid substitutes
 *
 * Integrates with:
 * - staminaManager.ts (current stamina values)
 * - quarter_simulation (active lineup management)
 *
 * @module simulation/systems/substitutions
 */

import type { Player } from '../../data/types';
import type { StaminaTracker } from '../stamina/staminaManager';

// =============================================================================
// DATA STRUCTURES
// =============================================================================

/**
 * Record of a substitution occurrence
 */
export interface SubstitutionEvent {
  /** Quarter time in "MM:SS" format */
  quarterTime: string;
  /** Name of player exiting */
  playerOut: string;
  /** Name of player entering */
  playerIn: string;
  /** Reason for substitution */
  reason: 'stamina' | 'minutes' | 'injury' | 'fouled_out' | 'stamina_rule2' | 'starter_return_rule1' | 'blowout_rest' | 'garbage_time' | 'close_game_insert_closer';
  /** Stamina of exiting player */
  staminaOut: number;
  /** Stamina of entering player */
  staminaIn: number;
  /** Team making substitution */
  team: 'home' | 'away';
}

/**
 * Q4 rotation decision for a starter
 */
interface Q4Decision {
  /** Action to take */
  action: 'STAY_IN' | 'WILL_FATIGUE' | 'INSERT_AT';
  /** Minutes playable from current stamina before dropping to 70 */
  playableMinutes: number;
  /** Current stamina value */
  currentStamina: number;
  /** Time into Q4 when stamina hits 70 (WILL_FATIGUE only) */
  subOutAt?: number;
  /** Time remaining when to insert player (INSERT_AT only) */
  insertAt?: number;
}

/**
 * Tactical settings interface (simplified)
 */
interface TacticalSettings {
  pace: 'fast' | 'standard' | 'slow';
  scoringOption1?: string;
  scoringOption2?: string;
  scoringOption3?: string;
}

// =============================================================================
// SUBSTITUTION LOGIC
// =============================================================================

/**
 * Check if a player needs to be substituted.
 *
 * Priority:
 *   1. Stamina < threshold → immediate substitution
 *   2. Minutes played >= allocation → substitution
 *   3. Otherwise → no substitution
 *
 * M4.5 PHASE 4 FIX:
 *   - Raised threshold from 60 → 75 for NBA realism
 *   - Players should not play with stamina < 75 except in competitive end-game
 *   - Context-aware thresholds can be passed by caller:
 *     * Close game: 50-65 (let starters play tired)
 *     * Blowout: 80-85 (rest starters aggressively)
 *     * Foul trouble: 80 (prevent fouling out)
 *
 * @param player - Player object
 * @param currentStamina - Current stamina value (0-100)
 * @param minutesPlayed - Minutes played this quarter
 * @param minutesAllocation - Allocated minutes for quarter
 * @param staminaThreshold - Stamina threshold for substitution (default 75)
 * @returns Tuple of [needsSub, reason]
 */
export function checkSubstitutionNeeded(
  player: Player,
  currentStamina: number,
  minutesPlayed: number,
  minutesAllocation: number,
  staminaThreshold: number = 75.0
): [boolean, string] {
  // Priority 1: Stamina check (highest priority)
  if (currentStamina < staminaThreshold) {
    return [true, 'stamina'];
  }

  // Priority 2: Minutes allocation check
  // Allow small tolerance (0.1 minutes = 6 seconds)
  if (minutesPlayed >= minutesAllocation + 0.1) {
    return [true, 'minutes'];
  }

  // No substitution needed
  return [false, ''];
}

// =============================================================================
// M3: END-GAME SUBSTITUTION LOGIC
// =============================================================================

/**
 * Check if blowout substitution should occur (rest starters).
 *
 * Thresholds (from FOULS_AND_INJURIES_SPEC.md):
 * - Q4, <6 min, +20 points → rest starters
 * - Q4, <4 min, +18 points → rest starters
 * - Q4, <2 min, +15 points → rest starters
 * - Q4, <2 min, +30 points → garbage time (all subs)
 *
 * @param quarter - Current quarter (1-4)
 * @param timeRemainingSeconds - Seconds remaining in quarter
 * @param scoreDifferential - Point differential (positive if winning)
 * @param winning - True if team is winning
 * @returns Tuple of [shouldSub, reason]
 */
export function checkBlowoutSubstitution(
  quarter: number,
  timeRemainingSeconds: number,
  scoreDifferential: number,
  winning: boolean
): [boolean, string] {
  if (quarter !== 4) {
    return [false, ''];
  }

  if (!winning) {
    return [false, ''];
  }

  const minutesRemaining = timeRemainingSeconds / 60.0;

  // Garbage time (most extreme)
  if (minutesRemaining <= 2.0 && scoreDifferential >= 30) {
    return [true, 'garbage_time'];
  }

  // Blowout thresholds
  if (minutesRemaining <= 6.0 && scoreDifferential >= 20) {
    return [true, 'blowout_rest'];
  }
  if (minutesRemaining <= 4.0 && scoreDifferential >= 18) {
    return [true, 'blowout_rest'];
  }
  if (minutesRemaining <= 2.0 && scoreDifferential >= 15) {
    return [true, 'blowout_rest'];
  }

  return [false, ''];
}

/**
 * Check if starters/closers should be inserted in close game.
 *
 * Thresholds:
 * - Q4, <5 min, ±10 points → keep closers on floor
 * - Q4, <3 min, ±8 points → keep closers on floor
 * - Q4, <2 min, ±5 points → insert closers if benched
 *
 * @param quarter - Current quarter
 * @param timeRemainingSeconds - Seconds remaining
 * @param scoreDifferential - Point differential (abs value used)
 * @param player - Player object
 * @param isCloser - True if player is designated closer
 * @returns Tuple of [shouldInsert, reason]
 */
export function checkCloseGameSubstitution(
  quarter: number,
  timeRemainingSeconds: number,
  scoreDifferential: number,
  player: Player,
  isCloser: boolean
): [boolean, string] {
  if (quarter !== 4) {
    return [false, ''];
  }

  const minutesRemaining = timeRemainingSeconds / 60.0;

  // Check close game thresholds
  let isClose = false;
  if (minutesRemaining <= 5.0 && Math.abs(scoreDifferential) <= 10) {
    isClose = true;
  }
  if (minutesRemaining <= 3.0 && Math.abs(scoreDifferential) <= 8) {
    isClose = true;
  }
  if (minutesRemaining <= 2.0 && Math.abs(scoreDifferential) <= 5) {
    isClose = true;
  }

  if (!isClose) {
    return [false, ''];
  }

  // If closer and it's a close game in final 2 minutes, insert
  if (isCloser && minutesRemaining <= 2.0) {
    return [true, 'close_game_insert_closer'];
  }

  return [false, ''];
}

/**
 * Detect if blowout is becoming competitive (re-insert starters).
 *
 * Triggers:
 * - Lead shrinks by 10+ points
 * - Lead drops below blowout threshold
 *
 * @param previousDifferential - Previous score differential
 * @param currentDifferential - Current score differential
 * @param timeRemainingSeconds - Seconds remaining
 * @returns True if comeback detected (starters should be re-inserted)
 */
export function checkBlowoutComeback(
  previousDifferential: number,
  currentDifferential: number,
  timeRemainingSeconds: number
): boolean {
  const differentialChange = previousDifferential - currentDifferential;

  // Lead shrinks by 10+ points
  if (differentialChange >= 10) {
    return true;
  }

  // Lead drops below blowout threshold
  const minutesRemaining = timeRemainingSeconds / 60.0;
  if (minutesRemaining <= 4.0 && currentDifferential < 15) {
    return true;
  }

  return false;
}

/**
 * Select best substitute from bench.
 *
 * Selection criteria:
 * 1. Prefer position match (PG/SG interchangeable, SF/PF interchangeable, C isolated)
 * 2. Prefer players with stamina >= returnThreshold (90+) to prevent rapid rotation
 * 3. Highest stamina among position matches
 * 4. If no position match or no one above threshold, choose best available
 *
 * Position Compatibility:
 *   PG ↔ SG (guards interchangeable)
 *   SF ↔ PF (wings interchangeable)
 *   C (centers isolated)
 *
 * M4.5 PHASE 4 FIX:
 *   Added returnThreshold (90) to prevent rapid rotation. Bench players must recover
 *   to 90+ stamina before being eligible to return. Falls back to best available if
 *   no one meets threshold (edge case: whole bench is fatigued).
 *
 * @param benchPlayers - List of players currently on bench
 * @param positionOut - Position of player being substituted
 * @param staminaValues - Map of player name → current stamina
 * @param returnThreshold - Minimum stamina for bench players (default 90)
 * @returns Selected substitute or null if no valid subs
 */
export function selectSubstitute(
  benchPlayers: Player[],
  positionOut: string,
  staminaValues: Record<string, number>,
  returnThreshold: number = 90.0
): Player | null {
  if (benchPlayers.length === 0) {
    return null;
  }

  // M4.5 PHASE 4: Filter for position-compatible players
  const compatiblePlayers = benchPlayers.filter(p =>
    isPositionCompatible(positionOut, p.position)
  );

  // M4.5 PHASE 4: Prefer players above return threshold (90+ stamina)
  if (compatiblePlayers.length > 0) {
    // First try: players above threshold
    const wellRested = compatiblePlayers.filter(p =>
      (staminaValues[p.name] ?? 0) >= returnThreshold
    );

    if (wellRested.length > 0) {
      // Sort by stamina (highest first) among well-rested players
      wellRested.sort((a, b) =>
        (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
      );
      return wellRested[0];
    } else {
      // Fallback: no one above threshold, use best available
      compatiblePlayers.sort((a, b) =>
        (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
      );
      return compatiblePlayers[0];
    }
  }

  // No compatible players, choose best available from all bench (any position)
  const wellRestedAny = benchPlayers.filter(p =>
    (staminaValues[p.name] ?? 0) >= returnThreshold
  );

  if (wellRestedAny.length > 0) {
    wellRestedAny.sort((a, b) =>
      (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
    );
    return wellRestedAny[0];
  } else {
    // Absolute fallback: use best available regardless of stamina
    const sorted = [...benchPlayers].sort((a, b) =>
      (staminaValues[b.name] ?? 0) - (staminaValues[a.name] ?? 0)
    );
    return sorted[0];
  }
}

/**
 * Check if two positions are interchangeable.
 *
 * Rules:
 *   PG ↔ SG (guards)
 *   SF ↔ PF (wings)
 *   C ↔ C (centers only)
 *
 * @param positionOut - Position of player exiting
 * @param positionIn - Position of candidate substitute
 * @returns True if positions are compatible
 */
export function isPositionCompatible(positionOut: string, positionIn: string): boolean {
  // Guards are interchangeable
  const guards = new Set(['PG', 'SG']);
  if (guards.has(positionOut) && guards.has(positionIn)) {
    return true;
  }

  // Wings are interchangeable
  const wings = new Set(['SF', 'PF']);
  if (wings.has(positionOut) && wings.has(positionIn)) {
    return true;
  }

  // Centers only match centers
  if (positionOut === 'C' && positionIn === 'C') {
    return true;
  }

  return false;
}

// =============================================================================
// LINEUP MANAGER CLASS
// =============================================================================

/**
 * Manages the 5 active players on court for a team.
 *
 * Responsibilities:
 * - Track current 5-player lineup
 * - Track bench players
 * - Execute substitutions
 * - Validate lineup integrity (always 5 players)
 */
export class LineupManager {
  private team: Player[];
  private activeLineup: Player[];
  private bench: Player[];

  /**
   * Initialize with starting lineup.
   *
   * @param team - Full team roster (10-13 players)
   * @param startingLineup - Optional list of 5 players to start
   * @throws Error if team has fewer than 5 players
   * @throws Error if startingLineup doesn't have exactly 5 players
   */
  constructor(team: Player[], startingLineup?: Player[]) {
    if (team.length < 5) {
      throw new Error(`Team must have at least 5 players, got ${team.length}`);
    }

    this.team = team;

    // Use provided starting lineup or default to first 5
    if (startingLineup !== undefined) {
      if (startingLineup.length !== 5) {
        throw new Error(`Starting lineup must have exactly 5 players, got ${startingLineup.length}`);
      }
      this.activeLineup = [...startingLineup];

      // Bench is everyone not in starting lineup
      const startingNames = new Set(startingLineup.map(p => p.name));
      this.bench = team.filter(p => !startingNames.has(p.name));
    } else {
      this.activeLineup = team.slice(0, 5);
      this.bench = team.length > 5 ? team.slice(5) : [];
    }
  }

  /**
   * Return current 5 players on court
   */
  getActivePlayers(): Player[] {
    return [...this.activeLineup];
  }

  /**
   * Return players on bench
   */
  getBenchPlayers(): Player[] {
    return [...this.bench];
  }

  /**
   * Find player in team by name
   *
   * @param name - Player name to search for
   * @returns Player object if found, null otherwise
   */
  getPlayerByName(name: string): Player | null {
    return this.team.find(p => p.name === name) ?? null;
  }

  /**
   * Replace playerOut with playerIn.
   *
   * Side Effects:
   *   Updates activeLineup and bench lists
   *
   * @param playerOut - Player to remove from active lineup
   * @param playerIn - Player to add to active lineup
   * @returns True if substitution successful, false otherwise
   */
  substitute(playerOut: Player, playerIn: Player): boolean {
    // Find playerOut in active lineup
    const playerOutIndex = this.activeLineup.findIndex(p => p.name === playerOut.name);
    if (playerOutIndex === -1) {
      // Player not in active lineup
      return false;
    }

    // Find playerIn on bench
    const playerInIndex = this.bench.findIndex(p => p.name === playerIn.name);
    if (playerInIndex === -1) {
      // Player not on bench
      return false;
    }

    // Execute substitution
    // Move playerOut to bench
    this.bench.push(this.activeLineup[playerOutIndex]);

    // Move playerIn to active lineup (replace playerOut)
    this.activeLineup[playerOutIndex] = this.bench[playerInIndex];

    // Remove playerIn from bench
    this.bench.splice(playerInIndex, 1);

    return true;
  }

  /**
   * Validate lineup integrity.
   *
   * @returns True if lineup is valid (exactly 5 active players)
   */
  validateLineup(): boolean {
    return this.activeLineup.length === 5;
  }
}

// =============================================================================
// SUBSTITUTION MANAGER CLASS
// =============================================================================

/**
 * Manages substitution logic for quarter simulation.
 *
 * Tracks active lineups, bench availability, and minutes allocation.
 * Coordinates substitutions for both teams based on stamina and minutes.
 */
export class SubstitutionManager {
  private homeRoster: Player[];
  private awayRoster: Player[];
  private minutesAllocationHome: Record<string, number>;
  private minutesAllocationAway: Record<string, number>;
  private tacticalHome: TacticalSettings | null;
  private tacticalAway: TacticalSettings | null;
  private paceHome: string;
  private paceAway: string;
  private scoringOptionsHome: string[];
  private scoringOptionsAway: string[];
  private homeLineupManager: LineupManager;
  private awayLineupManager: LineupManager;
  private substitutionEvents: SubstitutionEvent[];
  private lastSubTime: Record<string, number>;
  private substitutionCooldownMinutes: number;
  private timeOnCourt: Record<string, number>;
  private homeStarters: Set<string>;
  private awayStarters: Set<string>;
  private starterReplacementMap: Record<string, string>;
  private q4DecisionsHome: Record<string, Q4Decision>;
  private q4DecisionsAway: Record<string, Q4Decision>;
  private q4StartProcessed: boolean;

  /**
   * Initialize substitution manager.
   *
   * @param homeRoster - Full home team roster (10-13 players)
   * @param awayRoster - Full away team roster (10-13 players)
   * @param minutesAllocationHome - Map of player name → minutes (for quarter)
   * @param minutesAllocationAway - Map of player name → minutes (for quarter)
   * @param homeStartingLineup - Optional starting 5 for home team
   * @param awayStartingLineup - Optional starting 5 for away team
   * @param tacticalHome - TacticalSettings for home team
   * @param tacticalAway - TacticalSettings for away team
   */
  constructor(
    homeRoster: Player[],
    awayRoster: Player[],
    minutesAllocationHome: Record<string, number>,
    minutesAllocationAway: Record<string, number>,
    homeStartingLineup?: Player[],
    awayStartingLineup?: Player[],
    tacticalHome?: TacticalSettings | null,
    tacticalAway?: TacticalSettings | null
  ) {
    this.homeRoster = homeRoster;
    this.awayRoster = awayRoster;
    this.minutesAllocationHome = minutesAllocationHome;
    this.minutesAllocationAway = minutesAllocationAway;

    // Store tactical settings for Q4 closer calculations
    this.tacticalHome = tacticalHome ?? null;
    this.tacticalAway = tacticalAway ?? null;

    // Extract pace and scoring options (with safe defaults)
    this.paceHome = tacticalHome?.pace ?? 'standard';
    this.paceAway = tacticalAway?.pace ?? 'standard';

    this.scoringOptionsHome = [];
    if (tacticalHome) {
      if (tacticalHome.scoringOption1) this.scoringOptionsHome.push(tacticalHome.scoringOption1);
      if (tacticalHome.scoringOption2) this.scoringOptionsHome.push(tacticalHome.scoringOption2);
      if (tacticalHome.scoringOption3) this.scoringOptionsHome.push(tacticalHome.scoringOption3);
    }

    this.scoringOptionsAway = [];
    if (tacticalAway) {
      if (tacticalAway.scoringOption1) this.scoringOptionsAway.push(tacticalAway.scoringOption1);
      if (tacticalAway.scoringOption2) this.scoringOptionsAway.push(tacticalAway.scoringOption2);
      if (tacticalAway.scoringOption3) this.scoringOptionsAway.push(tacticalAway.scoringOption3);
    }

    // Initialize lineup managers with starting lineups
    this.homeLineupManager = new LineupManager(homeRoster, homeStartingLineup);
    this.awayLineupManager = new LineupManager(awayRoster, awayStartingLineup);

    // Track substitution events
    this.substitutionEvents = [];

    // M3 FIX: Track last substitution time per player to prevent excessive churn
    this.lastSubTime = {};
    for (const player of [...homeRoster, ...awayRoster]) {
      this.lastSubTime[player.name] = -999.0; // Never subbed yet
    }
    this.substitutionCooldownMinutes = 2.0;

    // NEW: Track continuous time on court for each player
    this.timeOnCourt = {};
    for (const player of [...homeRoster, ...awayRoster]) {
      this.timeOnCourt[player.name] = 0.0;
    }

    // Identify starters (players with highest minutes allocation)
    this.homeStarters = new Set();
    const sortedHome = [...homeRoster].sort((a, b) =>
      (minutesAllocationHome[b.name] ?? 0) - (minutesAllocationHome[a.name] ?? 0)
    );
    for (let i = 0; i < Math.min(5, sortedHome.length); i++) {
      this.homeStarters.add(sortedHome[i].name);
    }

    this.awayStarters = new Set();
    const sortedAway = [...awayRoster].sort((a, b) =>
      (minutesAllocationAway[b.name] ?? 0) - (minutesAllocationAway[a.name] ?? 0)
    );
    for (let i = 0; i < Math.min(5, sortedAway.length); i++) {
      this.awayStarters.add(sortedAway[i].name);
    }

    // BUG FIX: Track which backup replaced which starter
    this.starterReplacementMap = {};

    // Q4 Closer System: Track Q4 rotation decisions
    this.q4DecisionsHome = {};
    this.q4DecisionsAway = {};
    this.q4StartProcessed = false;
  }

  /**
   * Check all active players for substitution needs and execute.
   *
   * Side Effects:
   *   Updates lineup managers if substitutions occur
   *
   * @param staminaTracker - StaminaTracker instance
   * @param gameTimeStr - Current game time string
   * @param timeRemainingInQuarter - Seconds remaining in quarter
   * @param quarterNumber - Current quarter (1-4)
   * @param debug - If true, print debug information
   * @param homeScore - Current home team score
   * @param awayScore - Current away team score
   * @returns List of substitution events that occurred
   */
  checkAndExecuteSubstitutions(
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingInQuarter: number = 0,
    quarterNumber: number = 1,
    debug: boolean = false,
    homeScore: number = 0,
    awayScore: number = 0
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];

    // Q4 CLOSER SYSTEM: Process Q4 start (calculate rotation decisions once)
    if (quarterNumber === 4 && !this.q4StartProcessed) {
      this.q4StartProcessed = true;
      this.processQ4Start(staminaTracker, homeScore, awayScore);

      // TEMP DEBUG: Always print Q4 decisions for close games
      if (Math.abs(homeScore - awayScore) <= 10) {
        console.log(`\n[Q4 CLOSER DEBUG] Q4 rotation decisions calculated:`);
        console.log(`  Score: ${homeScore}-${awayScore} (diff: ${Math.abs(homeScore - awayScore)})`);
        console.log('  Home Team:');
        for (const [starter, decision] of Object.entries(this.q4DecisionsHome)) {
          console.log(`    ${starter}: ${decision.action} | playable: ${decision.playableMinutes.toFixed(1)} min | stamina: ${decision.currentStamina.toFixed(1)} | insert_at: ${decision.insertAt ?? 'N/A'}`);
        }
        console.log('  Away Team:');
        for (const [starter, decision] of Object.entries(this.q4DecisionsAway)) {
          console.log(`    ${starter}: ${decision.action} | playable: ${decision.playableMinutes.toFixed(1)} min | stamina: ${decision.currentStamina.toFixed(1)} | insert_at: ${decision.insertAt ?? 'N/A'}`);
        }
      }

      if (debug) {
        console.log(`\n[Q4 CLOSER] Q4 rotation decisions calculated:`);
        for (const [starter, decision] of Object.entries(this.q4DecisionsHome)) {
          console.log(`  ${starter}: ${decision.action} (stamina: ${decision.currentStamina.toFixed(1)})`);
        }
      }
    }

    if (debug) {
      // Debug: check time on court for first home player
      const homeActive = this.homeLineupManager.getActivePlayers();
      if (homeActive.length > 0) {
        const p = homeActive[0];
        const timeOn = this.timeOnCourt[p.name] ?? 0;
        console.log(`[DEBUG SUB CHECK] ${gameTimeStr}: ${p.name} time_on_court=${timeOn.toFixed(2)}min`);
      }
    }

    // Check home team (score_differential positive if home winning)
    const homeEvents = this.checkTeamSubstitutions(
      this.homeLineupManager,
      this.minutesAllocationHome,
      staminaTracker,
      gameTimeStr,
      timeRemainingInQuarter,
      quarterNumber,
      homeScore - awayScore,
      'home'
    );
    events.push(...homeEvents);

    // Check away team (score_differential positive if away winning)
    const awayEvents = this.checkTeamSubstitutions(
      this.awayLineupManager,
      this.minutesAllocationAway,
      staminaTracker,
      gameTimeStr,
      timeRemainingInQuarter,
      quarterNumber,
      awayScore - homeScore,
      'away'
    );
    events.push(...awayEvents);

    // Store events
    this.substitutionEvents.push(...events);

    if (debug && events.length > 0) {
      console.log(`[DEBUG SUB CHECK] ${gameTimeStr}: ${events.length} substitutions executed`);
    }

    return events;
  }

  /**
   * Check and execute substitutions for one team.
   *
   * M4.5 PHASE 4: USER RULES FOR SUBSTITUTIONS:
   *   Rule #1: If a starter has 90+ stamina AND the player at their position
   *            has been on court 6+ minutes → sub the starter in
   *   Rule #2: If a starter drops below 70 stamina → sub out immediately
   *            Try position match first (PG→PG), then position group
   *            (Guards: PG/SG, Wings: SF/PF, Bigs: C)
   *   Rule #3 (CRUNCH TIME): In final 2 min of close games (±5 pts),
   *            only sub out starters if stamina < 50 (play exhausted stars)
   *
   * @param lineupManager - LineupManager for this team
   * @param minutesAllocation - Minutes allocation dict
   * @param staminaTracker - StaminaTracker instance
   * @param gameTimeStr - Current game time string
   * @param timeRemainingInQuarter - Seconds remaining in quarter
   * @param quarterNumber - Current quarter (1-4)
   * @param scoreDifferential - Score difference (positive if winning)
   * @param team - 'home' or 'away'
   * @returns List of substitution events
   */
  private checkTeamSubstitutions(
    lineupManager: LineupManager,
    minutesAllocation: Record<string, number>,
    staminaTracker: StaminaTracker,
    gameTimeStr: string,
    timeRemainingInQuarter: number = 0,
    quarterNumber: number = 1,
    scoreDifferential: number = 0,
    team: 'home' | 'away'
  ): SubstitutionEvent[] {
    const events: SubstitutionEvent[] = [];
    let activePlayers = lineupManager.getActivePlayers();
    let benchPlayers = lineupManager.getBenchPlayers();
    const staminaValues = staminaTracker.getAllStaminaValues();

    // RULE #3: Detect crunch time (Q4, final 2 min, close game ±5 pts)
    const isCrunchTime = (
      quarterNumber === 4 &&
      timeRemainingInQuarter <= 120 &&
      Math.abs(scoreDifferential) <= 5
    );

    // RULE #2: Check for starters who need to be subbed out (<70 stamina normally, <50 in crunch time)
    for (const player of activePlayers) {
      const playerName = player.name;
      const currentStamina = staminaTracker.getCurrentStamina(playerName);
      const isStarter = this.isStarter(playerName);

      // Rule #2: Starter with <70 stamina must be subbed out (unless crunch time)
      // Rule #3: In crunch time, only sub out if stamina < 50 (play exhausted stars)
      let staminaThreshold = isCrunchTime ? 50.0 : 70.0;

      // Q4 CLOSER FIX: Check if this starter should finish Q4 (close game)
      let q4CloserActive = false;
      if (quarterNumber === 4 && Math.abs(scoreDifferential) <= 10 && isStarter) {
        const q4Decisions = team === 'home' ? this.q4DecisionsHome : this.q4DecisionsAway;
        if (q4Decisions[playerName]) {
          const action = q4Decisions[playerName].action;
          if (action === 'STAY_IN' || action === 'WILL_FATIGUE') {
            staminaThreshold = 50.0;
            q4CloserActive = true;
          }
        }
      }

      if (isStarter && currentStamina < staminaThreshold && benchPlayers.length > 0 && !q4CloserActive) {
        // Find substitute: prefer position match with 90+ stamina
        const substitute = this.selectSubstituteByRules(
          benchPlayers,
          player.position,
          staminaValues,
          true,
          90.0
        );

        if (substitute) {
          const success = lineupManager.substitute(player, substitute);
          if (success) {
            const event: SubstitutionEvent = {
              quarterTime: gameTimeStr,
              playerOut: playerName,
              playerIn: substitute.name,
              reason: 'stamina_rule2',
              staminaOut: currentStamina,
              staminaIn: staminaTracker.getCurrentStamina(substitute.name),
              team,
            };
            events.push(event);

            // BUG FIX: Track that this backup replaced this starter
            this.starterReplacementMap[playerName] = substitute.name;

            // Reset time on court
            this.timeOnCourt[playerName] = 0.0;
            this.timeOnCourt[substitute.name] = 0.0;

            // Update bench list for next iteration
            benchPlayers = lineupManager.getBenchPlayers();
            activePlayers = lineupManager.getActivePlayers();
          }
        }
      }
    }

    // RULE #1: Check for starters on bench who are ready to return
    for (const benchPlayer of [...benchPlayers]) {
      const benchPlayerName = benchPlayer.name;
      const isStarter = this.isStarter(benchPlayerName);
      const benchStamina = staminaValues[benchPlayerName] ?? 0;

      // Q4 CLOSER FIX: Check if this is a Q4 close game INSERT_AT scenario FIRST
      let hasQ4InsertPlan = false;
      if (quarterNumber === 4 && Math.abs(scoreDifferential) <= 10 && isStarter) {
        const q4Decisions = team === 'home' ? this.q4DecisionsHome : this.q4DecisionsAway;
        if (q4Decisions[benchPlayerName]) {
          if (q4Decisions[benchPlayerName].action === 'INSERT_AT') {
            hasQ4InsertPlan = true;
          }
        }
      }

      // Rule #1: Starter with 90+ stamina is ready to return
      // Q4 CLOSER FIX: OR starter has Q4 insert plan in close game (bypass 90 requirement)
      if (isStarter && (benchStamina >= 90.0 || hasQ4InsertPlan)) {
        // Q4 CLOSER SYSTEM: Check if we should wait to insert this starter
        let q4InsertOverride = false;
        if (quarterNumber === 4 && Math.abs(scoreDifferential) <= 10) {
          const q4Decisions = team === 'home' ? this.q4DecisionsHome : this.q4DecisionsAway;
          if (q4Decisions[benchPlayerName]) {
            const decision = q4Decisions[benchPlayerName];

            // Only insert if time remaining <= calculated insertion time
            if (decision.action === 'INSERT_AT') {
              q4InsertOverride = true;
              const timeRemainingMin = timeRemainingInQuarter / 60.0;
              const insertAtMin = decision.insertAt ?? 0;

              // Add 0.5 min buffer (insert slightly early for safety)
              if (timeRemainingMin > insertAtMin + 0.5) {
                // Too early - wait
                continue; // Skip this starter, check next bench player
              }
            }
          }
        }

        // BUG FIX: First check if we tracked a specific backup who replaced this starter
        const trackedBackupName = this.starterReplacementMap[benchPlayerName];
        let replacedTrackedBackup = false;

        if (trackedBackupName) {
          // Try to find the tracked backup in active players
          for (const activePlayer of activePlayers) {
            if (activePlayer.name === trackedBackupName) {
              // Found the backup who took this starter's spot - replace them
              const success = lineupManager.substitute(activePlayer, benchPlayer);
              if (success) {
                const event: SubstitutionEvent = {
                  quarterTime: gameTimeStr,
                  playerOut: activePlayer.name,
                  playerIn: benchPlayerName,
                  reason: 'starter_return_rule1',
                  staminaOut: staminaTracker.getCurrentStamina(activePlayer.name),
                  staminaIn: benchStamina,
                  team,
                };
                events.push(event);

                // Clear the mapping (starter has reclaimed their spot)
                delete this.starterReplacementMap[benchPlayerName];

                // Reset time on court
                this.timeOnCourt[activePlayer.name] = 0.0;
                this.timeOnCourt[benchPlayerName] = 0.0;

                // Update lists
                benchPlayers = lineupManager.getBenchPlayers();
                activePlayers = lineupManager.getActivePlayers();

                replacedTrackedBackup = true;
                break; // Exit loop, this starter is back in
              }
            }
          }
        }

        // If we didn't replace the tracked backup, fall back to original logic
        if (!replacedTrackedBackup) {
          let foundReplacement = false;
          for (const activePlayer of activePlayers) {
            const activePlayerName = activePlayer.name;
            const timeOnCourtVal = this.timeOnCourt[activePlayerName] ?? 0.0;

            // Check if positions are compatible and time >= 6 minutes (or Q4 insert override)
            if (
              (q4InsertOverride || timeOnCourtVal >= 6.0) &&
              this.positionsCompatible(benchPlayer.position, activePlayer.position)
            ) {
              foundReplacement = true;
              // Execute substitution
              const success = lineupManager.substitute(activePlayer, benchPlayer);
              if (success) {
                const event: SubstitutionEvent = {
                  quarterTime: gameTimeStr,
                  playerOut: activePlayerName,
                  playerIn: benchPlayerName,
                  reason: 'starter_return_rule1',
                  staminaOut: staminaTracker.getCurrentStamina(activePlayerName),
                  staminaIn: benchStamina,
                  team,
                };
                events.push(event);

                // Reset time on court
                this.timeOnCourt[activePlayerName] = 0.0;
                this.timeOnCourt[benchPlayerName] = 0.0;

                // Update lists
                benchPlayers = lineupManager.getBenchPlayers();
                activePlayers = lineupManager.getActivePlayers();

                // Break inner loop - this starter has been subbed in
                break;
              }
            }
          }
        }
      }
    }

    return events;
  }

  /**
   * Calculate how many minutes a player can play from current stamina
   * before dropping to 70 stamina.
   *
   * @param player - Player object with attributes
   * @param currentStamina - Current stamina value
   * @param pace - 'fast', 'standard', 'slow'
   * @param isScoringOption - True if player is scoring option #1/2/3
   * @returns Minutes playable (float)
   */
  private calculatePlayableMinutes(
    player: Player,
    currentStamina: number,
    pace: string,
    isScoringOption: boolean
  ): number {
    // Import stamina calculation (would need to be exported from staminaManager)
    // For now, using simplified logic

    // Stamina budget: current → 70
    const staminaBudget = currentStamina - 70.0;

    if (staminaBudget <= 0) {
      return 0.0; // Already below threshold
    }

    // Simplified stamina cost calculation
    // (In real implementation, would import from staminaManager)
    const baseCost = isScoringOption ? 1.5 : 1.0;
    const paceMod = pace === 'fast' ? 1.3 : pace === 'slow' ? 0.8 : 1.0;
    const avgCost = baseCost * paceMod;

    // Pace-specific possession rate
    const possessionsPerMinute = pace === 'fast' ? 2.8 : pace === 'slow' ? 2.2 : 2.5;

    // Calculate drain per minute
    const drainPerMinute = avgCost * possessionsPerMinute;

    // Calculate playable minutes
    const playableMinutes = staminaBudget / drainPerMinute;

    return playableMinutes;
  }

  /**
   * At Q4 start, evaluate every starter and calculate optimal rotation.
   *
   * For each starter:
   * - If on bench: calculate when to insert
   * - If on court: check if can finish Q4, if not calculate bench time needed
   *
   * Stores decisions in q4DecisionsHome and q4DecisionsAway
   */
  private processQ4Start(
    staminaTracker: StaminaTracker,
    homeScore: number,
    awayScore: number
  ): void {
    // Process home team
    this.processQ4TeamDecisions(
      staminaTracker,
      this.homeLineupManager,
      this.homeStarters,
      this.homeRoster,
      this.paceHome,
      this.scoringOptionsHome,
      this.q4DecisionsHome
    );

    // Process away team
    this.processQ4TeamDecisions(
      staminaTracker,
      this.awayLineupManager,
      this.awayStarters,
      this.awayRoster,
      this.paceAway,
      this.scoringOptionsAway,
      this.q4DecisionsAway
    );
  }

  /**
   * Process Q4 decisions for one team's starters.
   */
  private processQ4TeamDecisions(
    staminaTracker: StaminaTracker,
    lineupManager: LineupManager,
    starters: Set<string>,
    roster: Player[],
    pace: string,
    scoringOptions: string[],
    decisionsDict: Record<string, Q4Decision>
  ): void {
    const activePlayers = lineupManager.getActivePlayers();
    const activeNames = new Set(activePlayers.map(p => p.name));

    for (const starterName of starters) {
      // Find player in roster
      const player = roster.find(p => p.name === starterName);
      if (!player) {
        continue;
      }

      const currentStamina = staminaTracker.getCurrentStamina(starterName);
      const isScoringOption = scoringOptions.includes(starterName);
      const isActive = activeNames.has(starterName);

      // Calculate playable minutes from current stamina
      const playableMinutes = this.calculatePlayableMinutes(
        player,
        currentStamina,
        pace,
        isScoringOption
      );

      if (isActive) {
        // CASE 2: Starter on court
        // Can they play all 12 minutes of Q4?
        if (playableMinutes >= 12.0) {
          // Can finish - stay in
          decisionsDict[starterName] = {
            action: 'STAY_IN',
            playableMinutes,
            currentStamina,
          };
        } else {
          // Cannot finish - will need to sub out
          decisionsDict[starterName] = {
            action: 'WILL_FATIGUE',
            playableMinutes,
            currentStamina,
            subOutAt: 12.0 - playableMinutes,
          };
        }
      } else {
        // CASE 1: Starter on bench
        // Calculate when to insert
        // BUG FIX: If playableMinutes >= 12, insert at Q4 start
        let insertAtTime: number;
        if (playableMinutes >= 12.0) {
          insertAtTime = 12.0; // Insert at Q4 start (full stamina, can finish)
        } else {
          insertAtTime = 12.0 - playableMinutes; // Insert so they can play until end
        }

        decisionsDict[starterName] = {
          action: 'INSERT_AT',
          playableMinutes,
          currentStamina,
          insertAt: insertAtTime,
        };
      }
    }
  }

  /**
   * Get current home team active lineup
   */
  getHomeActive(): Player[] {
    return this.homeLineupManager.getActivePlayers();
  }

  /**
   * Get current away team active lineup
   */
  getAwayActive(): Player[] {
    return this.awayLineupManager.getActivePlayers();
  }

  /**
   * Get current home team bench
   */
  getHomeBench(): Player[] {
    return this.homeLineupManager.getBenchPlayers();
  }

  /**
   * Get current away team bench
   */
  getAwayBench(): Player[] {
    return this.awayLineupManager.getBenchPlayers();
  }

  /**
   * Get all substitution events recorded
   */
  getAllSubstitutionEvents(): SubstitutionEvent[] {
    return [...this.substitutionEvents];
  }

  /**
   * M4.5 FIX: Manual substitution for special cases (foul outs, injuries).
   *
   * @param team - 'home' or 'away'
   * @param playerOutName - Name of player to remove
   * @param playerInName - Name of player to add
   * @param quarterTime - Current quarter time (e.g., "8:32")
   * @param reason - Reason for substitution
   * @returns True if substitution successful, false otherwise
   */
  makeSubstitution(
    team: 'home' | 'away',
    playerOutName: string,
    playerInName: string,
    quarterTime: string = '0:00',
    reason: 'injury' | 'fouled_out' = 'fouled_out'
  ): boolean {
    // Get the appropriate lineup manager and roster
    const lineupManager = team === 'home' ? this.homeLineupManager : this.awayLineupManager;
    const roster = team === 'home' ? this.homeRoster : this.awayRoster;

    // Find player dictionaries
    const playerOut = lineupManager.getPlayerByName(playerOutName);
    if (playerOut === null) {
      return false; // Player not found in active lineup
    }

    const playerIn = roster.find(p => p.name === playerInName);
    if (!playerIn) {
      return false; // Substitute not found in roster
    }

    // Use reasonable default stamina values for event recording
    const staminaOut = 50.0; // Player coming off court
    const staminaIn = 100.0; // Player coming in fresh from bench

    // Execute substitution
    const success = lineupManager.substitute(playerOut, playerIn);

    if (success) {
      // Record substitution event
      const event: SubstitutionEvent = {
        quarterTime,
        playerOut: playerOutName,
        playerIn: playerIn.name,
        reason,
        staminaOut,
        staminaIn,
        team,
      };
      this.substitutionEvents.push(event);

      // Reset time on court for both players
      this.timeOnCourt[playerOutName] = 0.0;
      this.timeOnCourt[playerIn.name] = 0.0;
    }

    return success;
  }

  /**
   * Update continuous time on court for all active players.
   *
   * Call this after EVERY possession to track how long players have been
   * on court without rest.
   *
   * Side Effects:
   *   Updates timeOnCourt for all active players
   *
   * @param staminaTracker - StaminaTracker instance (unused but kept for compatibility)
   * @param durationSeconds - Possession duration in seconds
   */
  updateTimeOnCourt(staminaTracker: StaminaTracker, durationSeconds: number): void {
    const durationMinutes = durationSeconds / 60.0;

    const homeActive = this.homeLineupManager.getActivePlayers();
    const awayActive = this.awayLineupManager.getActivePlayers();

    for (const player of [...homeActive, ...awayActive]) {
      this.timeOnCourt[player.name] = (this.timeOnCourt[player.name] ?? 0) + durationMinutes;
    }
  }

  /**
   * Check if player is a starter (high minutes allocation).
   *
   * @param playerName - Player name
   * @returns True if player is in top 5 for their team (starter)
   */
  private isStarter(playerName: string): boolean {
    return this.homeStarters.has(playerName) || this.awayStarters.has(playerName);
  }

  /**
   * Check if two positions are compatible for substitution.
   *
   * M4.5 PHASE 4: User's position groupings:
   * - Guards: PG, SG
   * - Wings: SF, PF
   * - Bigs: C
   *
   * @param pos1 - First position
   * @param pos2 - Second position
   * @returns True if positions are in same group
   */
  private positionsCompatible(pos1: string, pos2: string): boolean {
    const guards = new Set(['PG', 'SG']);
    const wings = new Set(['SF', 'PF']);

    // Same position always compatible
    if (pos1 === pos2) {
      return true;
    }

    // Guards compatible with guards
    if (guards.has(pos1) && guards.has(pos2)) {
      return true;
    }

    // Wings compatible with wings
    if (wings.has(pos1) && wings.has(pos2)) {
      return true;
    }

    // Center only compatible with center (already handled by pos1 === pos2)
    return false;
  }

  /**
   * Select substitute following user's rules.
   *
   * M4.5 PHASE 4: Selection priority:
   * 1. Exact position match with stamina >= minimumStamina (90+)
   * 2. Position group match with stamina >= minimumStamina
   * 3. If no one meets minimum, use best available from position group
   * 4. Last resort: best available from entire bench
   *
   * BUG FIX: Avoid selecting starters whose tracked backup is still on court.
   *
   * @param benchPlayers - Available bench players
   * @param positionOut - Position of player being replaced
   * @param staminaValues - Current stamina for all players
   * @param isReplacingStarter - True if replacing a starter
   * @param minimumStamina - Minimum stamina requirement (default 90)
   * @returns Selected player or null
   */
  private selectSubstituteByRules(
    benchPlayers: Player[],
    positionOut: string,
    staminaValues: Record<string, number>,
    isReplacingStarter: boolean,
    minimumStamina: number = 90.0
  ): Player | null {
    if (benchPlayers.length === 0) {
      return null;
    }

    // BUG FIX: Filter out starters whose tracked replacement is still on court
    const eligibleBench = benchPlayers.filter(p => {
      // Check if this player is a starter with a tracked replacement
      if (this.starterReplacementMap[p.name]) {
        // This starter has a tracked backup - check if backup is still on court
        const backupName = this.starterReplacementMap[p.name];
        const homeActiveNames = new Set(this.homeLineupManager.getActivePlayers().map(p => p.name));
        const awayActiveNames = new Set(this.awayLineupManager.getActivePlayers().map(p => p.name));
        const allActiveNames = new Set([...homeActiveNames, ...awayActiveNames]);

        if (allActiveNames.has(backupName)) {
          // Backup is still on court - don't use this starter yet
          return false;
        }
      }

      // Player is eligible
      return true;
    });

    // If no eligible players after filtering, fall back to original bench
    const finalBench = eligibleBench.length > 0 ? eligibleBench : benchPlayers;

    // Priority 1: Exact position match with 90+ stamina
    const exactMatchReady = finalBench.filter(p =>
      p.position === positionOut && (staminaValues[p.name] ?? 0) >= minimumStamina
    );
    if (exactMatchReady.length > 0) {
      return exactMatchReady.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 2: Position group match with 90+ stamina
    const groupMatchReady = finalBench.filter(p =>
      this.positionsCompatible(p.position, positionOut) &&
      (staminaValues[p.name] ?? 0) >= minimumStamina
    );
    if (groupMatchReady.length > 0) {
      return groupMatchReady.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 3: Position group match (any stamina)
    const groupMatchAny = finalBench.filter(p =>
      this.positionsCompatible(p.position, positionOut)
    );
    if (groupMatchAny.length > 0) {
      return groupMatchAny.reduce((best, p) =>
        (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
      );
    }

    // Priority 4: Best available from entire bench (last resort)
    return finalBench.reduce((best, p) =>
      (staminaValues[p.name] ?? 0) > (staminaValues[best.name] ?? 0) ? p : best
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS FOR MINUTES ALLOCATION
// =============================================================================

/**
 * Convert game minutes to quarter targets.
 *
 * Simple division: allocation / 4 for each quarter
 *
 * @param totalAllocations - Map of player name → 48-minute allocation
 * @param quarterNumber - Quarter number (1-4)
 * @returns Map of player name → minutes for THIS quarter
 */
export function calculateQuarterAllocations(
  totalAllocations: Record<string, number>,
  quarterNumber: number
): Record<string, number> {
  const quarterAllocations: Record<string, number> = {};

  for (const [playerName, totalMinutes] of Object.entries(totalAllocations)) {
    const quarterMinutes = totalMinutes / 4.0;
    quarterAllocations[playerName] = quarterMinutes;
  }

  return quarterAllocations;
}

/**
 * Validate minutes allocation dictionary.
 *
 * Validation rules:
 *   - Must total exactly 240 minutes (5 players * 48 minutes)
 *   - No player can have more than 48 minutes
 *   - No player can have negative minutes
 *
 * @param allocations - Map of player name → minutes
 * @param teamSize - Number of players on team
 * @returns Tuple of [isValid, errorMessage]
 */
export function validateMinutesAllocation(
  allocations: Record<string, number>,
  teamSize: number
): [boolean, string] {
  const total = Object.values(allocations).reduce((sum, val) => sum + val, 0);

  // Check total
  if (Math.abs(total - 240) > 0.1) {
    // Allow tiny floating point error
    return [false, `Total minutes must be 240, got ${total}`];
  }

  // Check individual allocations
  for (const [playerName, minutes] of Object.entries(allocations)) {
    if (minutes < 0) {
      return [false, `Player ${playerName} has negative minutes: ${minutes}`];
    }
    if (minutes > 48) {
      return [false, `Player ${playerName} exceeds 48 minutes: ${minutes}`];
    }
  }

  return [true, ''];
}
