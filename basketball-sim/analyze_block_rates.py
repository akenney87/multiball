"""
Block Rate Analysis - 100 Games

Tracks block frequency by shot type:
- Overall block rate
- Block rate by shot type (3pt, midrange, rim)
- Block rate by contest distance
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
    'by_shot_type': defaultdict(lambda: {'attempts': 0, 'blocked': 0}),
    'by_contest': defaultdict(lambda: {'attempts': 0, 'blocked': 0}),
}

print("=" * 80)
print("BLOCK RATE ANALYSIS - 100 GAMES")
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

    result = game_sim.simulate_game(seed=4000 + game_num)

    # Analyze possession results
    for quarter_result in result.quarter_results:
        for poss_result in quarter_result.possession_results:
            # Only analyze shot attempts (made or missed)
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

            # Check if blocked
            blocked = shot_debug.get('outcome') == 'blocked_shot'

            # Track by shot type
            stats['by_shot_type'][shot_type]['attempts'] += 1
            if blocked:
                stats['by_shot_type'][shot_type]['blocked'] += 1

            # Track by contest level
            contest_distance = shot_debug.get('contest_distance', 999)
            if contest_distance >= 6.0:
                contest_level = 'wide_open'
            elif contest_distance >= 2.0:
                contest_level = 'contested'
            else:
                contest_level = 'heavy'

            stats['by_contest'][contest_level]['attempts'] += 1
            if blocked:
                stats['by_contest'][contest_level]['blocked'] += 1

    if game_num % 10 == 0:
        print(f"Completed {game_num}/{NUM_GAMES} games...")

print()
print("=" * 80)
print("BLOCK RATE BY SHOT TYPE")
print("=" * 80)
print(f"{'Shot Type':<15} {'Attempts':<12} {'Blocked':<12} {'Block %':<12} {'NBA Target'}")
print("-" * 80)

# NBA block rate targets (approximate)
nba_targets = {
    '3pt': '~0.5%',
    'midrange': '~2-3%',
    'rim': '~8-10%',
}

total_attempts = 0
total_blocks = 0

for shot_type in sorted(stats['by_shot_type'].keys()):
    data = stats['by_shot_type'][shot_type]
    attempts = data['attempts']
    blocked = data['blocked']
    block_pct = (blocked / attempts * 100) if attempts > 0 else 0
    target = nba_targets.get(shot_type, 'N/A')

    total_attempts += attempts
    total_blocks += blocked

    print(f"{shot_type:<15} {attempts:<12} {blocked:<12} {block_pct:<12.2f} {target}")

overall_block_pct = (total_blocks / total_attempts * 100) if total_attempts > 0 else 0
print("-" * 80)
print(f"{'TOTAL':<15} {total_attempts:<12} {total_blocks:<12} {overall_block_pct:<12.2f} {'~4.5-5%'}")

print()
print("=" * 80)
print("BLOCK RATE BY CONTEST DISTANCE")
print("=" * 80)
print(f"{'Contest Level':<15} {'Attempts':<12} {'Blocked':<12} {'Block %':<12} {'Expected'}")
print("-" * 80)

for level in ['wide_open', 'contested', 'heavy']:
    data = stats['by_contest'][level]
    attempts = data['attempts']
    blocked = data['blocked']
    block_pct = (blocked / attempts * 100) if attempts > 0 else 0

    if level == 'wide_open':
        expected = 'Very Low'
    elif level == 'contested':
        expected = 'Moderate'
    else:  # heavy
        expected = 'High'

    print(f"{level:<15} {attempts:<12} {blocked:<12} {block_pct:<12.2f} {expected}")

print()
print("=" * 80)
print("ANALYSIS")
print("=" * 80)

# Calculate blocks per game
blocks_per_game = total_blocks / NUM_GAMES
print(f"Blocks per game (per team): {blocks_per_game:.1f}")
print(f"NBA average: ~4.5-5.0 blocks per game per team")
print()

# Check 3PT block rate
three_data = stats['by_shot_type']['3pt']
three_block_pct = (three_data['blocked'] / three_data['attempts'] * 100) if three_data['attempts'] > 0 else 0
if three_block_pct > 1.0:
    print(f"WARNING: 3PT block rate ({three_block_pct:.2f}%) is too high (should be ~0.5%)")
elif three_block_pct < 0.2:
    print(f"WARNING: 3PT block rate ({three_block_pct:.2f}%) is too low (should be ~0.5%)")
else:
    print(f"✓ 3PT block rate ({three_block_pct:.2f}%) is reasonable")

# Check rim block rate
rim_data = stats['by_shot_type']['rim']
rim_block_pct = (rim_data['blocked'] / rim_data['attempts'] * 100) if rim_data['attempts'] > 0 else 0
if rim_block_pct > 12.0:
    print(f"WARNING: Rim block rate ({rim_block_pct:.2f}%) is too high (should be ~8-10%)")
elif rim_block_pct < 6.0:
    print(f"WARNING: Rim block rate ({rim_block_pct:.2f}%) is too low (should be ~8-10%)")
else:
    print(f"✓ Rim block rate ({rim_block_pct:.2f}%) is reasonable")

# Check midrange block rate
mid_data = stats['by_shot_type']['midrange']
mid_block_pct = (mid_data['blocked'] / mid_data['attempts'] * 100) if mid_data['attempts'] > 0 else 0
if mid_block_pct > 4.0:
    print(f"WARNING: Midrange block rate ({mid_block_pct:.2f}%) is too high (should be ~2-3%)")
elif mid_block_pct < 1.0:
    print(f"WARNING: Midrange block rate ({mid_block_pct:.2f}%) is too low (should be ~2-3%)")
else:
    print(f"✓ Midrange block rate ({mid_block_pct:.2f}%) is reasonable")

print()
print("=" * 80)
print("DIAGNOSTIC COMPLETE")
print("=" * 80)
