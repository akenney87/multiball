"""
Diagnostic test to determine why timeouts and substitutions aren't triggering.
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator

# Load sample teams
with open('data/sample_teams.json') as f:
    data = json.load(f)

ELITE_SHOOTERS = data['teams']['Elite Shooters']
ELITE_DEFENDERS = data['teams']['Elite Defenders']

# Define tactical settings (same as demo)
tactical_shooters = TacticalSettings(
    pace='fast',
    man_defense_pct=80,
    scoring_option_1='Stephen Curry',
    scoring_option_2='Kevin Durant',
    scoring_option_3='Klay Thompson',
    minutes_allotment={
        'Stephen Curry': 36,
        'Kevin Durant': 36,
        'Klay Thompson': 34,
        'Kyle Lowry': 28,
        'Shaquille O\'Neal': 30,
    },
    rebounding_strategy='standard',
    timeout_strategy='aggressive'  # Try aggressive to see if that helps
)

tactical_defenders = TacticalSettings(
    pace='slow',
    man_defense_pct=30,
    scoring_option_1='Kawhi Leonard',
    scoring_option_2='Gary Payton',
    scoring_option_3='Draymond Green',
    minutes_allotment={
        'Kawhi Leonard': 36,
        'Gary Payton': 34,
        'Draymond Green': 32,
        'Dennis Rodman': 30,
        'Rudy Gobert': 28,
    },
    rebounding_strategy='crash_glass',
    timeout_strategy='aggressive'
)

# Patch substitution manager to print debug info
from src.systems.substitutions import SubstitutionManager
original_check_and_execute = SubstitutionManager.check_and_execute_substitutions

def debug_check_and_execute(self, *args, **kwargs):
    """Wrapper that adds debug output."""
    kwargs['debug'] = True
    return original_check_and_execute(self, *args, **kwargs)

SubstitutionManager.check_and_execute_substitutions = debug_check_and_execute

# Create game simulator
game_sim = GameSimulator(
    home_roster=ELITE_SHOOTERS,
    away_roster=ELITE_DEFENDERS,
    tactical_home=tactical_shooters,
    tactical_away=tactical_defenders,
    home_team_name="Elite Shooters",
    away_team_name="Elite Defenders"
)

# Run just Q1 (not full game) to see what happens
print("=" * 80)
print("DIAGNOSTIC TEST: TIMEOUT & SUBSTITUTION TRIGGERS")
print("=" * 80)
print()
print("Testing Q1 only with debug output...")
print()

# Simulate game with different seed
game_result = game_sim.simulate_game(seed=12345)

print()
print("=" * 80)
print("RESULTS")
print("=" * 80)
print(f"Final Score: {game_result.home_score} - {game_result.away_score}")
print()

# Count timeouts and substitutions
pbp_text = game_result.play_by_play_text
timeout_count = pbp_text.count("TIMEOUT")
sub_count = pbp_text.count("Substitution")

print(f"Timeout count: {timeout_count}")
print(f"Substitution count: {sub_count}")
print()

if timeout_count == 0:
    print("❌ NO TIMEOUTS DETECTED - This is the bug!")
else:
    print(f"✓ {timeout_count} timeouts detected")

if sub_count == 0:
    print("❌ NO SUBSTITUTIONS DETECTED - This is the bug!")
else:
    print(f"✓ {sub_count} substitutions detected")

# Save output
with open('output/diagnostic_test_output.txt', 'w') as f:
    f.write(game_result.play_by_play_text)

print()
print("Full play-by-play saved to: output/diagnostic_test_output.txt")
