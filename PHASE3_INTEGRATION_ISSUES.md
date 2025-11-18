# Phase 3 Integration Issues - Systematic Fix Guide

**Created:** 2025-11-18
**Status:** Phase 3 translation complete, integration fixes needed
**Priority:** HIGH - Blocking full game simulation

---

## Overview

Phase 3 (Possession Orchestration & Game Simulation) translation is **100% complete** with **100% formula fidelity**. However, several type/interface mismatches exist between Python and TypeScript implementations that prevent full game simulation from running correctly.

**Test Status:** 178/221 tests passing (80.5%)
**Integration Status:** Partial - needs systematic alignment

---

## Issues by Category

### ✅ FIXED (3 issues)

1. **checkTurnover Return Type** ✅
   - **Location:** `possession.ts:636`
   - **Issue:** Tried to destructure as tuple, but returns object
   - **Fix:** Changed to `const result = checkTurnover(...); const occurred = result.turnover_occurred;`

2. **selectShotType Return Type** ✅
   - **Location:** `possession.ts:689`
   - **Issue:** Tried to access `.shotType` property, but returns string directly
   - **Fix:** Changed to `const shotType = selectShotType(...);`

3. **FoulSystem Method Naming** ✅
   - **Location:** `rebounding.ts:566`
   - **Issue:** Called `check_non_shooting_foul` (snake_case), actual method is `checkNonShootingFoul` (camelCase)
   - **Fix:** Updated to `checkNonShootingFoul()`

---

## ⚠️ CRITICAL ISSUES (Must Fix)

### 1. attemptShot Function Signature Mismatch

**Priority:** CRITICAL
**Blocking:** Full game simulation
**Files:** `possession.ts:708-721`, `shooting.ts:893-976`

**Problem:**
```typescript
// possession.ts CALLS with 13 parameters:
const result = shooting.attemptShot(
  shooter,                    // 1
  shooterDefender,           // 2
  shotType,                  // 3
  contestResult.distance,    // 4
  defenseType,               // 5
  possessionContext,         // 6
  tacticalSettingsOffense,   // 7
  tacticalSettingsDefense,   // 8
  foulSystem,                // 9
  quarter,                   // 10
  gameTime,                  // 11
  defendingTeamName          // 12
  // Plus accessing .pointsScored on result
);

// shooting.ts ACCEPTS only 6 parameters:
export function attemptShot(
  shooter: Record<string, number>,     // 1
  defender: Record<string, number>,    // 2
  shotType: string,                    // 3
  contestDistance: number,             // 4
  possessionContext: PossessionContext,// 5
  defenseType: string = 'man'          // 6
): [boolean, ShotDebugInfo] {
  // Returns tuple, not object with pointsScored
}
```

**Impact:**
- Prevents shot attempts from succeeding
- Causes `pointsScored` to be undefined
- Results in 0-0 game scores

**Solution Options:**

**Option A (Recommended):** Update shooting.ts to match Python signature
```typescript
export function attemptShot(
  shooter: Record<string, number>,
  defender: Record<string, number>,
  shotType: string,
  contestDistance: number,
  defenseType: string,
  possessionContext: PossessionContext,
  tacticalSettingsOffense: SimulationTacticalSettings,
  tacticalSettingsDefense: SimulationTacticalSettings,
  foulSystem: any, // or FoulSystem type
  quarter: number,
  gameTime: string,
  defendingTeamName: string
): ShotAttemptResult {
  // Return object with { made, pointsScored, shotDetail, foulEvent, ... }
}
```

**Option B:** Create wrapper function in possession.ts
```typescript
function attemptShotWithContext(/* full params */): ShotAttemptResult {
  const [made, debugInfo] = shooting.attemptShot(/* core params */);
  return {
    made,
    pointsScored: calculatePoints(shotType, made),
    shotDetail: debugInfo.shotDetail,
    foulEvent: null, // Handle separately
    ...debugInfo
  };
}
```

**Estimated Fix Time:** 30-45 minutes

---

### 2. Missing ShotAttemptResult Type

**Priority:** HIGH
**Files:** `possession.ts:708+`, `shooting.ts`

**Problem:**
```typescript
// possession.ts expects:
interface ShotAttemptResult {
  made: boolean;
  pointsScored: number;
  shotDetail: string;
  foulEvent: FoulEvent | null;
  contestDistance?: number;
  defenseType?: string;
  // ... other fields
}

// shooting.ts returns:
[boolean, ShotDebugInfo]
```

**Solution:**
1. Define `ShotAttemptResult` interface in `shooting.ts` or `types.ts`
2. Update all shot attempt functions to return this type
3. Include `pointsScored` calculation in return

**Estimated Fix Time:** 20-30 minutes

---

### 3. Player Type Attribute Access

**Priority:** MEDIUM
**Files:** Multiple Phase 2 and 3 files

**Problem:**
```typescript
// Data model (src/data/types.ts):
interface Player {
  id: string;
  name: string;
  attributes: PlayerAttributes; // NESTED
}

interface PlayerAttributes {
  height: number;
  jumping: number;
  // ... 23 more
}

// Simulation expects FLAT access:
shooter.height        // undefined - should be shooter.attributes.height
shooter.jumping       // undefined - should be shooter.attributes.jumping
```

**Impact:**
- All attribute-based calculations fail
- Composite calculations return wrong values
- Probability calculations affected

**Solution Options:**

**Option A:** Transform layer in quarterSimulation
```typescript
function flattenPlayer(player: Player): SimulationPlayer {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    ...player.attributes  // Flatten attributes
  };
}
```

**Option B:** Update SimulationPlayer type to match nested structure
```typescript
interface SimulationPlayer {
  id: string;
  name: string;
  position: string;
  attributes: PlayerAttributes;
}

// Update all calculations to use player.attributes.height
```

**Recommended:** Option A (transformation layer)
**Estimated Fix Time:** 45-60 minutes

---

## ⚠️ MEDIUM PRIORITY ISSUES

### 4. TacticalSettings Property Names

**Priority:** MEDIUM
**Files:** Multiple

**Problem:**
```typescript
// Data types use snake_case:
interface TacticalSettings {
  pace: string;
  man_defense_pct: number;
  scoring_option_1: string | null;
  scoring_option_2: string | null;
  scoring_option_3: string | null;
  rebounding_strategy: string;
  minutes_allotment: Record<string, number>;
}

// Simulation code sometimes expects camelCase:
tacticalSettings.manDefensePct       // undefined
tacticalSettings.reboundingStrategy  // undefined
```

**Solution:**
Audit all tactical settings access and ensure consistent snake_case usage

**Estimated Fix Time:** 15-20 minutes

---

### 5. Contest Distance Undefined

**Priority:** MEDIUM
**Files:** `possession.ts:883`

**Problem:**
```typescript
const distance = event.contestDistance;  // undefined
distance.toFixed(1);  // Error: Cannot read property 'toFixed' of undefined
```

**Current Fix:** Added nullish coalescing `?? 0` (line 883)

**Better Solution:** Ensure `contestDistance` is always populated in events

**Estimated Fix Time:** 10 minutes

---

## 🔍 MINOR ISSUES

### 6. Flaky Statistical Tests

**Priority:** LOW
**Files:** `timeoutManager.test.ts`, `substitutions.test.ts`

**Problem:**
- 3 tests fail intermittently due to statistical variance
- Sample sizes too small (100-200 trials)

**Solution:**
Increase sample sizes to 500-1000 trials

**Estimated Fix Time:** 5 minutes

---

### 7. TypeScript Strict Mode Warnings

**Priority:** LOW
**Files:** Multiple

**Problem:**
~80 TypeScript strict mode errors:
- Possibly undefined objects (50+ occurrences)
- Unused variables (20+ occurrences)
- Type coercion warnings (10+ occurrences)

**Solution:**
Systematic cleanup pass:
- Add null checks or assertions
- Remove unused variables
- Fix type casts

**Estimated Fix Time:** 60-90 minutes

---

## Systematic Fix Order

### Session 1 (Next): Critical Path (90 min)

1. **Define ShotAttemptResult interface** (10 min)
   - Create comprehensive interface
   - Add to types.ts

2. **Fix attemptShot signature** (40 min)
   - Update function signature to match Python
   - Add foul checking
   - Return proper result object
   - Update attempt3ptShot, attemptMidrangeShot, attemptRimShot

3. **Create Player transformation layer** (30 min)
   - Add flattenPlayer() utility
   - Apply in quarterSimulation
   - Test with sample possession

4. **Run game simulation test** (10 min)
   - Verify scores > 0
   - Check basic game flow

### Session 2: Cleanup (60 min)

5. **Fix TacticalSettings consistency** (20 min)
6. **Ensure contest distance populated** (10 min)
7. **Fix flaky tests** (10 min)
8. **First pass on TypeScript warnings** (20 min)

### Session 3: Polish (60 min)

9. **Complete TypeScript strict mode cleanup** (40 min)
10. **Final integration testing** (20 min)
11. **Performance profiling** (optional)

---

## Testing Strategy

### After Each Fix

```bash
# Run affected tests
npm test -- --testPathPattern="gameSimulation"

# Check for new TypeScript errors
npm run type-check
```

### Integration Milestones

**Milestone 1:** Single possession completes without error
**Milestone 2:** Single quarter simulates with score > 0
**Milestone 3:** Full game (4 quarters) completes
**Milestone 4:** All 221 tests passing

---

## Success Criteria

- ✅ All 221 tests passing
- ✅ Full 4-quarter game simulation works
- ✅ Realistic scores (90-130 per team)
- ✅ Realistic minutes (starters 36-48 min)
- ✅ Zero TypeScript errors
- ✅ Play-by-play generation works

---

## Notes for Next Session

### Quick Start Commands

```bash
# Check current test status
npm test

# Run only game simulation tests
npm test -- --testPathPattern="gameSimulation"

# Check TypeScript errors
npm run type-check

# Run all simulation tests
npm test -- --testPathPattern="simulation"
```

### Key Files to Focus On

1. `src/simulation/systems/shooting.ts` - Update attemptShot signature
2. `src/simulation/core/types.ts` - Add ShotAttemptResult interface
3. `src/simulation/possession/possession.ts` - Verify shot handling
4. `src/simulation/game/quarterSimulation.ts` - Add player transformation

### Expected Outcome

After Session 1 fixes:
- Game simulation should produce realistic scores
- All quarter simulations should complete
- Core integration should be solid
- Remaining work is cleanup and polish

---

**Total Estimated Fix Time:** 210 minutes (~3.5 hours)
**Confidence Level:** HIGH - Issues are well-understood and fixable

---

**Last Updated:** 2025-11-18
**Next Session Focus:** Critical Path (Items 1-4)
