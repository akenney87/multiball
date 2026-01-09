# Rotation System - Fix Required

## The Problem

**Starters getting too few minutes, bench players getting too many**
- LeBron James: 26 min (should be 40)
- Jaxson Hayes: 38 min (should be 10.5)

## The Bug

**File**: `C:\Users\alexa\desktop\projects\multiball\src\simulation\systems\substitutions.ts`
**Line**: 1229

### Current (BROKEN) Code:
```typescript
// Check if it's time to sub in (with 15-second buffer)
if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {
  const benchPlayers = lineupManager.getBenchPlayers();
  const playerIn = benchPlayers.find(p => p.name === plan.playerName);
  // ... execute substitution
}
```

### The Problem:
- `Math.abs(timeRemainingMin - plan.subInAt) < 0.25` requires EXACT timing
- If LeBron should sub at 10:00, this only works from 9:45 to 10:15
- If possession ends at 10:20 (too early) or 9:40 (too late), MISSED FOREVER
- No retry logic - player never subs in for that quarter

## The Fix

### Option 1: Allow Late Substitutions (RECOMMENDED)

```typescript
// Check if it's time to sub in (allow late subs within bounds)
if (timeRemainingMin <= plan.subInAt + 0.25 && timeRemainingMin >= plan.subInAt - 3.0) {
  const benchPlayers = lineupManager.getBenchPlayers();
  const playerIn = benchPlayers.find(p => p.name === plan.playerName);
  // ... execute substitution
}
```

**Why this works**:
- Uses `<=` so subs happen "at or after" planned time
- Allows subs to happen up to 3 minutes late (catches up on missed windows)
- Still prevents subs from happening too early (9:45 min buffer)

### Option 2: Increase Buffer Size (QUICK FIX)

```typescript
// Check if it's time to sub in (with 1-minute buffer)
if (Math.abs(timeRemainingMin - plan.subInAt) < 1.0) {
  const benchPlayers = lineupManager.getBenchPlayers();
  const playerIn = benchPlayers.find(p => p.name === plan.playerName);
  // ... execute substitution
}
```

**Why this works**:
- Changes buffer from 0.25 min (15 sec) to 1.0 min (60 sec)
- Creates 2-minute window (±1 min) for substitutions
- More forgiving if possession timing doesn't align
- **Note**: Still has no retry logic, but reduces chance of missing window

## Apply the Fix

### Step 1: Edit the file
```bash
# Open the file
code "C:\Users\alexa\desktop\projects\multiball\src\simulation\systems\substitutions.ts"

# Go to line 1229
# Replace the line with Option 1 (recommended) or Option 2 (quick fix)
```

### Step 2: Test the fix
```bash
# Run a full game simulation
npm run sim  # or whatever your test command is

# Check the box score:
# - LeBron should have 36-42 minutes (close to 40)
# - Jaxson Hayes should have 8-12 minutes (close to 10.5)
```

### Step 3: Verify with debug logs
The debug logging added will show:
```
[ROTATION DEBUG] Q2 @ 9:40 (9.67 min remaining)
  [LeBron James] isActive=false, subInAt=10.0, subOutAt=null
    → SUB IN CHECK: planSubIn=10.00, timeDiff=0.333, shouldSub=TRUE (with fix)
    → SUB EXECUTED: Jaxson Hayes OUT, LeBron James IN
```

## Expected Results After Fix

### Before Fix:
```
LeBron James:      26 min (14 min deficit)
Anthony Davis:     22 min (18 min deficit)
Jaxson Hayes:      38 min (27.5 min excess)
Cam Reddish:       27 min (24.9 min excess)
```

### After Fix:
```
LeBron James:      38-42 min (within 2 min of 40 target)
Anthony Davis:     38-42 min (within 2 min of 40 target)
Jaxson Hayes:      9-12 min (within 2 min of 10.5 target)
Cam Reddish:       1-4 min (within 2 min of 2.1 target)
```

## Why This Happened

### Rotation Plans Are CORRECT:
- Q1: LeBron starts, plays 10 min, subs out at 2:00
- Q2: LeBron subs in at 10:00, plays rest of quarter (10 min)
- Q3: LeBron starts, plays 10 min, subs out at 2:00
- Q4: LeBron subs in at 10:00, plays rest of quarter (10 min)
- **Total**: 40 minutes ✓

### Execution Is BROKEN:
- Q2: LeBron should sub at 10:00
- Possession ends at 10:20 → check fails (0.33 > 0.25)
- Next possession ends at 9:40 → check fails (0.33 > 0.25)
- LeBron never subs in (or subs in very late by chance)
- Jaxson Hayes (who was supposed to sub OUT when LeBron subs IN) stays on court
- Pattern repeats in Q3-Q4

## Debug Logging (Already Added)

The substitution system now logs:
1. Rotation plans at start of each quarter
2. Active lineup during each substitution check
3. Timing calculations for each substitution decision
4. Why substitutions succeed or fail

This will help verify the fix is working correctly.

## Additional Improvements (Optional)

### 1. Add Execution Flags
Prevent double-substitutions by tracking if a sub was executed:

```typescript
interface QuarterlyRotationPlan {
  playerName: string;
  startsQuarter: boolean;
  subOutAt: number | null;
  subInAt: number | null;
  minutesNeeded: number;
  subInExecuted?: boolean;  // NEW
  subOutExecuted?: boolean; // NEW
}
```

### 2. Make Buffer Configurable
```typescript
const SUB_TIMING_BUFFER = 0.25;  // minutes
const SUB_LATE_LIMIT = 3.0;      // minutes

if (timeRemainingMin <= plan.subInAt + SUB_TIMING_BUFFER &&
    timeRemainingMin >= plan.subInAt - SUB_LATE_LIMIT) {
  // Execute sub
}
```

## Summary

**One line change** (line 1229) will fix the entire rotation system:

**FROM**: `if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {`
**TO**: `if (timeRemainingMin <= plan.subInAt + 0.25 && timeRemainingMin >= plan.subInAt - 3.0) {`

This allows late substitutions within a reasonable window, fixing the cascading failures that cause starters to get too few minutes and bench players to get too many.
