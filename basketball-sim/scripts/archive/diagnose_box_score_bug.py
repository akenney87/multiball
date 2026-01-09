"""
Quick diagnostic to check why FT and steals aren't showing in box score.
"""

import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random

random.seed(99999)

# Create minimal rosters
home_roster = [create_player(f"Home_{i}", "PG", grip_strength=75, arm_strength=75, core_strength=75) for i in range(5)]
away_roster = [create_player(f"Away_{i}", "PG", grip_strength=75, arm_strength=75, core_strength=75) for i in range(5)]

home_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=home_roster[0]['name'],
    scoring_option_2=home_roster[1]['name'],
    scoring_option_3=home_roster[2]['name'],
    minutes_allotment={p['name']: 48 for p in home_roster},
    rebounding_strategy='standard',
    timeout_strategy='standard'
)

away_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=away_roster[0]['name'],
    scoring_option_2=away_roster[1]['name'],
    scoring_option_3=away_roster[2]['name'],
    minutes_allotment={p['name']: 48 for p in away_roster},
    rebounding_strategy='standard',
    timeout_strategy='standard'
)

sim = GameSimulator(
    home_roster=home_roster,
    away_roster=away_roster,
    tactical_home=home_tactics,
    tactical_away=away_tactics,
    home_team_name="Home",
    away_team_name="Away"
)

# Run single quarter
print("Simulating quarter 1...")
q1_result = sim.simulate_quarter(1, 0, 0)

# Check the raw possession results
print("\n" + "="*80)
print("CHECKING POSSESSION RESULTS FOR FT DATA")
print("="*80)

ft_count = 0
steal_count = 0

for poss in q1_result.possession_results:
    # Check for foul events with free throws
    if poss.foul_event and poss.foul_event.free_throws_awarded > 0:
        ft_count += 1
        print(f"\nFoul Event Found:")
        print(f"  Fouled Player: {poss.foul_event.fouled_player}")
        print(f"  FT Awarded: {poss.foul_event.free_throws_awarded}")
        print(f"  Debug 'free_throws_made': {poss.debug.get('free_throws_made', 'NOT FOUND')}")
        print(f"  Full debug keys: {list(poss.debug.keys())}")

    # Check for steals
    if poss.possession_outcome == 'turnover':
        steal_player = poss.debug.get('steal_player')
        if steal_player:
            steal_count += 1
            print(f"\nSteal Found:")
            print(f"  Steal Player: {steal_player}")
        else:
            print(f"\nTurnover (no steal):")
            print(f"  Type: {poss.debug.get('turnover_type', 'unknown')}")

print(f"\n" + "="*80)
print(f"SUMMARY:")
print(f"  Foul events with FT: {ft_count}")
print(f"  Steals: {steal_count}")
print("="*80)
