"""
100-Game Validation Suite

Runs 100 games with random teams, collects comprehensive statistics,
and outputs per-game averages for all metrics.
"""

import json
import random
import sys
import os
from pathlib import Path
from typing import Dict, List, Any

sys.path.insert(0, os.path.dirname(__file__))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# Create output directory
output_dir = Path("output/validation_100games")
output_dir.mkdir(parents=True, exist_ok=True)

# Load all available teams
teams_dir = Path("teams")
team_files = list(teams_dir.glob("Team_*.json"))

if len(team_files) < 2:
    print("ERROR: Need at least 2 teams in /teams folder")
    sys.exit(1)

print(f"Found {len(team_files)} teams in /teams folder")
print("="*100)

# Load teams into memory
all_teams = []
for team_file in team_files:
    with open(team_file, 'r') as f:
        team_data = json.load(f)
        all_teams.append({
            'file': team_file.name,
            'name': team_data.get('name', team_file.stem),
            'players': team_data['roster']
        })

print(f"Loaded {len(all_teams)} teams successfully")
print("="*100)

# Statistics accumulators
game_stats = []

# Run 100 games
print("\nRunning 100 games...")
print("-"*100)

for game_num in range(1, 101):
    # Randomly select two different teams
    home_team, away_team = random.sample(all_teams, 2)

    # Standard tactical settings
    tactics = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )

    # Run simulation
    game_sim = GameSimulator(
        home_roster=home_team['players'],
        away_roster=away_team['players'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=home_team['name'],
        away_team_name=away_team['name']
    )

    result = game_sim.simulate_game(seed=game_num)

    # Extract stats from game_statistics dict
    home_gs = result.game_statistics['home_stats']
    away_gs = result.game_statistics['away_stats']

    # Calculate margin
    margin = abs(result.home_score - result.away_score)
    is_blowout = margin >= 20

    # Extract home team stats
    home_stats = {
        'team': home_team['name'],
        'points': result.home_score,
        'fgm': home_gs['fgm'],
        'fga': home_gs['fga'],
        'fg_pct': (home_gs['fgm'] / home_gs['fga'] * 100) if home_gs['fga'] > 0 else 0,
        '3pm': home_gs['fg3m'],
        '3pa': home_gs['fg3a'],
        '3p_pct': (home_gs['fg3m'] / home_gs['fg3a'] * 100) if home_gs['fg3a'] > 0 else 0,
        'ftm': home_gs['ftm'],
        'fta': home_gs['fta'],
        'ft_pct': (home_gs['ftm'] / home_gs['fta'] * 100) if home_gs['fta'] > 0 else 0,
        'rebounds': home_gs['oreb'] + home_gs['dreb'],
        'off_reb': home_gs['oreb'],
        'def_reb': home_gs['dreb'],
        'assists': home_gs['ast'],
        'turnovers': home_gs['tov'],
        'steals': home_gs['stl'],
        'blocks': home_gs['blk'],
        'fouls': home_gs['pf'],
    }

    # Extract away team stats
    away_stats = {
        'team': away_team['name'],
        'points': result.away_score,
        'fgm': away_gs['fgm'],
        'fga': away_gs['fga'],
        'fg_pct': (away_gs['fgm'] / away_gs['fga'] * 100) if away_gs['fga'] > 0 else 0,
        '3pm': away_gs['fg3m'],
        '3pa': away_gs['fg3a'],
        '3p_pct': (away_gs['fg3m'] / away_gs['fg3a'] * 100) if away_gs['fg3a'] > 0 else 0,
        'ftm': away_gs['ftm'],
        'fta': away_gs['fta'],
        'ft_pct': (away_gs['ftm'] / away_gs['fta'] * 100) if away_gs['fta'] > 0 else 0,
        'rebounds': away_gs['oreb'] + away_gs['dreb'],
        'off_reb': away_gs['oreb'],
        'def_reb': away_gs['dreb'],
        'assists': away_gs['ast'],
        'turnovers': away_gs['tov'],
        'steals': away_gs['stl'],
        'blocks': away_gs['blk'],
        'fouls': away_gs['pf'],
    }

    # Store game data
    game_data = {
        'game_num': game_num,
        'home': home_stats,
        'away': away_stats,
        'margin': margin,
        'is_blowout': is_blowout,
    }
    game_stats.append(game_data)

    # Save detailed game log for first 5 games (for spot-checking)
    if game_num <= 5:
        log_file = output_dir / f"game_{game_num:03d}_log.txt"
        with open(log_file, 'w', encoding='utf-8') as f:
            f.write(f"GAME {game_num}: {home_team['name']} vs {away_team['name']}\n")
            f.write("="*100 + "\n\n")
            f.write(result.play_by_play_text)
        print(f"[{game_num:3d}/100] {home_team['name']:30s} {result.home_score:3d} - {result.away_score:3d} {away_team['name']:30s} (Margin: {margin:2d}) [LOG SAVED]")
    else:
        print(f"[{game_num:3d}/100] {home_team['name']:30s} {result.home_score:3d} - {result.away_score:3d} {away_team['name']:30s} (Margin: {margin:2d})")

print("-"*100)
print("All 100 games completed!\n")

# Calculate averages
print("="*100)
print("CALCULATING PER-GAME AVERAGES...")
print("="*100)

def calculate_averages(stats_list: List[Dict], key_prefix: str) -> Dict[str, float]:
    """Calculate averages for a list of team stats."""
    totals = {
        'points': 0,
        'fgm': 0,
        'fga': 0,
        '3pm': 0,
        '3pa': 0,
        'ftm': 0,
        'fta': 0,
        'rebounds': 0,
        'off_reb': 0,
        'def_reb': 0,
        'assists': 0,
        'turnovers': 0,
        'steals': 0,
        'blocks': 0,
        'fouls': 0,
    }

    for game in stats_list:
        for key in totals.keys():
            totals[key] += game[key_prefix][key]

    num_games = len(stats_list)
    averages = {key: val / num_games for key, val in totals.items()}

    # Calculate shooting percentages
    averages['fg_pct'] = (totals['fgm'] / totals['fga'] * 100) if totals['fga'] > 0 else 0
    averages['3p_pct'] = (totals['3pm'] / totals['3pa'] * 100) if totals['3pa'] > 0 else 0
    averages['ft_pct'] = (totals['ftm'] / totals['fta'] * 100) if totals['fta'] > 0 else 0

    return averages

# Calculate combined team averages (all 200 team performances)
all_team_stats = []
for game in game_stats:
    all_team_stats.append(game['home'])
    all_team_stats.append(game['away'])

combined_avg = calculate_averages(game_stats, 'home')  # Just use home as template
combined_totals = {
    'points': sum(s['points'] for s in all_team_stats) / 200,
    'fgm': sum(s['fgm'] for s in all_team_stats) / 200,
    'fga': sum(s['fga'] for s in all_team_stats) / 200,
    '3pm': sum(s['3pm'] for s in all_team_stats) / 200,
    '3pa': sum(s['3pa'] for s in all_team_stats) / 200,
    'ftm': sum(s['ftm'] for s in all_team_stats) / 200,
    'fta': sum(s['fta'] for s in all_team_stats) / 200,
    'rebounds': sum(s['rebounds'] for s in all_team_stats) / 200,
    'off_reb': sum(s['off_reb'] for s in all_team_stats) / 200,
    'def_reb': sum(s['def_reb'] for s in all_team_stats) / 200,
    'assists': sum(s['assists'] for s in all_team_stats) / 200,
    'turnovers': sum(s['turnovers'] for s in all_team_stats) / 200,
    'steals': sum(s['steals'] for s in all_team_stats) / 200,
    'blocks': sum(s['blocks'] for s in all_team_stats) / 200,
    'fouls': sum(s['fouls'] for s in all_team_stats) / 200,
}

# Shooting percentages
total_fgm = sum(s['fgm'] for s in all_team_stats)
total_fga = sum(s['fga'] for s in all_team_stats)
total_3pm = sum(s['3pm'] for s in all_team_stats)
total_3pa = sum(s['3pa'] for s in all_team_stats)
total_ftm = sum(s['ftm'] for s in all_team_stats)
total_fta = sum(s['fta'] for s in all_team_stats)

combined_totals['fg_pct'] = (total_fgm / total_fga * 100) if total_fga > 0 else 0
combined_totals['3p_pct'] = (total_3pm / total_3pa * 100) if total_3pa > 0 else 0
combined_totals['ft_pct'] = (total_ftm / total_fta * 100) if total_fta > 0 else 0

# Calculate margin stats
avg_margin = sum(g['margin'] for g in game_stats) / len(game_stats)
blowout_count = sum(1 for g in game_stats if g['is_blowout'])
blowout_pct = (blowout_count / len(game_stats)) * 100

# Print results
print("\n" + "="*100)
print("PER-GAME AVERAGES (Combined for both teams, 200 total team performances)")
print("="*100)
print(f"Points:              {combined_totals['points']:.1f}")
print(f"Field Goals:         {combined_totals['fgm']:.1f} / {combined_totals['fga']:.1f} ({combined_totals['fg_pct']:.1f}%)")
print(f"3-Pointers:          {combined_totals['3pm']:.1f} / {combined_totals['3pa']:.1f} ({combined_totals['3p_pct']:.1f}%)")
print(f"Free Throws:         {combined_totals['ftm']:.1f} / {combined_totals['fta']:.1f} ({combined_totals['ft_pct']:.1f}%)")
print(f"Rebounds:            {combined_totals['rebounds']:.1f} (Off: {combined_totals['off_reb']:.1f}, Def: {combined_totals['def_reb']:.1f})")
print(f"Assists:             {combined_totals['assists']:.1f}")
print(f"Turnovers:           {combined_totals['turnovers']:.1f}")
print(f"Steals:              {combined_totals['steals']:.1f}")
print(f"Blocks:              {combined_totals['blocks']:.1f}")
print(f"Fouls:               {combined_totals['fouls']:.1f}")
print()
print(f"Average Margin:      {avg_margin:.1f} points")
print(f"Blowouts (20+ pts):  {blowout_count}/100 ({blowout_pct:.1f}%)")
print("="*100)

# Save summary to file
summary_file = output_dir / "validation_summary.txt"
with open(summary_file, 'w', encoding='utf-8') as f:
    f.write("="*100 + "\n")
    f.write("100-GAME VALIDATION SUMMARY\n")
    f.write("="*100 + "\n\n")
    f.write(f"Teams Used: {len(all_teams)}\n")
    f.write(f"Games Simulated: 100\n\n")
    f.write("PER-GAME AVERAGES (200 team performances):\n")
    f.write("-"*100 + "\n")
    f.write(f"Points:              {combined_totals['points']:.1f}\n")
    f.write(f"Field Goals:         {combined_totals['fgm']:.1f} / {combined_totals['fga']:.1f} ({combined_totals['fg_pct']:.1f}%)\n")
    f.write(f"3-Pointers:          {combined_totals['3pm']:.1f} / {combined_totals['3pa']:.1f} ({combined_totals['3p_pct']:.1f}%)\n")
    f.write(f"Free Throws:         {combined_totals['ftm']:.1f} / {combined_totals['fta']:.1f} ({combined_totals['ft_pct']:.1f}%)\n")
    f.write(f"Rebounds:            {combined_totals['rebounds']:.1f} (Off: {combined_totals['off_reb']:.1f}, Def: {combined_totals['def_reb']:.1f})\n")
    f.write(f"Assists:             {combined_totals['assists']:.1f}\n")
    f.write(f"Turnovers:           {combined_totals['turnovers']:.1f}\n")
    f.write(f"Steals:              {combined_totals['steals']:.1f}\n")
    f.write(f"Blocks:              {combined_totals['blocks']:.1f}\n")
    f.write(f"Fouls:               {combined_totals['fouls']:.1f}\n\n")
    f.write(f"Average Margin:      {avg_margin:.1f} points\n")
    f.write(f"Blowouts (20+ pts):  {blowout_count}/100 ({blowout_pct:.1f}%)\n")
    f.write("="*100 + "\n\n")
    f.write("INDIVIDUAL GAME RESULTS:\n")
    f.write("-"*100 + "\n")
    for game in game_stats:
        f.write(f"Game {game['game_num']:3d}: {game['home']['team']:30s} {game['home']['points']:3d} - "
                f"{game['away']['points']:3d} {game['away']['team']:30s} (Margin: {game['margin']:2d})\n")

print(f"\nValidation summary saved to: {summary_file}")
print(f"First 5 game logs saved to: {output_dir}/")
print("\n" + "="*100)
print("NEXT STEPS: Manually review game logs 1-5 for any bugs or anomalies")
print("="*100)
