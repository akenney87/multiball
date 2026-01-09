# FOUL RATE ADJUSTMENT PROPOSAL
**Quick Reference Guide for Implementation**

---

## PROBLEM SUMMARY

**Current State:** 22.1 fouls per team per game (13.4% too high)
**NBA Target:** 19.5 fouls per team per game
**Required Reduction:** 2.6 fouls per team (-12%)

**Status:**
- ❌ Fouls per team: 22.1 (target: 19.5, range: 17.0-22.0)
- ❌ Fouls per 100 poss: 21.9 (target: 19.0, range: 17.0-21.0)
- ✓ FT/Foul ratio: 1.21 (target: 1.20, range: 1.0-1.4) **CORRECT**

---

## RECOMMENDED SOLUTION

**Option A: Uniform 12% Reduction** (RECOMMENDED - Simplest and Most Reliable)

Apply 0.88× multiplier to ALL foul base rates.

**Why This Works:**
- Mathematical certainty: 22.1 × 0.88 = 19.4 (within target range)
- Preserves foul type balance (FT/Foul ratio stays at 1.21)
- Minimal risk of unintended side effects
- One-line change per constant

---

## CODE CHANGES

### File: `src/systems/fouls.py`

### Change 1: Shooting Foul Base Rates (Lines 80-84)

**BEFORE:**
```python
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.24,         # 24% for contested (2-6 ft) [M4.5: 2.0x]
    'heavily_contested': 0.40, # 40% for heavily contested (<2 ft) [M4.5: 2.0x]
    'wide_open': 0.04,         # 4% for wide open (6+ ft, rare) [M4.5: 2.0x]
}
```

**AFTER:**
```python
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.21,         # 21% for contested (2-6 ft) [REALISM: 0.88x for NBA target]
    'heavily_contested': 0.35, # 35% for heavily contested (<2 ft) [REALISM: 0.88x for NBA target]
    'wide_open': 0.035,        # 3.5% for wide open (6+ ft, rare) [REALISM: 0.88x for NBA target]
}
```

---

### Change 2: Non-Shooting Foul Base Rate (Line 97)

**BEFORE:**
```python
NON_SHOOTING_FOUL_BASE_RATE = 0.075  # 7.5% per possession (generic) [M4.5: 3.0x]
```

**AFTER:**
```python
NON_SHOOTING_FOUL_BASE_RATE = 0.066  # 6.6% per possession (generic) [REALISM: 0.88x for NBA target]
```

---

### Change 3: Action-Specific Foul Rates (Lines 101-106)

**BEFORE:**
```python
ACTION_FOUL_RATES = {
    'drive': 0.075,      # 7.5% during drives (reach-in fouls) [M4.5: 3.0x]
    'post_up': 0.063,    # 6.3% during post-ups (holding) [M4.5: 3.0x]
    'rebound': 0.036,    # 3.6% during rebounds (loose ball fouls) [M4.5: 3.0x]
    'off_ball': 0.021,   # 2.1% during off-ball movement (hand-checking/holding) [M4.5: 3.0x]
}
```

**AFTER:**
```python
ACTION_FOUL_RATES = {
    'drive': 0.066,      # 6.6% during drives (reach-in fouls) [REALISM: 0.88x for NBA target]
    'post_up': 0.055,    # 5.5% during post-ups (holding) [REALISM: 0.88x for NBA target]
    'rebound': 0.032,    # 3.2% during rebounds (loose ball fouls) [REALISM: 0.88x for NBA target]
    'off_ball': 0.018,   # 1.8% during off-ball movement (hand-checking/holding) [REALISM: 0.88x for NBA target]
}
```

---

## PRECISE VALUES (Copy-Paste Ready)

```python
# Lines 80-84: SHOOTING_FOUL_BASE_RATES
'contested': 0.21,
'heavily_contested': 0.35,
'wide_open': 0.035,

# Line 97: NON_SHOOTING_FOUL_BASE_RATE
NON_SHOOTING_FOUL_BASE_RATE = 0.066

# Lines 102-105: ACTION_FOUL_RATES
'drive': 0.066,
'post_up': 0.055,
'rebound': 0.032,
'off_ball': 0.018,
```

---

## CALCULATION DETAILS

| Constant | Old Value | Multiplier | New Value | Calculation |
|----------|-----------|------------|-----------|-------------|
| contested | 0.24 | 0.88 | 0.21 | 0.24 × 0.88 = 0.2112 ≈ 0.21 |
| heavily_contested | 0.40 | 0.88 | 0.35 | 0.40 × 0.88 = 0.352 ≈ 0.35 |
| wide_open | 0.04 | 0.88 | 0.035 | 0.04 × 0.88 = 0.0352 ≈ 0.035 |
| NON_SHOOTING | 0.075 | 0.88 | 0.066 | 0.075 × 0.88 = 0.066 |
| drive | 0.075 | 0.88 | 0.066 | 0.075 × 0.88 = 0.066 |
| post_up | 0.063 | 0.88 | 0.055 | 0.063 × 0.88 = 0.05544 ≈ 0.055 |
| rebound | 0.036 | 0.88 | 0.032 | 0.036 × 0.88 = 0.03168 ≈ 0.032 |
| off_ball | 0.021 | 0.88 | 0.018 | 0.021 × 0.88 = 0.01848 ≈ 0.018 |

---

## EXPECTED IMPACT

### Before Changes:
- Fouls per team per game: **22.1**
- Fouls per 100 possessions: **21.9**
- FT/Foul ratio: **1.21**

### After Changes (Predicted):
- Fouls per team per game: **19.4** (target: 19.5) ✓
- Fouls per 100 possessions: **19.3** (target: 19.0) ✓
- FT/Foul ratio: **1.21** (unchanged) ✓

### Confidence: **95%**
- Mathematical certainty on proportional reduction
- Minimal risk to foul type distribution

---

## DO NOT CHANGE

These values should remain unchanged:

### Shot Type Multipliers (Lines 88-93)
```python
SHOT_TYPE_FOUL_MULTIPLIERS = {
    '3pt': 0.15,       # KEEP - 3PT fouls are correctly rare
    'midrange': 0.40,  # KEEP - Balanced
    'layup': 1.0,      # KEEP - Baseline
    'dunk': 1.2,       # KEEP - Correct rim foul frequency
}
```

**Reason:** 3PT foul frequency is already realistic (~1-2 per game). Foul type distribution is correct.

### Rare Fouls (Lines 109-110)
```python
FLAGRANT_FOUL_RATE = 0.005   # KEEP
TECHNICAL_FOUL_RATE = 0.003  # KEEP
```

**Reason:** These are already extremely rare and realistic.

---

## ALTERNATIVE SOLUTIONS

### Option B: Targeted Reduction (If Option A Insufficient)

**Only if Option A doesn't fully fix the issue:**

1. **Reduce heavily contested rate more aggressively:**
   ```python
   'heavily_contested': 0.32,  # Was 0.40 → 20% reduction instead of 12%
   ```
   - Justification: Rim shots are most common source of fouls

2. **Reduce drive rate more aggressively:**
   ```python
   'drive': 0.060,  # Was 0.075 → 20% reduction instead of 12%
   ```
   - Justification: Drives occur 30-40% of possessions

3. **Keep other rates at 12% reduction**

---

### Option C: Adjust Sigmoid Modifiers (Advanced)

**Only if attribute impact is pushing rates too high:**

**File:** `src/systems/fouls.py`

**Change 1: Shooting Foul Sigmoid Scaling (Line 231)**

BEFORE:
```python
scaled_diff = attribute_diff * 0.015
```

AFTER:
```python
scaled_diff = attribute_diff * 0.010  # Reduced from 0.015 to reduce attribute impact
```

**Change 2: Non-Shooting Foul Sigmoid Scaling (Line 300)**

BEFORE:
```python
scaled_diff = attribute_diff * 0.015
```

AFTER:
```python
scaled_diff = attribute_diff * 0.010  # Reduced from 0.015 to reduce attribute impact
```

**Change 3: Shooting Foul Probability Cap (Line 239)**

BEFORE:
```python
foul_probability = max(0.0, min(0.30, foul_probability))  # Cap at 30%
```

AFTER:
```python
foul_probability = max(0.0, min(0.25, foul_probability))  # Cap at 25%
```

**Expected Impact:** Additional 5-10% reduction in extreme matchups

---

## VALIDATION CHECKLIST

After implementing changes:

### Quick Test (10 games):
- [ ] Average fouls per team: 18-21
- [ ] FT/Foul ratio: 1.0-1.4
- [ ] No crashes or errors
- [ ] No games with >30 fouls per team

### Full Validation (100 games):
- [ ] Average fouls per team: 17.0-22.0 (prefer 19-20)
- [ ] Fouls per 100 possessions: 17.0-21.0
- [ ] FT/Foul ratio: 1.0-1.4
- [ ] Standard deviation: <4.0
- [ ] Max fouls per team: <30
- [ ] Min fouls per team: >12

### Edge Cases:
- [ ] Elite defender (90+) vs poor offense (30): <15 fouls per game
- [ ] Poor defender (30) vs elite offense (90+): 25-30 fouls acceptable
- [ ] Zone defense: Verify foul distribution shifts (fewer shooting, more reach-ins)

---

## TESTING COMMAND

```bash
cd C:\Users\alexa\desktop\projects\simulator
python scripts\run_validation.py --games 100 --output validation/foul_fix_attempt1/
python analyze_foul_rates.py
```

---

## ROLLBACK PLAN

If changes cause issues:

1. **Revert all constants to original values**
2. **Consult Option B or Option C**
3. **Test with smaller multiplier (0.90 instead of 0.88)**

**Original Values (For Rollback):**
```python
SHOOTING_FOUL_BASE_RATES = {
    'contested': 0.24,
    'heavily_contested': 0.40,
    'wide_open': 0.04,
}

NON_SHOOTING_FOUL_BASE_RATE = 0.075

ACTION_FOUL_RATES = {
    'drive': 0.075,
    'post_up': 0.063,
    'rebound': 0.036,
    'off_ball': 0.021,
}
```

---

## APPROVAL CRITERIA

**System APPROVED if:**
- ✓ Average fouls per team: 18.0-21.0
- ✓ Fouls per 100 possessions: 17.5-20.5
- ✓ FT/Foul ratio: 1.0-1.4
- ✓ Max fouls in 100 games: <30
- ✓ Standard deviation: <4.0

**System REJECTED if:**
- ❌ Average outside 17.0-22.0
- ❌ FT/Foul ratio outside 1.0-1.4 (distribution broken)
- ❌ Frequent games with <10 or >35 fouls

---

**END OF PROPOSAL**
