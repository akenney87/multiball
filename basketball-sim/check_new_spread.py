# Check new spread with ±50% modifier

def calculate_cost_new(stamina_attr):
    """Calculate stamina cost per possession with ±50% modifier."""
    base_cost = 0.8
    stamina_modifier = 1.0 + ((50 - stamina_attr) / 50.0) * 0.50  # NEW: ±50%
    return base_cost * stamina_modifier

# Team Alpha starters
alpha_starters = [
    ("Chris Maestro", 16),
    ("Ray Sniper", 40),
    ("Marcus Slasher", 65),
    ("Dennis Boardman", 84),
    ("Hassan Swatter", 95),
]

# Team Beta starters
beta_starters = [
    ("Steve Facilitator", 52),
    ("Reggie Shooter", 93),
    ("Dwyane Slasher", 78),
    ("Andre Rebounder", 78),
    ("Mutombo Blocker", 67),
]

print("NEW STAMINA SPREAD (±50% modifier)")
print("=" * 70)
print(f"{'Player':25} {'Stamina':8} {'Cost/Poss':10} {'Poss to 70':12} {'Minutes':10}")
print("-" * 70)

all_minutes = []
for name, stamina_attr in alpha_starters + beta_starters:
    cost = calculate_cost_new(stamina_attr)
    possessions_to_70 = (100 - 70) / cost
    minutes_to_70 = possessions_to_70 / 4.25  # 51 poss / 12 min = 4.25 poss/min
    all_minutes.append(minutes_to_70)
    print(f"{name:25} {stamina_attr:8} {cost:10.3f} {possessions_to_70:12.1f} {minutes_to_70:10.2f}")

min_time = min(all_minutes)
max_time = max(all_minutes)
spread = max_time - min_time

print()
print(f"SPREAD: From fastest ({min_time:.2f} min) to slowest ({max_time:.2f} min) = {spread:.2f} minutes")
print(f"That's {spread/2.3:.1f}x the previous spread of 2.3 minutes")
