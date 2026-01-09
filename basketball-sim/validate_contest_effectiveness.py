"""
Validate Contest Effectiveness - Large Sample

Tests whether heavily contested shots truly perform worse than regular contested shots.
Runs 100 games to get statistically significant sample sizes.

Tracks:
- FG% by contest distance tier (wide/contested/heavy)
- Sample sizes for each tier
- Shot type breakdown within each tier
"""

import json
import sys
import os
from collections import defaultdict

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

# Aggregators
stats = {
    'wide_open': {'attempts': 0, 'makes': 0, 'by_shot_type': defaultdict(lambda: {'attempts': 0, 'makes': 0})},
    'contested': {'attempts': 0, 'makes': 0, 'by_shot_type': defaultdict(lambda: {'attempts': 0, 'makes': 0})},
    'heavy': {'attempts': 0, 'makes': 0, 'by_shot_type': defaultdict(lambda: {'attempts': 0, 'makes': 0})},
}

print("=" * 80)
print("CONTEST EFFECTIVENESS VALIDATION - 100 GAMES")
print("=" * 80)
print()

NUM_GAMES = 100

for game_num in range(1, NUM_GAMES + 1):
    game_sim = GameSimulator(
        home_roster=team_a['players'],
        away_roster=team_b['players'],
        tactical_home=tactics,
        tactical_away=tactics,
        home_team_name=team_a['team_name'],
        away_team_name=team_b['team_name']
    )

    result = game_sim.simulate_game(seed=3000 + game_num)

    # Analyze possession results
    for quarter_result in result.quarter_results:
        for poss_result in quarter_result.possession_results:
            # Only analyze shot attempts
            if poss_result.possession_outcome not in ['made_shot', 'missed_shot']:
                continue

            # Skip and-1 fouls
            if poss_result.foul_event and poss_result.foul_event.and_one:
                continue

            debug = poss_result.debug
            if 'shot_attempt' not in debug:
                continue

            shot_debug = debug['shot_attempt']
            shot_type = debug.get('shot_type', 'unknown')
            made = poss_result.possession_outcome == 'made_shot'

            # Determine contest level
            contest_distance = shot_debug.get('contest_distance', 999)
            if contest_distance >= 6.0:
                contest_level = 'wide_open'
            elif contest_distance >= 2.0:
                contest_level = 'contested'
            else:
                contest_level = 'heavy'

            # Track overall
            stats[contest_level]['attempts'] += 1
            if made:
                stats[contest_level]['makes'] += 1

            # Track by shot type
            stats[contest_level]['by_shot_type'][shot_type]['attempts'] += 1
            if made:
                stats[contest_level]['by_shot_type'][shot_type]['makes'] += 1

    if game_num % 10 == 0:
        print(f"Completed {game_num}/{NUM_GAMES} games...")

print()
print("=" * 80)
print("OVERALL CONTEST EFFECTIVENESS")
print("=" * 80)
print(f"{'Contest Level':<20} {'FGA':<10} {'FGM':<10} {'FG%':<10} {'Sample %':<12} {'Expected'}")
print("-" * 80)

total_attempts = sum(stats[level]['attempts'] for level in stats)

for level in ['wide_open', 'contested', 'heavy']:
    data = stats[level]
    attempts = data['attempts']
    makes = data['makes']
    pct = (makes / attempts * 100) if attempts > 0 else 0
    sample_pct = (attempts / total_attempts * 100) if total_attempts > 0 else 0

    if level == 'wide_open':
        expected = 'Baseline'
    elif level == 'contested':
        expected = '-7 to -8pp'
    else:  # heavy
        expected = '-15 to -17pp'

    print(f"{level:<20} {attempts:<10} {makes:<10} {pct:<10.1f} {sample_pct:<12.1f} {expected}")

print()
print("=" * 80)
print("BREAKDOWN BY SHOT TYPE")
print("=" * 80)

for level in ['wide_open', 'contested', 'heavy']:
    print()
    print(f"{level.upper()} SHOTS:")
    print(f"{'Shot Type':<15} {'FGA':<10} {'FGM':<10} {'FG%':<10}")
    print("-" * 50)

    for shot_type in sorted(stats[level]['by_shot_type'].keys()):
        data = stats[level]['by_shot_type'][shot_type]
        attempts = data['attempts']
        makes = data['makes']
        pct = (makes / attempts * 100) if attempts > 0 else 0

        print(f"{shot_type:<15} {attempts:<10} {makes:<10} {pct:<10.1f}")

print()
print("=" * 80)
print("ANALYSIS")
print("=" * 80)

wide_pct = (stats['wide_open']['makes'] / stats['wide_open']['attempts'] * 100) if stats['wide_open']['attempts'] > 0 else 0
contested_pct = (stats['contested']['makes'] / stats['contested']['attempts'] * 100) if stats['contested']['attempts'] > 0 else 0
heavy_pct = (stats['heavy']['makes'] / stats['heavy']['attempts'] * 100) if stats['heavy']['attempts'] > 0 else 0

contested_diff = contested_pct - wide_pct
heavy_diff = heavy_pct - wide_pct

print(f"Wide Open:       {wide_pct:.1f}% (baseline)")
print(f"Contested:       {contested_pct:.1f}% ({contested_diff:+.1f}pp from wide open)")
print(f"Heavily Contest: {heavy_pct:.1f}% ({heavy_diff:+.1f}pp from wide open)")
print()

# Check if heavily contested is worse than contested
if heavy_pct < contested_pct:
    diff = contested_pct - heavy_pct
    print(f"✓ CORRECT: Heavily contested ({heavy_pct:.1f}%) is {diff:.1f}pp worse than contested ({contested_pct:.1f}%)")
else:
    diff = heavy_pct - contested_pct
    print(f"✗ ERROR: Heavily contested ({heavy_pct:.1f}%) is {diff:.1f}pp BETTER than contested ({contested_pct:.1f}%)")
    print("  This is backwards - heavier contests should reduce FG% further")

print()
print("Expected penalties from wide open:")
print(f"  Contested should be:       -7 to -8pp  (actual: {contested_diff:.1f}pp)")
print(f"  Heavily contested should be: -15 to -17pp (actual: {heavy_diff:.1f}pp)")

print()
print("=" * 80)
print("VALIDATION COMPLETE")
print("=" * 80)
