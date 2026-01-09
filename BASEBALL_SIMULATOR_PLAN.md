# Baseball Simulator Implementation Plan

## Overview

Implement a baseball simulation engine that follows the same architectural patterns as the existing basketball simulator. The simulator will use the same 26 attributes with sport-specific weight tables to determine outcomes at the at-bat level.

**Agent Reviews:**
- Plan Agent (Simulation Design): **B+**
- General-Purpose Agent (Integration): **B-**

---

## Core Design Principles

1. **Same 26 Attributes** - No new attributes; use sport-specific weight tables
2. **Attribute-Driven Realism** - Every outcome determined by weighted composites + sigmoid probability
3. **Granular Simulation** - At-bat level (pitch-by-pitch optional for future)
4. **Play-by-Play Output** - Human-readable narrative for each at-bat
5. **Testable** - Debug info at every step for validation
6. **Platoon Awareness** - Left vs Right matchups affect outcomes
7. **Codebase Integration** - Follows existing patterns, integrates with season/match system

---

## File Structure

```
src/simulation/baseball/
├── constants.ts              # All weight tables, base rates, penalties
├── types.ts                  # Baseball-specific types
├── core/
│   └── probability.ts        # Reuse from basketball (shared)
├── systems/
│   ├── batting.ts            # Contact, power calculations
│   ├── pitching.ts           # Pitch effectiveness, stamina
│   ├── fielding.ts           # Error rates, play execution
│   ├── baserunning.ts        # Steal attempts, advancing
│   └── substitutions.ts      # Bullpen management (NEW)
├── atBat/
│   ├── atBatSimulation.ts    # Single at-bat orchestration
│   └── pitchOutcome.ts       # Ball/strike/hit determination
├── game/
│   ├── gameSimulation.ts     # 9 innings orchestration
│   └── inningSimulation.ts   # 3 outs per half-inning
├── playByPlay/
│   └── playByPlay.ts         # Narrative generation
└── index.ts                  # Public exports

src/ai/baseball/               # NEW - AI decision modules
├── lineup.ts                  # Batting order construction
├── pitching.ts                # Starter/reliever selection
└── strategy.ts                # In-game decisions
```

---

## Codebase Integration Requirements

### 1. Position Constants (src/data/constants.ts)

**Add to existing constants file** (do NOT create new type on Player):

```typescript
// src/data/constants.ts - ADD THESE
export const BASEBALL_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'DH'] as const;
export type BaseballPosition = typeof BASEBALL_POSITIONS[number];

// Position suitability weights for auto-assignment
export const BASEBALL_POSITION_WEIGHTS: Record<BaseballPosition, Record<string, number>> = {
  'P': { arm_strength: 0.30, stamina: 0.25, throw_accuracy: 0.25, composure: 0.20 },
  'C': { durability: 0.25, throw_accuracy: 0.25, reactions: 0.25, awareness: 0.25 },
  '1B': { height: 0.30, hand_eye_coordination: 0.30, footwork: 0.20, reactions: 0.20 },
  '2B': { agility: 0.30, reactions: 0.25, throw_accuracy: 0.25, awareness: 0.20 },
  '3B': { reactions: 0.30, arm_strength: 0.30, bravery: 0.20, throw_accuracy: 0.20 },
  'SS': { agility: 0.25, reactions: 0.25, throw_accuracy: 0.25, arm_strength: 0.25 },
  'LF': { top_speed: 0.30, arm_strength: 0.25, awareness: 0.25, acceleration: 0.20 },
  'CF': { top_speed: 0.35, acceleration: 0.25, awareness: 0.25, reactions: 0.15 },
  'RF': { arm_strength: 0.35, top_speed: 0.25, awareness: 0.20, acceleration: 0.20 },
  'DH': { /* No fielding - batting only */ },
};
```

### 2. Sport Metadata on Player (src/data/types.ts)

**Add optional sport-specific metadata to Player interface:**

```typescript
// src/data/types.ts - ADD TO Player interface
export interface Player {
  // ... existing fields ...

  // Sport-specific metadata (optional)
  sportMetadata?: {
    baseball?: {
      bats: 'L' | 'R' | 'S';    // S = switch hitter
      throws: 'L' | 'R';
      preferredPosition?: BaseballPosition;
    };
    // soccer metadata can be added later
  };
}
```

**Handedness generation** (if not set, generate from player seed):
```typescript
// src/simulation/baseball/systems/batting.ts
export function getPlayerHandedness(player: Player): { bats: 'L'|'R'|'S', throws: 'L'|'R' } {
  // If explicitly set, use it
  if (player.sportMetadata?.baseball) {
    return {
      bats: player.sportMetadata.baseball.bats,
      throws: player.sportMetadata.baseball.throws,
    };
  }

  // Generate deterministically from player ID
  const seed = hashString(player.id);
  const rand = seededRandom(seed);

  // Distribution: 88% right, 10% left, 2% switch
  const batsRoll = rand();
  const bats = batsRoll < 0.10 ? 'L' : batsRoll < 0.12 ? 'S' : 'R';

  // Throwing: 90% right, 10% left
  const throws = rand() < 0.10 ? 'L' : 'R';

  return { bats, throws };
}
```

### 3. Career Stats Structure (src/data/types.ts)

**Replace placeholder with full implementation:**

```typescript
// src/data/types.ts - REPLACE BaseballCareerStats
export interface BaseballCareerStats {
  // Batting (accumulated totals)
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
  caughtStealing: number;

  // Pitching (if player has pitched)
  gamesStarted: number;
  inningsPitched: number;  // Stored as thirds (e.g., 6.2 IP = 20)
  hitsAllowed: number;
  runsAllowed: number;
  earnedRuns: number;
  walksAllowed: number;
  strikeoutsThrown: number;
  homeRunsAllowed: number;
  wins: number;
  losses: number;
  saves: number;

  // Fielding
  putouts: number;
  assists: number;
  errors: number;

  // Computed (not stored, calculated on demand)
  // battingAverage: hits / atBats
  // onBasePercentage: (hits + walks) / (atBats + walks)
  // sluggingPercentage: totalBases / atBats
  // era: (earnedRuns / inningsPitched) * 9
}
```

### 4. Tactical Settings (src/data/types.ts)

**Add baseball-specific tactical settings:**

```typescript
// src/data/types.ts - ADD NEW INTERFACE
export interface BaseballTacticalSettings {
  // Lineup (9 player IDs in batting order)
  lineup: [string, string, string, string, string, string, string, string, string];

  // Defensive positions (player ID -> position)
  defensivePositions: Record<string, BaseballPosition>;

  // Pitching
  startingPitcher: string;
  bullpenOrder: string[];  // Relief pitchers in preferred usage order
  bullpenStrategy: 'aggressive' | 'standard' | 'conservative';

  // Game settings
  useDH: boolean;

  // Baserunning
  baserunningAggression: 'aggressive' | 'standard' | 'conservative';
  stealFrequency: number;  // 0-1, likelihood of attempting steals

  // Situational
  sacrificeBuntFrequency: number;  // 0-1
}

// Update main TacticalSettings to be sport-aware
export type SportTacticalSettings =
  | { sport: 'basketball'; settings: TacticalSettings }
  | { sport: 'baseball'; settings: BaseballTacticalSettings }
  | { sport: 'soccer'; settings: SoccerTacticalSettings };
```

### 5. Match Runner Integration (src/season/matchRunner.ts)

**Update existing switch statement:**

```typescript
// src/season/matchRunner.ts - UPDATE
import { BaseballGameSimulator } from '../simulation/baseball';

// In runMatch function:
switch (match.sport) {
  case 'basketball':
    const basketballSim = new GameSimulator(homeRoster, awayRoster, tacticalSettings);
    gameResult = basketballSim.simulateGame();
    break;

  case 'baseball':
    const baseballSim = new BaseballGameSimulator(
      homeRoster,
      awayRoster,
      homeTactics as BaseballTacticalSettings,
      awayTactics as BaseballTacticalSettings
    );
    gameResult = baseballSim.simulateGame();
    break;

  case 'soccer':
    // TODO: Implement after baseball
    gameResult = simulateSoccerGame(homeRoster, awayRoster);
    break;
}
```

### 6. Box Score Interface (src/simulation/baseball/types.ts)

```typescript
// src/simulation/baseball/types.ts
export interface BaseballBoxScore {
  // Line score
  homeRunsByInning: number[];
  awayRunsByInning: number[];

  // Totals
  homeRuns: number;
  awayRuns: number;
  homeHits: number;
  awayHits: number;
  homeErrors: number;
  awayErrors: number;

  // Player stats
  homeBatting: Record<string, BaseballBattingLine>;
  awayBatting: Record<string, BaseballBattingLine>;
  homePitching: Record<string, BaseballPitchingLine>;
  awayPitching: Record<string, BaseballPitchingLine>;
}

export interface BaseballBattingLine {
  atBats: number;
  runs: number;
  hits: number;
  doubles: number;
  triples: number;
  homeRuns: number;
  rbi: number;
  walks: number;
  strikeouts: number;
  stolenBases: number;
}

export interface BaseballPitchingLine {
  inningsPitched: number;  // Stored as decimal (6.2 = 6 and 2/3)
  hits: number;
  runs: number;
  earnedRuns: number;
  walks: number;
  strikeouts: number;
  homeRuns: number;
  pitchCount: number;
  decision?: 'W' | 'L' | 'S' | 'H';  // Win/Loss/Save/Hold
}
```

---

## AI Decision Modules

### 1. Lineup Construction (src/ai/baseball/lineup.ts)

```typescript
export function constructBattingOrder(
  roster: Player[],
  opponent: { startingPitcher: Player },
  context: { gameImportance: number }
): string[] {
  // 1. Calculate batting composite for each player
  // 2. Consider platoon advantage vs opposing pitcher
  // 3. Order by role:
  //    - Leadoff (1): High OBP, speed
  //    - 2-hole: Contact, some speed
  //    - 3-hole: Best overall hitter
  //    - Cleanup (4): Power
  //    - 5-6: Power/RBI
  //    - 7-8: Defense-first players
  //    - 9: Weakest hitter (or pitcher if no DH)
  // 4. Balance L/R to avoid platoon disadvantages

  return lineup; // Array of 9 player IDs
}

export function assignDefensivePositions(
  roster: Player[],
  lineup: string[]
): Record<string, BaseballPosition> {
  // For each lineup spot, assign best available position
  // based on BASEBALL_POSITION_WEIGHTS suitability scores
}
```

### 2. Pitcher Selection (src/ai/baseball/pitching.ts)

```typescript
export function selectStartingPitcher(
  roster: Player[],
  recentStarts: Record<string, number>,  // playerId -> days since last start
  context: { gameImportance: number }
): string {
  // 1. Filter to players with high pitcher suitability
  // 2. Exclude anyone who started in last 4 days
  // 3. Weight by: pitcher composite, rest days, game importance
  // 4. Return best available starter
}

export function selectReliefPitcher(
  bullpen: Player[],
  situation: 'setup' | 'closer' | 'long_relief' | 'mop_up',
  pitchCounts: Record<string, number>  // Recent usage
): string {
  // Match pitcher attributes to situation needs
  // - Closer: High composure, velocity
  // - Setup: Balanced
  // - Long relief: High stamina
  // - Mop up: Whoever is available
}
```

### 3. In-Game Strategy (src/ai/baseball/strategy.ts)

```typescript
export function shouldAttemptSteal(
  runner: Player,
  pitcher: Player,
  catcher: Player,
  base: 1 | 2,
  outs: number,
  scoreDiff: number,
  settings: BaseballTacticalSettings
): boolean {
  // Calculate steal success probability
  // Weight by game situation (don't steal when ahead big)
  // Apply team's stealFrequency setting
}

export function shouldBunt(
  batter: Player,
  runners: BaseState,
  outs: number,
  inning: number,
  scoreDiff: number,
  settings: BaseballTacticalSettings
): boolean {
  // Sac bunt situations: runner on 1st/2nd, 0 outs, close game
  // Weight by batter's bunting ability (form_technique, patience)
  // Apply team's sacrificeBuntFrequency setting
}
```

---

## Substitution & Bullpen Management

### BaseballSubstitutionManager (src/simulation/baseball/systems/substitutions.ts)

```typescript
export class BaseballSubstitutionManager {
  private bullpen: Player[];
  private bullpenUsage: Map<string, number>;  // playerId -> pitches thrown today

  constructor(bullpen: Player[]) {
    this.bullpen = bullpen;
    this.bullpenUsage = new Map();
  }

  public shouldSubstitutePitcher(
    currentPitcher: Player,
    pitchCount: number,
    inning: number,
    outs: number,
    score: { home: number; away: number },
    isHome: boolean,
    settings: BaseballTacticalSettings
  ): boolean {
    // Automatic triggers:
    // - Pitch count > 100
    // - Pitch count > 90 and degradation > 20%
    // - Blowout (ahead/behind by 8+) in late innings

    // Strategic triggers:
    // - Closer situation (9th, leading by 1-3, aggressive bullpen)
    // - Setup situation (8th, leading by 1-3)
    // - Matchup (platoon disadvantage vs key hitter)

    // Conservative: Only mandatory triggers
    // Standard: + strategic triggers
    // Aggressive: Lower thresholds for all triggers
  }

  public selectReliefPitcher(
    situation: 'closer' | 'setup' | 'middle' | 'long' | 'mop_up'
  ): Player | null {
    // Filter available relievers (not used today or low usage)
    // Score by situation fit
    // Return best available or null if bullpen exhausted
  }

  public recordPitcherUsage(playerId: string, pitches: number): void {
    const current = this.bullpenUsage.get(playerId) || 0;
    this.bullpenUsage.set(playerId, current + pitches);
  }
}
```

---

## Attribute Weight Tables

### Batting Weights

```typescript
// Contact ability - making contact with the ball
WEIGHTS_BATTING_CONTACT = {
  hand_eye_coordination: 0.30,  // Primary - timing and tracking
  form_technique: 0.15,         // Swing mechanics (critical for contact)
  reactions: 0.15,              // Quick adjustments
  composure: 0.15,              // Pressure situations
  patience: 0.10,               // Pitch selection (discipline, not contact)
  consistency: 0.10,            // Reliable contact
  awareness: 0.05,              // Reading pitches
}

// Power - extra base hit potential
WEIGHTS_BATTING_POWER = {
  core_strength: 0.35,          // Primary - rotational power from hips/core
  arm_strength: 0.15,           // Bat speed contribution
  grip_strength: 0.15,          // Bat control through zone
  form_technique: 0.15,         // Swing mechanics
  balance: 0.10,                // Weight transfer
  height: 0.10,                 // Leverage
}

// Plate discipline - working counts, drawing walks
WEIGHTS_PLATE_DISCIPLINE = {
  patience: 0.35,               // Primary - waiting for pitch
  awareness: 0.25,              // Strike zone recognition
  composure: 0.20,              // Not chasing
  consistency: 0.10,            // Reliable approach
  determination: 0.10,          // Working counts
}
```

### Pitching Weights

```typescript
// Velocity - fastball effectiveness
WEIGHTS_PITCHING_VELOCITY = {
  arm_strength: 0.30,           // Raw power
  core_strength: 0.20,          // Rotational force
  acceleration: 0.15,           // Quick-twitch arm speed
  stamina: 0.15,                // Maintaining velocity
  form_technique: 0.10,         // Efficient mechanics
  balance: 0.10,                // Delivery consistency
}

// Control - throwing strikes, locating pitches
WEIGHTS_PITCHING_CONTROL = {
  throw_accuracy: 0.30,         // Primary - precision
  composure: 0.20,              // Pressure situations
  consistency: 0.20,            // Repeatable delivery
  form_technique: 0.15,         // Mechanics
  hand_eye_coordination: 0.10,  // Feel
  patience: 0.05,               // Not rushing
}

// Movement - pitch deception, break
WEIGHTS_PITCHING_MOVEMENT = {
  deception: 0.30,              // Primary - hiding pitch
  finesse: 0.25,                // Touch on breaking balls
  hand_eye_coordination: 0.20,  // Release point control
  creativity: 0.15,             // Pitch mix unpredictability
  form_technique: 0.10,         // Delivery variance
}

// Stamina - pitching deep into games
WEIGHTS_PITCHER_STAMINA = {
  stamina: 0.50,                // Primary
  durability: 0.25,             // Arm health
  determination: 0.15,          // Mental toughness
  composure: 0.10,              // Not tiring mentally
}
```

### Fielding Weights

```typescript
// Infield defense (SS, 2B, 3B)
WEIGHTS_FIELDING_INFIELD = {
  reactions: 0.25,              // Quick first step
  agility: 0.20,                // Lateral movement
  throw_accuracy: 0.20,         // Turning plays
  arm_strength: 0.15,           // Strong throws
  hand_eye_coordination: 0.10,  // Glove work
  awareness: 0.10,              // Positioning
}

// Outfield defense
WEIGHTS_FIELDING_OUTFIELD = {
  top_speed: 0.25,              // Range
  acceleration: 0.20,           // Getting jump
  arm_strength: 0.20,           // Throwing distance
  awareness: 0.15,              // Reading balls
  reactions: 0.10,              // Line drives
  jumping: 0.10,                // Wall catches
}

// First base
WEIGHTS_FIELDING_FIRST = {
  height: 0.25,                 // Stretch for throws
  hand_eye_coordination: 0.25,  // Catching throws
  reactions: 0.20,              // Quick scoops
  footwork: 0.15,               // Bag work
  agility: 0.15,                // Moving to bag
}

// Catcher
WEIGHTS_FIELDING_CATCHER = {
  throw_accuracy: 0.25,         // Throwing out runners
  arm_strength: 0.20,           // Pop time
  reactions: 0.20,              // Blocking
  durability: 0.15,             // Position demands
  awareness: 0.10,              // Game calling
  composure: 0.10,              // Managing pitchers
}
```

### Baserunning Weights

```typescript
// Stolen base ability
WEIGHTS_STEALING = {
  acceleration: 0.30,           // Primary - first step
  top_speed: 0.25,              // Raw speed
  reactions: 0.20,              // Jump timing
  awareness: 0.15,              // Reading pitcher tendencies
  bravery: 0.10,                // Willingness to go
}

// Taking extra bases
WEIGHTS_BASERUNNING_AGGRESSION = {
  top_speed: 0.25,              // Raw speed
  awareness: 0.25,              // Reading play
  bravery: 0.20,                // Willingness to take risk
  acceleration: 0.15,           // Bursts
  determination: 0.15,          // Hustle
}
```

---

## Base Rates (Tuned for Realism)

```typescript
// At-bat outcomes (before attribute modifiers)
BASE_RATE_STRIKEOUT = 0.22        // MLB average ~22%
BASE_RATE_WALK = 0.08             // MLB average ~8%
BASE_RATE_HIT_BY_PITCH = 0.01     // ~1%
BASE_RATE_CONTACT = 0.69          // When not K/BB/HBP

// Hit distribution (when contact is made, ball in play)
BASE_RATE_SINGLE = 0.65           // Most hits are singles
BASE_RATE_DOUBLE = 0.20           // ~20% doubles
BASE_RATE_TRIPLE = 0.02           // Rare
BASE_RATE_HOME_RUN = 0.13         // ~13% (power-dependent)

// Out distribution (when contact results in out)
BASE_RATE_GROUNDOUT = 0.45        // Ground balls
BASE_RATE_FLYOUT = 0.35           // Fly balls
BASE_RATE_LINEOUT = 0.15          // Line drives to fielders
BASE_RATE_POPUP = 0.05            // Infield popups

// Fielding
BASE_RATE_ERROR = 0.02            // ~2% error rate
BASE_RATE_DOUBLE_PLAY = 0.10      // With runner on 1st, <2 outs

// Baserunning
BASE_RATE_STEAL_SUCCESS = 0.70    // Base steal success
BASE_RATE_CAUGHT_STEALING = 0.30  // Caught stealing

// Situational
BASE_RATE_WILD_PITCH = 0.02       // Advances runners
BASE_RATE_PASSED_BALL = 0.01      // Catcher error on pitch
BASE_RATE_SAC_FLY_SUCCESS = 0.85  // Runner scores on fly out from 3rd
BASE_RATE_SAC_BUNT_SUCCESS = 0.80 // Successful sacrifice bunt

// Sigmoid tuning
SIGMOID_K = 0.02                  // Slightly lower than basketball (0.025)
                                  // Baseball has more variance
```

---

## Platoon Advantage System

```typescript
// Left-handed batter vs Right-handed pitcher (and vice versa) = advantage
PLATOON_ADVANTAGE_MODIFIER = 0.05  // +5% to contact/power for favorable matchup

// Apply when:
// - LHB vs RHP: Batter gets +5% contact/power composite
// - RHB vs LHP: Batter gets +5% contact/power composite
// - Same hand (LHB vs LHP, RHB vs RHP): No modifier
// - Switch hitter: Always favorable (uses opposite hand)
```

---

## Clutch Situations

```typescript
// High-leverage situations (7th inning+, within 2 runs)
CLUTCH_SITUATION_THRESHOLD = {
  minInning: 7,
  maxRunDifferential: 2,
}

// In clutch situations, composure weight increases by 50%
// Applied to both batters and pitchers
// Favors mentally strong players in big moments
```

---

## Pitcher Fatigue Model

Uses pitch count with exponential degradation (similar to basketball stamina):

```typescript
PITCH_COUNT_THRESHOLD = 80        // Degradation starts after 80 pitches
DEGRADATION_RATE = 0.005          // 0.5% per pitch over threshold
MAX_DEGRADATION = 0.30            // 30% cap on attribute reduction

// Example: At 100 pitches
// pitchesOver = 100 - 80 = 20
// degradation = min(20 * 0.005, 0.30) = 0.10 (10%)
// All pitcher composites reduced by 10%
```

Individual pitcher stamina composite affects degradation rate:
- High stamina pitcher: degradation_rate * 0.7
- Low stamina pitcher: degradation_rate * 1.3

---

## At-Bat Simulation Flow

```
1. Get pitcher composite (velocity + control + movement)
2. Get batter composite (contact + discipline)
3. Apply platoon modifier if applicable
4. Apply clutch modifier if applicable (7th+, close game)
5. Apply pitcher fatigue degradation
6. Check for strikeout (velocity+movement vs contact)
   - Uses: weightedSigmoidProbability(BASE_RATE_STRIKEOUT, pitcherDiff, SIGMOID_K)
7. Check for walk (discipline vs control)
   - Uses: weightedSigmoidProbability(BASE_RATE_WALK, disciplineDiff, SIGMOID_K)
8. Check for hit-by-pitch (rare, control-based)
9. Ball in play - determine contact quality
   - Contact composite vs pitcher composite
10. Determine hit type
    - Power composite affects HR/XBH rates
    - Uses: weighted random selection based on power
11. If out, determine out type
    - Ground/fly based on batter tendencies
    - Check for infield fly rule (runners on 1st/2nd or loaded, <2 outs, popup)
12. Check for error
    - Fielder composite affects error rate
13. Handle baserunners
    - Advancement based on hit type + runner speed
    - Sac fly: Runner on 3rd scores on fly out with <2 outs
    - Tag-up: Runners can advance on caught fly balls
    - Double play: Check with runner on 1st, <2 outs, groundout
14. Generate play-by-play text
15. Increment pitcher pitch count
```

---

## Inning Simulation Flow

```
1. Initialize inning state
   - Outs = 0
   - Bases = [empty, empty, empty]
   - Runs this inning = 0

2. While outs < 3:
   a. Get current batter from lineup
   b. Check for steal attempt (AI decision)
   c. Check for bunt attempt (AI decision)
   d. Simulate at-bat
   e. Handle result:
      - Walk/HBP: Advance runners (force), batter to 1st
      - Strikeout: Out++
      - Hit: Place batter, advance runners based on hit type, score runs
      - Groundout: Out++, check GIDP opportunity
      - Flyout: Out++, check sac fly (runner on 3rd, <2 outs)
      - Popup with infield fly: Out++ (runners hold)
   f. Check for tag-up opportunities on fly outs
   g. Update pitcher pitch count
   h. Check pitcher fatigue → substitution decision (BaseballSubstitutionManager)
   i. Advance batter in lineup

3. Return inning result (runs, hits, errors, LOB)
```

---

## Game Simulation Flow

```
1. Initialize game state
   - Home/Away lineups (from AI or tactical settings)
   - Starting pitchers (from AI or tactical settings)
   - Score = [0, 0]
   - Initialize BaseballSubstitutionManager for each team

2. For innings 1-9 (or until extra innings decided):
   a. Top of inning (Away bats)
      - Simulate half-inning
      - Update away score
   b. Bottom of inning (Home bats)
      - If bottom 9+ and home ahead, skip (walk-off detection)
      - Simulate half-inning
      - Check for walk-off win
      - Update home score
   c. Track pitch counts, fatigue
   d. Handle pitcher substitutions via SubstitutionManager

3. Extra innings if tied after 9
   - NO ghost runner rule (traditional rules for pro sim)
   - Continue until winner determined

4. Accumulate career stats for all players
5. Return GameResult with BaseballBoxScore
```

---

## Test File Structure

```
__tests__/simulation/baseball/
├── batting.test.ts           # Contact/power calculations
├── pitching.test.ts          # Velocity/control/movement
├── atBat.test.ts             # At-bat outcome distribution
├── inning.test.ts            # Inning flow, baserunners
├── game.test.ts              # Full game simulation
├── integration.test.ts       # Season/match integration
└── validation.test.ts        # Stat realism validation

# Key test cases:
- High contact players have higher batting average
- High power players hit more home runs
- High control pitchers walk fewer batters
- Platoon advantage produces ~5% improvement
- Pitcher fatigue degrades performance after 80 pitches
- Full season produces realistic stat distributions
```

### Validation Test Example

```typescript
// __tests__/simulation/baseball/validation.test.ts
describe('Baseball Simulation Realism', () => {
  test('high contact players hit for higher average', () => {
    const highContact = createPlayer({ hand_eye_coordination: 95, form_technique: 90 });
    const lowContact = createPlayer({ hand_eye_coordination: 30, form_technique: 30 });
    const avgPitcher = createPlayer({ /* average attributes */ });

    const highContactResults = simulateAtBats(highContact, avgPitcher, 1000);
    const lowContactResults = simulateAtBats(lowContact, avgPitcher, 1000);

    expect(highContactResults.battingAverage).toBeGreaterThan(0.280);
    expect(lowContactResults.battingAverage).toBeLessThan(0.220);
    expect(highContactResults.battingAverage - lowContactResults.battingAverage).toBeGreaterThan(0.080);
  });

  test('league-wide stats match MLB averages', () => {
    const season = simulateFullSeason(/* 30 teams, 162 games */);

    expect(season.leagueAverage.battingAverage).toBeCloseTo(0.250, 1);
    expect(season.leagueAverage.era).toBeCloseTo(4.00, 0.5);
    expect(season.leagueAverage.strikeoutRate).toBeCloseTo(0.22, 0.02);
  });
});
```

---

## Implementation Phases (Updated)

### Phase B1: Foundation & Integration Setup
1. Add `BASEBALL_POSITIONS` to `src/data/constants.ts`
2. Add `sportMetadata` to Player interface in `src/data/types.ts`
3. Implement `BaseballCareerStats` interface (replace placeholder)
4. Add `BaseballTacticalSettings` interface
5. Create `src/simulation/baseball/` directory structure
6. Define `constants.ts` with all weight tables and base rates
7. Define `types.ts` with baseball-specific interfaces (BoxScore, etc.)

### Phase B2: Core Systems
1. Create `batting.ts` with contact/power/discipline calculations
2. Create `pitching.ts` with velocity/control/movement calculations
3. Create `fielding.ts` with position-specific error rates
4. Create `baserunning.ts` with steal/advancement logic
5. Implement handedness generation function

### Phase B3: At-Bat Engine
1. Implement `atBatSimulation.ts` with full at-bat flow
2. Implement outcome determination (K, BB, hit, out)
3. Add hit type distribution based on power
4. Add out type distribution
5. Add platoon advantage calculations
6. Add clutch situation modifiers

### Phase B4: Game Flow
1. Implement `inningSimulation.ts` with 3-out logic
2. Implement baserunner state management (sac fly, tag-up, GIDP, infield fly)
3. Implement `gameSimulation.ts` with 9-inning flow
4. Add walk-off detection
5. Implement `BaseballSubstitutionManager` for bullpen
6. Add pitcher fatigue model integration

### Phase B5: AI & Play-by-Play
1. Implement `src/ai/baseball/lineup.ts` for batting order
2. Implement `src/ai/baseball/pitching.ts` for pitcher selection
3. Implement `src/ai/baseball/strategy.ts` for in-game decisions
4. Implement `playByPlay.ts` narrative generation
5. Implement box score accumulation

### Phase B6: Integration & Testing
1. Update `matchRunner.ts` to call baseball simulator
2. Create test suite with attribute validation
3. Create validation tests (stat realism)
4. Verify attribute-driven outcomes
5. Integrate career stat accumulation
6. Update sport-specific scout weights in Youth Academy

---

## Design Decisions (Agent-Reviewed)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Pitcher fatigue | Pitch count + exponential degradation | Matches basketball pattern, realistic |
| Defensive positioning | Simple per-position weights | MVP simplicity, add shifts in Phase 2 |
| Pitch-by-pitch vs at-bat | At-bat level | 5-10x faster, easier to validate |
| Lineup requirements | Enforce 9 positions with flexibility | Respects baseball reality + multi-sport |
| DH rule | Always use DH (default true) | Simpler, configurable if needed later |
| Position storage | Constants, not Player type | Maintains multi-sport neutrality |
| Handedness | Sport metadata OR generated from seed | Flexible, backward compatible |
| AI integration | Separate modules in src/ai/baseball/ | Follows existing basketball pattern |

---

## Success Criteria

1. Games produce realistic stat lines (batting ~.250-.300, ERA ~3.00-5.00)
2. Attribute differences create meaningful outcome variance
3. High-power players hit more HRs
4. High-contact players have higher AVG
5. High-control pitchers walk fewer batters
6. Platoon advantage produces ~5% improvement in matchup stats
7. Pitcher fatigue degrades performance after ~80 pitches
8. Play-by-play is readable and engaging
9. Full box score generated per game
10. Career stats accumulate correctly
11. AI constructs reasonable batting orders and pitcher selections
12. Integrates cleanly with existing season/match system
