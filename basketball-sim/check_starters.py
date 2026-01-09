"""
Check who is considered "starters" vs who actually starts Q1
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

# Tactical settings (empty minutes allotment = default allocation)
tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},  # Empty = default
    rebounding_strategy='standard'
)

print("=" * 80)
print("CHECKING STARTER DETERMINATION")
print("=" * 80)

# The starters are determined by minutes_allocation (top 5 by minutes)
# With empty minutes_allotment, it uses default allocation

print("\nTeam Alpha (with empty minutes allocation, uses first 5 as starters):")
for i, player in enumerate(team_a['players'][:10]):
    role = "STARTER" if i < 5 else "BENCH"
    print(f"  {role:8s} {i+1:2d}. {player['name']:20s} (Stamina Attr: {player['stamina']:3d})")

print("\nTeam Beta (with empty minutes allocation, uses first 5 as starters):")
for i, player in enumerate(team_b['players'][:10]):
    role = "STARTER" if i < 5 else "BENCH"
    print(f"  {role:8s} {i+1}. {player['name']:20s} (Stamina Attr: {player['stamina']:3d})")

print("\n" + "=" * 80)
print("From REVIEW_GAME_PROPER.txt, Q1 actually started with:")
print("=" * 80)
print("Team Alpha: Chris Maestro, Ray Sniper, Marcus Slasher, Dennis Boardman, Hassan Swatter")
print("Team Beta: Steve Facilitator, Reggie Shooter, Dwyane Slasher, Andre Rebounder, Mutombo Blocker")
print("\nThese are players 1-5 from each roster = CORRECT STARTERS")
