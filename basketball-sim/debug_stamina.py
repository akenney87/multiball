"""
Debug script to track stamina values during Q1.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, '.')

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings (standard)
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("=" * 80)
print("STAMINA DEBUG - Q1 TRACKING")
print("=" * 80)
print()

# Print starter stamina attributes
print("Team Alpha starters (stamina attributes):")
for player in team_a['players'][:5]:
    print(f"  {player['name']}: stamina={player['stamina']}")

print()
print("Team Beta starters (stamina attributes):")
for player in team_b['players'][:5]:
    print(f"  {player['name']}: stamina={player['stamina']}")

print()
print("=" * 80)
print("Running simulation with debug output...")
print("=" * 80)

# Run simulation
game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics,
    tactical_away=tactics,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

# Simulate just Q1
result = game_sim.simulate_game(seed=8888)

# Get Q1 results
q1_result = result.quarter_results[0]

print()
print(f"Q1 complete: {team_a['team_name']} {q1_result.home_score} - {team_b['team_name']} {q1_result.away_score}")
print(f"Total possessions in Q1: {len(q1_result.possession_results)}")
print()

# Try to extract stamina values from possession debug data
print("=" * 80)
print("STAMINA VALUES DURING Q1")
print("=" * 80)
print()

# Sample possessions throughout Q1
sample_indices = [0, 10, 20, 30, 40, -1]  # Beginning, middle intervals, and end

for idx in sample_indices:
    if idx == -1:
        idx = len(q1_result.possession_results) - 1

    if idx < len(q1_result.possession_results):
        poss = q1_result.possession_results[idx]

        print(f"After possession #{idx + 1}:")

        # Check if stamina values are in debug dict
        if hasattr(poss, 'debug') and 'stamina_values' in poss.debug:
            stamina_values = poss.debug['stamina_values']

            print("  Team Alpha:")
            for player in team_a['players'][:5]:
                name = player['name']
                stamina = stamina_values.get(name, 'N/A')
                if isinstance(stamina, float):
                    print(f"    {name}: {stamina:.1f}")
                else:
                    print(f"    {name}: {stamina}")

            print("  Team Beta:")
            for player in team_b['players'][:5]:
                name = player['name']
                stamina = stamina_values.get(name, 'N/A')
                if isinstance(stamina, float):
                    print(f"    {name}: {stamina:.1f}")
                else:
                    print(f"    {name}: {stamina}")
        else:
            print("  [No stamina data in debug dict]")

        print()

print("=" * 80)
