"""
100-Game Validation with Scoring Options

Runs 100 games with Team Alpha vs Team Beta using scoring options.
Tracks all box score metrics and generates comprehensive statistics.
"""

import json
import sys
import os
from collections import defaultdict
import statistics

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Load teams
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_a = json.load(f)

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_b = json.load(f)

# Tactical settings with scoring options
tactics_alpha = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Chris Maestro',
    scoring_option_2='Ray Sniper',
    scoring_option_3='Marcus Slasher',
    minutes_allotment={},
    rebounding_strategy='standard'
)

tactics_beta = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1='Steve Facilitator',
    scoring_option_2='Reggie Shooter',
    scoring_option_3='Dwyane Slasher',
    minutes_allotment={},
    rebounding_strategy='standard'
)

print("="*80)
print("100-GAME VALIDATION - SCORING OPTIONS")
print("="*80)
print()
print("TEAM ALPHA SCORING OPTIONS:")
print(f"  Option #1 (30%): {tactics_alpha.scoring_option_1}")
print(f"  Option #2 (20%): {tactics_alpha.scoring_option_2}")
print(f"  Option #3 (15%): {tactics_alpha.scoring_option_3}")
print()
print("TEAM BETA SCORING OPTIONS:")
print(f"  Option #1 (30%): {tactics_beta.scoring_option_1}")
print(f"  Option #2 (20%): {tactics_beta.scoring_option_2}")
print(f"  Option #3 (15%): {tactics_beta.scoring_option_3}")
print()
print("Running 100 games...")
print()

# Track all metrics per game
game_results = []
player_stats_per_game = defaultdict(lambda: defaultdict(list))
team_stats_per_game = defaultdict(lambda: defaultdict(list))

for game_num in range(1, 101):
    if game_num % 10 == 0:
        print(f"Completed {game_num}/100 games...")

    # Run simulation
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics_alpha,
        tactical_away=tactics_beta,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=None)

    # Store game result
    game_results.append({
        'game_num': game_num,
        'home_score': result.home_score,
        'away_score': result.away_score,
        'home_win': result.home_score > result.away_score
    })

    # Aggregate team stats
    home_stats = result.game_statistics['home_stats']
    away_stats = result.game_statistics['away_stats']

    # Team stats
    team_stats_per_game['Team Alpha']['points'].append(result.home_score)
    team_stats_per_game['Team Alpha']['fgm'].append(home_stats['fgm'])
    team_stats_per_game['Team Alpha']['fga'].append(home_stats['fga'])
    team_stats_per_game['Team Alpha']['fg3m'].append(home_stats['fg3m'])
    team_stats_per_game['Team Alpha']['fg3a'].append(home_stats['fg3a'])
    team_stats_per_game['Team Alpha']['ftm'].append(home_stats.get('ftm', 0))
    team_stats_per_game['Team Alpha']['fta'].append(home_stats.get('fta', 0))
    team_stats_per_game['Team Alpha']['oreb'].append(home_stats['oreb'])
    team_stats_per_game['Team Alpha']['dreb'].append(home_stats['dreb'])
    team_stats_per_game['Team Alpha']['ast'].append(home_stats['ast'])
    team_stats_per_game['Team Alpha']['tov'].append(home_stats['tov'])
    team_stats_per_game['Team Alpha']['stl'].append(home_stats.get('stl', 0))
    team_stats_per_game['Team Alpha']['blk'].append(home_stats.get('blk', 0))
    team_stats_per_game['Team Alpha']['pf'].append(home_stats.get('pf', 0))

    team_stats_per_game['Team Beta']['points'].append(result.away_score)
    team_stats_per_game['Team Beta']['fgm'].append(away_stats['fgm'])
    team_stats_per_game['Team Beta']['fga'].append(away_stats['fga'])
    team_stats_per_game['Team Beta']['fg3m'].append(away_stats['fg3m'])
    team_stats_per_game['Team Beta']['fg3a'].append(away_stats['fg3a'])
    team_stats_per_game['Team Beta']['ftm'].append(away_stats.get('ftm', 0))
    team_stats_per_game['Team Beta']['fta'].append(away_stats.get('fta', 0))
    team_stats_per_game['Team Beta']['oreb'].append(away_stats['oreb'])
    team_stats_per_game['Team Beta']['dreb'].append(away_stats['dreb'])
    team_stats_per_game['Team Beta']['ast'].append(away_stats['ast'])
    team_stats_per_game['Team Beta']['tov'].append(away_stats['tov'])
    team_stats_per_game['Team Beta']['stl'].append(away_stats.get('stl', 0))
    team_stats_per_game['Team Beta']['blk'].append(away_stats.get('blk', 0))
    team_stats_per_game['Team Beta']['pf'].append(away_stats.get('pf', 0))

    # Player stats - aggregate from all quarters
    for player in team_a['players']:
        player_name = player['name']

        # Sum stats across all quarters for this player
        total_pts = 0
        total_fgm = 0
        total_fga = 0
        total_fg3m = 0
        total_fg3a = 0
        total_ftm = 0
        total_fta = 0
        total_reb = 0
        total_ast = 0
        total_tov = 0
        total_stl = 0
        total_blk = 0
        total_pf = 0
        total_minutes = result.minutes_played.get(player_name, 0)

        # Aggregate from quarter results
        for quarter in result.quarter_results:
            for poss in quarter.possession_results:
                if poss.offensive_team == 'home':
                    # Check if this player was involved
                    shooter = poss.debug.get('shooter')
                    if shooter == player_name:
                        total_fga += 1
                        if poss.possession_outcome == 'made_shot':
                            total_fgm += 1
                            total_pts += poss.points_scored
                            if poss.debug.get('shot_type') == '3pt':
                                total_fg3m += 1
                        if poss.debug.get('shot_type') == '3pt':
                            total_fg3a += 1

                    # Assists
                    if poss.assist_player == player_name:
                        total_ast += 1

                    # Turnovers
                    if poss.possession_outcome == 'turnover':
                        if poss.debug.get('ball_handler') == player_name:
                            total_tov += 1

                    # Free throws
                    if poss.foul_event and hasattr(poss.foul_event, 'shooter_name'):
                        if poss.foul_event.shooter_name == player_name:
                            total_fta += poss.foul_event.free_throws_awarded
                            total_ftm += poss.foul_event.free_throws_made

                # Defensive stats
                if poss.offensive_team == 'away':
                    # Steals
                    if poss.possession_outcome == 'turnover':
                        steal_player = poss.debug.get('steal_player')
                        if steal_player == player_name:
                            total_stl += 1

                    # Blocks
                    shot_attempt = poss.debug.get('shot_attempt', {})
                    if shot_attempt.get('outcome') == 'blocked_shot':
                        blocker = shot_attempt.get('blocking_player')
                        if blocker == player_name:
                            total_blk += 1

                # Rebounds
                if poss.rebound_player == player_name:
                    total_reb += 1

        # Store player stats for this game
        player_stats_per_game[player_name]['minutes'].append(total_minutes)
        player_stats_per_game[player_name]['pts'].append(total_pts)
        player_stats_per_game[player_name]['fgm'].append(total_fgm)
        player_stats_per_game[player_name]['fga'].append(total_fga)
        player_stats_per_game[player_name]['fg3m'].append(total_fg3m)
        player_stats_per_game[player_name]['fg3a'].append(total_fg3a)
        player_stats_per_game[player_name]['ftm'].append(total_ftm)
        player_stats_per_game[player_name]['fta'].append(total_fta)
        player_stats_per_game[player_name]['reb'].append(total_reb)
        player_stats_per_game[player_name]['ast'].append(total_ast)
        player_stats_per_game[player_name]['tov'].append(total_tov)
        player_stats_per_game[player_name]['stl'].append(total_stl)
        player_stats_per_game[player_name]['blk'].append(total_blk)

    # Team Beta players
    for player in team_b['players']:
        player_name = player['name']

        total_pts = 0
        total_fgm = 0
        total_fga = 0
        total_fg3m = 0
        total_fg3a = 0
        total_ftm = 0
        total_fta = 0
        total_reb = 0
        total_ast = 0
        total_tov = 0
        total_stl = 0
        total_blk = 0
        total_minutes = result.minutes_played.get(player_name, 0)

        for quarter in result.quarter_results:
            for poss in quarter.possession_results:
                if poss.offensive_team == 'away':
                    shooter = poss.debug.get('shooter')
                    if shooter == player_name:
                        total_fga += 1
                        if poss.possession_outcome == 'made_shot':
                            total_fgm += 1
                            total_pts += poss.points_scored
                            if poss.debug.get('shot_type') == '3pt':
                                total_fg3m += 1
                        if poss.debug.get('shot_type') == '3pt':
                            total_fg3a += 1

                    if poss.assist_player == player_name:
                        total_ast += 1

                    if poss.possession_outcome == 'turnover':
                        if poss.debug.get('ball_handler') == player_name:
                            total_tov += 1

                    if poss.foul_event and hasattr(poss.foul_event, 'shooter_name'):
                        if poss.foul_event.shooter_name == player_name:
                            total_fta += poss.foul_event.free_throws_awarded
                            total_ftm += poss.foul_event.free_throws_made

                if poss.offensive_team == 'home':
                    if poss.possession_outcome == 'turnover':
                        steal_player = poss.debug.get('steal_player')
                        if steal_player == player_name:
                            total_stl += 1

                    shot_attempt = poss.debug.get('shot_attempt', {})
                    if shot_attempt.get('outcome') == 'blocked_shot':
                        blocker = shot_attempt.get('blocking_player')
                        if blocker == player_name:
                            total_blk += 1

                if poss.rebound_player == player_name:
                    total_reb += 1

        player_stats_per_game[player_name]['minutes'].append(total_minutes)
        player_stats_per_game[player_name]['pts'].append(total_pts)
        player_stats_per_game[player_name]['fgm'].append(total_fgm)
        player_stats_per_game[player_name]['fga'].append(total_fga)
        player_stats_per_game[player_name]['fg3m'].append(total_fg3m)
        player_stats_per_game[player_name]['fg3a'].append(total_fg3a)
        player_stats_per_game[player_name]['ftm'].append(total_ftm)
        player_stats_per_game[player_name]['fta'].append(total_fta)
        player_stats_per_game[player_name]['reb'].append(total_reb)
        player_stats_per_game[player_name]['ast'].append(total_ast)
        player_stats_per_game[player_name]['tov'].append(total_tov)
        player_stats_per_game[player_name]['stl'].append(total_stl)
        player_stats_per_game[player_name]['blk'].append(total_blk)

print()
print("100 games completed!")
print()

# Calculate statistics
def calc_stats(values):
    """Calculate mean, std, min, max for a list of values."""
    if not values:
        return {'mean': 0, 'std': 0, 'min': 0, 'max': 0}
    return {
        'mean': statistics.mean(values),
        'std': statistics.stdev(values) if len(values) > 1 else 0,
        'min': min(values),
        'max': max(values)
    }

# Generate report
output_lines = []
output_lines.append("="*80)
output_lines.append("100-GAME VALIDATION RESULTS - SCORING OPTIONS")
output_lines.append("="*80)
output_lines.append("")
output_lines.append(f"Team Alpha: {sum(1 for g in game_results if g['home_win'])}-{sum(1 for g in game_results if not g['home_win'])}")
output_lines.append(f"Team Beta: {sum(1 for g in game_results if not g['home_win'])}-{sum(1 for g in game_results if g['home_win'])}")
output_lines.append("")

# Team statistics
output_lines.append("="*80)
output_lines.append("TEAM STATISTICS (Per Game Averages)")
output_lines.append("="*80)
output_lines.append("")

for team in ['Team Alpha', 'Team Beta']:
    output_lines.append(f"{team}:")
    output_lines.append("-"*80)
    output_lines.append(f"{'Stat':<10} {'Mean':>8} {'StdDev':>8} {'Min':>6} {'Max':>6}")
    output_lines.append("-"*80)

    for stat in ['points', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'oreb', 'dreb', 'ast', 'tov', 'stl', 'blk', 'pf']:
        stats = calc_stats(team_stats_per_game[team][stat])
        output_lines.append(f"{stat:<10} {stats['mean']:>8.1f} {stats['std']:>8.1f} {stats['min']:>6.0f} {stats['max']:>6.0f}")

    # Calculate percentages
    fg_pct_games = []
    fg3_pct_games = []
    ft_pct_games = []

    for i in range(len(team_stats_per_game[team]['fgm'])):
        fga = team_stats_per_game[team]['fga'][i]
        if fga > 0:
            fg_pct_games.append((team_stats_per_game[team]['fgm'][i] / fga) * 100)

        fg3a = team_stats_per_game[team]['fg3a'][i]
        if fg3a > 0:
            fg3_pct_games.append((team_stats_per_game[team]['fg3m'][i] / fg3a) * 100)

        fta = team_stats_per_game[team]['fta'][i]
        if fta > 0:
            ft_pct_games.append((team_stats_per_game[team]['ftm'][i] / fta) * 100)

    output_lines.append("-"*80)
    if fg_pct_games:
        stats = calc_stats(fg_pct_games)
        output_lines.append(f"{'FG%':<10} {stats['mean']:>8.1f} {stats['std']:>8.1f} {stats['min']:>6.1f} {stats['max']:>6.1f}")
    if fg3_pct_games:
        stats = calc_stats(fg3_pct_games)
        output_lines.append(f"{'3PT%':<10} {stats['mean']:>8.1f} {stats['std']:>8.1f} {stats['min']:>6.1f} {stats['max']:>6.1f}")
    if ft_pct_games:
        stats = calc_stats(ft_pct_games)
        output_lines.append(f"{'FT%':<10} {stats['mean']:>8.1f} {stats['std']:>8.1f} {stats['min']:>6.1f} {stats['max']:>6.1f}")
    output_lines.append("")

# Player statistics - focus on scoring options
output_lines.append("="*80)
output_lines.append("SCORING OPTIONS - PLAYER STATISTICS (Per Game Averages)")
output_lines.append("="*80)
output_lines.append("")

scoring_options_alpha = ['Chris Maestro', 'Ray Sniper', 'Marcus Slasher']
scoring_options_beta = ['Steve Facilitator', 'Reggie Shooter', 'Dwyane Slasher']

output_lines.append("TEAM ALPHA SCORING OPTIONS:")
output_lines.append("-"*80)
output_lines.append(f"{'Player':<20} {'MIN':>5} {'PTS':>5} {'FGA':>5} {'AST':>5} {'TOV':>5} {'REB':>5}")
output_lines.append("-"*80)

for player_name in scoring_options_alpha:
    mins = calc_stats(player_stats_per_game[player_name]['minutes'])
    pts = calc_stats(player_stats_per_game[player_name]['pts'])
    fga = calc_stats(player_stats_per_game[player_name]['fga'])
    ast = calc_stats(player_stats_per_game[player_name]['ast'])
    tov = calc_stats(player_stats_per_game[player_name]['tov'])
    reb = calc_stats(player_stats_per_game[player_name]['reb'])

    output_lines.append(f"{player_name:<20} {mins['mean']:>5.1f} {pts['mean']:>5.1f} {fga['mean']:>5.1f} {ast['mean']:>5.1f} {tov['mean']:>5.1f} {reb['mean']:>5.1f}")

output_lines.append("")
output_lines.append("TEAM BETA SCORING OPTIONS:")
output_lines.append("-"*80)
output_lines.append(f"{'Player':<20} {'MIN':>5} {'PTS':>5} {'FGA':>5} {'AST':>5} {'TOV':>5} {'REB':>5}")
output_lines.append("-"*80)

for player_name in scoring_options_beta:
    mins = calc_stats(player_stats_per_game[player_name]['minutes'])
    pts = calc_stats(player_stats_per_game[player_name]['pts'])
    fga = calc_stats(player_stats_per_game[player_name]['fga'])
    ast = calc_stats(player_stats_per_game[player_name]['ast'])
    tov = calc_stats(player_stats_per_game[player_name]['tov'])
    reb = calc_stats(player_stats_per_game[player_name]['reb'])

    output_lines.append(f"{player_name:<20} {mins['mean']:>5.1f} {pts['mean']:>5.1f} {fga['mean']:>5.1f} {ast['mean']:>5.1f} {tov['mean']:>5.1f} {reb['mean']:>5.1f}")

output_lines.append("")
output_lines.append("="*80)
output_lines.append("ALL PLAYERS - COMPLETE STATISTICS")
output_lines.append("="*80)
output_lines.append("")

# All Team Alpha players
output_lines.append("TEAM ALPHA:")
output_lines.append("-"*80)
output_lines.append(f"{'Player':<20} {'MIN':>5} {'PTS':>5} {'FGM':>4} {'FGA':>4} {'3PM':>4} {'3PA':>4} {'FTM':>4} {'FTA':>4} {'REB':>4} {'AST':>4} {'TOV':>4} {'STL':>4} {'BLK':>4}")
output_lines.append("-"*80)

for player in team_a['players']:
    player_name = player['name']
    mins = calc_stats(player_stats_per_game[player_name]['minutes'])
    pts = calc_stats(player_stats_per_game[player_name]['pts'])
    fgm = calc_stats(player_stats_per_game[player_name]['fgm'])
    fga = calc_stats(player_stats_per_game[player_name]['fga'])
    fg3m = calc_stats(player_stats_per_game[player_name]['fg3m'])
    fg3a = calc_stats(player_stats_per_game[player_name]['fg3a'])
    ftm = calc_stats(player_stats_per_game[player_name]['ftm'])
    fta = calc_stats(player_stats_per_game[player_name]['fta'])
    reb = calc_stats(player_stats_per_game[player_name]['reb'])
    ast = calc_stats(player_stats_per_game[player_name]['ast'])
    tov = calc_stats(player_stats_per_game[player_name]['tov'])
    stl = calc_stats(player_stats_per_game[player_name]['stl'])
    blk = calc_stats(player_stats_per_game[player_name]['blk'])

    output_lines.append(
        f"{player_name:<20} "
        f"{mins['mean']:>5.1f} {pts['mean']:>5.1f} "
        f"{fgm['mean']:>4.1f} {fga['mean']:>4.1f} "
        f"{fg3m['mean']:>4.1f} {fg3a['mean']:>4.1f} "
        f"{ftm['mean']:>4.1f} {fta['mean']:>4.1f} "
        f"{reb['mean']:>4.1f} {ast['mean']:>4.1f} "
        f"{tov['mean']:>4.1f} {stl['mean']:>4.1f} {blk['mean']:>4.1f}"
    )

output_lines.append("")
output_lines.append("TEAM BETA:")
output_lines.append("-"*80)
output_lines.append(f"{'Player':<20} {'MIN':>5} {'PTS':>5} {'FGM':>4} {'FGA':>4} {'3PM':>4} {'3PA':>4} {'FTM':>4} {'FTA':>4} {'REB':>4} {'AST':>4} {'TOV':>4} {'STL':>4} {'BLK':>4}")
output_lines.append("-"*80)

for player in team_b['players']:
    player_name = player['name']
    mins = calc_stats(player_stats_per_game[player_name]['minutes'])
    pts = calc_stats(player_stats_per_game[player_name]['pts'])
    fgm = calc_stats(player_stats_per_game[player_name]['fgm'])
    fga = calc_stats(player_stats_per_game[player_name]['fga'])
    fg3m = calc_stats(player_stats_per_game[player_name]['fg3m'])
    fg3a = calc_stats(player_stats_per_game[player_name]['fg3a'])
    ftm = calc_stats(player_stats_per_game[player_name]['ftm'])
    fta = calc_stats(player_stats_per_game[player_name]['fta'])
    reb = calc_stats(player_stats_per_game[player_name]['reb'])
    ast = calc_stats(player_stats_per_game[player_name]['ast'])
    tov = calc_stats(player_stats_per_game[player_name]['tov'])
    stl = calc_stats(player_stats_per_game[player_name]['stl'])
    blk = calc_stats(player_stats_per_game[player_name]['blk'])

    output_lines.append(
        f"{player_name:<20} "
        f"{mins['mean']:>5.1f} {pts['mean']:>5.1f} "
        f"{fgm['mean']:>4.1f} {fga['mean']:>4.1f} "
        f"{fg3m['mean']:>4.1f} {fg3a['mean']:>4.1f} "
        f"{ftm['mean']:>4.1f} {fta['mean']:>4.1f} "
        f"{reb['mean']:>4.1f} {ast['mean']:>4.1f} "
        f"{tov['mean']:>4.1f} {stl['mean']:>4.1f} {blk['mean']:>4.1f}"
    )

output_lines.append("")
output_lines.append("="*80)

# Write to file
output_text = "\n".join(output_lines)
with open('output/VALIDATION_100_GAMES_SCORING_OPTIONS.txt', 'w', encoding='utf-8') as f:
    f.write(output_text)

print(output_text)
print()
print("Results written to: output/VALIDATION_100_GAMES_SCORING_OPTIONS.txt")
