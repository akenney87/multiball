# Rotation System Bug Report

## Summary

The quarterly rotation system has **two critical bugs** causing starters to play too few minutes and bench players to play too many:

1. **Timing Window Too Strict**: Substitutions use a 15-second window (`< 0.25 min`) which can be missed if possessions don't align
2. **Missed Substitutions Never Retry**: Once a substitution window is missed, the player never subs in for that quarter

## Root Cause Analysis

### Bug #1: Tight Timing Window with No Catchup

**Location**: `substitutions.ts` line 1216

```typescript
// Check if player should sub IN according to plan
if (!isActive && plan.subInAt !== null && plan.minutesNeeded > 0) {
  // Check if it's time to sub in (with 15-second buffer)
  if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {  // ← BUG HERE
    // Execute substitution...
  }
}
```

**Problem**:
- LeBron's Q2 plan: `subInAt: 10.0` (sub in at 10:00 remaining)
- This check only passes when time is between 9:45 and 10:15
- If possessions happen at 10:20 (too early) then 9:40 (too late), the window is MISSED
- Once missed, LeBron never subs in for Q2!

**Why This Happens**:
- Possessions vary in length (5-25 seconds typically)
- Substitution checks happen BETWEEN possessions (during dead balls)
- If a possession ends at 10:20 remaining, check fails (too early)
- Next possession might end at 9:40 remaining, check fails again (too late)
- No retry logic - LeBron stays on bench entire quarter

### Bug #2: One-Time Check with No "Overdue" Logic

**Location**: Same function, lines 1208-1241

```typescript
// Check if player should sub IN according to plan
if (!isActive && plan.subInAt !== null && plan.minutesNeeded > 0) {
  if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {
    // Execute sub...
  }
  // ← NO ELSE CLAUSE for overdue substitutions!
}
```

**Problem**:
- The logic only checks for EXACT timing match
- No logic for "this sub is overdue, execute it now"
- If time is 9:00 and LeBron should have subbed at 10:00, nothing happens

**Correct Behavior Should Be**:
```typescript
if (!isActive && plan.subInAt !== null && plan.minutesNeeded > 0) {
  // Sub in if we're AT OR PAST the planned time
  if (timeRemainingMin <= plan.subInAt + 0.25) {
    // Execute sub (as long as we haven't passed the point where it's too late)
  }
}
```

## Observed Symptoms

### Lakers Minutes (Expected → Actual from user report):
- **LeBron James** (40 min target): **26 min** actual (14 min lost)
- **Anthony Davis** (40 min target): **22 min** actual (18 min lost)
- **Jaxson Hayes** (10.5 min target): **38 min** actual (27.5 min excess!)
- **Cam Reddish** (2.1 min target): **27 min** actual (24.9 min excess!)

### Substitution Timeline (from user report):
- **Q1 1:46**: All 4 starters sub OUT (LeBron, AD, Austin, D'Angelo)
- **Q2 4:09**: LeBron subs back IN (should have been at ~10:00!)
- **Q2 0:55**: LeBron subs OUT
- **Q3/Q4**: LeBron NEVER subs back in

### Why This Happens:

**Q2 Issue**:
1. LeBron's Q2 plan: `subInAt: 10.0` (should sub at 10:00 remaining)
2. Possession timing causes substitution window to be missed
3. LeBron doesn't sub in until 4:09 remaining (6 minutes late!)
4. By then, he only plays 4 minutes instead of 10 minutes

**Q3/Q4 Issue**:
1. Because actual minutes are tracked incorrectly (only got 4 min in Q2 instead of 10)
2. Q3 rotation plans might calculate wrong `subInAt` time
3. Or same timing bug causes Q3/Q4 subs to be missed
4. LeBron accumulates large minutes deficit

**Jaxson Hayes Issue**:
1. Q1: Jaxson subs in when LeBron leaves (correct)
2. Q2: Jaxson's plan says `startsQuarter: true, subOutAt: 4.6` (should sub out at 4:36 remaining)
3. LeBron should sub in at 10:00, replacing Jaxson
4. But LeBron's sub never happens! So Jaxson stays on court
5. Jaxson plays entire Q2 (12 min instead of 4.6 min)
6. Pattern repeats in Q3/Q4

## The Fix

### Solution 1: Use "Overdue" Logic Instead of Exact Match

**Change line 1216 from:**
```typescript
if (Math.abs(timeRemainingMin - plan.subInAt) < 0.25) {
```

**To:**
```typescript
// Sub in if we're at or past the planned time (within reason)
if (timeRemainingMin <= plan.subInAt + 0.25 && timeRemainingMin >= plan.subInAt - 3.0) {
```

This allows:
- Substitutions to happen "late" (if we miss the exact window)
- But not too late (not if we're 3+ minutes past the planned time)
- Catches up on missed subs within a reasonable window

### Solution 2: Add "Execute Once" Flag to Prevent Multiple Subs

```typescript
interface QuarterlyRotationPlan {
  playerName: string;
  startsQuarter: boolean;
  subOutAt: number | null;
  subInAt: number | null;
  minutesNeeded: number;
  subInExecuted?: boolean;  // ← NEW: Track if sub-in was executed
  subOutExecuted?: boolean; // ← NEW: Track if sub-out was executed
}
```

Then in the check:
```typescript
if (!isActive && plan.subInAt !== null && !plan.subInExecuted) {
  if (timeRemainingMin <= plan.subInAt + 0.25) {
    // Execute sub...
    plan.subInExecuted = true;  // Mark as executed
  }
}
```

### Solution 3: Increase Buffer Size

**Quick fix** (less robust):
```typescript
// Change from 0.25 min (15 sec) to 1.0 min (60 sec)
if (Math.abs(timeRemainingMin - plan.subInAt) < 1.0) {
```

This gives a 2-minute window (±1 min) for substitutions, making timing less strict.

## Additional Issues

### Sub-Out Logic Has Same Bug (line 1139)

```typescript
if (timeRemainingMin <= plan.subOutAt + 0.25) {
```

This is correct for sub-outs (uses `<=` operator, allows late subs).

But it should also check we're not too early:
```typescript
if (timeRemainingMin <= plan.subOutAt + 0.25 && timeRemainingMin >= plan.subOutAt - 0.25) {
```

## Recommended Fix Priority

1. **Immediate**: Change line 1216 to use `<=` operator with upper bound
2. **Follow-up**: Add execution flags to prevent double-substitutions
3. **Testing**: Run full game simulation and verify minutes distribution
4. **Monitoring**: Add debug logging to trace when subs are executed vs. planned

## Test Case

Run a full 4-quarter game and verify:
- LeBron James: 36-42 minutes (close to 40 min target)
- Jaxson Hayes: 8-12 minutes (close to 10.5 min target)
- All starters: Within 5 minutes of their targets
- No bench player exceeds 20 minutes unless their target is >20

## Debug Logging Needed

Add to `checkRotationPlanSubstitutions`:

```typescript
// Debug: Log when substitution timing is checked
if (plan.subInAt !== null && !isActive) {
  const timeToSub = timeRemainingMin - plan.subInAt;
  const willExecute = Math.abs(timeToSub) < 0.25;

  console.log(`[SUB CHECK] Q${quarter} ${plan.playerName}: ` +
    `time=${timeRemainingMin.toFixed(2)}, ` +
    `planSubIn=${plan.subInAt.toFixed(2)}, ` +
    `diff=${timeToSub.toFixed(2)}, ` +
    `execute=${willExecute}`);
}
```

This will show exactly when/why subs are being skipped.
