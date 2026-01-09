# Calculate expected stamina after Q1 for review team players

def calculate_cost(stamina_attr):
    """Calculate stamina cost per possession."""
    base_cost = 0.8
    stamina_modifier = 1.0 + ((50 - stamina_attr) / 50.0) * 0.15
    return base_cost * stamina_modifier

# Review team starters
players = [
    ("Chris Maestro", 16),
    ("Ray Sniper", 40),
    ("Marcus Slasher", 65),
    ("Dennis Boardman", 84),
    ("Hassan Swatter", 95),
]

possessions = 51  # Actual from Q1

print("Expected stamina after Q1 (51 possessions):")
print("-" * 50)
for name, stamina_attr in players:
    cost = calculate_cost(stamina_attr)
    final_stamina = 100 - (possessions * cost)
    status = "BELOW 70" if final_stamina < 70 else "ABOVE 70"
    print(f"{name:20} (stamina={stamina_attr:2}): {final_stamina:5.1f} - {status}")

print()
print("Conclusion: ALL players correctly drain below 70 after 51 possessions")
