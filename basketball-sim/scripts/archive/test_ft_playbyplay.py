"""
Simple test to verify FT fix by checking play-by-play output.

Checks that:
1. Free throws are attempted
2. Both GOOD and MISS outcomes occur
3. NOT 100% FT success rate
"""

import random
import re
from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator

def create_test_roster(team_name, ft_composites):
    """Create roster with specified FT shooting abilities."""
    roster = []
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']

    for i, (pos, ft_comp) in enumerate(zip(positions, ft_composites)):
        player = create_player(
            name=f"{team_name}_{pos}_{i+1}",
            position=pos,
            form_technique=ft_comp,
            throw_accuracy=ft_comp - 2,
            finesse=ft_comp + 2,
            hand_eye_coordination=ft_comp,
            balance=ft_comp - 3,
            composure=ft_comp + 1,
            consistency=ft_comp - 4,
            agility=ft_comp - 5,
            grip_strength=65,
            arm_strength=65,
            core_strength=65,
            acceleration=65,
            top_speed=65,
            jumping=65,
            reactions=65,
            stamina=75,
            height=75 if pos in ['PG', 'SG'] else 85,
            durability=70,
            awareness=65,
            creativity=60,
            determination=65,
            bravery=65,
            patience=60,
            deception=60,
            teamwork=65
        )
        roster.append(player)

    return roster

# Create teams with mixed FT shooters
# Include some poor shooters (30-50) to increase chance of misses
home_ft_composites = [90, 85, 70, 50, 30, 80, 65, 55, 45, 35]
away_ft_composites = [92, 75, 68, 48, 35, 78, 62, 52, 42, 38]

random.seed(42)

home_roster = create_test_roster("Home", home_ft_composites)
away_roster = create_test_roster("Away", away_ft_composites)

tactical_home = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=home_roster[0]['name'],
    scoring_option_2=home_roster[1]['name'],
    scoring_option_3=home_roster[2]['name'],
    minutes_allotment={p['name']: 24 for p in home_roster},
    rebounding_strategy='standard',
    closers=[p['name'] for p in home_roster[:7]],
    timeout_strategy='standard'
)

tactical_away = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=away_roster[0]['name'],
    scoring_option_2=away_roster[1]['name'],
    scoring_option_3=away_roster[2]['name'],
    minutes_allotment={p['name']: 24 for p in away_roster},
    rebounding_strategy='standard',
    closers=[p['name'] for p in away_roster[:7]],
    timeout_strategy='standard'
)

print("=" * 80)
print("FREE THROW FIX VALIDATION - PLAY-BY-PLAY TEST")
print("=" * 80)
print("\nSimulating game with mixed FT shooters (elite to very poor)...")
print("Checking play-by-play for FT makes and misses...\n")

game_sim = GameSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=tactical_home,
    tactical_away=tactical_away,
    home_team_name="Home",
    away_team_name="Away"
)

result = game_sim.simulate_game(seed=42)

# Parse play-by-play for FT outcomes
pbp = result.play_by_play_text

# Count FT makes and misses
ft_good_pattern = r'FT \d+/\d+: GOOD'
ft_miss_pattern = r'FT \d+/\d+: MISS'

ft_makes = len(re.findall(ft_good_pattern, pbp))
ft_misses = len(re.findall(ft_miss_pattern, pbp))
ft_total = ft_makes + ft_misses

ft_pct = (ft_makes / ft_total * 100) if ft_total > 0 else 0

print("=" * 80)
print("RESULTS")
print("=" * 80)
print(f"\nFree Throw Statistics (from play-by-play):")
print(f"  FT Makes: {ft_makes}")
print(f"  FT Misses: {ft_misses}")
print(f"  FT Total: {ft_total}")
print(f"  FT%: {ft_pct:.2f}%")

print("\n" + "-" * 80)
print("VALIDATION CHECKS")
print("-" * 80)

checks_passed = 0
checks_total = 4

print(f"[CHECK 1] Free throws were attempted: ", end="")
if ft_total > 0:
    print(f"PASS ({ft_total} attempts)")
    checks_passed += 1
else:
    print("FAIL (no FT attempts found)")

print(f"[CHECK 2] FT% is NOT 100%: ", end="")
if ft_pct < 99:
    print(f"PASS ({ft_pct:.2f}%)")
    checks_passed += 1
else:
    print(f"FAIL ({ft_pct:.2f}%)")

print(f"[CHECK 3] At least one FT miss occurred: ", end="")
if ft_misses > 0:
    print(f"PASS ({ft_misses} misses)")
    checks_passed += 1
else:
    print("FAIL (no misses)")

print(f"[CHECK 4] FT% is NBA-realistic (65-90%): ", end="")
if 65 <= ft_pct <= 90:
    print(f"PASS ({ft_pct:.2f}%)")
    checks_passed += 1
elif 60 <= ft_pct <= 95:
    print(f"ACCEPTABLE ({ft_pct:.2f}%, close to target)")
    checks_passed += 0.5
else:
    print(f"FAIL ({ft_pct:.2f}%)")

print("\n" + "=" * 80)
print(f"VALIDATION SUMMARY: {checks_passed}/{checks_total} checks passed")
print("=" * 80)

if checks_passed >= 3.5:
    print("\nSUCCESS! Free throw fix is working:")
    print(f"  - FT percentage: {ft_pct:.2f}% (realistic)")
    print(f"  - {ft_misses} misses out of {ft_total} attempts")
    print("  - No longer 100% FT shooting")
    print("  - Fix successfully integrated into gameplay")
else:
    print("\nWARNING: Some checks failed. Review results above.")

print("=" * 80)

# Show some sample FT sequences from play-by-play
print("\nSAMPLE FREE THROW SEQUENCES FROM GAME:")
print("-" * 80)

# Extract FT sequences (lines containing "to the line")
ft_sequences = []
lines = pbp.split('\n')
for i, line in enumerate(lines):
    if 'to the line' in line.lower():
        # Get this line and next few lines (FT results)
        sequence = [line]
        for j in range(1, 5):
            if i + j < len(lines) and ('FT' in lines[i + j] or 'makes' in lines[i + j]):
                sequence.append(lines[i + j])
        ft_sequences.append('\n'.join(sequence))

# Show first 3 FT sequences
for idx, seq in enumerate(ft_sequences[:3], 1):
    print(f"\nSequence {idx}:")
    print(seq)

print("\n" + "=" * 80)
print(f"Final Score: Home {result.home_score}, Away {result.away_score}")
print("=" * 80)
