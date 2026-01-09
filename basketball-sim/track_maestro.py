# Track Chris Maestro's stamina through Q1

cost_per_poss = 0.8 * 1.102  # stamina=16 modifier
poss_per_minute = 51 / 12.0  # 4.25 possessions per minute

times = [
    ("Q1 Start", 12.0, 0),
    ("4:21 remaining", 4.35, int((12.0 - 4.35) * poss_per_minute)),
    ("1:25 remaining", 1.42, int((12.0 - 1.42) * poss_per_minute)),
    ("0:02 remaining", 0.03, int((12.0 - 0.03) * poss_per_minute)),
]

print("Chris Maestro (stamina=16) - Stamina Tracking:")
print("=" * 60)
for desc, time_remaining, possessions in times:
    stamina = 100 - (possessions * cost_per_poss)
    status = "BELOW 70!" if stamina < 70 else "above 70"
    print(f"{desc:20} {possessions:2} poss -> {stamina:5.1f} stamina ({status})")

print()
print("CONCLUSION: Chris Maestro drops below 70 between 4:21 and 1:25")
print("            At 1:25, he's at ~61 stamina and SHOULD be subbed")
