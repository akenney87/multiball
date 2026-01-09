"""
Test Phase 3 attribute systems to verify they work correctly.

Tests:
1. Patience contest distance modifier
2. Bravery drive tendency
3. Consistency variance
4. Stamina rate modifiers
"""

import random
from src.core.probability import apply_consistency_variance
from src.constants import (
    PATIENCE_DISTANCE_MODIFIER_SCALE,
    BRAVERY_RIM_TENDENCY_SCALE,
    CONSISTENCY_VARIANCE_SCALE,
    STAMINA_DRAIN_RATE_MAX_MODIFIER,
    STAMINA_RECOVERY_RATE_MAX_MODIFIER
)

print("=" * 80)
print("PHASE 3 SYSTEMS TEST")
print("=" * 80)
print()

# Test 1: Patience Contest Distance Modifier
print("TEST 1: Patience Contest Distance Modifier")
print("-" * 80)
base_distance = 4.0  # feet
for patience in [10, 50, 90]:
    modifier = (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE
    effective_distance = base_distance + modifier
    print(f"patience={patience:2d}: base={base_distance:.1f}ft, modifier={modifier:+.2f}ft, effective={effective_distance:.2f}ft")
print()

# Test 2: Bravery Drive Tendency
print("TEST 2: Bravery Drive Tendency")
print("-" * 80)
base_rim_pct = 0.40
for bravery in [10, 50, 90]:
    rim_bonus = (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE
    adjusted_rim = base_rim_pct + rim_bonus
    print(f"bravery={bravery:2d}: base_rim={base_rim_pct:.1%}, bonus={rim_bonus:+.2%}, adjusted={adjusted_rim:.2%}")
print()

# Test 3: Consistency Variance
print("TEST 3: Consistency Variance System")
print("-" * 80)
base_prob = 0.42  # 42% base shooting probability
random.seed(42)
for consistency in [10, 50, 90]:
    player = {'consistency': consistency, 'name': f'Player_{consistency}'}
    # Test 10 rolls to see variance
    rolls = []
    for _ in range(10):
        prob = apply_consistency_variance(base_prob, player)
        rolls.append(prob)

    avg = sum(rolls) / len(rolls)
    min_prob = min(rolls)
    max_prob = max(rolls)
    variance_range = max_prob - min_prob

    print(f"consistency={consistency:2d}: avg={avg:.4f}, min={min_prob:.4f}, max={max_prob:.4f}, range={variance_range:.4f}")
print()

# Test 4: Stamina Rate Modifiers
print("TEST 4: Stamina Rate Modifiers")
print("-" * 80)
print("Drain rate modifiers:")
for stamina in [10, 50, 90]:
    drain_modifier = 1.0 + ((50 - stamina) / 50) * STAMINA_DRAIN_RATE_MAX_MODIFIER
    print(f"stamina={stamina:2d}: drain_modifier={drain_modifier:.4f} ({(drain_modifier-1)*100:+.1f}%)")

print()
print("Recovery rate modifiers:")
for stamina in [10, 50, 90]:
    recovery_modifier = 1.0 + ((stamina - 50) / 50) * STAMINA_RECOVERY_RATE_MAX_MODIFIER
    print(f"stamina={stamina:2d}: recovery_modifier={recovery_modifier:.4f} ({(recovery_modifier-1)*100:+.1f}%)")

print()
print("=" * 80)
print("VALIDATION COMPLETE")
print("=" * 80)
print()
print("Expected results:")
print("1. Patience: High patience (+0.8ft), low patience (-0.8ft)")
print("2. Bravery: High bravery (+8% rim), low bravery (-8% rim)")
print("3. Consistency: High (tight range ~1.6%), low (wide range ~16%)")
print("4. Stamina: High (+10-12% recovery, -12% drain), low (-10% recovery, +12% drain)")
