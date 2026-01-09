# SubstitutionManagerV2 - REVISED Implementation Plan

## Overview
Create a simplified substitution manager focused on **hitting minutes targets** using quarterly rotation system. Priority is starters' minutes accuracy, not perfect player matching.

## Core Philosophy
- **Priority 1**: Starters hit their minutes targets (±2 min)
- **Priority 2**: Bench players get close to their targets (±5 min)
- **Simplicity**: Don't worry about position matching or specific player-to-player subs
- **User override**: Imperfect default lineups incentivize manual minutes allocation

## Key Changes from Original V2 Plan

### ✅ FIXED: Substitution Logic
**OLD (BROKEN):**
```typescript
const playerIn = bench[0]; // Wrong: first bench player regardless of who should come in
```

**NEW (MINUTES-FOCUSED):**
```typescript
// When subbing OUT a player who hit their quota
// Find the bench player who needs the MOST minutes
const playerIn = bench
  .filter(p => {
    const plan = rotationPlans.find(rp => rp.playerName === p.name);
    return plan && plan.minutesNeeded > 0;
  })
  .sort((a, b) => {
    const planA = rotationPlans.find(rp => rp.playerName === a.name)!;
    const planB = rotationPlans.find(rp => rp.playerName === b.name)!;
    return planB.minutesNeeded - planA.minutesNeeded; // Most minutes needed first
  })[0];
```

**Logic:** Substitute based on **minutes deficit**, not player identity.

### ✅ ADDED: Deduplication Mechanism
```typescript
private lastCheckTime: number = -1;
private subsExecutedThisCheck: Set<string> = new Set();

checkAndExecuteSubstitutions(...) {
  const currentTime = timeRemainingSeconds / 60.0;

  // Reset if this is a new time window (>6 seconds since last check)
  if (Math.abs(currentTime - this.lastCheckTime) > 0.1) {
    this.subsExecutedThisCheck.clear();
    this.lastCheckTime = currentTime;
  }

  // Skip players already processed this cycle
  for (const plan of rotationPlans) {
    if (this.subsExecutedThisCheck.has(plan.playerName)) continue;

    // ... execute substitution ...

    this.subsExecutedThisCheck.add(plan.playerName);
  }
}
```

### ✅ ADDED: Missing Public Methods
```typescript
class SubstitutionManagerV2 {
  // Expose active lineups
  getHomeActive(): Player[] {
    return this.homeLineupManager.getActivePlayers();
  }

  getAwayActive(): Player[] {
    return this.awayLineupManager.getActivePlayers();
  }

  // Expose benches
  getHomeBench(): Player[] {
    return this.homeLineupManager.getBenchPlayers();
  }

  getAwayBench(): Player[] {
    return this.awayLineupManager.getBenchPlayers();
  }

  // Handle foul-outs
  handleFoulOut(playerName: string, team: 'home' | 'away', currentTime: string): SubstitutionEvent | null {
    // Redistribute this player's remaining minutes
    this.redistributeMinutes(playerName, team);

    // Execute immediate substitution
    return this.forceSubstitution(playerName, team, currentTime, 'fouled_out');
  }

  // Handle injuries
  handleInjury(playerName: string, team: 'home' | 'away', currentTime: string): SubstitutionEvent | null {
    // Redistribute this player's remaining minutes
    this.redistributeMinutes(playerName, team);

    // Execute immediate substitution
    return this.forceSubstitution(playerName, team, currentTime, 'injury');
  }

  // Match V1 method name
  addMinutesPlayed(playerName: string, minutes: number, team: 'home' | 'away'): void {
    if (team === 'home') {
      this.actualMinutesHome[playerName] = (this.actualMinutesHome[playerName] || 0) + minutes;
    } else {
      this.actualMinutesAway[playerName] = (this.actualMinutesAway[playerName] || 0) + minutes;
    }
  }

  // No-op for compatibility with V1 interface
  updateTimeOnCourt(staminaTracker: any, durationSeconds: number): void {
    // V2 doesn't track continuous time on court, only total minutes
    // This method exists for interface compatibility only
  }
}
```

### ✅ ADDED: Minute Redistribution for Foul-Outs/Injuries
```typescript
private redistributeMinutes(playerName: string, team: 'home' | 'away'): void {
  const roster = team === 'home' ? this.homeRosterWithMinutes : this.awayRosterWithMinutes;
  const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

  // Find the player's remaining minutes
  const player = roster.find(p => p.name === playerName);
  if (!player) return;

  const played = actualMinutes[playerName] || 0;
  const remaining = Math.max(0, player.minutesTarget - played);

  if (remaining === 0) return;

  // Redistribute using weighted formula
  const eligiblePlayers = roster.filter(p => p.name !== playerName);
  const minOverall = Math.min(...eligiblePlayers.map(p =>
    Object.values(p.attributes).reduce((a, b) => a + b, 0) / 25
  ));

  // Calculate weights
  const playersWithWeights = eligiblePlayers.map(p => {
    const overall = Object.values(p.attributes).reduce((a, b) => a + b, 0) / 25;
    return {
      player: p,
      weight: Math.pow(overall - minOverall + 1, 1.6)
    };
  });

  const totalWeight = playersWithWeights.reduce((sum, p) => sum + p.weight, 0);

  // Add redistributed minutes to each player's target
  for (const pw of playersWithWeights) {
    const additionalMinutes = remaining * (pw.weight / totalWeight);
    pw.player.minutesTarget += additionalMinutes;

    // Recalculate quarter target
    pw.player.quarterTarget = pw.player.minutesTarget / 4;
  }

  // Mark player as unavailable
  player.minutesTarget = played; // Their new target is what they've already played
  player.quarterTarget = 0;
}
```

### ✅ ADDED: Safety Checks
```typescript
private executeSubstitution(
  playerOut: Player,
  playerIn: Player,
  lineupManager: LineupManager,
  team: 'home' | 'away',
  currentTime: string,
  reason: string
): SubstitutionEvent | null {
  // Safety check: playerOut must be on court
  const active = lineupManager.getActivePlayers();
  if (!active.find(p => p.name === playerOut.name)) {
    console.warn(`[SUB V2] Cannot sub out ${playerOut.name} - not on court`);
    return null;
  }

  // Safety check: playerIn must be on bench
  const bench = lineupManager.getBenchPlayers();
  if (!bench.find(p => p.name === playerIn.name)) {
    console.warn(`[SUB V2] Cannot sub in ${playerIn.name} - not on bench`);
    return null;
  }

  // Execute substitution
  const success = lineupManager.substitute(playerOut, playerIn);

  if (!success) {
    console.warn(`[SUB V2] Substitution failed: ${playerOut.name} OUT, ${playerIn.name} IN`);
    return null;
  }

  // Create event
  return {
    quarterTime: currentTime,
    playerOut: playerOut.name,
    playerIn: playerIn.name,
    reason: reason as any,
    staminaOut: 0, // V2 doesn't track stamina
    staminaIn: 0,
    team
  };
}
```

### ✅ ADDED: Emergency Substitutions
```typescript
private checkEmergencySubstitutions(
  lineupManager: LineupManager,
  roster: Player[],
  staminaTracker: StaminaTracker,
  team: 'home' | 'away',
  currentTime: string
): SubstitutionEvent[] {
  const events: SubstitutionEvent[] = [];
  const active = lineupManager.getActivePlayers();
  const bench = lineupManager.getBenchPlayers();

  if (bench.length === 0) return events; // No bench available

  for (const player of active) {
    const stamina = staminaTracker.getCurrentStamina(player.name);

    // Emergency: stamina critically low
    if (stamina < 30) {
      // Find any available bench player
      const sub = bench[0];
      if (sub) {
        const event = this.executeSubstitution(
          player,
          sub,
          lineupManager,
          team,
          currentTime,
          'stamina'
        );
        if (event) events.push(event);
      }
    }
  }

  return events;
}
```

### ✅ IMPROVED: Substitution Execution Flow
```typescript
checkAndExecuteSubstitutions(
  staminaTracker: StaminaTracker,
  gameTimeStr: string,
  timeRemainingSeconds: number,
  quarterNumber: number
): SubstitutionEvent[] {
  const events: SubstitutionEvent[] = [];
  const timeRemaining = timeRemainingSeconds / 60.0;

  // Check for deduplication
  if (Math.abs(timeRemaining - this.lastCheckTime) > 0.1) {
    this.subsExecutedThisCheck.clear();
    this.lastCheckTime = timeRemaining;
  }

  // Emergency subs first (stamina < 30)
  events.push(...this.checkEmergencySubstitutions(
    this.homeLineupManager,
    this.homeRoster,
    staminaTracker,
    'home',
    gameTimeStr
  ));

  events.push(...this.checkEmergencySubstitutions(
    this.awayLineupManager,
    this.awayRoster,
    staminaTracker,
    'away',
    gameTimeStr
  ));

  // Rotation-based subs (check rotation plans)
  events.push(...this.checkTeamRotations(
    this.homeLineupManager,
    this.homeRotationPlans,
    this.homeRoster,
    'home',
    timeRemaining,
    gameTimeStr
  ));

  events.push(...this.checkTeamRotations(
    this.awayLineupManager,
    this.awayRotationPlans,
    this.awayRoster,
    'away',
    timeRemaining,
    gameTimeStr
  ));

  // Store events
  this.substitutionEvents.push(...events);

  return events;
}

private checkTeamRotations(
  lineupManager: LineupManager,
  rotationPlans: QuarterlyRotationPlan[],
  roster: Player[],
  team: 'home' | 'away',
  timeRemaining: number,
  currentTime: string
): SubstitutionEvent[] {
  const events: SubstitutionEvent[] = [];
  const active = lineupManager.getActivePlayers();
  const bench = lineupManager.getBenchPlayers();
  const actualMinutes = team === 'home' ? this.actualMinutesHome : this.actualMinutesAway;

  // PHASE 1: Sub OUT players who have hit their quota
  for (const player of active) {
    if (this.subsExecutedThisCheck.has(player.name)) continue;

    const plan = rotationPlans.find(p => p.playerName === player.name);
    if (!plan) continue;

    const played = actualMinutes[player.name] || 0;
    const playerWithMinutes = roster.find(p => p.name === player.name) as any;
    const target = playerWithMinutes?.minutesTarget || 0;

    // Check if player should be subbed out
    const shouldSubOut = (
      (plan.subOutAt && Math.abs(timeRemaining - plan.subOutAt) <= 0.1) ||
      (played >= target - 0.5) // Within 30 seconds of target
    );

    if (shouldSubOut && bench.length > 0) {
      // Find bench player who needs most minutes
      const playerIn = this.findBenchPlayerNeedingMinutes(bench, rotationPlans, actualMinutes, roster);

      if (playerIn) {
        const event = this.executeSubstitution(player, playerIn, lineupManager, team, currentTime, 'minutes');
        if (event) {
          events.push(event);
          this.subsExecutedThisCheck.add(player.name);
          this.subsExecutedThisCheck.add(playerIn.name);
        }
      }
    }
  }

  // PHASE 2: Sub IN players who need minutes (if bench has someone on schedule)
  for (const plan of rotationPlans) {
    if (this.subsExecutedThisCheck.has(plan.playerName)) continue;

    // Check if this player should sub in
    if (plan.subInAt && Math.abs(timeRemaining - plan.subInAt) <= 0.1) {
      const playerIn = bench.find(p => p.name === plan.playerName);
      if (playerIn && active.length > 0) {
        // Find active player who has played most (relative to target)
        const playerOut = this.findActivePlayerToRest(active, actualMinutes, roster);

        if (playerOut) {
          const event = this.executeSubstitution(playerOut, playerIn, lineupManager, team, currentTime, 'minutes');
          if (event) {
            events.push(event);
            this.subsExecutedThisCheck.add(playerOut.name);
            this.subsExecutedThisCheck.add(playerIn.name);
          }
        }
      }
    }
  }

  return events;
}

private findBenchPlayerNeedingMinutes(
  bench: Player[],
  rotationPlans: QuarterlyRotationPlan[],
  actualMinutes: Record<string, number>,
  roster: Player[]
): Player | null {
  if (bench.length === 0) return null;

  // Find bench player with biggest minutes deficit
  const benchWithDeficit = bench
    .map(p => {
      const played = actualMinutes[p.name] || 0;
      const playerWithMinutes = roster.find(rp => rp.name === p.name) as any;
      const target = playerWithMinutes?.minutesTarget || 0;
      const deficit = target - played;
      return { player: p, deficit };
    })
    .filter(pd => pd.deficit > 0)
    .sort((a, b) => b.deficit - a.deficit); // Biggest deficit first

  return benchWithDeficit.length > 0 ? benchWithDeficit[0].player : bench[0];
}

private findActivePlayerToRest(
  active: Player[],
  actualMinutes: Record<string, number>,
  roster: Player[]
): Player | null {
  if (active.length === 0) return null;

  // Find active player who has played most (relative to target)
  const activeWithRatio = active
    .map(p => {
      const played = actualMinutes[p.name] || 0;
      const playerWithMinutes = roster.find(rp => rp.name === p.name) as any;
      const target = playerWithMinutes?.minutesTarget || 1; // Avoid division by zero
      const ratio = played / target;
      return { player: p, ratio };
    })
    .sort((a, b) => b.ratio - a.ratio); // Highest ratio first (played most relative to target)

  return activeWithRatio[0].player;
}
```

## Complete Class Structure

```typescript
export class SubstitutionManagerV2 {
  // Core data
  private homeRoster: Player[];
  private awayRoster: Player[];
  private homeRosterWithMinutes: PlayerWithMinutes[];
  private awayRosterWithMinutes: PlayerWithMinutes[];

  // Rotation plans
  private homeRotationPlans: QuarterlyRotationPlan[];
  private awayRotationPlans: QuarterlyRotationPlan[];
  private currentQuarter: number;

  // Minutes tracking
  private actualMinutesHome: Record<string, number>;
  private actualMinutesAway: Record<string, number>;

  // Lineup management
  private homeLineupManager: LineupManager;
  private awayLineupManager: LineupManager;

  // Deduplication
  private lastCheckTime: number;
  private subsExecutedThisCheck: Set<string>;

  // Event history
  private substitutionEvents: SubstitutionEvent[];

  constructor(homeRoster, awayRoster, homeStartingLineup?, awayStartingLineup?)
  startQuarter(quarter: number): void
  checkAndExecuteSubstitutions(...): SubstitutionEvent[]
  addMinutesPlayed(playerName, minutes, team): void

  // Public accessors
  getHomeActive(): Player[]
  getAwayActive(): Player[]
  getHomeBench(): Player[]
  getAwayBench(): Player[]
  getSubstitutionEvents(): SubstitutionEvent[]

  // Emergency handling
  handleFoulOut(playerName, team, currentTime): SubstitutionEvent | null
  handleInjury(playerName, team, currentTime): SubstitutionEvent | null

  // Compatibility no-op
  updateTimeOnCourt(staminaTracker, durationSeconds): void

  // Verification
  verifyMinutesTargets(): Array<{player: string, actual: number, target: number, diff: number}>

  // Private helpers
  private checkTeamRotations(...): SubstitutionEvent[]
  private checkEmergencySubstitutions(...): SubstitutionEvent[]
  private executeSubstitution(...): SubstitutionEvent | null
  private redistributeMinutes(playerName, team): void
  private findBenchPlayerNeedingMinutes(...): Player | null
  private findActivePlayerToRest(...): Player | null
  private forceSubstitution(...): SubstitutionEvent | null
}
```

## Integration with quarterSimulation.ts

**Minimal changes required:**

```typescript
// At start of quarter
substitutionManager.startQuarter(quarterNumber);

// During quarter (only when dead ball allowed)
if (possessionState.canSubstitute()) {
  const subEvents = substitutionManager.checkAndExecuteSubstitutions(
    staminaTracker,
    currentTime,
    timeRemainingSeconds,
    quarterNumber
  );

  // Log to play-by-play
  for (const event of subEvents) {
    playByPlayLogger.addSubstitution(...);
  }
}

// After possession (update minutes)
const activePlayers = [
  ...substitutionManager.getHomeActive(),
  ...substitutionManager.getAwayActive()
];

for (const player of activePlayers) {
  const team = homeRoster.find(p => p.name === player.name) ? 'home' : 'away';
  substitutionManager.addMinutesPlayed(player.name, possessionDuration, team);
}

// Handle foul-out
if (playerFouledOut) {
  const subEvent = substitutionManager.handleFoulOut(playerName, team, currentTime);
  if (subEvent) playByPlayLogger.addSubstitution(...);
}

// End of game verification
const discrepancies = substitutionManager.verifyMinutesTargets();
```

## Success Criteria

✅ Starters within ±2 minutes of target
✅ Bench players within ±5 minutes of target
✅ No duplicate substitutions
✅ No crashes (empty bench, etc.)
✅ Foul-outs/injuries handled properly
✅ Compatible with existing quarterSimulation.ts interface
✅ Only substitutes during legal dead balls (enforced by caller)

## Addresses All Agent Feedback

| Issue | Status | Solution |
|-------|--------|----------|
| Broken substitution logic | ✅ FIXED | Minutes-deficit based matching |
| No deduplication | ✅ FIXED | Time-window + Set tracking |
| Missing methods | ✅ FIXED | All V1 methods added |
| Edge cases | ✅ FIXED | Empty bench checks, safety validations |
| Safety issues | ✅ FIXED | Internal checks before subbing |
| Tolerance too wide | ✅ FIXED | ±0.1 min (6 seconds) |
| No starters tracking | ✅ FIXED | Starters determined in constructor |
| Minute redistribution | ✅ ADDED | Weighted formula for foul-outs/injuries |
| Emergency subs | ✅ ADDED | Stamina < 30 = immediate sub |
| Method name mismatch | ✅ FIXED | `addMinutesPlayed` matches V1 |

## Philosophy Alignment

✅ **User Priority**: Starters' minutes accuracy > perfect player matching
✅ **Simplicity**: No position matching (4 guards is fine, incentivizes manual override)
✅ **Flexibility**: User can override with manual minutes allocation
✅ **Robustness**: Handles edge cases gracefully
