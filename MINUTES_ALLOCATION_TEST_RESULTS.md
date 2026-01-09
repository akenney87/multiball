# Basketball Minutes Allocation Test Results

## Executive Summary

The basketball minutes allocation system has been tested with comprehensive test scenarios. The tests reveal that **the system is partially working but has accuracy issues** that cause players to receive minutes significantly different from their allocated targets.

## Test Suite Overview

- **Total Tests**: 10 tests created
- **Tests Passed**: 3 tests ✅
- **Tests Failed**: 7 tests ❌
- **Test File**: `src/simulation/__tests__/minutesAllocation.test.ts`

---

## Test Results by Category

### ✅ PASSING TESTS (3/10)

1. **should not overwork players (36 min allocation should not play 48 min)** ✅
   - Players with 36-minute allocations stayed within reasonable bounds
   - No players exceeded maximum game time

2. **should handle edge case: player with 0 minutes allocation must not play** ✅
   - Players allocated 0 minutes correctly did NOT play
   - DNP (Did Not Play) functionality working correctly

3. **should use provided starting lineup at Q1 and Q3** ✅
   - User-specified starting lineups were respected
   - All designated starters played in the game

---

### ❌ FAILING TESTS (7/10)

#### 1. **should respect varying minutes allocation for starters and bench** ❌

**Issue**: Minutes targets are not being accurately met. Players are receiving significantly different minutes than allocated.

**Sample Data**:
```
Player Name                 | Target | Actual | Diff
---------------------------|--------|--------|------
Home_Starter_PG            |     36 |   34.8 |   1.2  ✅ (within tolerance)
Home_Starter_SG            |     34 |   34.8 |   0.8  ✅ (within tolerance)
Home_Starter_SF            |     32 |   34.8 |   2.8  ✅ (within tolerance)
Home_Starter_PF            |     30 |   34.8 |   4.8  ❌ (exceeds ±4 min tolerance)
Home_Starter_C             |     28 |   (varies by run)
Home_Bench_PG              |     24 |   (varies by run)
Home_Bench_SG              |     20 |   (varies by run)
Home_Bench_SF              |     16 |   (varies by run)
Home_Bench_PF              |     12 |   (varies by run)
Home_Bench_C               |      8 |   (varies by run)
Home_DeepBench_G           |      0 |    0.0  ✅ (correct)
Home_DeepBench_F           |      0 |    0.0  ✅ (correct)
```

**Root Cause**: The substitution system appears to be using a quarterly rotation system that doesn't precisely honor user-allocated minutes. Instead, it calculates quarter targets (minutes_target / 4) and substitutes based on those targets, leading to:
- Players getting approximately equal minutes per quarter regardless of total allocation
- Cumulative error over 4 quarters
- Some players playing too much, others too little

**Expected Behavior**:
- All players should play within ±4 minutes of their allocation
- A player allocated 30 minutes should play 26-34 minutes

**Actual Behavior**:
- Some players exceed the ±4 minute tolerance
- Differences as high as 10.8 minutes observed in some test runs

---

#### 2. **should handle allocation where one player gets maximum minutes (42)** ❌

**Issue**: Star players allocated maximum minutes (42) are not receiving close to their target.

**Test Data**:
```
Expected: Star PG to play 38-46 minutes (42 ± 4 tolerance)
Actual: 27.9 minutes
Difference: 14.1 minutes under target ❌
```

**Root Cause**: The rotation system is capping minutes or distributing them too evenly, preventing stars from playing their allocated heavy minutes load.

---

#### 3. **should handle balanced allocation (all 8 rotation players get equal time)** ❌

**Issue**: When allocating equal minutes (30 min each) to 8-man rotation, some players are playing far more than their allocation.

**Test Data**:
```
Expected: All 8 rotation players play 26-34 minutes (30 ± 4 tolerance)
Actual: Some players playing 48.6 minutes ❌
```

**Root Cause**: System is not enforcing the upper bound on minutes. Players are being left in the game too long.

---

#### 4. **should ensure total minutes equals 240 for home team** ❌

**Issue**: Total team minutes do not sum to exactly 240.

**Test Data**:
```
Expected: 240.0 minutes (5 players × 48 min game)
Actual: 242.8 minutes
Difference: +2.8 minutes ❌
```

**Root Cause**: Rounding errors or timing inconsistencies are causing the total to drift above 240. This suggests possessions may not be perfectly aligned with game clock or minutes are being double-counted somewhere.

---

#### 5. **should ensure no single player exceeds 48 minutes** ❌

**Issue**: Some players are exceeding the maximum possible game time.

**Test Data**:
```
Expected: ≤ 48.0 minutes (full game length)
Actual: 48.5 minutes
Difference: +0.5 minutes over game length ❌
```

**Root Cause**: Game clock tracking or minutes accumulation has a bug allowing players to exceed physical game duration. This is impossible in real basketball and indicates a fundamental tracking issue.

---

#### 6. **should auto-calculate minutes when no allocation provided** ❌

**Issue**: Auto-calculated minutes allocation also produces totals that don't sum to 240.

**Test Data**:
```
Expected: 240.0 minutes total
Actual: 242.3 minutes
Difference: +2.3 minutes ❌
```

**Root Cause**: Same as #4 - systematic over-counting of minutes regardless of whether allocation is user-provided or auto-calculated.

---

#### 7. **should distribute minutes evenly across quarters** ❌

**Issue**: Quarter totals are way off from expected ~120 minutes per quarter (60 per team).

**Test Data**:
```
Expected per quarter: 100-140 minutes total (both teams combined)
Actual: 243.5 minutes in a single quarter ❌
```

**Root Cause**: This indicates the quarter-level tracking is completely broken. A quarter should have ~60 minutes of playing time per team (5 players × 12 min quarter). Getting 243 minutes in one quarter suggests minutes from all quarters are being aggregated incorrectly or there's a fundamental misconception about how quarters report minutes.

---

## Key Findings

### Critical Issues

1. **Minutes Overrun**: Players can exceed 48 minutes, which is impossible in a real 48-minute game
2. **Inaccurate Allocation**: User-specified minutes targets are not being honored within acceptable tolerance
3. **Total Minutes Drift**: Team totals exceed 240 minutes due to timing/rounding errors
4. **Quarter Reporting**: Quarter-by-quarter minutes reporting appears fundamentally broken

### Working Features

1. **Zero Allocation**: Players allocated 0 minutes correctly do not play ✅
2. **Starting Lineup**: User-specified starting lineups are respected ✅
3. **General Range**: Players are generally getting "some minutes" vs "no minutes" correctly ✅

---

## Root Cause Analysis

Based on the test failures, the issues appear to stem from:

### 1. **Quarterly Rotation System vs. User Allocation**

The `SubstitutionManager` class uses a `calculateQuarterlyRotations()` function that:
- Divides total minutes by 4 to get quarter targets
- Executes rotation plans based on these quarter targets
- Does NOT account for cumulative error across quarters

**Code Location**: `src/simulation/systems/substitutions.ts`, lines 315-516

**Problem**: The quarterly system is rigid and doesn't dynamically adjust based on actual minutes played in previous quarters.

### 2. **Minutes Tracking Accuracy**

Multiple tracking systems exist:
- `StaminaTracker.minutesPlayed` (possession-level)
- `SubstitutionManager.actualMinutesHome/Away` (game-level)
- `QuarterResult.minutesPlayed` (quarter-level)

**Code Location**:
- `src/simulation/stamina/staminaManager.ts`
- `src/simulation/systems/substitutions.ts`
- `src/simulation/game/quarterSimulation.ts`

**Problem**: These systems may not be perfectly synchronized, leading to drift and over-counting.

### 3. **Game Clock vs. Possession Time**

Possessions have variable duration, and the clock doesn't always align perfectly with 12-minute quarters.

**Code Location**: `src/simulation/clock/gameClock.ts`

**Problem**: Rounding of possession times may accumulate error, causing totals to exceed 240 or allowing players to play more than 48 minutes.

---

## Recommendations

### High Priority Fixes

1. **Enforce Hard Caps**
   - Add assertions to prevent any player from exceeding 48 minutes
   - Add validation that team totals never exceed 240 minutes
   - Implement runtime checks that throw errors when limits are violated

2. **Fix Quarterly Rotation Logic**
   - Modify `calculateQuarterlyRotations()` to account for cumulative error
   - After each quarter, recalculate remaining minutes needed: `remaining = target - actual_so_far`
   - Adjust subsequent quarter plans dynamically based on actual vs. target

3. **Improve Minutes Tracking**
   - Consolidate to a single source of truth for minutes played
   - Add validation that all tracking systems agree
   - Log warnings when discrepancies detected

### Medium Priority Improvements

4. **Better Substitution Timing**
   - Use actual game clock time instead of estimated quarter targets
   - Sub players out when they hit their target, not based on fixed quarter times

5. **Add Tolerance Handling**
   - When approaching minute limits, be more conservative with substitutions
   - If a player is at 35 minutes with 36 target and 3 min remaining, keep them in

### Testing Improvements

6. **Add More Granular Tests**
   - Test single-quarter accuracy
   - Test cumulative error across quarters
   - Test edge cases (overtime, very lopsided allocations)

---

## Next Steps

1. **Investigate Substitution System** (Priority 1)
   - Review `SubstitutionManager.checkRotationPlanSubstitutions()`
   - Trace how minutes targets flow from user input → quarters → actual subs

2. **Add Debug Logging** (Priority 1)
   - Log every substitution with player name, time, and reason
   - Log cumulative minutes after each quarter
   - Compare allocated vs. actual after each quarter

3. **Fix Hard Caps** (Priority 1 - Quick Win)
   - Add `Math.min(minutesPlayed, 48)` cap in minutes reporting
   - Add team total validation in `GameSimulator.buildGameResult()`

4. **Refactor Rotation System** (Priority 2 - Larger Effort)
   - Move from rigid quarterly targets to dynamic minute-based substitutions
   - Implement "minutes remaining" tracking that updates after each possession

---

## Test Execution Summary

```
PASS  Starting Lineup Enforcement
  ✓ should use provided starting lineup at Q1 and Q3

PASS  Basic Minutes Allocation
  ✓ should not overwork players (36 min allocation should not play 48 min)
  ✓ should handle edge case: player with 0 minutes allocation must not play

FAIL  Basic Minutes Allocation
  ✗ should respect varying minutes allocation for starters and bench
    Reason: PF played 34.8 min (target: 30), diff 4.8 > tolerance 4.0

FAIL  Extreme Allocations
  ✗ should handle allocation where one player gets maximum minutes (42)
    Reason: Star PG played 27.9 min (target: 42), diff 14.1 >> tolerance

  ✗ should handle balanced allocation (all 8 rotation players get equal time)
    Reason: Some players played 48.6 min (target: 30), far exceeding limits

FAIL  Minutes Distribution Validation
  ✗ should ensure total minutes equals 240 for home team
    Reason: Total was 242.8 minutes (+2.8 over expected 240.0)

  ✗ should ensure no single player exceeds 48 minutes
    Reason: Player played 48.5 minutes (+0.5 over game duration)

FAIL  Auto-Allocation (No User Input)
  ✗ should auto-calculate minutes when no allocation provided
    Reason: Total was 242.3 minutes (+2.3 over expected 240.0)

FAIL  Quarter-by-Quarter Accuracy
  ✗ should distribute minutes evenly across quarters
    Reason: Quarter reported 243.5 minutes (expected ~120 for both teams)
```

---

## Conclusion

The basketball minutes allocation system **has fundamental issues** that prevent it from accurately honoring user-specified minutes targets. While basic functionality works (players with 0 minutes don't play, starting lineups are respected), the precision required for a realistic basketball simulation is not being met.

**Key Problems**:
1. ❌ Players exceed allocated minutes by more than acceptable tolerance
2. ❌ Players can play more than 48 minutes (impossible in real game)
3. ❌ Team totals exceed 240 minutes
4. ❌ Quarterly rotation system doesn't dynamically adjust to actual minutes played

**Severity**: HIGH - This affects core game realism and user control

**Recommended Action**:
1. Immediate: Add hard caps to prevent >48 min and >240 team total
2. Short-term: Add debugging to trace minute accumulation through the system
3. Medium-term: Refactor substitution system to use dynamic minute targets instead of rigid quarterly plans
