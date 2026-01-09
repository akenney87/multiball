"""
Check what the actual elapsed_time_seconds would be with different random seeds.
"""
import random

# Test with different scenarios
for seed_val in [None, 42, 12345]:
    if seed_val:
        random.seed(seed_val)
        print(f"Seed: {seed_val}")
    else:
        print(f"Seed: None (random)")

    seconds_before_foul = random.uniform(1.0, 3.0)
    ft_time = 2 * 2.0  # 2 FTs
    elapsed_time = seconds_before_foul + ft_time

    print(f"  Foul delay: {seconds_before_foul:.3f}s")
    print(f"  FT time: {ft_time:.3f}s")
    print(f"  Total elapsed: {elapsed_time:.3f}s")
    print(f"  Rounded: {int(round(elapsed_time))}s")

    # What if we started with exactly 7 seconds?
    remaining = 7 - int(round(elapsed_time))
    print(f"  Starting from 7s → {remaining}s remaining")

    if remaining <= 0:
        print(f"  ** PROBLEM: Quarter would end! **")
    print()
