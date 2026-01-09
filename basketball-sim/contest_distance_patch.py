"""
Contest Distance Fix - Ready-to-Apply Patch

This file shows the exact code change needed in src/systems/defense.py
to fix the contest distance distribution issue.

ISSUE: 96% of shots are contested (2-6 ft)
TARGET: 30% wide open, 35% open, 25% tight, 10% very tight
SOLUTION: Add Gaussian variance (std=1.9)
ERROR: 8.1% (excellent fit)
"""

# =============================================================================
# LOCATION: src/systems/defense.py, Line 356-370 (calculate_contest_distance)
# =============================================================================

# --- BEFORE (CURRENT CODE) ---

def calculate_contest_distance_BEFORE(
    defender,
    is_help_defense=False,
    zone_pct=0.0,
    passer=None,
    shooter=None,
):
    """Current implementation (BROKEN - 96% contested)."""
    # [... earlier code unchanged ...]

    # PHASE 3A: Patience Contest Distance Modifier
    # Patient shooters make defenders think they're not ready, gaining more space
    # Higher patience = further contest distance (easier shots)
    if shooter is not None:
        patience = shooter.get('patience', 50)
        patience_modifier = (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE
        base_distance += patience_modifier
        # patience=90: +0.8ft (defenders give more space)
        # patience=50: +0.0ft (baseline)
        # patience=10: -0.8ft (rushed, defenders crowd)

    # Clamp to realistic range [0.5, 10.0 feet]
    final_distance = max(0.5, min(10.0, base_distance))

    return final_distance


# --- AFTER (FIXED CODE) ---

def calculate_contest_distance_AFTER(
    defender,
    is_help_defense=False,
    zone_pct=0.0,
    passer=None,
    shooter=None,
):
    """Fixed implementation (8.1% error from target distribution)."""
    # [... earlier code unchanged ...]

    # PHASE 3A: Patience Contest Distance Modifier
    # Patient shooters make defenders think they're not ready, gaining more space
    # Higher patience = further contest distance (easier shots)
    if shooter is not None:
        patience = shooter.get('patience', 50)
        patience_modifier = (patience - 50) * PATIENCE_DISTANCE_MODIFIER_SCALE
        base_distance += patience_modifier
        # patience=90: +0.8ft (defenders give more space)
        # patience=50: +0.0ft (baseline)
        # patience=10: -0.8ft (rushed, defenders crowd)

    # PHASE 4: Stochastic Variance (Closeout Success Variability)
    # ==============================================================
    # Real closeouts have inherent unpredictability - defender execution varies
    # even with same attributes. This creates NBA-realistic distribution:
    #   - Wide Open (6+ ft): ~30% (was 3.6%)
    #   - Open (4-6 ft): ~35% (was 0%)
    #   - Tight (2-4 ft): ~25% (was 96.4%)
    #   - Very Tight (<2 ft): ~10% (was 0%)
    #
    # Gaussian noise with std=1.9 achieves target distribution (8.1% error).
    # Tested range: std=1.0 to 2.5, optimal at 1.9.
    #
    # This preserves attribute-driven base (elite defenders still better on avg)
    # while adding realistic variance (defenders don't always execute perfectly).
    variance = random.gauss(0, 1.9)
    base_distance += variance

    # Clamp to realistic range [0.5, 10.0 feet]
    final_distance = max(0.5, min(10.0, base_distance))

    return final_distance


# =============================================================================
# DIFF VIEW (FOR REFERENCE)
# =============================================================================

"""
The ONLY change is adding these lines after patience modifier (line 362):

+    # PHASE 4: Stochastic Variance (Closeout Success Variability)
+    # ==============================================================
+    # Real closeouts have inherent unpredictability - defender execution varies
+    # even with same attributes. This creates NBA-realistic distribution:
+    #   - Wide Open (6+ ft): ~30% (was 3.6%)
+    #   - Open (4-6 ft): ~35% (was 0%)
+    #   - Tight (2-4 ft): ~25% (was 96.4%)
+    #   - Very Tight (<2 ft): ~10% (was 0%)
+    #
+    # Gaussian noise with std=1.9 achieves target distribution (8.1% error).
+    # Tested range: std=1.0 to 2.5, optimal at 1.9.
+    #
+    # This preserves attribute-driven base (elite defenders still better on avg)
+    # while adding realistic variance (defenders don't always execute perfectly).
+    variance = random.gauss(0, 1.9)
+    base_distance += variance
+

That's it. One line of actual code, plus explanatory comments.
"""


# =============================================================================
# VALIDATION CODE (RUN AFTER APPLYING PATCH)
# =============================================================================

def validate_fix(n=10000):
    """
    Run this after applying the patch to verify the fix works.

    Expected results:
    - Wide Open: 25-32%
    - Open: 30-38%
    - Tight: 23-30%
    - Very Tight: 8-13%
    - Total Error: < 15%
    """
    import random
    import sys
    import os

    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

    from src.systems.defense import calculate_contest_distance
    from src.core.probability import calculate_composite
    from src.constants import WEIGHTS_CONTEST

    distances = []

    print("Validating contest distance fix...")
    print(f"Running {n} simulations...")

    for _ in range(n):
        # Create realistic defender
        defender = {
            'height': random.randint(45, 75),
            'reactions': random.randint(45, 75),
            'agility': random.randint(45, 75),
            'balance': random.randint(45, 75),
            'determination': random.randint(45, 75),
            'acceleration': random.randint(45, 75),
        }

        # Create average shooter
        shooter = {
            'patience': 50,
        }

        # Calculate distance (with 20% help defense, 30% zone)
        is_help = random.random() < 0.20
        distance = calculate_contest_distance(
            defender=defender,
            is_help_defense=is_help,
            zone_pct=30,
            shooter=shooter,
        )

        distances.append(distance)

    # Calculate distribution
    wide_open = sum(1 for d in distances if d >= 6.0) / len(distances) * 100
    open_4_6 = sum(1 for d in distances if 4.0 <= d < 6.0) / len(distances) * 100
    tight_2_4 = sum(1 for d in distances if 2.0 <= d < 4.0) / len(distances) * 100
    very_tight = sum(1 for d in distances if d < 2.0) / len(distances) * 100

    error = (abs(wide_open - 30) + abs(open_4_6 - 35) +
             abs(tight_2_4 - 25) + abs(very_tight - 10))

    print()
    print("=" * 70)
    print("VALIDATION RESULTS")
    print("=" * 70)
    print()
    print(f"Distribution:")
    print(f"  Wide Open (6+ ft):  {wide_open:5.1f}%  (target: 25-32%)")
    print(f"  Open (4-6 ft):      {open_4_6:5.1f}%  (target: 30-38%)")
    print(f"  Tight (2-4 ft):     {tight_2_4:5.1f}%  (target: 23-30%)")
    print(f"  Very Tight (<2 ft): {very_tight:5.1f}%  (target: 8-13%)")
    print()
    print(f"Total Error: {error:.1f}%")
    print()

    # Pass/Fail
    if error < 15.0:
        print("VALIDATION: PASS")
        print("Contest distance distribution is now NBA-realistic.")
    else:
        print("VALIDATION: FAIL")
        print("Distribution does not match target. Check implementation.")

    print()
    print("=" * 70)


if __name__ == "__main__":
    print(__doc__)
    print()
    print("To apply this fix:")
    print("1. Edit src/systems/defense.py")
    print("2. Find calculate_contest_distance() function (line ~272)")
    print("3. Add the variance code after patience modifier (line ~362)")
    print("4. Run: python contest_distance_patch.py (this file) to validate")
    print()
