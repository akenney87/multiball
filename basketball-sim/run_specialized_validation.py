"""
Run 100 games between two specialized teams and aggregate player-level statistics
"""

import json
import sys
import os
from collections import defaultdict
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/specialized/team_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/specialized/team_b.json', 'r') as f:
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

# Initialize aggregators
player_stats = defaultdict(lambda: {
    'games': 0,
    'points': 0,
    'fgm': 0,
    'fga': 0,
    'fg3m': 0,
    'fg3a': 0,
    'ftm': 0,
    'fta': 0,
    'oreb': 0,
    'dreb': 0,
    'reb': 0,
    'ast': 0,
    'stl': 0,
    'blk': 0,
    'tov': 0,
    'pf': 0,
})

team_stats = {
    'possessions': 0,
    'points_team_a': 0,
    'points_team_b': 0,
    'wins_team_a': 0,
    'wins_team_b': 0,
    'blowouts': 0,  # 20+ margin
    'close_games': 0,  # <=5 margin
}

print("=" * 80)
print("SPECIALIZED TEAM VALIDATION - 100 GAMES")
print("=" * 80)
print(f"Team A: {team_a['team_name']}")
print(f"Team B: {team_b['team_name']}")
print()

NUM_GAMES = 100
SEED_START = 1000

for game_num in range(1, NUM_GAMES + 1):
    # Simulate game
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=SEED_START + game_num)

    # Aggregate team stats
    team_stats['possessions'] += result.game_statistics.get('total_possessions', 0) / 2.0
    team_stats['points_team_a'] += result.home_score
    team_stats['points_team_b'] += result.away_score

    margin = abs(result.home_score - result.away_score)
    if margin >= 20:
        team_stats['blowouts'] += 1
    if margin <= 5:
        team_stats['close_games'] += 1

    if result.home_score > result.away_score:
        team_stats['wins_team_a'] += 1
    else:
        team_stats['wins_team_b'] += 1

    # Aggregate player stats from quarter results (using same logic as game_simulation.py)
    for quarter_result in result.quarter_results:
        for poss_result in quarter_result.possession_results:
            offensive_team = poss_result.offensive_team  # 'home' or 'away'
            team_prefix = "Team_A_" if offensive_team == 'home' else "Team_B_"
            def_team = 'away' if offensive_team == 'home' else 'home'
            def_prefix = "Team_A_" if def_team == 'home' else "Team_B_"

            # Points scored
            if poss_result.scoring_player:
                player_key = f"{team_prefix}{poss_result.scoring_player}"
                player_stats[player_key]['games'] = 1
                player_stats[player_key]['points'] += poss_result.points_scored

            # Rebounds (can be by either team)
            if poss_result.rebound_player:
                # Determine which team's roster to check
                offensive_roster = team_a['players'] if offensive_team == 'home' else team_b['players']
                offensive_player_names = [p['name'] for p in offensive_roster]

                if poss_result.rebound_player in offensive_player_names:
                    # Offensive rebound
                    reb_key = f"{team_prefix}{poss_result.rebound_player}"
                    player_stats[reb_key]['games'] = 1
                    player_stats[reb_key]['oreb'] += 1
                    player_stats[reb_key]['reb'] += 1
                else:
                    # Defensive rebound
                    reb_key = f"{def_prefix}{poss_result.rebound_player}"
                    player_stats[reb_key]['games'] = 1
                    player_stats[reb_key]['dreb'] += 1
                    player_stats[reb_key]['reb'] += 1

            # Assists
            if poss_result.assist_player:
                ast_key = f"{team_prefix}{poss_result.assist_player}"
                player_stats[ast_key]['games'] = 1
                player_stats[ast_key]['ast'] += 1

            # FG attempts and makes
            if poss_result.possession_outcome in ['made_shot', 'missed_shot']:
                shooter = poss_result.debug.get('shooter')
                shot_type = poss_result.debug.get('shot_type')

                if shooter:
                    shooter_key = f"{team_prefix}{shooter}"
                    player_stats[shooter_key]['games'] = 1
                    player_stats[shooter_key]['fga'] += 1

                    if poss_result.possession_outcome == 'made_shot':
                        player_stats[shooter_key]['fgm'] += 1

                    if shot_type == '3pt':
                        player_stats[shooter_key]['fg3a'] += 1
                        if poss_result.possession_outcome == 'made_shot':
                            player_stats[shooter_key]['fg3m'] += 1

            # And-1 situations
            elif poss_result.possession_outcome == 'foul':
                if poss_result.foul_event and poss_result.foul_event.and_one:
                    shooter = poss_result.debug.get('shooter')
                    shot_type = poss_result.debug.get('shot_type')
                    if shooter:
                        shooter_key = f"{team_prefix}{shooter}"
                        player_stats[shooter_key]['games'] = 1
                        player_stats[shooter_key]['fga'] += 1
                        player_stats[shooter_key]['fgm'] += 1
                        if shot_type == '3pt':
                            player_stats[shooter_key]['fg3a'] += 1
                            player_stats[shooter_key]['fg3m'] += 1

            # Free throws
            if poss_result.free_throw_result:
                ft_shooter = poss_result.free_throw_result.shooter
                ft_key = f"{team_prefix}{ft_shooter}"
                player_stats[ft_key]['games'] = 1
                player_stats[ft_key]['fta'] += poss_result.free_throw_result.attempts
                player_stats[ft_key]['ftm'] += poss_result.free_throw_result.made

            # Turnovers
            if poss_result.possession_outcome == 'turnover':
                if 'ball_handler' in poss_result.debug:
                    ball_handler = poss_result.debug['ball_handler']
                    to_key = f"{team_prefix}{ball_handler}"
                    player_stats[to_key]['games'] = 1
                    player_stats[to_key]['tov'] += 1

                # Steals
                steal_player = poss_result.debug.get('steal_player')
                if steal_player:
                    stl_key = f"{def_prefix}{steal_player}"
                    player_stats[stl_key]['games'] = 1
                    player_stats[stl_key]['stl'] += 1

            # Blocks
            if 'shot_attempt' in poss_result.debug:
                shot_debug = poss_result.debug['shot_attempt']
                if shot_debug.get('outcome') == 'blocked_shot':
                    blocking_player = shot_debug.get('blocking_player')
                    if blocking_player:
                        blk_key = f"{def_prefix}{blocking_player}"
                        player_stats[blk_key]['games'] = 1
                        player_stats[blk_key]['blk'] += 1

            # Personal fouls
            if poss_result.foul_event:
                fouling_player = poss_result.foul_event.fouling_player
                pf_key = f"{def_prefix}{fouling_player}"
                player_stats[pf_key]['games'] = 1
                player_stats[pf_key]['pf'] += 1

    if game_num % 10 == 0:
        print(f"Completed {game_num}/{NUM_GAMES} games...")

print()
print("=" * 80)
print("AVERAGE BOX SCORES (Per Game)")
print("=" * 80)
print()

# Calculate and display averages
print("TEAM A PLAYERS:")
print("-" * 80)
print(f"{'Player':<22} {'PTS':>5} {'FGM-FGA':>9} {'FG%':>5} {'3PM-3PA':>9} {'3P%':>5} {'REB':>4} {'AST':>4} {'STL':>4} {'BLK':>4} {'TOV':>4}")
print("-" * 80)

for player in team_a['players']:
    player_key = f"Team_A_{player['name']}"
    stats = player_stats[player_key]
    games = stats['games']

    if games > 0:
        pts = stats['points'] / games
        fgm = stats['fgm'] / games
        fga = stats['fga'] / games
        fg_pct = (stats['fgm'] / stats['fga'] * 100) if stats['fga'] > 0 else 0
        fg3m = stats['fg3m'] / games
        fg3a = stats['fg3a'] / games
        fg3_pct = (stats['fg3m'] / stats['fg3a'] * 100) if stats['fg3a'] > 0 else 0
        reb = stats['reb'] / games
        ast = stats['ast'] / games
        stl = stats['stl'] / games
        blk = stats['blk'] / games
        tov = stats['tov'] / games

        print(f"{player['name']:<22} {pts:>5.1f} {fgm:>4.1f}-{fga:<4.1f} {fg_pct:>5.1f} {fg3m:>4.1f}-{fg3a:<4.1f} {fg3_pct:>5.1f} {reb:>4.1f} {ast:>4.1f} {stl:>4.1f} {blk:>4.1f} {tov:>4.1f}")

print()
print("TEAM B PLAYERS:")
print("-" * 80)
print(f"{'Player':<22} {'PTS':>5} {'FGM-FGA':>9} {'FG%':>5} {'3PM-3PA':>9} {'3P%':>5} {'REB':>4} {'AST':>4} {'STL':>4} {'BLK':>4} {'TOV':>4}")
print("-" * 80)

for player in team_b['players']:
    player_key = f"Team_B_{player['name']}"
    stats = player_stats[player_key]
    games = stats['games']

    if games > 0:
        pts = stats['points'] / games
        fgm = stats['fgm'] / games
        fga = stats['fga'] / games
        fg_pct = (stats['fgm'] / stats['fga'] * 100) if stats['fga'] > 0 else 0
        fg3m = stats['fg3m'] / games
        fg3a = stats['fg3a'] / games
        fg3_pct = (stats['fg3m'] / stats['fg3a'] * 100) if stats['fg3a'] > 0 else 0
        reb = stats['reb'] / games
        ast = stats['ast'] / games
        stl = stats['stl'] / games
        blk = stats['blk'] / games
        tov = stats['tov'] / games

        print(f"{player['name']:<22} {pts:>5.1f} {fgm:>4.1f}-{fga:<4.1f} {fg_pct:>5.1f} {fg3m:>4.1f}-{fg3a:<4.1f} {fg3_pct:>5.1f} {reb:>4.1f} {ast:>4.1f} {stl:>4.1f} {blk:>4.1f} {tov:>4.1f}")

# Calculate team aggregates
print()
print("=" * 80)
print("TEAM AGGREGATES")
print("=" * 80)

total_fgm = sum(stats['fgm'] for stats in player_stats.values()) / 2  # Divide by 2 for per-team
total_fga = sum(stats['fga'] for stats in player_stats.values()) / 2
total_fg3m = sum(stats['fg3m'] for stats in player_stats.values()) / 2
total_fg3a = sum(stats['fg3a'] for stats in player_stats.values()) / 2
total_reb = sum(stats['reb'] for stats in player_stats.values()) / 2
total_ast = sum(stats['ast'] for stats in player_stats.values()) / 2
total_stl = sum(stats['stl'] for stats in player_stats.values()) / 2
total_blk = sum(stats['blk'] for stats in player_stats.values()) / 2
total_tov = sum(stats['tov'] for stats in player_stats.values()) / 2

avg_possessions = team_stats['possessions'] / NUM_GAMES
avg_points_a = team_stats['points_team_a'] / NUM_GAMES
avg_points_b = team_stats['points_team_b'] / NUM_GAMES
avg_margin = abs(avg_points_a - avg_points_b)
avg_fg_pct = (total_fgm / total_fga * 100) if total_fga > 0 else 0
avg_3pt_pct = (total_fg3m / total_fg3a * 100) if total_fg3a > 0 else 0

print(f"Average Possessions per Game: {avg_possessions:.1f}")
print(f"Average Points (Team A): {avg_points_a:.1f}")
print(f"Average Points (Team B): {avg_points_b:.1f}")
print(f"Average Margin: {avg_margin:.1f}")
print(f"Average FG%: {avg_fg_pct:.1f}%")
print(f"Average 3PT%: {avg_3pt_pct:.1f}%")
print(f"Average 3PT Attempts per Game: {total_fg3a / NUM_GAMES:.1f}")
print(f"Average Rebounds per Game: {total_reb / NUM_GAMES:.1f}")
print(f"Average Assists per Game: {total_ast / NUM_GAMES:.1f}")
print(f"Average Steals per Game: {total_stl / NUM_GAMES:.1f}")
print(f"Average Blocks per Game: {total_blk / NUM_GAMES:.1f}")
print(f"Average Turnovers per Game: {total_tov / NUM_GAMES:.1f}")
print()
print(f"Total Blowouts (20+ margin): {team_stats['blowouts']}/{NUM_GAMES} ({team_stats['blowouts']/NUM_GAMES*100:.1f}%)")
print(f"Total Close Games (<=5 margin): {team_stats['close_games']}/{NUM_GAMES} ({team_stats['close_games']/NUM_GAMES*100:.1f}%)")
print()
print(f"Team A Wins: {team_stats['wins_team_a']}")
print(f"Team B Wins: {team_stats['wins_team_b']}")

print()
print("=" * 80)
print("VALIDATION COMPLETE")
print("=" * 80)
