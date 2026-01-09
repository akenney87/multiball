"""
Debug test for M4.7 Shot Selection
Shows intermediate distribution values
"""

import sys
sys.path.insert(0, 'C:\\Users\\alexa\\desktop\\projects\\simulator')

from src.core.probability import calculate_composite
from src.constants import (
    SHOT_DISTRIBUTION_BASELINE,
    WEIGHTS_3PT,
    WEIGHTS_MIDRANGE,
    WEIGHTS_DUNK,
    WEIGHTS_LAYUP,
    BRAVERY_RIM_TENDENCY_SCALE
)

# Create test player
elite_3pt_shooter = {
    'name': "Elite 3PT Shooter",
    'position': "SG",
    'grip_strength': 90, 'arm_strength': 90, 'core_strength': 90,
    'agility': 90, 'acceleration': 90, 'top_speed': 90,
    'jumping': 30, 'reactions': 90, 'stamina': 80,
    'balance': 90, 'height': 75, 'durability': 80,
    'awareness': 90, 'creativity': 90, 'determination': 90,
    'bravery': 50, 'consistency': 90, 'composure': 90, 'patience': 90,
    'hand_eye_coordination': 90, 'throw_accuracy': 90, 'form_technique': 90,
    'finesse': 90, 'deception': 90, 'teamwork': 90
}

poor_3pt_shooter = {
    'name': "Poor 3PT Shooter",
    'position': "SG",
    'grip_strength': 30, 'arm_strength': 30, 'core_strength': 30,
    'agility': 30, 'acceleration': 30, 'top_speed': 30,
    'jumping': 30, 'reactions': 30, 'stamina': 80,
    'balance': 30, 'height': 75, 'durability': 80,
    'awareness': 30, 'creativity': 30, 'determination': 30,
    'bravery': 50, 'consistency': 30, 'composure': 30, 'patience': 30,
    'hand_eye_coordination': 30, 'throw_accuracy': 30, 'form_technique': 30,
    'finesse': 30, 'deception': 30, 'teamwork': 30
}

def calculate_distribution(shooter):
    """Manually calculate distribution following select_shot_type logic."""
    distribution = SHOT_DISTRIBUTION_BASELINE.copy()
    position = shooter['position']

    print(f"\n{shooter['name']} ({position})")
    print(f"  Step 1 - Baseline: 3pt={distribution['3pt']:.3f}, mid={distribution['midrange']:.3f}, rim={distribution['rim']:.3f}")

    # Position-based adjustments (SG = no change)

    # Calculate composites
    composite_3pt = calculate_composite(shooter, WEIGHTS_3PT)
    composite_mid = calculate_composite(shooter, WEIGHTS_MIDRANGE)
    composite_rim = (calculate_composite(shooter, WEIGHTS_DUNK) +
                     calculate_composite(shooter, WEIGHTS_LAYUP)) / 2.0

    print(f"  Composites: 3pt={composite_3pt:.1f}, mid={composite_mid:.1f}, rim={composite_rim:.1f}")

    # M4.7: Smooth composite-based shot selection
    if position not in ['C', 'PF']:
        composite_diff_3pt = composite_3pt - 50
        shot_selection_scale_3pt = 0.006  # Doubled from 0.003
        three_pt_bonus = composite_diff_3pt * shot_selection_scale_3pt
        distribution['3pt'] += three_pt_bonus
        distribution['midrange'] -= three_pt_bonus * 0.6
        distribution['rim'] -= three_pt_bonus * 0.4
        print(f"  Step 2 - 3PT modifier ({three_pt_bonus:+.3f}): 3pt={distribution['3pt']:.3f}, mid={distribution['midrange']:.3f}, rim={distribution['rim']:.3f}")

    # Rim modifier
    composite_diff_rim = composite_rim - 50
    shot_selection_scale_rim = 0.006  # Doubled from 0.003
    rim_bonus = composite_diff_rim * shot_selection_scale_rim
    distribution['rim'] += rim_bonus
    distribution['3pt'] -= rim_bonus * 0.5
    distribution['midrange'] -= rim_bonus * 0.5
    print(f"  Step 3 - Rim modifier ({rim_bonus:+.3f}): 3pt={distribution['3pt']:.3f}, mid={distribution['midrange']:.3f}, rim={distribution['rim']:.3f}")

    # Bravery
    bravery = shooter.get('bravery', 50)
    bravery_rim_bonus = (bravery - 50) * BRAVERY_RIM_TENDENCY_SCALE
    distribution['rim'] += bravery_rim_bonus
    distribution['3pt'] -= bravery_rim_bonus * 0.6
    distribution['midrange'] -= bravery_rim_bonus * 0.4
    print(f"  Step 4 - Bravery ({bravery_rim_bonus:+.3f}): 3pt={distribution['3pt']:.3f}, mid={distribution['midrange']:.3f}, rim={distribution['rim']:.3f}")

    # Total before normalization
    total = sum(distribution.values())
    print(f"  Step 5 - Before normalize (sum={total:.3f}): 3pt={distribution['3pt']:.3f}, mid={distribution['midrange']:.3f}, rim={distribution['rim']:.3f}")

    # Normalize
    normalized = {k: v/total for k, v in distribution.items()}
    print(f"  Step 6 - After normalize: 3pt={normalized['3pt']:.3f} ({normalized['3pt']*100:.1f}%), mid={normalized['midrange']:.3f} ({normalized['midrange']*100:.1f}%), rim={normalized['rim']:.3f} ({normalized['rim']*100:.1f}%)")

    return normalized

print("=" * 80)
print("M4.7 SHOT SELECTION DEBUG")
print("=" * 80)

dist_elite = calculate_distribution(elite_3pt_shooter)
dist_poor = calculate_distribution(poor_3pt_shooter)

print("\n" + "=" * 80)
print("COMPARISON")
print("=" * 80)
print(f"Elite 3PT%: {dist_elite['3pt']*100:.1f}%")
print(f"Poor 3PT%: {dist_poor['3pt']*100:.1f}%")
print(f"Ratio: {dist_elite['3pt'] / dist_poor['3pt']:.2f}x")
