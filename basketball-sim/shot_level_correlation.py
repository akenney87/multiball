"""
Shot-level 3PT correlation analysis.
Runs 100 games and tracks every individual 3PT shot attempt.
"""
import json
import math
import random
from pathlib import Path
import statistics
from collections import defaultdict

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings
from src.constants import WEIGHTS_3PT, WEIGHTS_CONTEST


def calculate_composite(player, weights):
    """Calculate weighted composite score."""
    return sum(player.get(attr, 50) * weight for attr, weight in weights.items())


def extract_shot_data_from_possession(possession, home_roster, away_roster):
    """Extract 3PT shot data from a possession result."""
    shots = []

    # Check if this possession had a shot attempt
    if 'shot_attempt' not in possession.debug:
        return shots

    shot_info = possession.debug['shot_attempt']

    # Only track 3PT shots
    if shot_info.get('shot_type') != '3pt':
        return shots

    # Extract shot details from debug info
    shot_data = {
        'shooter_name': shot_info.get('shooter_name'),
        'shooter_composite': shot_info.get('shooter_composite'),
        'defender_name': shot_info.get('defender_name'),
        'defender_composite': shot_info.get('defender_composite'),
        'contest_distance': shot_info.get('contest_distance', 0.0),
        'is_transition': shot_info.get('transition_bonus', 0.0) > 0,
        'outcome': 1 if shot_info.get('result') == 'make' else 0,
        'final_probability': shot_info.get('final_success_rate', 0.0)
    }

    shots.append(shot_data)
    return shots


def create_minutes_allotment(roster):
    """Create standard minutes allocation: 35 for starters, 13 for bench."""
    allotment = {}

    # Starters (0-4): 35 minutes each
    for i in range(5):
        allotment[roster[i]['name']] = 35

    # Bench (5-9): 13 minutes each
    for i in range(5, 10):
        allotment[roster[i]['name']] = 13

    return allotment


def create_standard_tactical_settings(roster):
    """Create standard/baseline tactical settings for validation."""
    minutes_allotment = create_minutes_allotment(roster)

    return TacticalSettings(
        pace='standard',
        man_defense_pct=50,  # 50% man, 50% zone
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment=minutes_allotment,
        rebounding_strategy='standard'
    )


def run_shot_level_analysis(num_games=100):
    """Run correlation analysis at shot level."""
    print("="*80)
    print("SHOT-LEVEL 3PT CORRELATION ANALYSIS")
    print("="*80)

    # Set seed for reproducibility
    random.seed(42)

    # Load all teams
    print(f"\nLoading teams...")
    teams = []
    for team_file in sorted(Path('teams').glob('team_*.json')):
        team = json.loads(team_file.read_text())
        teams.append(team)

    print(f"Loaded {len(teams)} teams")

    if len(teams) < 2:
        print("ERROR: Need at least 2 teams")
        return

    # Collect all shot data
    all_shots = []

    print(f"\nSimulating {num_games} games...")
    for game_num in range(num_games):
        if (game_num + 1) % 10 == 0:
            print(f"  Game {game_num + 1}/{num_games}...")

        # Pick random teams
        home_team, away_team = random.sample(teams, 2)

        # Create tactical settings
        home_tactical = create_standard_tactical_settings(home_team['roster'])
        away_tactical = create_standard_tactical_settings(away_team['roster'])

        # Run simulation
        simulator = GameSimulator(
            home_roster=home_team['roster'],
            away_roster=away_team['roster'],
            tactical_home=home_tactical,
            tactical_away=away_tactical,
            home_team_name=home_team['name'],
            away_team_name=away_team['name']
        )
        result = simulator.simulate_game()

        # Extract shot data from all possessions
        home_roster = home_team['roster']
        away_roster = away_team['roster']

        for quarter_result in result.quarter_results:
            for possession in quarter_result.possession_results:
                shots = extract_shot_data_from_possession(possession, home_roster, away_roster)
                all_shots.extend(shots)

    print(f"\nTotal 3PT attempts: {len(all_shots)}")

    if len(all_shots) == 0:
        print("ERROR: No 3PT shots found in game data")
        return

    # Filter out shots with None values (shouldn't happen but let's be safe)
    all_shots = [s for s in all_shots if s['shooter_composite'] is not None]

    # Calculate overall statistics
    makes = sum(s['outcome'] for s in all_shots)
    overall_pct = makes / len(all_shots)

    print(f"Total makes: {makes}")
    print(f"Overall 3PT%: {overall_pct*100:.1f}%")

    # Calculate correlation
    shooter_comps = [s['shooter_composite'] for s in all_shots]
    outcomes = [s['outcome'] for s in all_shots]

    # Pearson correlation
    mean_comp = statistics.mean(shooter_comps)
    mean_outcome = statistics.mean(outcomes)

    numerator = sum((comp - mean_comp) * (outcome - mean_outcome)
                    for comp, outcome in zip(shooter_comps, outcomes))

    denom_comp = math.sqrt(sum((comp - mean_comp)**2 for comp in shooter_comps))
    denom_outcome = math.sqrt(sum((outcome - mean_outcome)**2 for outcome in outcomes))

    if denom_comp == 0 or denom_outcome == 0:
        correlation = 0.0
    else:
        correlation = numerator / (denom_comp * denom_outcome)

    print(f"\n{'='*80}")
    print("SHOT-LEVEL CORRELATION")
    print("="*80)
    print(f"Pearson correlation (shooter_composite vs outcome): {correlation:.3f}")

    # Bucket analysis
    print(f"\n{'='*80}")
    print("COMPOSITE BUCKET ANALYSIS")
    print("="*80)

    buckets = {
        '40-50': [],
        '50-55': [],
        '55-60': [],
        '60-65': [],
        '65-70': [],
        '70-80': [],
        '80+': []
    }

    for shot in all_shots:
        comp = shot['shooter_composite']
        outcome = shot['outcome']

        if comp < 50:
            buckets['40-50'].append(outcome)
        elif comp < 55:
            buckets['50-55'].append(outcome)
        elif comp < 60:
            buckets['55-60'].append(outcome)
        elif comp < 65:
            buckets['60-65'].append(outcome)
        elif comp < 70:
            buckets['65-70'].append(outcome)
        elif comp < 80:
            buckets['70-80'].append(outcome)
        else:
            buckets['80+'].append(outcome)

    print(f"\n{'Composite Range':<18} {'Attempts':>10} {'Makes':>10} {'FG%':>10}")
    print("-"*80)

    for bucket_name in ['40-50', '50-55', '55-60', '60-65', '65-70', '70-80', '80+']:
        outcomes = buckets[bucket_name]
        if len(outcomes) > 0:
            attempts = len(outcomes)
            makes = sum(outcomes)
            pct = makes / attempts
            print(f"{bucket_name:<18} {attempts:>10} {makes:>10} {pct*100:>9.1f}%")
        else:
            print(f"{bucket_name:<18} {0:>10} {0:>10} {'N/A':>10}")

    # Contest distance analysis
    print(f"\n{'='*80}")
    print("CONTEST DISTANCE ANALYSIS")
    print("="*80)

    wide_open = [s for s in all_shots if s['contest_distance'] >= 6.0]
    contested = [s for s in all_shots if 2.0 <= s['contest_distance'] < 6.0]
    heavily_contested = [s for s in all_shots if s['contest_distance'] < 2.0]

    print(f"\n{'Contest Level':<20} {'Attempts':>10} {'Makes':>10} {'FG%':>10}")
    print("-"*80)

    for label, shots in [
        ('Wide Open (6+ ft)', wide_open),
        ('Contested (2-6 ft)', contested),
        ('Heavy (<2 ft)', heavily_contested)
    ]:
        if len(shots) > 0:
            attempts = len(shots)
            makes = sum(s['outcome'] for s in shots)
            pct = makes / attempts
            print(f"{label:<20} {attempts:>10} {makes:>10} {pct*100:>9.1f}%")

    # Transition analysis
    print(f"\n{'='*80}")
    print("TRANSITION ANALYSIS")
    print("="*80)

    transition_shots = [s for s in all_shots if s['is_transition']]
    halfcourt_shots = [s for s in all_shots if not s['is_transition']]

    print(f"\n{'Context':<20} {'Attempts':>10} {'Makes':>10} {'FG%':>10}")
    print("-"*80)

    for label, shots in [
        ('Transition', transition_shots),
        ('Half-court', halfcourt_shots)
    ]:
        if len(shots) > 0:
            attempts = len(shots)
            makes = sum(s['outcome'] for s in shots)
            pct = makes / attempts
            print(f"{label:<20} {attempts:>10} {makes:>10} {pct*100:>9.1f}%")

    # Save detailed shot data
    output_path = Path('output/SHOT_LEVEL_3PT_DATA.json')
    output_path.parent.mkdir(exist_ok=True)

    output_data = {
        'total_shots': len(all_shots),
        'overall_3pt_pct': overall_pct,
        'correlation': correlation,
        'composite_stats': {
            'min': min(shooter_comps),
            'max': max(shooter_comps),
            'mean': mean_comp,
            'stdev': statistics.stdev(shooter_comps)
        },
        'shots': all_shots
    }

    output_path.write_text(json.dumps(output_data, indent=2))
    print(f"\nDetailed shot data saved to: {output_path}")

    # Summary
    print(f"\n{'='*80}")
    print("SUMMARY")
    print("="*80)
    print(f"\nShot-level correlation: {correlation:.3f}")
    print(f"Sample size: {len(all_shots)} shots (vs 87 teams in previous study)")

    # Expected correlation for binary outcome
    print(f"\nNote: For binary outcomes (make/miss), correlation is naturally lower")
    print(f"than team-level correlations due to shot-to-shot variance.")
    print(f"A correlation of 0.10-0.20 at shot level ≈ 0.40-0.60 at team level.")

    # Check if attributes are having meaningful impact
    bucket_data = []
    for bucket_name in ['50-55', '55-60', '60-65', '65-70']:
        outcomes = buckets[bucket_name]
        if len(outcomes) > 10:
            pct = sum(outcomes) / len(outcomes)
            bucket_data.append((bucket_name, pct))

    if len(bucket_data) >= 2:
        pct_range = max(b[1] for b in bucket_data) - min(b[1] for b in bucket_data)
        print(f"\nFG% range across composites: {pct_range*100:.1f} percentage points")
        if pct_range < 0.05:
            print("⚠️  WARNING: Less than 5 percentage point spread - attributes have weak impact")
        elif pct_range < 0.10:
            print("⚠️  CAUTION: Only 5-10 percentage point spread - attributes could have stronger impact")
        else:
            print("✓ Attributes show meaningful impact (10+ percentage point spread)")


if __name__ == '__main__':
    run_shot_level_analysis(num_games=100)
