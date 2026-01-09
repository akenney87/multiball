"""
Test if rounding of elapsed_time_seconds could cause the bug.
"""
import random

print("Testing different foul timings with 7 seconds remaining:\n")

for seed in [1, 42, 100, 200, 300, 400, 500]:
    random.seed(seed)

    seconds_before_foul = random.uniform(1.0, 3.0)
    ft_time = 2 * 2.0  # 2 FTs at 2s each
    elapsed_time = seconds_before_foul + ft_time
    rounded = int(round(elapsed_time))

    remaining_after = 7 - rounded

    problem = "** PROBLEM **" if remaining_after <= 0 else ""

    print(f"Seed {seed:3d}: foul={seconds_before_foul:.2f}s, "
          f"total={elapsed_time:.2f}s, rounded={rounded}s, "
          f"remaining={remaining_after}s {problem}")
