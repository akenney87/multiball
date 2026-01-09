# SubstitutionManagerV2 - Implementation Plan

## Overview
Create a new, simplified substitution manager that uses the quarterly rotation system based on auto-calculated minutes targets from player overall ratings.

## Key Differences from V1
- **V1**: Complex logic with stamina thresholds, Q4 closers, blowout detection, position matching
- **V2**: Simple quarterly rotation plans, minimal logic, respects dead balls

## Architecture

### New Class: `SubstitutionManagerV2`

**File**: `src/simulation/systems/substitutionsV2.ts`

**Dependencies**:
- Uses existing `calculateMinutesTargets()` and `calculateQuarterlyRotations()` from `substitutions.ts`
- Uses existing `LineupManager` class
- Uses existing `PossessionState.canSubstitute()` for dead ball checking

**Core Data:**
```typescript
class SubstitutionManagerV2 {
  // Rosters with auto-calculated minutes
  private homeRosterWithMinutes: PlayerWithMinutes[];
  private awayRosterWithMinutes: PlayerWithMinutes[];

  // Current quarter rotation plans
  private homeRotationPlans: QuarterlyRotationPlan[];
  private awayRotationPlans: QuarterlyRotationPlan[];

  // Actual minutes tracking
  private actualMinutesHome: Record<string, number>;
  private actualMinutesAway: Record<string, number>;

  // Lineup management
  private homeLineupManager: LineupManager;
  private awayLineupManager: LineupManager;

  // Current quarter
  private currentQuarter: number;

  // Substitution history
  private substitutionEvents: SubstitutionEvent[];
}
```

**Key Methods:**

1. **`constructor(homeRoster, awayRoster)`**
   - Calculate minutes targets for both teams
   - Determine starters (top 5 by minutes target)
   - Initialize lineup managers with starters
   - Initialize actual minutes tracking to 0

2. **`startQuarter(quarter: number)`**
   - Calculate rotation plans for both teams for this quarter
   - Store in homeRotationPlans / awayRotationPlans

3. **`checkAndExecuteSubstitutions(staminaTracker, gameTimeStr, timeRemainingSeconds, quarter)`**
   - Convert timeRemainingSeconds to minutes
   - For home team:
     - Check each rotation plan
     - If timeRemaining ≈ subOutAt → find player on court, sub them out
     - If timeRemaining ≈ subInAt → find player on bench, sub them in
   - For away team: same logic
   - Return substitution events

4. **`updateMinutesPlayed(playerName, minutes, team)`**
   - Add to actualMinutesHome or actualMinutesAway

5. **`getSubstitutionEvents()`**
   - Return history of all subs

6. **`verifyMinutesTargets()`**
   - Check all players actual vs target minutes
   - Return list of players >5 min off target
   - Used at end of game for verification

## Substitution Logic

### Time-Based Substitution Windows
- Use tolerance of ±0.5 minutes for matching rotation times
- Example: If subOutAt = 3.0 minutes, trigger when timeRemaining is between 2.5 and 3.5

### Substitution Execution
```typescript
// For subOut
if (plan.subOutAt && Math.abs(timeRemaining - plan.subOutAt) <= 0.5) {
  const playerOut = activeLineup.find(p => p.name === plan.playerName);
  const playerIn = bench[0]; // Simple: take first bench player

  if (playerOut && playerIn) {
    lineupManager.substitute(playerOut, playerIn);
  }
}

// For subIn
if (plan.subInAt && Math.abs(timeRemaining - plan.subInAt) <= 0.5) {
  const playerIn = bench.find(p => p.name === plan.playerName);
  const playerOut = activeLineup[0]; // Simple: take first active player

  if (playerIn && playerOut) {
    lineupManager.substitute(playerOut, playerIn);
  }
}
```

### Dead Ball Enforcement
- SubstitutionManagerV2 does NOT check `canSubstitute()`
- Responsibility of caller (quarterSimulation.ts)
- Caller only invokes `checkAndExecuteSubstitutions()` when `possessionState.canSubstitute() === true`

## Integration Points

### quarterSimulation.ts Changes

**At start of each quarter:**
```typescript
// Before quarter loop
substitutionManagerV2.startQuarter(quarterNumber);
```

**During quarter (only when dead ball):**
```typescript
if (possessionState.canSubstitute()) {
  const subEvents = substitutionManagerV2.checkAndExecuteSubstitutions(
    staminaTracker,
    currentTime,
    timeRemainingSeconds,
    quarterNumber
  );

  // Log events to play-by-play
  for (const event of subEvents) {
    playByPlayLogger.addSubstitution(...);
  }
}
```

**After each possession:**
```typescript
// Update minutes for active players
const activePlayers = substitutionManagerV2.getActivePlayers(team);
for (const player of activePlayers) {
  substitutionManagerV2.updateMinutesPlayed(
    player.name,
    possessionDurationMinutes,
    team
  );
}
```

**At end of game:**
```typescript
const discrepancies = substitutionManagerV2.verifyMinutesTargets();
if (discrepancies.length > 0) {
  console.warn('Players off minutes targets:', discrepancies);
}
```

## No Conflicts with V1

### Why No Conflicts:
1. **Separate file**: `substitutionsV2.ts` vs `substitutions.ts`
2. **Separate class name**: `SubstitutionManagerV2` vs `SubstitutionManager`
3. **Shared utilities only**: Both use `calculateMinutesTargets()` and `calculateQuarterlyRotations()` (which are exported functions, not class methods)
4. **No shared state**: V2 doesn't reference any V1 class instances
5. **Caller's choice**: `quarterSimulation.ts` can use either V1 or V2 (not both simultaneously)

### Migration Path:
- V1 remains unchanged in `substitutions.ts`
- V2 created in new file `substitutionsV2.ts`
- Tests can use V2
- Production code can switch from V1 to V2 by changing import

## Simplifications in V2

### What's Removed (from V1):
- ❌ Stamina-based emergency substitutions
- ❌ Q4 closer system
- ❌ Blowout detection and garbage time
- ❌ Position matching logic
- ❌ Substitution cooldown tracking
- ❌ Time-on-court tracking
- ❌ Starter replacement mapping

### What's Kept:
- ✅ Minutes target calculation (auto-calculated from overall ratings)
- ✅ Quarterly rotation plans (Q1-Q4 with specific sub times)
- ✅ Dead ball respect (via caller checking `canSubstitute()`)
- ✅ Actual minutes tracking
- ✅ Substitution event logging

## Testing Strategy

1. **Unit tests**: Test `calculateMinutesTargets()` and `calculateQuarterlyRotations()` in isolation
2. **Integration test**: Full game simulation with V2
3. **Verification**: Check all players within ±5 min of targets
4. **Comparison**: Run same game with V1 and V2, compare results

## Success Criteria

✅ All players get within ±5 minutes of their calculated targets
✅ Substitutions only occur during legal dead balls
✅ No TypeScript compilation errors
✅ Game simulation completes without crashes
✅ Play-by-play shows clear substitution timing
