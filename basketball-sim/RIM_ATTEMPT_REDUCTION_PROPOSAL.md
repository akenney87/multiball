# Rim Attempt Reduction Proposal

## Executive Summary

**Current State:** 57.6% of all shots are rim attempts (vs NBA target: 35%)
**Root Cause:** Multiple compounding modifiers pushing shot selection toward rim
**Impact:** High FG% (68.3% at rim), low PPG (too many 2-point attempts), unrealistic offense

---

## Detailed Analysis

### Current Shot Distribution (100-Game Validation)

| Shot Type | Current | NBA Target | Difference |
|-----------|---------|------------|------------|
| **3PT** | 37.0% | 40% | -3.0% ✓ |
| **Midrange** | 5.4% | 25% | -19.6% ✗ |
| **Rim** | 57.6% | 35% | **+22.6% ✗** |

**FG% by Shot Type:**
- 3PT: 35.9% ✓ (NBA: ~36%)
- Midrange: 50.2% ✓ (NBA: ~40-45%)
- Rim: **68.3% ✗** (NBA: ~60-62%)

---

## Root Cause Analysis

### Where Rim Attempts Come From

I've traced the shot selection logic through `src/systems/shooting.py` and `src/systems/possession.py`. Here's what's pushing rim attempts so high:

#### 1. **Baseline Distribution** (`constants.py:281-285`)
```python
SHOT_DISTRIBUTION_BASELINE = {
    '3pt': 0.40,    # 40%
    'midrange': 0.20,  # 20%
    'rim': 0.40,    # 40% ← Starting point already high
}
```

#### 2. **Position-Based Adjustments** (`shooting.py:127-140`)
```python
if position == 'C':
    distribution['rim'] += 0.25   # +25% for centers
    distribution['3pt'] -= 0.30   # -30% for centers
elif position == 'PF':
    distribution['rim'] += 0.10   # +10% for power forwards
    distribution['3pt'] -= 0.15   # -15% for power forwards
```

**Impact:** With 2 centers and 2 PFs typically on rosters, this significantly shifts team-wide shot distribution toward rim.

#### 3. **Player Composite Modifiers** (`shooting.py:181-197`)
```python
# Elite rim finishers (composite > 50)
rim_bonus = composite_diff_rim * 0.008  # Up to +32% at composite=90

# Poor rim finishers (composite < 50)
rim_bonus = -0.50 * (1.0 - math.exp(0.08 * composite_diff_rim))  # Down to -55% at composite=20
```

**Impact:** Elite finishers (Hassan Swatter, Mutombo Blocker) push rim attempts way up. Since you have specialist teams with elite finishers, this amplifies rim attempts.

#### 4. **Bravery Modifier** (`shooting.py:221-229`)
```python
bravery_rim_bonus = (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE  # 0.002
# ±8% at ±40 bravery difference
distribution['rim'] += bravery_rim_bonus
```

**Impact:** Brave players (+8%) attack rim more often.

#### 5. **Transition Bonus** (`shooting.py:216-219`)
```python
if possession_context.is_transition:
    distribution['rim'] += 0.20  # +20% in transition
    distribution['3pt'] -= 0.10
    distribution['midrange'] -= 0.10
```

**Impact:** Transition possessions heavily favor rim (fast break layups/dunks).

#### 6. **Tactical Modifiers - Fast Pace** (`shooting.py:200-203`)
```python
if tactical_settings.pace == 'fast':
    distribution['rim'] += 0.05  # +5% for fast pace
    distribution['midrange'] -= 0.05
```

**Impact:** Fast pace = more rim attempts.

#### 7. **Drive-and-Kick Outcomes** (`possession.py:248-382`)

When `shot_type='rim'` is selected, the system checks if it's a drive. Drives have 4 outcomes:
- **Dunk**: Shot at rim
- **Layup**: Shot at rim
- **Kickout**: Drive collapses defense, kick out for new shot (usually 3PT)
- **Turnover**: Possession ends

**Current Issue:** Drive outcomes are weighted by player composites, and with elite finishers, dunk/layup outcomes dominate. Kickout rate is too low.

---

## Proposed Solution (Multi-Pronged Approach)

### **Objective:** Reduce rim attempts from 57.6% to 35% (target: -22.6%)

### **Strategy:** Attack the problem at multiple intervention points to distribute the reduction across the system.

---

### **PHASE 1: Baseline Adjustment** (Fastest, Safest)

**Impact:** -5% to -8% rim attempts

**File:** `src/constants.py`

**Current:**
```python
SHOT_DISTRIBUTION_BASELINE = {
    '3pt': 0.40,
    'midrange': 0.20,
    'rim': 0.40,
}
```

**Proposed:**
```python
SHOT_DISTRIBUTION_BASELINE = {
    '3pt': 0.42,      # +2% (move toward NBA 40%)
    'midrange': 0.28,  # +8% (address the 5.4% problem)
    'rim': 0.30,      # -10% (move toward NBA 35%)
}
```

**Rationale:**
- Reduces baseline rim from 40% → 30% (closer to NBA 35%)
- Increases midrange from 20% → 28% (addresses the 5.4% issue)
- Slight increase to 3PT to compensate

**Why This Works:**
- All other modifiers (position, composites, etc.) apply on TOP of this baseline
- By lowering the starting point, we reduce compounding effects
- This is the "dial" that controls the entire system

**Expected Outcome:** Rim attempts drop to ~50-52%

---

### **PHASE 2: Reduce Position Adjustments** (Medium Risk)

**Impact:** -3% to -5% rim attempts

**File:** `src/systems/shooting.py` (lines 127-140)

**Current:**
```python
if position == 'C':
    distribution['rim'] += 0.25   # +25%
    distribution['3pt'] -= 0.30
elif position == 'PF':
    distribution['rim'] += 0.10   # +10%
    distribution['3pt'] -= 0.15
```

**Proposed:**
```python
if position == 'C':
    distribution['rim'] += 0.15   # Reduced from +25% to +15%
    distribution['3pt'] -= 0.25   # Reduced penalty from -30% to -25%
    distribution['midrange'] += 0.10  # Centers shoot more midrange
elif position == 'PF':
    distribution['rim'] += 0.05   # Reduced from +10% to +5%
    distribution['3pt'] -= 0.10   # Reduced penalty from -15% to -10%
    distribution['midrange'] += 0.05  # PFs shoot more midrange
```

**Rationale:**
- Modern NBA centers (Joel Embiid, Nikola Jokic, KAT) shoot more midrange and even some 3PT
- Position-based modifiers were too extreme
- Still preserves the "centers attack rim more" logic, but less aggressively

**Expected Outcome:** Rim attempts drop to ~47-49%

---

### **PHASE 3: Reduce Player Composite Bonuses** (Medium Risk)

**Impact:** -2% to -4% rim attempts

**File:** `src/systems/shooting.py` (lines 181-197)

**Current:**
```python
if composite_diff_rim >= 0:
    rim_bonus = composite_diff_rim * 0.008  # Up to +32% at composite=90
```

**Proposed:**
```python
if composite_diff_rim >= 0:
    rim_bonus = composite_diff_rim * 0.005  # Reduced: up to +20% at composite=90
```

**Rationale:**
- Elite finishers still get bonus, but less extreme
- +20% bonus (instead of +32%) still makes elite finishers attack rim significantly more
- Reduces the "specialist teams amplification" effect

**Expected Outcome:** Rim attempts drop to ~45-47%

---

### **PHASE 4: Reduce Transition Bonus** (Low Risk)

**Impact:** -2% to -3% rim attempts

**File:** `src/systems/shooting.py` (lines 216-219)

**Current:**
```python
if possession_context.is_transition:
    distribution['rim'] += 0.20  # +20%
```

**Proposed:**
```python
if possession_context.is_transition:
    distribution['rim'] += 0.15  # Reduced from +20% to +15%
```

**Rationale:**
- Transition still favors rim (fast breaks), but less aggressively
- NBA transition includes pull-up 3PT and midrange shots, not just layups
- Still preserves transition advantage for rim

**Expected Outcome:** Rim attempts drop to ~43-45%

---

### **PHASE 5: Increase Drive Kickout Rate** (Higher Risk, Major Impact)

**Impact:** -5% to -8% rim attempts

**File:** `src/systems/possession.py` (lines 278-312)

**Current:** Drive outcomes weighted by player composites with no explicit kickout floor.

**Proposed:** Add a minimum kickout rate to simulate NBA "drive and kick" offense.

**New Code Addition (after line 298):**
```python
# TUNING: Ensure minimum kickout rate for drive-and-kick offense
# NBA reality: ~35-40% of drives result in kickout to perimeter
MIN_KICKOUT_RATE = 0.30

if kickout_score / total_score < MIN_KICKOUT_RATE:
    # Boost kickout probability to reach minimum
    boost_needed = MIN_KICKOUT_RATE - (kickout_score / total_score)
    kickout_score += boost_needed * total_score
    # Reduce dunk/layup proportionally
    dunk_score *= (1.0 - boost_needed)
    layup_score *= (1.0 - boost_needed)
    # Recalculate total
    total_score = dunk_score + layup_score + kickout_score + turnover_score
```

**Rationale:**
- Modern NBA offense is drive-and-kick: drive collapses defense, kick to open shooter
- Current system allows elite finishers to finish drives too often (low kickout rate)
- Enforcing 30% minimum kickout creates more 3PT opportunities from drives
- This is realistic: Even elite finishers (Giannis, LeBron) kick out 30-35% of drives

**Expected Outcome:** Rim attempts drop to ~38-40%

---

### **PHASE 6: Reduce Bravery Modifier** (Low Risk, Small Impact)

**Impact:** -1% to -2% rim attempts

**File:** `src/constants.py` (line 263)

**Current:**
```python
BRAVERY_RIM_TENDENCY_SCALE = 0.002  # ±8% at ±40 bravery difference
```

**Proposed:**
```python
BRAVERY_RIM_TENDENCY_SCALE = 0.0015  # ±6% at ±40 bravery difference
```

**Rationale:**
- Bravery should influence rim attempts, but ±8% is too much
- Reducing to ±6% still preserves brave vs timid distinction

**Expected Outcome:** Rim attempts drop to ~37-39%

---

## Implementation Roadmap

### **Recommended Order (Safest → Most Impactful):**

1. **PHASE 1: Baseline Adjustment** (Start here - safest, fastest)
   - Change 3 numbers in constants.py
   - Run 20-game test
   - Expected: 57.6% → ~50-52%

2. **PHASE 2: Position Adjustments** (If still too high)
   - Modify position-based rim bonuses
   - Run 20-game test
   - Expected: ~50-52% → ~47-49%

3. **PHASE 3: Player Composite Bonuses** (If still too high)
   - Reduce elite finisher bonus
   - Run 20-game test
   - Expected: ~47-49% → ~45-47%

4. **PHASE 4: Transition Bonus** (If still too high)
   - Reduce transition rim boost
   - Run 20-game test
   - Expected: ~45-47% → ~43-45%

5. **PHASE 5: Drive Kickout Rate** (If still above 40%)
   - Add minimum kickout floor to drives
   - Run 20-game test
   - Expected: ~43-45% → ~38-40%

6. **PHASE 6: Bravery Modifier** (Fine-tuning)
   - Reduce bravery scale
   - Run 20-game test
   - Expected: ~38-40% → ~37-39%

### **Validation After Each Phase:**

Run a quick 20-game validation with the same teams/settings:
```bash
python analyze_shot_distribution.py  # Modified to run 20 games instead of 100
```

Check:
- Rim attempt %
- 3PT attempt %
- Midrange attempt %
- Overall FG%

**Target:** Rim attempts 35-37%, 3PT 38-42%, Midrange 22-28%

---

## Secondary Benefits

Once rim attempts are reduced to NBA levels, you should see:

1. **FG% Decreases** (68.3% rim → 60-62% rim)
   - Fewer easy layups/dunks
   - More contested shots overall

2. **PPG Increases** (100 → 108-112)
   - More 3PT attempts (3 points > 2 points)
   - Less reliance on 2-point rim shots

3. **Assists Increase** (18.7 → 22-25)
   - More drive-and-kick sequences (kickout Phase 5)
   - More ball movement to create 3PT looks

4. **Shot Distribution Matches NBA**
   - 3PT: 40%, Midrange: 25%, Rim: 35%
   - Modern NBA analytics-driven offense

---

## Risk Assessment

| Phase | Risk Level | Reversibility | Impact |
|-------|-----------|---------------|--------|
| Phase 1: Baseline | **LOW** | Easy (3 number changes) | HIGH |
| Phase 2: Position | **MEDIUM** | Easy (code revert) | MEDIUM |
| Phase 3: Composites | **MEDIUM** | Easy (1 number change) | MEDIUM |
| Phase 4: Transition | **LOW** | Easy (1 number change) | LOW |
| Phase 5: Kickout Rate | **HIGH** | Moderate (new logic) | HIGH |
| Phase 6: Bravery | **LOW** | Easy (1 number change) | LOW |

**Recommendation:** Start with Phases 1-4 (low/medium risk, easy to revert). Only proceed to Phase 5 if needed.

---

## Expected Timeline

- **Phase 1:** 15 minutes (change constants + 20-game test)
- **Phase 2:** 30 minutes (modify shooting.py + 20-game test)
- **Phase 3:** 15 minutes (change constant + 20-game test)
- **Phase 4:** 15 minutes (change constant + 20-game test)
- **Phase 5:** 1-2 hours (add new logic + debug + 20-game test)
- **Phase 6:** 15 minutes (change constant + 20-game test)

**Total:** 2-4 hours to reach target rim attempt rate

---

## Success Criteria

**Primary:**
- Rim attempts: 35-37% (currently 57.6%)
- 3PT attempts: 38-42% (currently 37.0%)
- Midrange attempts: 22-28% (currently 5.4%)

**Secondary:**
- FG% overall: 47-50% (currently 54.6%)
- FG% at rim: 60-62% (currently 68.3%)
- PPG: 108-114 (currently 100.2)

**Tertiary (Natural Consequences):**
- Assists per game: 24-27 (currently 18.7)
- Game flow more NBA-realistic
- Play-by-play reads like modern NBA offense

---

## Recommendation

**Start with Phase 1 (Baseline Adjustment).** This is the safest, fastest change with the highest impact. It addresses the foundational issue without touching complex logic.

If Phase 1 alone gets you to 45-50% rim attempts, you're 80% there. Then proceed to Phase 2-4 for fine-tuning.

Only implement Phase 5 (Drive Kickout Rate) if the first 4 phases don't get you below 40%.

**Your hypothesis is correct:** Fixing rim attempts will likely cause 3PT and midrange to self-correct naturally, since shot distribution normalizes to 100%. Reducing rim by 22.6% will force those attempts to distribute across 3PT and midrange.

---

## Questions for Review

1. Do you want to start with Phase 1 only and test?
2. Should I prepare a 20-game validation script (faster than 100 games)?
3. Any concerns about the midrange jump (5.4% → 28%)?
4. Should we validate against specific NBA teams for realism check?

---

**Next Step:** Await your approval to begin Phase 1 implementation.
