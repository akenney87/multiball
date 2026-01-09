# PHASE 1 & 2 Attribute Refactoring - Complete Summary

## Executive Summary

Successfully implemented all requested attribute refactoring changes across 7 weight dictionaries in 3 files. All weight sums verified to equal 1.0, and all attributes are from the canonical 25-attribute list.

**User Confirmations Applied:**
1. Consistency: Add variance to final probability (±0.8% for 90 consistency, ±8% for 10 consistency)
2. Stamina: ±15% drain, ±13% recovery rates (happy medium)
3. Help Defense: Use 5-attribute version from constants.py (teamwork, awareness, reactions, agility, determination)

---

## PHASE 1: Fix Help Defense Inconsistency

### Changes Made

**File:** `src/systems/defense.py`

**Issue:** Two different help defense weight dictionaries existed:
- Old 3-attribute version in `defense.py` (height, reactions, agility)
- New 5-attribute version in `constants.py` (teamwork, awareness, reactions, agility, determination)

**Resolution:**
1. Removed `HELP_DEFENSE_WEIGHTS` from `defense.py` (lines 35-40)
2. Updated `select_help_defender()` function (line 408) to use `WEIGHTS_HELP_DEFENSE_ROTATION` from `constants.py`
3. Updated imports to ensure `WEIGHTS_HELP_DEFENSE_ROTATION` is available

**Basketball Rationale:**
The 5-attribute version better captures help defense:
- **teamwork (0.30)**: Team-first mindset, willingness to help
- **awareness (0.30)**: Reading when help is needed
- **reactions (0.20)**: Quick rotation speed
- **agility (0.12)**: Lateral movement to help position
- **determination (0.08)**: Effort and hustle

---

## PHASE 2: Weight Dictionary Updates

### 1. SHOOTING_FOUL_WEIGHTS_DEFENDER (fouls.py)

**Change:** Removed `patience`, redistributed to remaining attributes

**BEFORE (5 attributes, sum = 1.00):**
```python
{
    'composure': 0.30,
    'awareness': 0.25,
    'patience': 0.20,
    'agility': 0.15,
    'reactions': 0.10,
}
```

**AFTER (4 attributes, sum = 1.00):**
```python
{
    'composure': 0.375,     # +0.075 (37.5%)
    'awareness': 0.3125,    # +0.0625 (31.25%)
    'agility': 0.1875,      # +0.0375 (18.75%)
    'reactions': 0.125,     # +0.025 (12.5%)
}
```

**Basketball Rationale:**
- **composure (37.5%)**: Most important for staying calm and not reaching/hacking
- **awareness (31.25%)**: Knowing when NOT to foul, understanding offensive player intentions
- **agility (18.75%)**: Staying in front of offensive player without fouling
- **reactions (12.5%)**: Quick hands and defensive adjustments without fouling

**Redistribution Method:** Proportional to original weights (each attribute gets its share of the removed 0.20)

---

### 2. WEIGHTS_LAYUP (constants.py)

**Change:** Added `core_strength` and `throw_accuracy`

**BEFORE (4 attributes, sum = 1.00):**
```python
{
    'finesse': 0.35,
    'hand_eye_coordination': 0.30,
    'balance': 0.20,
    'jumping': 0.15,
}
```

**AFTER (6 attributes, sum = 1.00):**
```python
{
    'finesse': 0.30,                    # -0.05 (30.0%)
    'hand_eye_coordination': 0.25,      # -0.05 (25.0%)
    'balance': 0.17,                    # -0.03 (17.0%)
    'jumping': 0.13,                    # -0.02 (13.0%)
    'core_strength': 0.10,              # NEW (10.0%)
    'throw_accuracy': 0.05,             # NEW (5.0%)
}
```

**Basketball Rationale:**
- **core_strength (10%)**: Finishing through contact at the rim, absorbing body blows, maintaining control while being fouled
- **throw_accuracy (5%)**: Soft touch for floaters, finger rolls, high-arcing layups around rim protectors
- Finesse and hand_eye reduced most as they conceptually overlap with the new additions
- Layups require both finesse AND physicality - this balance is now captured

---

### 3. WEIGHTS_DRIVE_LAYUP (constants.py)

**Change:** Added `core_strength` and `throw_accuracy`

**BEFORE (5 attributes, sum = 1.00):**
```python
{
    'finesse': 0.25,
    'hand_eye_coordination': 0.30,
    'balance': 0.20,
    'jumping': 0.15,
    'acceleration': 0.10,
}
```

**AFTER (7 attributes, sum = 1.00):**
```python
{
    'finesse': 0.22,                    # -0.03 (22.0%)
    'hand_eye_coordination': 0.26,      # -0.04 (26.0%)
    'balance': 0.17,                    # -0.03 (17.0%)
    'jumping': 0.13,                    # -0.02 (13.0%)
    'acceleration': 0.10,               # UNCHANGED (10.0%)
    'core_strength': 0.10,              # NEW (10.0%)
    'throw_accuracy': 0.02,             # NEW (2.0%)
}
```

**Basketball Rationale:**
- **core_strength (10%)**: Even more critical on drives - absorbing contact while attacking the rim in traffic
- **throw_accuracy (2%)**: Smaller role than standard layups because drives prioritize power/explosiveness over touch
- **acceleration (10%)**: Unchanged - first step burst is critical for beating defenders on drives
- Slightly different distribution than WEIGHTS_LAYUP to reflect the explosiveness-focused nature of drives

---

### 4. WEIGHTS_REBOUND (constants.py)

**Change:** Added `arm_strength`

**BEFORE (7 attributes, sum = 1.00):**
```python
{
    'height': 0.22,
    'jumping': 0.18,
    'core_strength': 0.14,
    'awareness': 0.18,
    'grip_strength': 0.10,
    'reactions': 0.09,
    'determination': 0.09,
}
```

**AFTER (8 attributes, sum = 1.00):**
```python
{
    'height': 0.20,                     # -0.02 (20.0%)
    'jumping': 0.16,                    # -0.02 (16.0%)
    'core_strength': 0.13,              # -0.01 (13.0%)
    'awareness': 0.17,                  # -0.01 (17.0%)
    'grip_strength': 0.10,              # UNCHANGED (10.0%)
    'arm_strength': 0.09,               # NEW (9.0%)
    'reactions': 0.08,                  # -0.01 (8.0%)
    'determination': 0.07,              # -0.02 (7.0%)
}
```

**Basketball Rationale:**
- **arm_strength (9%)**: Ripping ball out of air, boxing out opponents with physicality, wrestling for position
- **grip_strength (10%)**: Unchanged - critical for securing ball once possessed
- Height/jumping still most important (36% combined) for getting to ball first
- Awareness still critical (17%) for anticipating trajectory and positioning
- Minor reductions across board preserve relative importance hierarchy

---

### 5 & 6. WEIGHTS_CONTEST (constants.py)

**Change:** Added `balance` and `determination` (expanded from 3 to 5 attributes)

**BEFORE (3 attributes, sum = 1.00):**
```python
{
    'height': 0.3333,
    'reactions': 0.3333,
    'agility': 0.3334,
}
```

**AFTER (5 attributes, sum = 1.00):**
```python
{
    'height': 0.25,                     # -0.0833 (25.0%)
    'reactions': 0.25,                  # -0.0833 (25.0%)
    'agility': 0.25,                    # -0.0834 (25.0%)
    'balance': 0.15,                    # NEW (15.0%)
    'determination': 0.10,              # NEW (10.0%)
}
```

**Basketball Rationale:**
- **balance (15%)**: Maintaining defensive stance, staying in front without getting beat on cuts, body control while contesting
- **determination (10%)**: Hustle, chasing down shots, fighting through screens to contest, effort plays
- Physical tools (height, reactions, agility) remain equal at 25% each
- Contest now captures physical tools (75%) AND mental/effort components (25%)
- More realistic representation of what makes a good contest

---

### 7. WEIGHTS_FIND_OPEN_TEAMMATE (constants.py)

**Change:** Added `throw_accuracy`

**BEFORE (5 attributes, sum = 1.00):**
```python
{
    'creativity': 0.30,
    'awareness': 0.30,
    'teamwork': 0.20,
    'composure': 0.12,
    'hand_eye_coordination': 0.08,
}
```

**AFTER (6 attributes, sum = 1.00):**
```python
{
    'creativity': 0.25,                 # -0.05 (25.0%)
    'awareness': 0.25,                  # -0.05 (25.0%)
    'teamwork': 0.20,                   # UNCHANGED (20.0%)
    'throw_accuracy': 0.15,             # NEW (15.0%)
    'composure': 0.10,                  # -0.02 (10.0%)
    'hand_eye_coordination': 0.05,      # -0.03 (5.0%)
}
```

**Basketball Rationale:**
- **throw_accuracy (15%)**: Significant weight - delivering accurate passes to open teammates is critical for playmaking
- **creativity (25%)** and **awareness (25%)**: Still most important for FINDING open players (court vision)
- **teamwork (20%)**: Unchanged - it's about willingness to pass, not ability
- **hand_eye_coordination (5%)**: Reduced because throw_accuracy better captures passing precision
- **composure (10%)**: Decision-making under pressure slightly reduced

---

### 8. WEIGHTS_DRIVE_KICKOUT (constants.py)

**Change:** Added `throw_accuracy`

**BEFORE (3 attributes, sum = 1.00):**
```python
{
    'teamwork': 0.40,
    'awareness': 0.35,
    'composure': 0.25,
}
```

**AFTER (4 attributes, sum = 1.00):**
```python
{
    'teamwork': 0.35,                   # -0.05 (35.0%)
    'awareness': 0.30,                  # -0.05 (30.0%)
    'composure': 0.20,                  # -0.05 (20.0%)
    'throw_accuracy': 0.15,             # NEW (15.0%)
}
```

**Basketball Rationale:**
- **throw_accuracy (15%)**: Very important for kickouts - delivering accurate passes while driving under defensive pressure
- All attributes reduced equally (5% each) to maintain relative importance balance
- Kickouts require quick, accurate passes to perimeter shooters (often on the move)
- Throw_accuracy captures ability to deliver catchable passes to moving targets in tight windows

---

## Validation Results

**All weight dictionaries validated successfully:**

1. All sums equal 1.0 (within 0.0001 tolerance)
2. All attributes from canonical 25-attribute list
3. All weights positive
4. Basketball rationale sound for all changes

**Files Modified:**
- `src/systems/defense.py` (PHASE 1)
- `src/systems/fouls.py` (PHASE 2, change #1)
- `src/constants.py` (PHASE 2, changes #2-8)

**Validation Script:** `validate_weight_sums.py`

---

## Summary of Attribute Additions

### Attributes Added to Multiple Systems

**core_strength:**
- WEIGHTS_LAYUP (10%) - finishing through contact
- WEIGHTS_DRIVE_LAYUP (10%) - absorbing contact on drives

**throw_accuracy:**
- WEIGHTS_LAYUP (5%) - soft touch for floaters/finger rolls
- WEIGHTS_DRIVE_LAYUP (2%) - touch on difficult finishes
- WEIGHTS_FIND_OPEN_TEAMMATE (15%) - accurate passes to open players
- WEIGHTS_DRIVE_KICKOUT (15%) - accurate passes while driving

**Single-System Additions:**
- arm_strength → WEIGHTS_REBOUND (9%)
- balance → WEIGHTS_CONTEST (15%)
- determination → WEIGHTS_CONTEST (10%)

### Attributes Removed
- patience → removed from SHOOTING_FOUL_WEIGHTS_DEFENDER

---

## Basketball Realism Assessment

All changes enhance basketball realism:

1. **Physicality in Finishing:** Core strength now properly impacts rim finishing
2. **Touch/Accuracy:** Throw accuracy captures soft touch on layups and passing precision
3. **Rebounding Physicality:** Arm strength captures boxing out and wrestling for position
4. **Contest Depth:** Balance and determination add mental/effort components to contesting
5. **Passing Accuracy:** Throw accuracy properly weighted in playmaking scenarios
6. **Help Defense:** 5-attribute version better captures team defense mindset

---

## Next Steps

No further action required for PHASE 1 & 2. All changes implemented, validated, and documented.

**For future reference:**
- All weight dictionaries sum to 1.0
- All attributes are from the canonical 25-attribute list
- Basketball rationale documented for each change
- Changes align with Pillar #3 (Attribute-Driven Outcomes)

---

**Generated:** 2025-11-09
**Status:** COMPLETE
