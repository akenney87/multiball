# Attribute Refactoring - Quick Reference Table

## PHASE 1: Help Defense Fix

| File | Line | Old | New |
|------|------|-----|-----|
| defense.py | 36-40 | HELP_DEFENSE_WEIGHTS (3 attrs) | REMOVED - use WEIGHTS_HELP_DEFENSE_ROTATION from constants |
| defense.py | 408 | `calculate_composite(helper, HELP_DEFENSE_WEIGHTS)` | `calculate_composite(helper, WEIGHTS_HELP_DEFENSE_ROTATION)` |

---

## PHASE 2: Weight Dictionary Updates

### 1. SHOOTING_FOUL_WEIGHTS_DEFENDER (fouls.py:113-119)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| composure | 0.30 | 0.375 | +0.075 | Staying calm, not reaching/hacking |
| awareness | 0.25 | 0.3125 | +0.0625 | Knowing when NOT to foul |
| patience | 0.20 | REMOVED | -0.20 | Removed per user request |
| agility | 0.15 | 0.1875 | +0.0375 | Staying in front without contact |
| reactions | 0.10 | 0.125 | +0.025 | Quick hands without fouling |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **4 attributes** |

---

### 2. WEIGHTS_LAYUP (constants.py:77-85)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| finesse | 0.35 | 0.30 | -0.05 | Touch and body control |
| hand_eye_coordination | 0.30 | 0.25 | -0.05 | Coordination and timing |
| balance | 0.20 | 0.17 | -0.03 | Staying upright on contact |
| jumping | 0.15 | 0.13 | -0.02 | Elevating over defenders |
| core_strength | - | 0.10 | +0.10 | NEW: Finishing through contact |
| throw_accuracy | - | 0.05 | +0.05 | NEW: Soft touch for floaters |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **6 attributes** |

---

### 3. WEIGHTS_DRIVE_LAYUP (constants.py:129-137)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| hand_eye_coordination | 0.30 | 0.26 | -0.04 | Coordination while driving |
| finesse | 0.25 | 0.22 | -0.03 | Touch and body control |
| balance | 0.20 | 0.17 | -0.03 | Staying upright through contact |
| jumping | 0.15 | 0.13 | -0.02 | Elevating in traffic |
| acceleration | 0.10 | 0.10 | 0.00 | First-step burst (unchanged) |
| core_strength | - | 0.10 | +0.10 | NEW: Absorbing contact on drives |
| throw_accuracy | - | 0.02 | +0.02 | NEW: Touch on difficult finishes |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **7 attributes** |

---

### 4. WEIGHTS_REBOUND (constants.py:89-98)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| height | 0.22 | 0.20 | -0.02 | Reach advantage |
| awareness | 0.18 | 0.17 | -0.01 | Anticipating trajectory |
| jumping | 0.18 | 0.16 | -0.02 | Elevating for ball |
| core_strength | 0.14 | 0.13 | -0.01 | Balance and positioning |
| grip_strength | 0.10 | 0.10 | 0.00 | Securing ball (unchanged) |
| arm_strength | - | 0.09 | +0.09 | NEW: Ripping ball, boxing out |
| reactions | 0.09 | 0.08 | -0.01 | Quick response to miss |
| determination | 0.09 | 0.07 | -0.02 | Hustle and effort |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **8 attributes** |

---

### 5 & 6. WEIGHTS_CONTEST (constants.py:102-108)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| height | 0.3333 | 0.25 | -0.0833 | Reach and size advantage |
| reactions | 0.3333 | 0.25 | -0.0833 | Quick closeout timing |
| agility | 0.3334 | 0.25 | -0.0834 | Lateral movement |
| balance | - | 0.15 | +0.15 | NEW: Defensive stance, staying in front |
| determination | - | 0.10 | +0.10 | NEW: Hustle, effort to contest |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **5 attributes** |

---

### 7. WEIGHTS_FIND_OPEN_TEAMMATE (constants.py:196-203)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| creativity | 0.30 | 0.25 | -0.05 | Seeing unconventional passes |
| awareness | 0.30 | 0.25 | -0.05 | Court vision |
| teamwork | 0.20 | 0.20 | 0.00 | Willingness to share (unchanged) |
| throw_accuracy | - | 0.15 | +0.15 | NEW: Delivering accurate passes |
| composure | 0.12 | 0.10 | -0.02 | Decision-making under pressure |
| hand_eye_coordination | 0.08 | 0.05 | -0.03 | General coordination |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **6 attributes** |

---

### 8. WEIGHTS_DRIVE_KICKOUT (constants.py:145-150)

| Attribute | Before | After | Change | Rationale |
|-----------|--------|-------|--------|-----------|
| teamwork | 0.40 | 0.35 | -0.05 | Willingness to kick out |
| awareness | 0.35 | 0.30 | -0.05 | Finding open shooters |
| composure | 0.25 | 0.20 | -0.05 | Decision-making under pressure |
| throw_accuracy | - | 0.15 | +0.15 | NEW: Accurate passes while driving |
| **TOTAL** | **1.00** | **1.00** | **0.00** | **4 attributes** |

---

## Attribute Usage Summary

### New Attributes Added (by frequency)

| Attribute | Systems | Total Weight | Usage |
|-----------|---------|--------------|-------|
| throw_accuracy | 4 systems | 0.37 | Layups (5%), Drive Layups (2%), Find Open (15%), Kickouts (15%) |
| core_strength | 2 systems | 0.20 | Layups (10%), Drive Layups (10%) |
| arm_strength | 1 system | 0.09 | Rebounds (9%) |
| balance | 1 system | 0.15 | Contest (15%) |
| determination | 1 system | 0.10 | Contest (10%) |

### Attributes Removed

| Attribute | Removed From | Weight Lost |
|-----------|--------------|-------------|
| patience | SHOOTING_FOUL_WEIGHTS_DEFENDER | 0.20 |

---

## Files Modified

1. **src/systems/defense.py**
   - Removed HELP_DEFENSE_WEIGHTS (old 3-attribute version)
   - Updated select_help_defender() to use WEIGHTS_HELP_DEFENSE_ROTATION

2. **src/systems/fouls.py**
   - Updated SHOOTING_FOUL_WEIGHTS_DEFENDER (removed patience)

3. **src/constants.py**
   - Updated WEIGHTS_LAYUP
   - Updated WEIGHTS_DRIVE_LAYUP
   - Updated WEIGHTS_REBOUND
   - Updated WEIGHTS_CONTEST
   - Updated WEIGHTS_FIND_OPEN_TEAMMATE
   - Updated WEIGHTS_DRIVE_KICKOUT

---

## Validation Status

**All dictionaries validated:**
- Sum = 1.0 (within 0.0001 tolerance) ✓
- All attributes from canonical 25-attribute list ✓
- All weights positive ✓
- Basketball rationale sound ✓

**Validation script:** `validate_weight_sums.py`

---

**Date:** 2025-11-09
**Status:** COMPLETE
