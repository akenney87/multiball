"""
Test M4.7 Shot Selection Enhancement
Validates smooth composite-based shot distribution scaling
"""

import sys
sys.path.insert(0, 'C:\\Users\\alexa\\desktop\\projects\\simulator')

from src.systems.shooting import select_shot_type
from src.core.data_structures import TacticalSettings, PossessionContext

# Create test players with extreme attributes
def create_test_player(name, position, three_pt_composite, rim_composite):
    """Create test player with specified composites."""
    # All attributes set to match desired composite (since weights sum to 1.0)
    return {
        'name': name,
        'position': position,
        # Physical
        'grip_strength': three_pt_composite,
        'arm_strength': three_pt_composite,
        'core_strength': three_pt_composite,
        'agility': three_pt_composite,
        'acceleration': three_pt_composite,
        'top_speed': three_pt_composite,
        'jumping': rim_composite,
        'reactions': three_pt_composite,
        'stamina': 80,
        'balance': three_pt_composite,
        'height': 75,
        'durability': 80,
        # Mental
        'awareness': three_pt_composite,
        'creativity': three_pt_composite,
        'determination': three_pt_composite,
        'bravery': 50,  # Neutral to avoid bravery modifier
        'consistency': three_pt_composite,
        'composure': three_pt_composite,
        'patience': three_pt_composite,
        # Technical
        'hand_eye_coordination': three_pt_composite,
        'throw_accuracy': three_pt_composite,
        'form_technique': three_pt_composite,
        'finesse': three_pt_composite,
        'deception': three_pt_composite,
        'teamwork': three_pt_composite,
    }

# Test cases
elite_3pt_shooter = create_test_player("Elite 3PT Shooter", "SG", 90, 30)
poor_3pt_shooter = create_test_player("Poor 3PT Shooter", "SG", 30, 30)
elite_rim_finisher = create_test_player("Elite Rim Finisher", "SF", 50, 90)
poor_rim_finisher = create_test_player("Poor Rim Finisher", "SF", 50, 30)

# Baseline tactical settings (neutral)
neutral_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

# Baseline possession context (no transition, no score differential)
neutral_context = PossessionContext(
    is_transition=False,
    shot_clock=24,
    score_differential=0,
    game_time_remaining=720
)

print("=" * 70)
print("M4.7 SHOT SELECTION VALIDATION")
print("=" * 70)
print()

# Test 1: Elite vs Poor 3PT shooter
print("TEST 1: Elite vs Poor 3PT Shooter (SG position)")
print("-" * 70)

# Run 1000 simulations to get distribution
elite_3pt_counts = {'3pt': 0, 'midrange': 0, 'rim': 0}
poor_3pt_counts = {'3pt': 0, 'midrange': 0, 'rim': 0}

for _ in range(1000):
    elite_shot = select_shot_type(elite_3pt_shooter, neutral_tactics, neutral_context, 'man')
    poor_shot = select_shot_type(poor_3pt_shooter, neutral_tactics, neutral_context, 'man')
    elite_3pt_counts[elite_shot] += 1
    poor_3pt_counts[poor_shot] += 1

print(f"Elite 3PT Shooter (composite=90):")
print(f"  3PT: {elite_3pt_counts['3pt']/10:.1f}%")
print(f"  Mid: {elite_3pt_counts['midrange']/10:.1f}%")
print(f"  Rim: {elite_3pt_counts['rim']/10:.1f}%")
print()

print(f"Poor 3PT Shooter (composite=30):")
print(f"  3PT: {poor_3pt_counts['3pt']/10:.1f}%")
print(f"  Mid: {poor_3pt_counts['midrange']/10:.1f}%")
print(f"  Rim: {poor_3pt_counts['rim']/10:.1f}%")
print()

elite_3pt_pct = elite_3pt_counts['3pt'] / 10
poor_3pt_pct = poor_3pt_counts['3pt'] / 10
ratio_3pt = elite_3pt_pct / poor_3pt_pct if poor_3pt_pct > 0 else 0
print(f"Ratio (Elite/Poor 3PT attempts): {ratio_3pt:.2f}x")
print(f"Expected: ~2.0x or higher (PM agent target)")
print()

# Test 2: Elite vs Poor rim finisher
print("TEST 2: Elite vs Poor Rim Finisher (SF position)")
print("-" * 70)

elite_rim_counts = {'3pt': 0, 'midrange': 0, 'rim': 0}
poor_rim_counts = {'3pt': 0, 'midrange': 0, 'rim': 0}

for _ in range(1000):
    elite_shot = select_shot_type(elite_rim_finisher, neutral_tactics, neutral_context, 'man')
    poor_shot = select_shot_type(poor_rim_finisher, neutral_tactics, neutral_context, 'man')
    elite_rim_counts[elite_shot] += 1
    poor_rim_counts[poor_shot] += 1

print(f"Elite Rim Finisher (composite=90):")
print(f"  3PT: {elite_rim_counts['3pt']/10:.1f}%")
print(f"  Mid: {elite_rim_counts['midrange']/10:.1f}%")
print(f"  Rim: {elite_rim_counts['rim']/10:.1f}%")
print()

print(f"Poor Rim Finisher (composite=30):")
print(f"  3PT: {poor_rim_counts['3pt']/10:.1f}%")
print(f"  Mid: {poor_rim_counts['midrange']/10:.1f}%")
print(f"  Rim: {poor_rim_counts['rim']/10:.1f}%")
print()

elite_rim_pct = elite_rim_counts['rim'] / 10
poor_rim_pct = poor_rim_counts['rim'] / 10
ratio_rim = elite_rim_pct / poor_rim_pct if poor_rim_pct > 0 else 0
print(f"Ratio (Elite/Poor rim attempts): {ratio_rim:.2f}x")
print(f"Expected: ~2.0x or higher (PM agent target)")
print()

# Test 3: Position restrictions (Center shouldn't benefit from 3PT composite)
print("TEST 3: Position Restrictions (Center with elite 3PT composite)")
print("-" * 70)

elite_3pt_center = create_test_player("Elite 3PT Center", "C", 90, 90)
center_counts = {'3pt': 0, 'midrange': 0, 'rim': 0}

for _ in range(1000):
    shot = select_shot_type(elite_3pt_center, neutral_tactics, neutral_context, 'man')
    center_counts[shot] += 1

print(f"Elite 3PT Center (C, composite=90):")
print(f"  3PT: {center_counts['3pt']/10:.1f}%")
print(f"  Mid: {center_counts['midrange']/10:.1f}%")
print(f"  Rim: {center_counts['rim']/10:.1f}%")
print()
print("Expected: Very low 3PT% due to position-based reduction (-30%)")
print("and no 3PT composite bonus applied to Centers")
print()

print("=" * 70)
print("VALIDATION COMPLETE")
print("=" * 70)
