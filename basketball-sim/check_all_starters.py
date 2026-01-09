# Check when each starter hits 70 stamina

def calculate_cost(stamina_attr):
    """Calculate stamina cost per possession."""
    base_cost = 0.8
    stamina_modifier = 1.0 + ((50 - stamina_attr) / 50.0) * 0.15
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

print("When does each starter hit 70 stamina?")
print("=" * 70)
print(f"{'Player':25} {'Stamina Attr':13} {'Cost/Poss':10} {'Poss to 70':12} {'Minutes':10}")
print("-" * 70)

for name, stamina_attr in alpha_starters + beta_starters:
    cost = calculate_cost(stamina_attr)
    possessions_to_70 = (100 - 70) / cost
    minutes_to_70 = possessions_to_70 / 4.25  # 51 poss / 12 min = 4.25 poss/min
    print(f"{name:25} {stamina_attr:13} {cost:10.3f} {possessions_to_70:12.1f} {minutes_to_70:10.2f}")

print()
print("SPREAD: From fastest (Chris: 7.9 min) to slowest (Hassan: 10.2 min) = 2.3 minutes")
print("This means all starters will drop below 70 within a 2.3 minute window!")
