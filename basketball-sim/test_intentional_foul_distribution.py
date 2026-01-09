"""
Test intentional foul target selection distribution.
Verify that 50% goes to best FT shooter, 50% to others.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from src.systems.end_game_modes import select_intentional_foul_target

# Create roster with varying FT composites
test_roster = [
    {
        'name': 'Best_FT',
        'throw_accuracy': 95,
        'composure': 90,
        'consistency': 88,
        'hand_eye_coordination': 92
    },
    {
        'name': 'Second_Best',
        'throw_accuracy': 80,
        'composure': 75,
        'consistency': 78,
        'hand_eye_coordination': 82
    },
    {
        'name': 'Average',
        'throw_accuracy': 70,
        'composure': 65,
        'consistency': 68,
        'hand_eye_coordination': 72
    },
    {
        'name': 'Below_Avg',
        'throw_accuracy': 60,
        'composure': 55,
        'consistency': 58,
        'hand_eye_coordination': 62
    },
    {
        'name': 'Worst_FT',
        'throw_accuracy': 45,
        'composure': 40,
        'consistency': 42,
        'hand_eye_coordination': 48
    },
]

print("=" * 80)
print("INTENTIONAL FOUL TARGET SELECTION - DISTRIBUTION TEST")
print("=" * 80)
print("\nRoster FT abilities (best to worst):")
print("1. Best_FT (elite FT shooter)")
print("2. Second_Best")
print("3. Average")
print("4. Below_Avg")
print("5. Worst_FT")

# Run 10,000 simulations to check distribution
n_simulations = 10000
foul_counts = {
    'Best_FT': 0,
    'Second_Best': 0,
    'Average': 0,
    'Below_Avg': 0,
    'Worst_FT': 0
}

print(f"\nRunning {n_simulations} simulations...")
for _ in range(n_simulations):
    target = select_intentional_foul_target(test_roster)
    foul_counts[target] += 1

print("\n" + "=" * 80)
print("RESULTS")
print("=" * 80)
print(f"\n{'Player':<20} {'Fouls':<10} {'%':<10} {'Expected %':<15} {'Status'}")
print("-" * 80)

# Calculate percentages
total = sum(foul_counts.values())
best_pct = (foul_counts['Best_FT'] / total) * 100
others_pct = 100 - best_pct

print(f"{'Best_FT':<20} {foul_counts['Best_FT']:<10} {best_pct:>6.1f}%    ~50%            ", end="")
if 45 <= best_pct <= 55:
    print("[OK]")
else:
    print("[FAIL]")

print()
for player in ['Second_Best', 'Average', 'Below_Avg', 'Worst_FT']:
    count = foul_counts[player]
    pct = (count / total) * 100
    print(f"{player:<20} {count:<10} {pct:>6.1f}%    ~12.5%          ", end="")
    if 10 <= pct <= 15:
        print("[OK]")
    else:
        print("[FAIL]")

print("\n" + "-" * 80)
print(f"{'TOTAL OTHERS':<20} {sum(foul_counts[p] for p in ['Second_Best', 'Average', 'Below_Avg', 'Worst_FT']):<10} {others_pct:>6.1f}%    ~50%            ", end="")
if 45 <= others_pct <= 55:
    print("[OK]")
else:
    print("[FAIL]")

print("\n" + "=" * 80)
print("ANALYSIS")
print("=" * 80)
print(f"\nBest FT shooter (Best_FT): {best_pct:.1f}% (target: 50%)")
print(f"Other 4 players combined: {others_pct:.1f}% (target: 50%)")
print(f"\nThis reflects reality: When teams know intentional fouling is coming,")
print(f"the offense protects the ball with their best FT shooter ~50% of the time.")
print("=" * 80)
