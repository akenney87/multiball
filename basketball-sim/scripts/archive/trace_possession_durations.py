"""
M4.5 PHASE 1: Trace actual possession durations from a simulated quarter
"""

import random
import sys
sys.path.append('src')

from systems.game_clock import calculate_possession_duration

def sample_possession_durations(pace='standard', num_samples=1000, seed=42):
    """Sample possession durations and analyze the distribution."""
    random.seed(seed)

    durations = []
    for _ in range(num_samples):
        duration = calculate_possession_duration(pace, is_transition=False)
        durations.append(duration)

    avg = sum(durations) / len(durations)
    min_val = min(durations)
    max_val = max(durations)

    # Calculate theoretical expected value
    if pace == 'standard':
        theoretical_mean = (10 + 24 + 15) / 3.0
    elif pace == 'fast':
        theoretical_mean = (6 + 20 + 10) / 3.0
    elif pace == 'slow':
        theoretical_mean = (14 + 30 + 20) / 3.0

    print(f"{"="*80}")
    print(f"SAMPLING {num_samples} POSSESSION DURATIONS ({pace.upper()} PACE)")
    print(f"{"="*80}")
    print(f"  Theoretical mean: {theoretical_mean:.2f} seconds")
    print(f"  Actual mean: {avg:.2f} seconds")
    print(f"  Min: {min_val} seconds")
    print(f"  Max: {max_val} seconds")
    print(f"  Difference: {avg - theoretical_mean:+.2f} seconds")
    print()

    # Show distribution
    bins = {}
    for d in durations:
        bin_key = (d // 2) * 2  # Group into 2-second bins
        bins[bin_key] = bins.get(bin_key, 0) + 1

    print("DISTRIBUTION:")
    for bin_start in sorted(bins.keys()):
        count = bins[bin_start]
        bar = "#" * (count // 10)
        pct = (count / num_samples) * 100
        print(f"  {bin_start:2d}-{bin_start+1:2d}s: {bar} ({count}, {pct:.1f}%)")
    print()

def simulate_quarter_possessions(pace='standard', seed=42):
    """Simulate a single quarter and track all possession durations."""
    random.seed(seed)

    quarter_length = 720
    elapsed = 0
    possession_num = 0
    durations = []

    while elapsed < quarter_length:
        duration = calculate_possession_duration(pace, is_transition=False)
        durations.append(duration)
        elapsed += duration
        possession_num += 1

        if possession_num > 100:  # Safety valve
            break

    avg = sum(durations) / len(durations)
    total_time = sum(durations)

    print(f"{"="*80}")
    print(f"SIMULATED QUARTER ({pace.upper()} PACE)")
    print(f"{"="*80}")
    print(f"  Total possessions: {possession_num}")
    print(f"  Total time: {total_time} seconds ({total_time/60:.1f} minutes)")
    print(f"  Average possession duration: {avg:.2f} seconds")
    print(f"  Per team per quarter: {possession_num/2:.1f}")
    print(f"  Per team per game: {possession_num/2*4:.1f}")
    print()

    # Show first 10 possession durations
    print("First 10 possession durations:")
    for i, dur in enumerate(durations[:10], 1):
        print(f"  Possession {i}: {dur} seconds")
    print()

if __name__ == '__main__':
    sample_possession_durations('standard', num_samples=1000, seed=42)
    simulate_quarter_possessions('standard', seed=42)

    print(f"{"="*80}")
    print("COMPARISON TO ACTUAL VALIDATION DATA")
    print(f"{"="*80}")
    print(f"Simulated quarter possessions: ~44 total per quarter")
    print(f"Actual validation data: 33.1 total per quarter")
    print(f"Discrepancy: 10.9 fewer possessions per quarter")
    print()
    print("HYPOTHESIS: The actual game simulation has additional overhead that")
    print("increases effective possession duration beyond the sampled values.")
    print("This could be:")
    print("  - Timeout duration (currently only 1 second, likely not the issue)")
    print("  - Dead ball time not accounted for")
    print("  - Substitution windows adding time")
    print("  - End-of-quarter logic causing quarters to end early")
    print()
