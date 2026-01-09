"""
Comprehensive M4.7 Shot Selection Test
Validates both 3PT and rim selection with realistic player profiles
"""

import sys
sys.path.insert(0, 'C:\\Users\\alexa\\desktop\\projects\\simulator')

from src.systems.shooting import select_shot_type
from src.core.data_structures import TacticalSettings, PossessionContext

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

# Baseline possession context
neutral_context = PossessionContext(
    is_transition=False,
    shot_clock=24,
    score_differential=0,
    game_time_remaining=720
)

def create_player(name, position, three_pt_attrs, rim_attrs):
    """Create player with specific 3PT and rim attributes."""
    return {
        'name': name,
        'position': position,
        # 3PT-related attributes
        'form_technique': three_pt_attrs,
        'throw_accuracy': three_pt_attrs,
        'finesse': three_pt_attrs,
        'hand_eye_coordination': three_pt_attrs,
        'balance': three_pt_attrs,
        'composure': three_pt_attrs,
        'consistency': three_pt_attrs,
        'agility': three_pt_attrs,
        # Rim-related attributes
        'jumping': rim_attrs,
        'core_strength': rim_attrs,
        'top_speed': rim_attrs,
        'acceleration': rim_attrs,
        'grip_strength': rim_attrs,
        'arm_strength': rim_attrs,
        # Other required attributes (neutral)
        'reactions': 60,
        'stamina': 80,
        'height': 75,
        'durability': 80,
        'awareness': 60,
        'creativity': 60,
        'determination': 60,
        'bravery': 50,  # Neutral
        'patience': 60,
        'deception': 60,
        'teamwork': 60,
    }

# Test players
elite_shooter_poor_finisher = create_player("Elite Shooter (e.g., JJ Redick)", "SG", 90, 30)
poor_shooter_elite_finisher = create_player("Poor Shooter (e.g., Rudy Gobert)", "C", 20, 90)
balanced_player = create_player("Balanced Player", "SF", 60, 60)
average_player = create_player("Average Player", "SF", 50, 50)
bad_shooter_bad_finisher = create_player("Bad Shooter/Finisher", "PF", 30, 30)

players = [
    elite_shooter_poor_finisher,
    poor_shooter_elite_finisher,
    balanced_player,
    average_player,
    bad_shooter_bad_finisher,
]

print("=" * 80)
print("M4.7 COMPREHENSIVE SHOT SELECTION TEST")
print("=" * 80)
print()
print("Testing exponential drop-off for bad shooters (Rudy Gobert effect)")
print("Testing rim attack for elite finishers vs poor finishers")
print()

# Run 10,000 simulations per player for accurate distributions
for player in players:
    counts = {'3pt': 0, 'midrange': 0, 'rim': 0}

    for _ in range(10000):
        shot = select_shot_type(player, neutral_tactics, neutral_context, 'man')
        counts[shot] += 1

    print(f"{player['name']}")
    print(f"  Position: {player['position']}")
    print(f"  3PT attributes: {player['form_technique']}")
    print(f"  Rim attributes: {player['jumping']}")
    print(f"  Distribution:")
    print(f"    3PT: {counts['3pt']/100:.1f}%")
    print(f"    Mid: {counts['midrange']/100:.1f}%")
    print(f"    Rim: {counts['rim']/100:.1f}%")
    print()

print("=" * 80)
print("KEY VALIDATION CHECKS")
print("=" * 80)

# Re-run for analysis
elite_shooter_dist = {'3pt': 0, 'midrange': 0, 'rim': 0}
gobert_dist = {'3pt': 0, 'midrange': 0, 'rim': 0}
average_dist = {'3pt': 0, 'midrange': 0, 'rim': 0}

for _ in range(10000):
    elite_shooter_dist[select_shot_type(elite_shooter_poor_finisher, neutral_tactics, neutral_context, 'man')] += 1
    gobert_dist[select_shot_type(poor_shooter_elite_finisher, neutral_tactics, neutral_context, 'man')] += 1
    average_dist[select_shot_type(average_player, neutral_tactics, neutral_context, 'man')] += 1

print()
print("1. EXPONENTIAL DROP-OFF TEST (3PT):")
print("-" * 80)
print(f"   Elite Shooter (90): {elite_shooter_dist['3pt']/100:.1f}% threes")
print(f"   Average (50): {average_dist['3pt']/100:.1f}% threes (baseline)")
print(f"   Rudy Gobert (20): {gobert_dist['3pt']/100:.1f}% threes")
print()
print(f"   Expected: Gobert should take <5% threes (almost never)")
print(f"   Result: {'PASS ✓' if gobert_dist['3pt']/100 < 5 else 'FAIL ✗'}")

print()
print("2. ELITE FINISHER TEST (Rim):")
print("-" * 80)
print(f"   Rudy Gobert (rim=90): {gobert_dist['rim']/100:.1f}% at rim")
print(f"   Average (rim=50): {average_dist['rim']/100:.1f}% at rim")
print(f"   Elite Shooter (rim=30): {elite_shooter_dist['rim']/100:.1f}% at rim")
print()
gobert_rim_pct = gobert_dist['rim']/100
elite_shooter_rim_pct = elite_shooter_dist['rim']/100
rim_ratio = gobert_rim_pct / elite_shooter_rim_pct if elite_shooter_rim_pct > 0 else 0
print(f"   Ratio (Gobert/Elite Shooter): {rim_ratio:.2f}x")
print(f"   Expected: >2.0x (elite finishers attack rim much more)")
print(f"   Result: {'PASS ✓' if rim_ratio >= 2.0 else f'PARTIAL ({rim_ratio:.2f}x)'}")

print()
print("3. POSITION RESTRICTIONS:")
print("-" * 80)
# Note: Gobert is a Center, so he should get position penalty for 3PT
print(f"   Gobert (C) with 3PT composite=20: {gobert_dist['3pt']/100:.1f}% threes")
print(f"   Expected: Nearly 0% (position restriction + bad shooter)")
print(f"   Result: {'PASS ✓' if gobert_dist['3pt']/100 < 2 else 'FAIL ✗'}")

print()
print("=" * 80)
print("VALIDATION COMPLETE")
print("=" * 80)
