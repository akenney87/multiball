"""
URGENT: Simple Correlation Diagnostic

Tests current code with 3 matchups to quickly determine if correlation is working.
"""

import sys
import os
import json
import random
import numpy as np

sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator
from generate_teams import generate_team

print("=" * 80)
print("URGENT CORRELATION DIAGNOSTIC")
print("=" * 80)
print()

# Fixed seed for reproducibility
random.seed(99999)

print("Step 1: Generate 4 teams with varied quality")
print("-" * 80)

teams = []
quality_levels = [57, 61, 65, 69]  # Wide spread

for quality in quality_levels:
    team = generate_team(f"Team_Q{quality}", quality)
    teams.append(team)
    print(f"  {team['name']}: Target={quality}, Actual={team['actual_overall_rating']}")

print()

print("Step 2: Run 6 matchups")
print("-" * 80)

matchups = [
    (0, 1),  # 57 vs 61 (small gap)
    (0, 2),  # 57 vs 65 (medium gap)
    (0, 3),  # 57 vs 69 (large gap)
    (1, 2),  # 61 vs 65
    (1, 3),  # 61 vs 69
    (2, 3),  # 65 vs 69
]

# Default tactics
default_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=100,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={},
    rebounding_strategy='standard'
)

results = []

for idx, (home_idx, away_idx) in enumerate(matchups, 1):
    home_team = teams[home_idx]
    away_team = teams[away_idx]

    home_rating = home_team['actual_overall_rating']
    away_rating = away_team['actual_overall_rating']
    rating_gap = home_rating - away_rating

    print(f"\nGame {idx}: {home_team['name']} ({home_rating:.1f}) vs {away_team['name']} ({away_rating:.1f})")
    print(f"  Rating Gap: {rating_gap:+.1f}")

    # Run game
    simulator = GameSimulator(
        home_roster=home_team['roster'],
        away_roster=away_team['roster'],
        tactical_home=default_tactics,
        tactical_away=default_tactics,
        home_team_name=home_team['name'],
        away_team_name=away_team['name']
    )

    game_result = simulator.simulate_game(seed=1000 + idx)

    home_score = game_result.home_score
    away_score = game_result.away_score
    margin = home_score - away_score

    print(f"  Final Score: {home_score}-{away_score}")
    print(f"  Margin: {margin:+d}")

    # Did better team win?
    if rating_gap > 0 and margin < 0:
        print(f"  UPSET: Underdog won!")
    elif rating_gap < 0 and margin > 0:
        print(f"  UPSET: Underdog won!")

    results.append({
        'rating_gap': rating_gap,
        'margin': margin
    })

print()
print("=" * 80)
print("Step 3: Calculate Correlation")
print("=" * 80)

rating_gaps = [r['rating_gap'] for r in results]
margins = [r['margin'] for r in results]

correlation = np.corrcoef(rating_gaps, margins)[0, 1]

print(f"\nPearson Correlation: {correlation:.4f}")
print()

if correlation < 0:
    print("  STATUS: CRITICAL - Negative correlation!")
    print("  Better teams are LOSING more often.")
elif correlation < 0.15:
    print("  STATUS: CRITICAL - Near-zero correlation!")
    print("  Team quality has no meaningful impact.")
elif correlation < 0.30:
    print("  STATUS: WARNING - Low correlation")
elif correlation < 0.45:
    print("  STATUS: OK - Acceptable correlation")
else:
    print("  STATUS: EXCELLENT - Strong correlation")

print()
print("=" * 80)
print(f"FINAL RESULT: {correlation:.4f}")
print("=" * 80)

# Save results
with open('urgent_correlation_result.json', 'w') as f:
    json.dump({
        'correlation': float(correlation),
        'games': results
    }, f, indent=2)

print("\nResults saved to: urgent_correlation_result.json")
