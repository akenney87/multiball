# Rotation System Bug Investigation Summary

## Executive Summary

I've identified **two critical bugs** in the rotation execution system that explain why starters are getting too few minutes (LeBron: 26 instead of 40) and bench players too many (Jaxson Hayes: 38 instead of 10.5).

## Root Cause

### Bug #1: Exact Timing Match Required (CRITICAL)

**Location**: `C:\Users\alexa\desktop\projects\multiball\src\simulation\systems\substitutions.ts` line 1229

```typescript
// Current (BROKEN) code:
if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {
  // Execute substitution
}
```

**Problem**:
- Requires substitution to happen within ±15 seconds of planned time
- If a possession ends at 10:20 (too early) or 9:40 (too late), the window is MISSED
- Once missed, player NEVER subs in for that quarter
- No retry or "overdue" logic

**Example**:
- LeBron's Q2 plan: subInAt = 10.0 minutes
- Possession ends at 10:20 remaining → check fails (0.33 > 0.25)
- Next possession ends at 9:40 remaining → check fails again (0.33 > 0.25)
- LeBron stays on bench entire Q2 or only subs in by chance later

### Bug #2: No Catchup Logic

**Problem**:
- The check uses `Math.abs()` which requires EXACT timing
- Should use `<=` operator to allow "late" substitutions
- Should have upper bound to prevent too-late subs

**Correct logic should be**:
```typescript
// Allow substitutions at or after the planned time (with reasonable bounds)
if (timeRemainingMin <= plan.subInAt + 0.25 && timeRemainingMin >= plan.subInAt - 3.0) {
  // Execute substitution
}
```

This allows:
- Substitutions to happen if we're "late" (missed exact window)
- But prevents subs from happening too late (>3 minutes overdue)
- Catches up on missed windows within a reasonable timeframe

## How This Causes the Observed Issues

### LeBron James: 40 min target → 26 min actual

**Q1**: Plays correctly (10 min, subs out at 2:00 remaining)
**Q2**: Should sub in at 10:00 remaining
  - Timing window is missed (possessions don't align)
  - Either subs in very late (4:09 as user observed) or not at all
  - Only plays ~4 minutes instead of 10 minutes
**Q3**: Rotation plans calculated based on Q1-Q2 actual minutes
  - If Q2 failed, only has 14 min instead of 20 min
  - Q3 plan might be wrong, or timing window missed again
**Q4**: Cascading failures from Q2-Q3 mean he never catches up
  - Ends with 26 minutes instead of 40 minutes (14 min deficit)

### Jaxson Hayes: 10.5 min target → 38 min actual

**Q1**: Subs in when starters rest (correct, ~4.6 min)
**Q2**: Plan says:
  - startsQuarter: true (continues from Q1)
  - subOutAt: 4.6 min remaining
  - But this requires LeBron to sub IN at 10:00
  - LeBron's sub fails → Jaxson never subs OUT
  - Jaxson plays entire Q2 (12 min instead of 4.6 min)
**Q3-Q4**: Pattern repeats
  - Starters miss their sub-in windows
  - Bench players stay on court longer than planned
  - Jaxson accumulates 38 minutes (27.5 min excess)

## The Fix

### Immediate Fix (Line 1229)

**Change from**:
```typescript
if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {
```

**To**:
```typescript
// Allow late substitutions within a 3-minute window
if (timeRemainingMin <= plan.subInAt + 0.25 && timeRemainingMin >= plan.subInAt - 3.0) {
```

### Why This Works:

1. **Late Subs Allowed**: If we're at 9:30 and should have subbed at 10:00, we'll still sub (0.5 min late)
2. **Prevents Too-Late Subs**: Won't sub if we're 5 minutes past the window (that's a different issue)
3. **Catches Up on Missed Windows**: As soon as substitution window is hit, sub happens
4. **More Forgiving**: Works even if possession timing is imperfect

### Additional Improvement: Execution Flags

Add tracking to prevent double-substitutions:

```typescript
interface QuarterlyRotationPlan {
  playerName: string;
  startsQuarter: boolean;
  subOutAt: number | null;
  subInAt: number | null;
  minutesNeeded: number;
  subInExecuted?: boolean;  // NEW: Prevent double subs
  subOutExecuted?: boolean; // NEW: Prevent double subs
}
```

## Debug Logging Added

I've added comprehensive debug logging to trace the issue:

1. **In `startQuarter()`** (line 964):
   - Logs rotation plans for LeBron, Jaxson Hayes, Anthony Davis
   - Shows startsQuarter, subInAt, subOutAt, minutesNeeded, actual minutes

2. **In `checkRotationPlanSubstitutions()`** (line 1133):
   - Logs active lineup at each check
   - Shows each player's rotation plan state
   - Logs timing calculations for sub-in checks
   - Shows why substitutions succeed or fail

### Example Debug Output:

```
[ROTATION PLANS] Q2 Start
  Home Team:
    LeBron James: starts=false, subOut=null, subIn=10.0, need=10.0, actual=10.0
    Jaxson Hayes: starts=true, subOut=4.6, subIn=null, need=4.6, actual=4.6

[ROTATION DEBUG] Q2 @ 10:20 (10.33 min remaining)
  Active: Jaxson Hayes, Cam Reddish, Player 8, Player 9, Player 10
  [LeBron James] isActive=false, subInAt=10.0, subOutAt=null, minutesNeeded=10.0
    → SUB IN CHECK: planSubIn=10.00, timeDiff=0.333, shouldSub=false

[ROTATION DEBUG] Q2 @ 9:40 (9.67 min remaining)
  Active: Jaxson Hayes, Cam Reddish, Player 8, Player 9, Player 10
  [LeBron James] isActive=false, subInAt=10.0, subOutAt=null, minutesNeeded=10.0
    → SUB IN CHECK: planSubIn=10.00, timeDiff=0.333, shouldSub=false
```

This will show **exactly when and why** LeBron's substitution is being skipped.

## Testing the Fix

### Before Fix:
- Run full game simulation
- Observe LeBron: ~26 min, Jaxson Hayes: ~38 min

### After Fix:
- Apply line 1229 change
- Run full game simulation
- Verify LeBron: 36-42 min (within 2 min of 40 target)
- Verify Jaxson Hayes: 8-12 min (within 2 min of 10.5 target)

## Files Modified

1. `C:\Users\alexa\desktop\projects\multiball\src\simulation\systems\substitutions.ts`
   - Added debug logging in `startQuarter()` (lines 964-990)
   - Added debug logging in `checkRotationPlanSubstitutions()` (lines 1132-1147, 1232-1272)

2. `C:\Users\alexa\desktop\projects\multiball\debug_rotation_plans.ts`
   - Created analysis script showing rotation plan calculations
   - Demonstrates the expected vs. actual behavior

3. `C:\Users\alexa\desktop\projects\multiball\ROTATION_BUG_REPORT.md`
   - Comprehensive bug analysis
   - Recommended fixes with code examples

## Next Steps

1. **Run a test simulation** with the debug logging enabled
   - The logs will confirm the exact timing issue
   - Will show when LeBron's substitution windows are missed

2. **Apply the fix** to line 1229
   - Change from exact match to "at or after" with bounds

3. **Test the fix** with a full game
   - Verify minutes distribution matches targets

4. **Remove debug logging** after confirming fix works
   - Or make it conditional on a DEBUG flag

5. **Consider additional improvements**:
   - Add execution flags to prevent double-subs
   - Make timing buffer configurable
   - Add metrics for "missed substitution windows"

## Analysis Tools Created

### 1. Debug Rotation Plans Script
**Location**: `C:\Users\alexa\desktop\projects\multiball\debug_rotation_plans.ts`

**Output**: Shows rotation plans for all 4 quarters with expected behavior:
```bash
npx tsx debug_rotation_plans.ts
```

### 2. Instrumented Substitution System
**Location**: `C:\Users\alexa\desktop\projects\multiball\src\simulation\systems\substitutions.ts`

Now includes debug logging that will show:
- Rotation plans at start of each quarter
- Active lineup during each check
- Timing calculations for each substitution
- Why substitutions succeed or fail

## Questions Answered

### 1. What are the exact rotation plans for LeBron (all 4 quarters)?

**Q1**: starts=true, subOut=2.0, subIn=null, need=10.0
**Q2**: starts=false, subOut=null, subIn=10.0, need=10.0
**Q3**: starts=true, subOut=2.0, subIn=null, need=10.0
**Q4**: starts=false, subOut=null, subIn=10.0, need=10.0

### 2. What are the exact rotation plans for Jaxson Hayes (all 4 quarters)?

**Q1**: starts=false, subOut=null, subIn=2.0, need=4.6
**Q2**: starts=true, subOut=4.6, subIn=null, need=4.6
**Q3**: starts=false, subOut=null, subIn=2.0, need=4.6
**Q4**: starts=false, subOut=null, subIn=4.8, need=4.8

### 3. Why don't LeBron's plans trigger substitutions in Q2/Q4?

**Root cause**: The timing check `Math.abs(timeRemainingMin - plan.subInAt) < 0.25` requires EXACT timing match within ±15 seconds. If possessions don't align perfectly, the window is missed and there's no retry logic.

### 4. Why does Jaxson Hayes stay in for 38 minutes?

**Root cause**: Jaxson is supposed to sub OUT when starters sub IN. But because LeBron's sub-in fails (timing window missed), Jaxson never subs out. He stays on court because no one replaces him.

### 5. What are the bugs in rotation plan calculation or execution?

**Calculation**: Rotation plans are CORRECT
**Execution**: Timing check is TOO STRICT and has NO CATCHUP LOGIC

The fix is simple: Change line 1229 to allow late substitutions within bounds.
