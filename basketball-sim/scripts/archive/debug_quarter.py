"""
M4.5 PHASE 1: Debug a single quarter to see why possessions are low
"""

import random
import json
import sys

# Load a sample team
with open('teams/Team_001.json', 'r') as f:
    team1 = json.load(f)

with open('teams/Team_002.json', 'r') as f:
    team2 = json.load(f)

from src.systems.quarter_simulation import QuarterSimulator
from src.core.data_structures import TacticalSettings

def create_standard_tactical_settings(roster):
    """Create standard tactical settings."""
    minutes_allotment = {}
    for i in range(5):
        minutes_allotment[roster[i]['name']] = 35
    for i in range(5, 10):
        minutes_allotment[roster[i]['name']] = 13

    return TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment=minutes_allotment,
        rebounding_strategy='standard'
    )

# Create tactical settings
tactical_home = create_standard_tactical_settings(team1['roster'])
tactical_away = create_standard_tactical_settings(team2['roster'])

# Run a single quarter
random.seed(42)

quarter_sim = QuarterSimulator(
    home_roster=team1['roster'],
    away_roster=team2['roster'],
    tactical_home=tactical_home,
    tactical_away=tactical_away,
    home_team_name=team1['name'],
    away_team_name=team2['name'],
    quarter_number=1
)

# Monkey-patch the quarter simulator to log possession durations
original_simulate = quarter_sim.simulate_quarter

def logged_simulate_quarter(seed=None):
    """Wrapper that logs possession info."""
    if seed is not None:
        random.seed(seed)

    print(f"{"="*80}")
    print("STARTING QUARTER SIMULATION WITH DETAILED LOGGING")
    print(f"{"="*80}")
    print()

    # Track possession durations manually
    import time as time_module
    from src.systems.game_clock import calculate_possession_duration

    possession_count = 0
    home_has_possession = True
    elapsed_time = 0

    print(f"Quarter length: {quarter_sim.game_clock.total_seconds} seconds")
    print()

    # Run the original simulation but with logging hooks
    # We'll just run the simulation and then inspect the results
    result = original_simulate(seed=seed)

    print(f"{"="*80}")
    print("QUARTER SIMULATION COMPLETE")
    print(f"{"="*80}")
    print(f"  Total possessions: {result.possession_count}")
    print(f"  Home score: {result.home_score}")
    print(f"  Away score: {result.away_score}")
    print(f"  Final clock: {quarter_sim.game_clock.format_time()}")
    print(f"  Clock remaining: {quarter_sim.game_clock.get_time_remaining()} seconds")
    print()

    # Calculate actual average possession duration
    if result.possession_count > 0:
        total_time_used = 720 - quarter_sim.game_clock.get_time_remaining()
        avg_duration = total_time_used / result.possession_count
        print(f"  Total time used: {total_time_used} seconds")
        print(f"  Average possession duration: {avg_duration:.2f} seconds")
        print()

    # Show first few possession results
    print("First 10 possession outcomes:")
    for i, poss_result in enumerate(result.possession_results[:10], 1):
        print(f"  Possession {i}: {poss_result.possession_outcome}, {poss_result.points_scored} pts")

    return result

quarter_result = logged_simulate_quarter(seed=42)

print()
print(f"{"="*80}")
print("ANALYSIS")
print(f"{"="*80}")
print()
print(f"Expected possessions (triangular(10,24,15) → 16.33s avg): 44.1 total")
print(f"Actual possessions: {quarter_result.possession_count} total")
print(f"Discrepancy: {44.1 - quarter_result.possession_count:.1f} possessions")
print()

# Calculate what the average possession duration would need to be
total_time_used = 720 - quarter_sim.game_clock.get_time_remaining()
if quarter_result.possession_count > 0:
    implied_avg_duration = total_time_used / quarter_result.possession_count
    expected_avg_duration = 16.33

    print(f"Implied average possession duration: {implied_avg_duration:.2f} seconds")
    print(f"Expected average possession duration: {expected_avg_duration:.2f} seconds")
    print(f"Difference: {implied_avg_duration - expected_avg_duration:+.2f} seconds per possession")
    print()

    extra_time_per_possession = implied_avg_duration - expected_avg_duration
    total_extra_time = extra_time_per_possession * quarter_result.possession_count
    print(f"Extra time per possession: {extra_time_per_possession:.2f} seconds")
    print(f"Total extra time in quarter: {total_extra_time:.1f} seconds ({total_extra_time/60:.1f} minutes)")
    print()

print("NEXT STEP: Instrument quarter_simulation.py to log actual clock ticks")
print("to identify where the extra time is coming from.")
print()
