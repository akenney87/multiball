"""
Trace stamina depletion for Chris Maestro to understand substitution timing
"""

import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

# Patch the substitution check to add logging
from src.systems import substitutions
original_check_team = substitutions.SubstitutionManager._check_team_substitutions

def logged_check_team(self, team, game_time_str, stamina_tracker):
    """Wrapper that logs substitution checks for Chris Maestro"""
    if team == "Home":
        lineup_manager = self.home_lineup_manager
    else:
        lineup_manager = self.away_lineup_manager

    active_players = lineup_manager.get_active_players()
    bench_players = lineup_manager.get_bench_players()

    # Log Chris Maestro specifically
    for player in active_players:
        if player['name'] == 'Chris Maestro':
            stamina = stamina_tracker.get_current_stamina('Chris Maestro')
            is_starter = self._is_starter('Chris Maestro')
            print(f"[{game_time_str}] Chris Maestro: stamina={stamina:.1f}, is_starter={is_starter}, bench_count={len(bench_players)}")
            break

    # Call original
    return original_check_team(self, team, game_time_str, stamina_tracker)

# Apply patch
substitutions.SubstitutionManager._check_team_substitutions = logged_check_team

# Now run the game
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings
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
print("TRACING CHRIS MAESTRO STAMINA AND SUBSTITUTION CHECKS")
print("=" * 80)
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

result = game_sim.simulate_game(seed=None)  # Random seed like review game

print()
print("=" * 80)
print("GAME COMPLETE")
print("=" * 80)
