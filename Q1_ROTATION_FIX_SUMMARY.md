# Q1 Rotation System Fixes

## Problem Summary
The Q1 rotation system had three critical issues:
1. Cam Reddish (0.5 min quarterly target) was subbing in when he shouldn't play
2. Starters like LeBron and Austin were either:
   - Subbing out too early (at 4:46 instead of 2:00)
   - OR not subbing out at all (playing full 12 minutes)
3. Bench players with sufficient minutes weren't getting substitution opportunities

## Root Causes

### Issue 1: Low-Minute Players Playing in Q1-Q3
**Location**: `src/simulation/systems/substitutions.ts`
- Lines 289-321 (Q1 rotation plan calculation)
- Lines 401-429 (Q3 rotation plan calculation)
- Lines 1357-1361 (Q1-Q3 subIn execution)
- Lines 1306-1319 (fallback substitution logic)

**Problem**: The quarterly rotation plan calculator was assigning `subInAt` times to ALL bench players with `quarterTarget > 0`, regardless of how small their target was. Players with 0.5-2.0 min quarterly targets (like Cam Reddish) were getting rotation slots.

**Fix**: Added filtering to exclude players with `quarterTarget <= 2.0` from Q1-Q3 rotation plans:
- Q1/Q3 plan calculation now only creates `subInAt` times for players with >2.0 min targets
- Execution logic filters out players with `minutesNeeded <= 2.0` from subbing in during Q1-Q3
- Fallback logic excludes same low-minute players

### Issue 2: SubOut Timing Logic Inverted
**Location**: `src/simulation/systems/substitutions.ts`, line 1269

**Problem**: The timing check for when to sub out a player was backwards:
```typescript
// OLD (BROKEN):
if (timeRemainingMin <= plan.subOutAt + 0.25) {
```

This meant a player with `subOutAt=2.0` would only sub out when time was at 2:15 or LESS. This is inverted - we want to sub when time REACHES 2:00, not when it goes below it.

**Fix**: Added proper window check with both upper and lower bounds:
```typescript
// NEW (FIXED):
if (timeRemainingMin <= plan.subOutAt + 0.25 && timeRemainingMin >= plan.subOutAt - 0.25) {
```

Now a player with `subOutAt=2.0` will sub out when time is between 1:45 and 2:15 (30-second window).

### Issue 3: SubIn Timing Windows Too Wide
**Location**: `src/simulation/systems/substitutions.ts`, lines 1373-1377

**Problem**: The timing windows for bench players subbing in were too wide:
- Q1/Q3: earlyWindow=1.0 min, lateWindow=2.0 min (3-minute total window!)
- This meant a player with `subInAt=2.0` could sub in anywhere from 0:00 to 4:00

**Fix**: Tightened timing windows for Q1/Q3:
```typescript
// NEW (FIXED):
const earlyWindow = this.currentQuarter === 4 ? 2.0 :
                    (this.currentQuarter === 2 && plan.subInAt > 10.0) ? 0.5 : 0.5;
const lateWindow = this.currentQuarter === 4 ? 5.0 :
                   (this.currentQuarter === 2) ? 1.0 : 0.5;
```

Now Q1/Q3 use ±30 second windows (±0.5 min), ensuring substitutions happen within 1 minute of planned time.

## Test Results

### Before Fixes:
- Cam Reddish (1.5 min target): Subbed in at 2:30 ❌
- Player 10 (0.5 min target): Subbed in at 3:36 ❌
- LeBron James: Subbed out at 3:00 (plan said 2:00) ❌
- Austin Reaves: Subbed out at varying times ❌

### After Fixes:
- Cam Reddish (1.5 min target): Did NOT play ✅
- Player 10 (0.5 min target): Did NOT play ✅
- LeBron James: Subbed out at 2:30 (within 30 sec of 2:00 plan) ✅
- Austin Reaves: Subbed out at 2:15 (within 15 sec of 2:00 plan) ✅
- Jarred Vanderbilt (4.4 min target): Subbed in at 2:30 ✅
- Jaxson Hayes (3.4 min target): Subbed in at 2:15 ✅
- Taurean Prince (2.5 min target): Subbed in at 2:15 ✅

## Files Modified
1. `src/simulation/systems/substitutions.ts`:
   - Lines 289-305: Q1 rotation plan - filter low-minute players
   - Lines 407-416: Q3 rotation plan - filter low-minute players
   - Line 1269: Fix subOut timing logic
   - Lines 1306-1319: Fallback logic - filter low-minute players
   - Lines 1357-1361: SubIn execution - filter low-minute players
   - Lines 1373-1377: Tighten subIn timing windows for Q1/Q3

## Verification
Run these tests to verify the fixes:
```bash
npx ts-node --transpile-only test_q1_rotation_issue.ts  # Shows rotation plans
npx ts-node --transpile-only test_q1_execution.ts       # Shows execution
```

Expected outcomes:
1. Players with <=2.0 min quarterly targets have `subInAt: null` in Q1/Q3 plans
2. Starters sub out within 30 seconds of their planned time
3. Bench players with >2.0 min targets sub in to replace starters
4. Low-minute players (Cam Reddish, Player 10) do not play in Q1-Q3

## Impact on Other Quarters
- **Q2**: Unchanged - bench players start Q2 and play their full allocation
- **Q3**: Same fixes as Q1 applied
- **Q4**: Unchanged - low-minute players can still play in garbage time (as intended)
