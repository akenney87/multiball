"""
Correlation Analysis: Verify all 24 attributes meaningfully impact gameplay

Tests each attribute by creating high vs low variants and measuring outcome differences.
Excludes durability (planned for injury system in Milestone 3).
"""

import random
import json
from typing import Dict, List, Tuple
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

# All attributes except durability (24 total)
ATTRIBUTES_TO_TEST = [
    # Physical (11 - excluding durability)
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height',
    # Mental (7)
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience',
    # Technical (6)
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'teamwork'
]

def create_modified_team(base_team: Dict, attribute: str, value: int) -> Dict:
    """Create team with specific attribute modified for all players."""
    modified_team = {
        'name': base_team['name'],
        'roster': []
    }

    for player in base_team['roster']:
        modified_player = player.copy()
        modified_player[attribute] = value
        modified_team['roster'].append(modified_player)

    return modified_team

def run_game_pair(base_team: Dict, baseline_team: Dict, attribute: str, high_value: int, low_value: int, seed: int) -> Dict:
    """Run two games: high attribute team vs baseline, low attribute team vs baseline."""
    random.seed(seed)

    # Create high and low attribute teams
    high_team = create_modified_team(base_team, attribute, high_value)
    high_team['name'] = f"High_{attribute}"

    low_team = create_modified_team(base_team, attribute, low_value)
    low_team['name'] = f"Low_{attribute}"

    # Tactical settings (standard)
    # Create minutes allotment
    minutes_high = {player['name']: 24.0 for player in high_team['roster'][:10]}
    minutes_baseline = {player['name']: 24.0 for player in baseline_team['roster'][:10]}

    tactical_high = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=high_team['roster'][0]['name'],
        scoring_option_2=high_team['roster'][1]['name'],
        scoring_option_3=high_team['roster'][2]['name'],
        minutes_allotment=minutes_high,
        rebounding_strategy='standard'
    )

    tactical_baseline = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=baseline_team['roster'][0]['name'],
        scoring_option_2=baseline_team['roster'][1]['name'],
        scoring_option_3=baseline_team['roster'][2]['name'],
        minutes_allotment=minutes_baseline,
        rebounding_strategy='standard'
    )

    # Run high attribute game
    random.seed(seed)
    high_sim = GameSimulator(
        home_roster=high_team['roster'],
        away_roster=baseline_team['roster'],
        home_team_name=high_team['name'],
        away_team_name=baseline_team['name'],
        tactical_home=tactical_high,
        tactical_away=tactical_baseline
    )
    high_result = high_sim.simulate_game()

    # Run low attribute game (same baseline team, different seed for variety)
    # Need to recreate tactical_low with low_team player names
    minutes_low = {player['name']: 24.0 for player in low_team['roster'][:10]}
    tactical_low = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=low_team['roster'][0]['name'],
        scoring_option_2=low_team['roster'][1]['name'],
        scoring_option_3=low_team['roster'][2]['name'],
        minutes_allotment=minutes_low,
        rebounding_strategy='standard'
    )

    random.seed(seed + 10000)
    low_sim = GameSimulator(
        home_roster=low_team['roster'],
        away_roster=baseline_team['roster'],
        home_team_name=low_team['name'],
        away_team_name=baseline_team['name'],
        tactical_home=tactical_low,
        tactical_away=tactical_baseline
    )
    low_result = low_sim.simulate_game()

    # Extract key stats from game_statistics
    high_home = high_result.game_statistics['home_stats']
    low_home = low_result.game_statistics['home_stats']

    # Calculate percentages
    high_fg_pct = (high_home['fgm'] / high_home['fga'] * 100) if high_home['fga'] > 0 else 0
    high_fg3_pct = (high_home['fg3m'] / high_home['fg3a'] * 100) if high_home['fg3a'] > 0 else 0
    high_ft_pct = (high_home['ftm'] / high_home['fta'] * 100) if high_home['fta'] > 0 else 0

    low_fg_pct = (low_home['fgm'] / low_home['fga'] * 100) if low_home['fga'] > 0 else 0
    low_fg3_pct = (low_home['fg3m'] / low_home['fg3a'] * 100) if low_home['fg3a'] > 0 else 0
    low_ft_pct = (low_home['ftm'] / low_home['fta'] * 100) if low_home['fta'] > 0 else 0

    high_stats = {
        'points': high_result.home_score,
        'fg_pct': high_fg_pct,
        'fg3_pct': high_fg3_pct,
        'ft_pct': high_ft_pct,
        'turnovers': high_home['tov'],
        'offensive_rebounds': high_home['oreb'],
        'assists': high_home['ast'],
        'fouls': high_home['pf']
    }

    low_stats = {
        'points': low_result.home_score,
        'fg_pct': low_fg_pct,
        'fg3_pct': low_fg3_pct,
        'ft_pct': low_ft_pct,
        'turnovers': low_home['tov'],
        'offensive_rebounds': low_home['oreb'],
        'assists': low_home['ast'],
        'fouls': low_home['pf']
    }

    return {
        'attribute': attribute,
        'high_value': high_value,
        'low_value': low_value,
        'high_stats': high_stats,
        'low_stats': low_stats,
        'differences': {
            'points': high_stats['points'] - low_stats['points'],
            'fg_pct': high_stats['fg_pct'] - low_stats['fg_pct'],
            'fg3_pct': high_stats['fg3_pct'] - low_stats['fg3_pct'],
            'ft_pct': high_stats['ft_pct'] - low_stats['ft_pct'],
            'turnovers': high_stats['turnovers'] - low_stats['turnovers'],
            'offensive_rebounds': high_stats['offensive_rebounds'] - low_stats['offensive_rebounds'],
            'assists': high_stats['assists'] - low_stats['assists'],
            'fouls': high_stats['fouls'] - low_stats['fouls']
        }
    }

def main():
    """Run correlation analysis for all 24 attributes."""
    print("=" * 80)
    print("CORRELATION ANALYSIS: Verifying All 24 Attributes Impact Gameplay")
    print("=" * 80)
    print()
    print("Testing strategy:")
    print("- For each attribute, create HIGH (90) and LOW (30) teams")
    print("- Run each against same baseline opponent (rating 58-62)")
    print("- Measure stat differences (HIGH - LOW)")
    print("- Positive difference = attribute helps performance")
    print("- Negative difference = attribute hurts performance (e.g., fewer turnovers)")
    print()
    print("Running 5 game pairs per attribute (24 attributes × 5 = 120 total games)...")
    print()

    # Load base team and baseline opponent from existing teams
    with open('teams/Team_001.json', 'r') as f:
        base_team = json.load(f)

    with open('teams/Team_002.json', 'r') as f:
        baseline_team = json.load(f)

    print(f"Base team: {base_team['name']} (rating: {base_team['actual_overall_rating']})")
    print(f"Baseline opponent: {baseline_team['name']} (rating: {baseline_team['actual_overall_rating']})")
    print()

    results = []

    for attr_idx, attribute in enumerate(ATTRIBUTES_TO_TEST, 1):
        print(f"[{attr_idx}/24] Testing {attribute}...")

        # Run 5 game pairs per attribute
        attr_results = []
        for game_num in range(5):
            seed = (attr_idx * 1000) + game_num
            result = run_game_pair(base_team, baseline_team, attribute, high_value=90, low_value=30, seed=seed)
            attr_results.append(result)

        # Calculate averages
        avg_diffs = {
            'points': sum(r['differences']['points'] for r in attr_results) / 5,
            'fg_pct': sum(r['differences']['fg_pct'] for r in attr_results) / 5,
            'fg3_pct': sum(r['differences']['fg3_pct'] for r in attr_results) / 5,
            'ft_pct': sum(r['differences']['ft_pct'] for r in attr_results) / 5,
            'turnovers': sum(r['differences']['turnovers'] for r in attr_results) / 5,
            'offensive_rebounds': sum(r['differences']['offensive_rebounds'] for r in attr_results) / 5,
            'assists': sum(r['differences']['assists'] for r in attr_results) / 5,
            'fouls': sum(r['differences']['fouls'] for r in attr_results) / 5
        }

        results.append({
            'attribute': attribute,
            'games_tested': 5,
            'average_differences': avg_diffs,
            'individual_results': attr_results
        })

        # Print summary
        print(f"  -> Avg differences (HIGH-LOW): Pts={avg_diffs['points']:+.1f}, "
              f"FG%={avg_diffs['fg_pct']:+.1f}%, TO={avg_diffs['turnovers']:+.1f}")

    # Save detailed results
    output_file = 'output/CORRELATION_ANALYSIS.json'
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)

    print()
    print("=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)
    print()

    # Generate summary report
    print("ATTRIBUTE IMPACT SUMMARY")
    print("=" * 80)
    print()

    # Sort by points impact
    sorted_by_points = sorted(results, key=lambda x: abs(x['average_differences']['points']), reverse=True)

    print("TOP 10 ATTRIBUTES BY POINTS IMPACT:")
    print(f"{'Attribute':<25} {'Avg Diff Pts':<15} {'Avg Diff FG%':<15} {'Avg Diff TO':<15}")
    print("-" * 80)
    for i, result in enumerate(sorted_by_points[:10], 1):
        attr = result['attribute']
        diffs = result['average_differences']
        print(f"{i:2d}. {attr:<22} {diffs['points']:+7.1f}         {diffs['fg_pct']:+7.1f}%        {diffs['turnovers']:+7.1f}")

    print()
    print("ATTRIBUTES WITH MINIMAL IMPACT (potential issues):")
    print(f"{'Attribute':<25} {'Avg Diff Pts':<15} {'Avg Diff FG%':<15} {'Avg Diff TO':<15}")
    print("-" * 80)

    minimal_impact = []
    for result in results:
        attr = result['attribute']
        diffs = result['average_differences']

        # Flag if all differences are tiny (< 1 point, < 0.5%, etc.)
        if (abs(diffs['points']) < 1.0 and
            abs(diffs['fg_pct']) < 0.5 and
            abs(diffs['turnovers']) < 0.5):
            minimal_impact.append(result)
            print(f"[!] {attr:<22} {diffs['points']:+7.1f}         {diffs['fg_pct']:+7.1f}%        {diffs['turnovers']:+7.1f}")

    if not minimal_impact:
        print("[OK] All attributes show meaningful impact!")

    print()
    print(f"Detailed results saved to: {output_file}")
    print()

    # Check for unused attributes
    print("ATTRIBUTE USAGE STATUS:")
    print("-" * 80)
    print(f"[OK] Tested and active: {len(ATTRIBUTES_TO_TEST)}/25 attributes")
    print(f"[FUTURE] Reserved for future: durability (injury system in Milestone 3)")
    print()

if __name__ == '__main__':
    main()
