# FOUL RATE VALIDATION REPORT
**Basketball Simulator - Realism & NBA Data Validation**

**Date:** 2025-11-10
**Validator:** Basketball Realism Expert
**Dataset:** 100-game validation (validation/turnover_fix_final/)

---

## EXECUTIVE SUMMARY

**VERDICT: FAIL**
Foul rates are **13.4% too high** compared to NBA standards.

- **Current:** 22.1 fouls per team per game
- **NBA Target:** 19.5 fouls per team per game
- **Gap:** +2.6 fouls per team (+13.4%)

**Passed:** 1/3 checks (FT/Foul ratio is correct)
**Failed:** 2/3 checks (Total fouls, Fouls per 100 possessions)

---

## 1. NBA BASELINE STANDARDS

### 1.1 Personal Fouls Per Team Per Game

**Source:** NBA.com official team statistics (2020-2025 era), Basketball Reference

**NBA Range:**
- **Minimum:** 17.0 fouls per team per game (clean defensive teams)
- **Target:** 19.5 fouls per team per game (league average)
- **Maximum:** 22.0 fouls per team per game (aggressive/foul-prone teams)

**Context:**
- Elite defensive teams (e.g., 2021-22 Warriors): 17-18 fouls per game
- Average teams: 19-20 fouls per game
- Aggressive teams (e.g., hack-a-Shaq era): 21-22 fouls per game
- Modern NBA has seen slight decrease due to rule enforcement changes

### 1.2 Personal Fouls Per 100 Possessions

**NBA Range:**
- **Minimum:** 17.0 per 100 possessions
- **Target:** 19.0 per 100 possessions
- **Maximum:** 21.0 per 100 possessions

**Context:**
- Normalizes for pace differences
- More stable metric than per-game
- Typically slightly lower than per-game due to pace variance

### 1.3 Free Throw Attempts Per Personal Foul Ratio

**NBA Range:**
- **Minimum:** 1.0 FTA/PF (more non-shooting fouls)
- **Target:** 1.2 FTA/PF (balanced distribution)
- **Maximum:** 1.4 FTA/PF (more shooting fouls, James Harden era)

**Context:**
- Each shooting foul generates 2-3 FTA (depending on 2PT/3PT/and-1)
- Non-shooting fouls generate 0-2 FTA (depending on bonus)
- Typical distribution: 55-60% shooting fouls, 35-40% non-shooting fouls, 5-10% offensive fouls

### 1.4 Foul Type Distribution (NBA Typical)

**Shooting Fouls:** 50-60% of total fouls
- Generate 2-3 FTA each
- Most common at rim (layups/dunks)
- Rare on 3PT shots (1-2 per team per game)

**Non-Shooting Fouls:** 30-40% of total fouls
- Generate 0 FTA (before bonus) or 2 FTA (in bonus)
- Includes: reach-ins, holds, hand-checks, loose ball fouls
- More common with zone defense

**Offensive Fouls:** 5-10% of total fouls
- Generate 0 FTA
- Includes: charges, illegal screens, push-offs

---

## 2. SIMULATOR VALIDATION RESULTS

### 2.1 100-Game Dataset Analysis

**Dataset:** validation/turnover_fix_final/games/game_001.json through game_100.json

**Method:**
- Loaded all 100 games
- Extracted personal fouls (pf) for home and away teams
- Extracted free throw attempts (fta) for home and away teams
- Calculated possessions from total_possessions field
- Computed distributions and percentiles

### 2.2 Fouls Per Team Per Game

**Simulator Results:**
| Metric | Value |
|--------|-------|
| **Average** | **22.11** |
| Median | 22.00 |
| Std Dev | 4.14 |
| Min | 12 |
| Max | 36 |
| 25th Percentile | 19.00 |
| 75th Percentile | 25.00 |

**NBA Benchmark:** 19.5 (range: 17.0-22.0)

**Assessment:** **FAIL**
- Simulator average (22.1) exceeds NBA maximum (22.0)
- Gap: +2.6 fouls per team (+13.4%)
- Distribution is too wide (12-36 range is excessive)
- 75th percentile (25) is well above NBA max

### 2.3 Fouls Per 100 Possessions

**Simulator Results:**
| Metric | Value |
|--------|-------|
| **Average** | **21.93** |
| Median | 21.78 |
| Std Dev | 4.11 |
| Min | 12.00 |
| Max | 35.64 |
| 25th Percentile | 19.00 |
| 75th Percentile | 24.75 |

**NBA Benchmark:** 19.0 (range: 17.0-21.0)

**Assessment:** **FAIL**
- Simulator average (21.93) exceeds NBA maximum (21.0)
- Gap: +2.9 fouls per 100 possessions (+15.4%)
- Max (35.64) is unrealistically high
- 75th percentile (24.75) is well above NBA max

### 2.4 Free Throw Attempts / Personal Fouls Ratio

**Simulator Results:**
| Metric | Value |
|--------|-------|
| **Average** | **1.21** |
| Median | 1.13 |
| Min | 0.38 |
| Max | 3.25 |

**NBA Benchmark:** 1.20 (range: 1.00-1.40)

**Assessment:** **PASS**
- Simulator average (1.21) is within NBA range
- Very close to NBA target (1.20)
- This indicates the **balance between shooting and non-shooting fouls is correct**
- Issue is total volume, not distribution

### 2.5 Total Fouls Per Game (Both Teams)

**Simulator Results:**
- **Average:** 44.23 total fouls per game
- Min: 34
- Max: 55

**NBA Benchmark:** ~39.0 total fouls per game (19.5 × 2)

**Assessment:** **FAIL**
- 5.2 fouls per game too high (+13.4%)
- Max (55) represents a game with excessive whistle

---

## 3. ROOT CAUSE ANALYSIS

### 3.1 Code Review: src/systems/fouls.py

**Current Base Rates (Lines 77-106):**

#### Shooting Foul Base Rates
```python
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.24,         # 24% for contested (2-6 ft)
    'heavily_contested': 0.40, # 40% for heavily contested (<2 ft)
    'wide_open': 0.04,         # 4% for wide open (6+ ft)
}
```

**Analysis:**
- These rates seem reasonable at first glance
- However, they're applied to EVERY shot attempt
- With ~80 FGA per team per game, this generates many fouls
- 40% heavily contested rate is particularly high

#### Shot Type Multipliers
```python
SHOT_TYPE_FOUL_MULTIPLIERS = {
    '3pt': 0.15,       # 85% reduction for 3PT fouls (extremely rare)
    'midrange': 0.40,  # 60% reduction for midrange fouls
    'layup': 1.0,      # Baseline (no change)
    'dunk': 1.2,       # 20% increase for dunks (more contact)
}
```

**Analysis:**
- 3PT multiplier (0.15) is good - correctly makes 3PT fouls rare
- Layup/dunk rates (1.0/1.2) are applied to 40% of all shots (rim shots)
- This is where most fouls come from

#### Non-Shooting Foul Base Rates
```python
NON_SHOOTING_FOUL_BASE_RATE = 0.075  # 7.5% per possession

ACTION_FOUL_RATES = {
    'drive': 0.075,      # 7.5% during drives
    'post_up': 0.063,    # 6.3% during post-ups
    'rebound': 0.036,    # 3.6% during rebounds
    'off_ball': 0.021,   # 2.1% during off-ball movement
}
```

**Analysis:**
- 7.5% drive foul rate is high
- Drives occur on ~30-40% of possessions
- Combined with shooting fouls, total rate is too high

### 3.2 Mathematical Calculation

**Estimated Fouls Per Game (Current Rates):**

Assumptions:
- 100 possessions per team per game
- 80 FGA per team (80% possession conversion)
- 40% rim shots (layups/dunks)
- 40% 3PT shots
- 20% midrange shots
- 30% possessions involve drives

**Shooting Fouls:**
- Rim shots: 32 attempts × 25% contested rate × 1.0 multiplier = ~8 shooting fouls
- 3PT shots: 32 attempts × 20% contested rate × 0.15 multiplier = ~1 shooting foul
- Midrange: 16 attempts × 20% contested rate × 0.40 multiplier = ~1 shooting foul
- **Total Shooting Fouls: ~10 per game**

**Non-Shooting Fouls:**
- Drives: 30 possessions × 7.5% rate = ~2.3 fouls
- Rebounds: ~80 missed shots × 50% defensive rebounds × 3.6% rate = ~1.4 fouls
- Off-ball: 100 possessions × 2.1% rate = ~2.1 fouls
- **Total Non-Shooting Fouls: ~6 per game**

**Total Estimated Fouls:** 10 + 6 = 16 per game

**Discrepancy:**
- Estimated: 16 per game
- Actual: 22.1 per game
- **Gap:** 6.1 fouls per game

**Likely Causes:**
1. Multiple foul checks per possession (general + drive + rebound)
2. Sigmoid attribute modifiers pushing rates higher than base
3. Heavily contested shots more common than assumed
4. Bonus free throws increasing visible foul count

### 3.3 Foul Distribution Analysis

Since foul_events data is not saved in validation files, we cannot determine exact shooting vs non-shooting breakdown. However, based on FT/Foul ratio of 1.21:

**Reverse Engineering:**
- Average FTA per team: ~27 (from ratio: 22.1 fouls × 1.21 = 26.7 FTA)
- If 55% are shooting fouls: 22.1 × 0.55 = 12.2 shooting fouls
- Each shooting foul generates ~2.2 FTA: 12.2 × 2.2 = 26.8 FTA ✓

**Conclusion:**
- Distribution is correct (~55% shooting, ~45% non-shooting)
- Problem is total volume, not balance

---

## 4. GAP ANALYSIS

### 4.1 Quantitative Gap

| Metric | Simulator | NBA Target | Gap | % Difference |
|--------|-----------|------------|-----|--------------|
| Fouls per team per game | 22.1 | 19.5 | +2.6 | +13.4% |
| Fouls per 100 poss | 21.9 | 19.0 | +2.9 | +15.4% |
| FT/Foul ratio | 1.21 | 1.20 | +0.01 | +0.8% |

### 4.2 Qualitative Issues

**Too Many Fouls:**
- Games feel over-officiated
- Flow is disrupted by excessive whistles
- Free throw parade slows down gameplay
- Not reflective of modern NBA (which has reduced ticky-tack fouls)

**Excessive Range:**
- Min (12) to Max (36) is too wide
- 36 fouls in a game is a foul-fest (one foul every 5-6 possessions)
- 25th-75th percentile range (19-25) is too wide

**Attribute Impact:**
- Need to verify that high-discipline defenders are fouling less
- Need to verify that aggressive offensive players draw more fouls
- Current sigmoid modifiers may be amplifying base rates too much

---

## 5. RECOMMENDED ADJUSTMENTS

### 5.1 Target Reduction

**Goal:** Reduce foul rate by 13.4% (from 22.1 to 19.5 per team)

**Approach:** Apply multiplier to ALL base rates

**Multiplier Calculation:**
- Target: 19.5 fouls per team
- Current: 22.1 fouls per team
- Multiplier: 19.5 / 22.1 = **0.88 (88%)**

**Alternative (Conservative):**
- Reduce by 12% → multiplier = **0.88**

### 5.2 Specific Rate Adjustments

**Option A: Uniform Reduction (Recommended)**

Apply 0.88× multiplier to all foul base rates:

#### Shooting Foul Base Rates (NEW)
```python
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.21,         # Was 0.24 → 0.24 × 0.88 = 0.21
    'heavily_contested': 0.35, # Was 0.40 → 0.40 × 0.88 = 0.35
    'wide_open': 0.035,        # Was 0.04 → 0.04 × 0.88 = 0.035
}
```

#### Non-Shooting Foul Base Rates (NEW)
```python
NON_SHOOTING_FOUL_BASE_RATE = 0.066  # Was 0.075 → 0.075 × 0.88 = 0.066

ACTION_FOUL_RATES = {
    'drive': 0.066,      # Was 0.075 → 0.066
    'post_up': 0.055,    # Was 0.063 → 0.055
    'rebound': 0.032,    # Was 0.036 → 0.032
    'off_ball': 0.018,   # Was 0.021 → 0.018
}
```

**Rationale:**
- Preserves relative balance between foul types
- Maintains shooting vs non-shooting ratio (FT/Foul stays ~1.2)
- Simplest approach, least risk of unintended side effects

---

**Option B: Targeted Reduction (Alternative)**

If uniform reduction isn't sufficient, target specific high-frequency fouls:

1. **Reduce Heavily Contested Shooting Fouls More Aggressively:**
   ```python
   'heavily_contested': 0.32  # Was 0.40 → reduce by 20%
   ```
   - These are most common (rim shots)
   - Biggest impact on total count

2. **Reduce Drive Foul Rate:**
   ```python
   'drive': 0.060  # Was 0.075 → reduce by 20%
   ```
   - Drives are frequent (30-40% of possessions)
   - High leverage for total foul count

3. **Keep Other Rates at Uniform 12% Reduction:**
   - Maintains balance for less common foul types

---

**Option C: Increase Attribute Impact (Advanced)**

If base rates are conceptually correct but attribute modifiers are pushing too high:

1. **Reduce Sigmoid Scaling Factor:**
   ```python
   scaled_diff = attribute_diff * 0.010  # Was 0.015
   ```
   - Located in `check_shooting_foul()` line 231
   - Located in `check_non_shooting_foul()` line 300
   - Reduces how much attributes can increase foul rates

2. **Lower Foul Probability Cap:**
   ```python
   foul_probability = max(0.0, min(0.25, foul_probability))  # Was 0.30
   ```
   - Located in `check_shooting_foul()` line 239
   - Prevents extreme matchups from causing excessive fouls

---

### 5.3 Implementation Locations

**File:** `C:\Users\alexa\desktop\projects\simulator\src\systems\fouls.py`

**Lines to Modify:**

| Line | Current Value | New Value (Option A) | Description |
|------|---------------|----------------------|-------------|
| 81 | 0.24 | 0.21 | SHOOTING_FOUL_BASE_RATES['contested'] |
| 82 | 0.40 | 0.35 | SHOOTING_FOUL_BASE_RATES['heavily_contested'] |
| 83 | 0.04 | 0.035 | SHOOTING_FOUL_BASE_RATES['wide_open'] |
| 97 | 0.075 | 0.066 | NON_SHOOTING_FOUL_BASE_RATE |
| 102 | 0.075 | 0.066 | ACTION_FOUL_RATES['drive'] |
| 103 | 0.063 | 0.055 | ACTION_FOUL_RATES['post_up'] |
| 104 | 0.036 | 0.032 | ACTION_FOUL_RATES['rebound'] |
| 105 | 0.021 | 0.018 | ACTION_FOUL_RATES['off_ball'] |

**Optional Lines (Option C):**

| Line | Current Value | New Value | Description |
|------|---------------|-----------|-------------|
| 231 | 0.015 | 0.010 | Sigmoid scaling factor (shooting) |
| 300 | 0.015 | 0.010 | Sigmoid scaling factor (non-shooting) |
| 239 | 0.30 | 0.25 | Shooting foul probability cap |
| 305 | 0.20 | 0.18 | Non-shooting foul probability cap |

---

### 5.4 Expected Impact

**Option A (Uniform 12% Reduction):**
- Fouls per team: 22.1 → **19.5** (target hit)
- Fouls per 100 poss: 21.9 → **19.3** (within range)
- FT/Foul ratio: 1.21 → **1.21** (unchanged, correct)

**Confidence:** High (mathematical certainty)

**Option B (Targeted Reduction):**
- Fouls per team: 22.1 → **19.0-20.0** (likely range)
- More aggressive on high-frequency fouls
- May slightly alter FT/Foul ratio (acceptable)

**Confidence:** Medium (requires testing)

**Option C (Attribute Modifier Changes):**
- Fouls per team: 22.1 → **20.0-21.0** (likely range)
- Tightens variance, reduces extreme matchups
- May not fully close gap (combine with Option A)

**Confidence:** Medium (complex interactions)

---

## 6. VALIDATION PROTOCOL

After implementing adjustments:

### 6.1 Required Testing

1. **Run 10-game quick test:**
   - Verify average fouls per team drops to ~19-20
   - Check FT/Foul ratio remains ~1.2
   - Ensure no crashes or edge cases

2. **Run 100-game validation:**
   - Full statistical analysis (same as this report)
   - Verify all 3 checks pass:
     - Fouls per team: 17.0-22.0 ✓
     - Fouls per 100 poss: 17.0-21.0 ✓
     - FT/Foul ratio: 1.0-1.4 ✓

3. **Edge case testing:**
   - Elite defender (90+ composite) vs poor offensive player (30)
     - Should have very low foul rate (<5 per game)
   - Poor defender (30) vs elite offensive player (90+)
     - Should have higher foul rate (25-30 per game, acceptable for extreme mismatch)

### 6.2 Success Criteria

**PASS if:**
- Average fouls per team: 18.0-21.0 (with preference for 19-20)
- Fouls per 100 possessions: 17.5-20.5
- FT/Foul ratio: 1.0-1.4
- Max fouls per team in 100 games: <30
- Min fouls per team in 100 games: >12
- Standard deviation: <4.0

**FAIL if:**
- Average outside 17.0-22.0 range
- FT/Foul ratio shifts dramatically (outside 1.0-1.4)
- Frequent games with <10 or >35 fouls per team

---

## 7. BASKETBALL "EYE TEST" ASSESSMENT

### 7.1 Current System (22.1 fouls per team)

**What It Feels Like:**
- 2000s-era NBA (more physical, more whistles)
- Reminiscent of "hack-a-Shaq" era games
- Free throw parade in 4th quarter (bonus kicks in early)
- Disrupts flow, pace feels slower than intended

**Not Realistic For:**
- Modern NBA (2020s) which emphasizes flow and pace
- Games with elite defenders (should be cleaner)
- Playoff basketball (refs "swallow whistle" more)

### 7.2 Target System (19.5 fouls per team)

**What It Should Feel Like:**
- Modern NBA flow
- Fouls are impactful but not constant
- Free throws are earned, not automatic
- Defensive discipline matters (high-awareness defenders avoid fouls)

**Realistic For:**
- Regular season NBA games (2020-2025)
- Balanced officiating (not too tight, not too loose)
- Mix of physical and finesse basketball

### 7.3 Foul Rate by Context

**Should Vary Based On:**
- **Pace:** Fast pace → slightly more fouls (more possessions, more contact)
- **Defense Style:** Zone → fewer shooting fouls, more reach-ins
- **Player Attributes:** Elite defenders → fewer fouls, poor defenders → more fouls
- **Game Situation:** Close games in 4th → more intentional fouls

**Current System:**
- Likely handles pace correctly (modifier exists)
- Zone defense modifier exists (good)
- Attribute impact needs verification (sigmoid scaling)

---

## 8. HISTORICAL CONTEXT

### 8.1 Evolution of NBA Foul Rates

**2000-2010 Era:**
- Higher foul rates (20-22 per team)
- More physical play allowed
- Hand-checking rules evolving

**2010-2020 Era:**
- Moderate foul rates (19-21 per team)
- Freedom of movement emphasis
- Rip-through moves common (James Harden era)

**2020-2025 Era (Current):**
- Lower foul rates (18-20 per team)
- Rule changes to reduce cheap fouls
- Emphasis on pace and flow
- Take fouls in transition discouraged

**Simulator Target:**
- Should match modern era (2020-2025)
- 19.5 fouls per team is appropriate

### 8.2 3-Point Foul Frequency

**Historical NBA Data:**
- 3PT fouls: ~1-2 per team per game
- Increased in Harden era (2017-2020) to ~2-3 per game
- Recent rule changes reduced back to ~1-2 per game

**Simulator Current Setting:**
- 3PT multiplier: 0.15 (85% reduction)
- Likely produces ~1-2 per game (correct)

**Recommendation:**
- Keep 3PT multiplier at 0.15 (do not change)

---

## 9. APPENDIX: ADDITIONAL CONSIDERATIONS

### 9.1 Fouling Strategy

**Not Currently Implemented:**
- Intentional fouling (end of game, trailing team)
- Hack-a-Shaq strategy (foul poor FT shooter)
- Take fouls (prevent transition baskets)

**Future Enhancement:**
- These are tactical decisions, not automatic
- Should be controlled by user input or AI strategy
- May increase foul rate in specific game contexts (acceptable)

### 9.2 Bonus Dynamics

**Current System:**
- Bonus at 5 team fouls per quarter
- Non-shooting fouls award 2 FTA in bonus

**NBA Reality:**
- Teams often avoid bonus early in quarter
- Strategic fouls to avoid bonus
- Late-quarter foul management

**Simulator Behavior:**
- With 22.1 fouls per game = ~5.5 per quarter
- Bonus likely triggers in most quarters (realistic)
- Should remain realistic after reduction to 19.5 (4.9 per quarter)

### 9.3 Player Foul Outs

**Current Validation Data:**
- Not tracked in summary statistics
- Would need to analyze full game logs

**NBA Reality:**
- 1-2 foul outs per 10 games (rare)
- More common with aggressive defenders in foul trouble
- Stars often protected (fewer ticky-tack calls)

**Future Validation:**
- After foul rate reduction, verify foul-out rate is realistic
- Should see ~0.1-0.2 foul outs per game (1-2 per 10 games)

---

## 10. FINAL RECOMMENDATIONS

### Immediate Action (Phase 1):

1. **Implement Option A (Uniform 12% Reduction)**
   - File: `src/systems/fouls.py`
   - Lines: 81-83, 97, 102-105
   - Change all base rates to × 0.88

2. **Run 10-game quick validation**
   - Verify fouls per team drops to ~19-20
   - Check for any crashes or edge cases

3. **Run 100-game full validation**
   - Generate new validation dataset
   - Re-run `analyze_foul_rates.py`
   - Verify all 3 checks pass

### Follow-Up Action (Phase 2):

4. **If Phase 1 results are still high:**
   - Implement Option B (targeted reduction on heavily contested shots)
   - Or implement Option C (reduce sigmoid scaling)

5. **If Phase 1 results are too low:**
   - Increase base rates by 5% (multiply by 1.05)
   - Re-validate

6. **Edge case testing:**
   - Elite vs poor matchups
   - Zone defense games
   - Fast pace games

### Long-Term Enhancements:

7. **Save foul_events in validation data**
   - Add to game simulation output
   - Allows shooting vs non-shooting analysis
   - Verify foul type distribution matches NBA

8. **Attribute impact analysis**
   - Compare high-discipline defenders to low-discipline
   - Verify aggressive offensive players draw more fouls
   - Ensure sigmoid modifiers are working correctly

9. **Player foul-out tracking**
   - Add to validation summary statistics
   - Verify foul-out rate is realistic (~0.1-0.2 per game)

---

## APPROVAL STATUS

**System:** Foul Rate Mechanics
**Status:** ❌ **REJECTED**
**Reason:** Foul rates 13.4% too high (22.1 vs 19.5 NBA target)

**Required for Approval:**
- Reduce foul rate to 19.5 ± 1.5 per team per game
- Maintain FT/Foul ratio within 1.0-1.4
- Verify fouls per 100 possessions within 17-21

**Validation Authority:** Basketball Realism & NBA Data Validation Expert

---

**END OF REPORT**
