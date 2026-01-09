"""
Debug substitution system
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

print("Team Alpha Roster:")
for i, p in enumerate(team_a['players']):
    print(f"  {i+1}. {p['name']:20s} Position: {p['position']}  Stamina Attribute: {p['stamina']}")

print("\nTeam Beta Roster:")
for i, p in enumerate(team_b['players']):
    print(f"  {i+1}. {p['name']:20s} Position: {p['position']}  Stamina Attribute: {p['stamina']}")

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

print("\nRunning game simulation with debug output...")
print()

# Run simulation
game_sim = GameSimulator(
    home_roster=team_a['players'],
    away_roster=team_b['players'],
    tactical_home=tactics,
    tactical_away=tactics,
    home_team_name=team_a['team_name'],
    away_team_name=team_b['team_name']
)

result = game_sim.simulate_game(seed=12345)  # Fixed seed for reproducibility

# Write the play-by-play
with open('output/DEBUG_GAME.txt', 'w', encoding='utf-8') as f:
    f.write(result.play_by_play_text)

print("Play-by-play written to output/DEBUG_GAME.txt")

# Check substitutions
print("\n=== SUBSTITUTION ANALYSIS ===")
import re
subs = re.findall(r'Substitution \(([^)]+)\): ([^→]+)→ ([^(]+)\(([^)]+)\)', result.play_by_play_text)
print(f"Total substitutions: {len(subs)}")
for team, out, in_player, reason in subs:
    print(f"  {team}: {out.strip()} OUT → {in_player.strip()} IN ({reason})")

# Check Q1 box score
print("\n=== Q1 ANALYSIS ===")
q1_text = result.play_by_play_text.split("2ND QUARTER")[0] if "2ND QUARTER" in result.play_by_play_text else result.play_by_play_text
q1_subs = [s for s in subs if "1ST QUARTER" in q1_text.split(f"Substitution ({s[0]})")[0]]
print(f"Q1 substitutions: {len(q1_subs)}")
