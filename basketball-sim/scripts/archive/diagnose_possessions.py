"""
M4.5 PHASE 1: Possession Duration Diagnostic

Analyzes why games are producing 66.3 possessions per team instead of ~100.
"""

import random

def triangular_mean(a, b, c):
    """Calculate expected value of triangular distribution."""
    return (a + b + c) / 3.0

def analyze_current_settings():
    """Analyze current pace settings."""
    print("="*80)
    print("CURRENT PACE SETTINGS ANALYSIS")
    print("="*80)
    print()

    current_settings = {
        'fast': (6, 20, 10),
        'standard': (10, 24, 15),
        'slow': (14, 30, 20)
    }

    quarter_length = 720  # 12 minutes in seconds

    for pace, (min_dur, max_dur, mode_dur) in current_settings.items():
        avg_duration = triangular_mean(min_dur, max_dur, mode_dur)
        possessions_per_quarter = quarter_length / avg_duration
        possessions_per_team_per_quarter = possessions_per_quarter / 2
        possessions_per_team_per_game = possessions_per_team_per_quarter * 4

        print(f"{pace.upper()} PACE:")
        print(f"  Distribution: triangular({min_dur}, {max_dur}, {mode_dur})")
        print(f"  Expected avg duration: {avg_duration:.2f} seconds")
        print(f"  Possessions per quarter (total): {possessions_per_quarter:.1f}")
        print(f"  Possessions per team per quarter: {possessions_per_team_per_quarter:.1f}")
        print(f"  Possessions per team per game: {possessions_per_team_per_game:.1f}")
        print()

def calculate_target_settings():
    """Calculate new pace settings to hit NBA targets."""
    print("="*80)
    print("TARGET SETTINGS TO REACH NBA BENCHMARKS")
    print("="*80)
    print()
    print("NBA Target: ~100 possessions per team per game")
    print("Requirement: 25 possessions per team per quarter")
    print("Requirement: 50 total possessions per quarter")
    print("Requirement: 720 seconds / 50 = 14.4 seconds average per possession")
    print()

    # Design new distributions targeting different NBA pace scenarios
    # NBA teams range from ~95 possessions (slow) to ~105 (fast)

    new_settings = {
        'fast': {
            'target_poss_per_team_per_game': 105,
            'target_avg_duration': 720 / (105 / 4 * 2),  # 13.71 seconds
        },
        'standard': {
            'target_poss_per_team_per_game': 100,
            'target_avg_duration': 720 / (100 / 4 * 2),  # 14.4 seconds
        },
        'slow': {
            'target_poss_per_team_per_game': 95,
            'target_avg_duration': 720 / (95 / 4 * 2),   # 15.16 seconds
        }
    }

    print("PROPOSED NEW PACE SETTINGS:")
    print()

    for pace, targets in new_settings.items():
        target_avg = targets['target_avg_duration']
        target_poss = targets['target_poss_per_team_per_game']

        # Design triangular distribution with desired mean
        # For triangular(a, b, c), mean = (a + b + c) / 3
        # We want c (mode) near the middle, and reasonable spread

        # Strategy: Set mode = target_avg, then add ±40% spread
        mode = target_avg
        min_val = target_avg * 0.6
        max_val = target_avg * 1.4

        # Verify the mean
        actual_mean = triangular_mean(min_val, max_val, mode)

        # Adjust mode to hit exact target
        # (a + b + c) / 3 = target, solve for c
        adjusted_mode = 3 * target_avg - min_val - max_val
        actual_mean_adjusted = triangular_mean(min_val, max_val, adjusted_mode)

        possessions_per_quarter = 720 / actual_mean_adjusted
        possessions_per_team_per_quarter = possessions_per_quarter / 2
        possessions_per_team_per_game = possessions_per_team_per_quarter * 4

        print(f"{pace.upper()} PACE:")
        print(f"  Target: {target_poss:.1f} possessions per team per game")
        print(f"  Target avg duration: {target_avg:.2f} seconds")
        print(f"  Proposed: triangular({min_val:.1f}, {max_val:.1f}, {adjusted_mode:.1f})")
        print(f"  Actual mean: {actual_mean_adjusted:.2f} seconds")
        print(f"  Result: {possessions_per_team_per_game:.1f} possessions per team per game")
        print()

def simulate_current_vs_proposed():
    """Run Monte Carlo simulation comparing current vs proposed."""
    print("="*80)
    print("MONTE CARLO SIMULATION (1000 quarters each)")
    print("="*80)
    print()

    current_standard = (10, 24, 15)
    proposed_standard = (8.6, 20.2, 14.4)  # Calculated above

    num_quarters = 1000
    quarter_length = 720

    # Simulate current
    random.seed(42)
    current_results = []
    for _ in range(num_quarters):
        possessions = 0
        elapsed = 0
        while elapsed < quarter_length:
            duration = random.triangular(*current_standard)
            elapsed += duration
            possessions += 1
        current_results.append(possessions)

    # Simulate proposed
    random.seed(42)
    proposed_results = []
    for _ in range(num_quarters):
        possessions = 0
        elapsed = 0
        while elapsed < quarter_length:
            duration = random.triangular(*proposed_standard)
            elapsed += duration
            possessions += 1
        proposed_results.append(possessions)

    # Calculate statistics
    current_avg = sum(current_results) / len(current_results)
    current_min = min(current_results)
    current_max = max(current_results)

    proposed_avg = sum(proposed_results) / len(proposed_results)
    proposed_min = min(proposed_results)
    proposed_max = max(proposed_results)

    print(f"STANDARD PACE - CURRENT SETTINGS triangular{current_standard}:")
    print(f"  Average possessions per quarter: {current_avg:.1f}")
    print(f"  Range: {current_min}-{current_max}")
    print(f"  Per team per quarter: {current_avg/2:.1f}")
    print(f"  Per team per game: {current_avg/2*4:.1f}")
    print()

    print(f"STANDARD PACE - PROPOSED SETTINGS triangular{proposed_standard}:")
    print(f"  Average possessions per quarter: {proposed_avg:.1f}")
    print(f"  Range: {proposed_min}-{proposed_max}")
    print(f"  Per team per quarter: {proposed_avg/2:.1f}")
    print(f"  Per team per game: {proposed_avg/2*4:.1f}")
    print()

    improvement = (proposed_avg/2*4) - (current_avg/2*4)
    print(f"IMPROVEMENT: +{improvement:.1f} possessions per team per game")
    print()

def analyze_validation_data():
    """Analyze actual validation results."""
    print("="*80)
    print("ACTUAL VALIDATION DATA ANALYSIS")
    print("="*80)
    print()

    # From VALIDATION_REPORT_FIXED.md
    actual_poss_per_team_per_game = 66.3
    actual_poss_per_team_per_quarter = actual_poss_per_team_per_game / 4
    actual_total_poss_per_quarter = actual_poss_per_team_per_quarter * 2
    actual_avg_possession_duration = 720 / actual_total_poss_per_quarter

    print(f"Actual validation results (20 games, standard pace):")
    print(f"  Possessions per team per game: {actual_poss_per_team_per_game}")
    print(f"  Possessions per team per quarter: {actual_poss_per_team_per_quarter:.1f}")
    print(f"  Total possessions per quarter: {actual_total_poss_per_quarter:.1f}")
    print(f"  Implied avg possession duration: {actual_avg_possession_duration:.2f} seconds")
    print()
    print(f"Expected with triangular(10, 24, 15): {triangular_mean(10, 24, 15):.2f} seconds")
    print()
    print("DISCREPANCY ANALYSIS:")
    expected_theoretical = triangular_mean(10, 24, 15)
    print(f"  Theoretical expected: {expected_theoretical:.2f} seconds")
    print(f"  Actual observed: {actual_avg_possession_duration:.2f} seconds")
    print(f"  Difference: +{actual_avg_possession_duration - expected_theoretical:.2f} seconds per possession")
    print(f"  Extra time per quarter: {(actual_avg_possession_duration - expected_theoretical) * actual_total_poss_per_quarter:.1f} seconds")
    print()
    print("HYPOTHESIS: Possessions may be running longer than the triangular distribution")
    print("suggests due to additional game mechanics (fouls, turnovers, etc.)")
    print()

if __name__ == '__main__':
    analyze_current_settings()
    print()
    calculate_target_settings()
    print()
    simulate_current_vs_proposed()
    print()
    analyze_validation_data()
