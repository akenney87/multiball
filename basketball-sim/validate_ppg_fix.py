"""
Quick PPG Validation - Verify BASE_RATE_3PT increase fixed the issue
"""
import json, sys, os, random
from pathlib import Path
sys.path.insert(0, '.')

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

teams_dir = Path('teams')
team_files = list(teams_dir.glob('Team_*.json'))

print("="*80)
print("PPG VALIDATION - 20 GAMES")
print("="*80)
print()
print("Testing BASE_RATE_3PT increase from 0.23 -> 0.28")
print()

total_points = 0
total_fta = 0
total_ftm = 0
total_3pt_made = 0
total_3pt_attempts = 0

for game_num in range(1, 21):
    if game_num % 5 == 0:
        print(f"Completed {game_num}/20 games...")

    tf = random.sample(team_files, 2)
    team_a = json.load(open(tf[0]))
    team_b = json.load(open(tf[1]))

    tactics = TacticalSettings(
        pace='standard', man_defense_pct=50,
        scoring_option_1=team_a['roster'][0]['name'],
        scoring_option_2=None, scoring_option_3=None,
        minutes_allotment={}, rebounding_strategy='standard'
    )

    sim = GameSimulator(team_a['roster'], team_b['roster'], tactics, tactics,
                        team_a['name'], team_b['name'])
    result = sim.simulate_game()

    game_points = result.home_score + result.away_score
    total_points += game_points

    # Extract FTA from possession results
    for quarter in result.quarter_results:
        for poss in quarter.possession_results:
            if poss.free_throw_result:
                total_fta += poss.free_throw_result.attempts
                total_ftm += poss.free_throw_result.made

            # Track 3PT
            if poss.debug.get('shot_type') == '3pt':
                total_3pt_attempts += 1
                if poss.possession_outcome == 'made_shot':
                    total_3pt_made += 1

games_played = 20 * 2  # 40 team performances
avg_ppg = total_points / games_played
avg_fta = total_fta / games_played
avg_ftm = total_ftm / games_played
three_pt_pct = (total_3pt_made / total_3pt_attempts * 100) if total_3pt_attempts > 0 else 0

print()
print("="*80)
print("RESULTS")
print("="*80)
print()
print(f"Average PPG: {avg_ppg:.1f} (target: 108-114)")
print(f"FTA per game: {avg_fta:.1f} (target: ~24)")
print(f"FTM per game: {avg_ftm:.1f}")
print(f"FT%: {(avg_ftm/avg_fta*100) if avg_fta > 0 else 0:.1f}%")
print(f"3PT FG%: {three_pt_pct:.1f}% (target: 36-37%)")
print()

if 108 <= avg_ppg <= 114:
    print("[OK] PPG within target range!")
else:
    gap = 108 - avg_ppg if avg_ppg < 108 else avg_ppg - 114
    print(f"[INFO] PPG {'+' if avg_ppg > 114 else '-'}{abs(gap):.1f} from target range")

if 35 <= three_pt_pct <= 38:
    print("[OK] 3PT% within target range!")
else:
    print(f"[INFO] 3PT% {three_pt_pct:.1f}% (target: 36-37%)")

if 20 <= avg_fta <= 26:
    print("[OK] FTA within expected range!")
else:
    print(f"[INFO] FTA {avg_fta:.1f} (target: ~24)")

print()
print("="*80)
