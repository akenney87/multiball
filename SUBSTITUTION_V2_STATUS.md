# SubstitutionManagerV2 - Implementation Status

**Date**: 2025-11-19
**Status**: ✅ Plan Approved - Ready for Implementation

---

## Current Status

### ✅ Completed Tasks

1. **Minutes Target Calculation** - Implemented `calculateMinutesTargets()` in `substitutions.ts`
   - Weighted formula with 1.6 exponent
   - 42-minute ceiling with proportional redistribution
   - Returns `PlayerWithMinutes[]` with `minutesTarget` and `quarterTarget`

2. **Quarterly Rotation Planning** - Implemented `calculateQuarterlyRotations()` in `substitutions.ts`
   - Q1-Q4 rotation logic
   - Calculates `subOutAt` and `subInAt` times per player
   - Adjusts Q4 based on actual minutes played in Q1-Q3

3. **Dead Ball Enforcement** - Verified existing implementation in `possessionState.ts`
   - `canSubstitute()` method correctly enforces dead ball rules
   - Only allows subs during: FOUL, VIOLATION, TIMEOUT, QUARTER_END
   - NOT during: MADE_BASKET, MADE_FREE_THROW, MISSED_FINAL_FT

4. **Revised Plan Created** - `SUBSTITUTION_V2_REVISED_PLAN.md`
   - Addresses all 14 critical issues from agent review
   - Minutes-deficit based substitution matching
   - Deduplication mechanism (time-window + Set)
   - Complete public API matching V1 interface
   - Minute redistribution for foul-outs/injuries
   - Emergency substitutions (stamina < 30)
   - Safety checks and edge case handling

5. **Agent Approval** - Plan reviewed and approved by basketball-sim-pm agent
   - All 14 issues adequately addressed
   - Minutes-deficit approach aligns with goals
   - Minor documentation concerns already resolved
   - **Recommendation: Proceed with implementation immediately**

---

## User Priorities (From Feedback)

1. **Priority 1**: Starters hit their minutes targets (±2 min accuracy)
2. **Priority 2**: Bench players get close to targets (±5 min accuracy)
3. **Simplicity**: Don't worry about position matching (4 guards is acceptable)
4. **Flexibility**: Imperfect default lineups incentivize user to manually override
5. **Robustness**: Handle edge cases (foul-outs, injuries, empty bench, stamina)

---

## Upcoming Implementation

### Task: Create SubstitutionManagerV2 Class

**File**: `src/simulation/systems/substitutionsV2.ts`

**Class Structure**:
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

  // Public methods (V1-compatible interface)
  constructor(homeRoster, awayRoster, homeStartingLineup?, awayStartingLineup?)
  startQuarter(quarter: number): void
  checkAndExecuteSubstitutions(...): SubstitutionEvent[]
  addMinutesPlayed(playerName, minutes, team): void
  getHomeActive(): Player[]
  getAwayActive(): Player[]
  getHomeBench(): Player[]
  getAwayBench(): Player[]
  getSubstitutionEvents(): SubstitutionEvent[]
  handleFoulOut(playerName, team, currentTime): SubstitutionEvent | null
  handleInjury(playerName, team, currentTime): SubstitutionEvent | null
  updateTimeOnCourt(staminaTracker, durationSeconds): void  // no-op
  verifyMinutesTargets(): Array<{...}>

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

**Key Features**:
1. **Minutes-deficit matching** - Sub in bench player with biggest deficit, sub out active player with highest ratio
2. **Deduplication** - 6-second time window with Set tracking
3. **Emergency subs** - Stamina < 30 triggers immediate substitution
4. **Minute redistribution** - Foul-outs/injuries redistribute remaining minutes using weighted formula
5. **Safety checks** - Validates playerOut on court, playerIn on bench, handles empty bench
6. **Two-phase execution** - Phase 1: sub OUT (quota reached), Phase 2: sub IN (scheduled)

---

## Integration Points

### No Changes to V1
- V1 (`SubstitutionManager` in `substitutions.ts`) remains unchanged
- Shared utilities (`calculateMinutesTargets`, `calculateQuarterlyRotations`) used by both

### Minimal Changes to quarterSimulation.ts
```typescript
// Import V2 instead of V1
import { SubstitutionManagerV2 } from './systems/substitutionsV2';

// Rest of integration remains identical (same method signatures)
```

---

## Success Criteria

✅ Starters within ±2 minutes of target
✅ Bench players within ±5 minutes of target
✅ No duplicate substitutions
✅ No crashes (empty bench, edge cases handled)
✅ Foul-outs/injuries handled with minute redistribution
✅ Compatible with existing quarterSimulation.ts interface
✅ Only substitutes during legal dead balls
✅ TypeScript compiles without errors
✅ Full game simulation completes successfully

---

## Next Steps

1. ✅ Agent approval received
2. ⏳ **IN PROGRESS**: Implement SubstitutionManagerV2 class
3. ⏳ Test with full game simulation
4. ⏳ Verify minutes accuracy (run `verifyMinutesTargets()`)
5. ⏳ Check play-by-play logs for substitution timing
6. ⏳ Validate no duplicate subs in logs

---

## Reference Documents

- `SUBSTITUTION_V2_PLAN.md` - Original plan (14 critical issues identified)
- `SUBSTITUTION_V2_REVISED_PLAN.md` - Approved plan addressing all issues
- `test_new_rotation_system.ts` - Test script for rotation calculations
- `basketball-sim/CLAUDE.md` - Project guidelines
