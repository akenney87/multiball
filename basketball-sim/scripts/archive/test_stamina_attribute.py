"""
M4.5 PHASE 4B: Test stamina attribute integration

Compare three teams with different stamina ratings:
1. Elite endurance (stamina=90): Should fatigue slower, recover faster
2. Average endurance (stamina=50): Baseline behavior
3. Poor endurance (stamina=30): Should fatigue faster, recover slower

Expected outcomes:
- Elite team: Fewer substitutions, longer stints
- Poor team: More substitutions, shorter stints
- Average team: Middle ground
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("M4.5 PHASE 4B: STAMINA ATTRIBUTE INTEGRATION TEST")
print("=" * 80)

# ============================================================================
# TEST 1: Elite Endurance Team (stamina=90)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 1: ELITE ENDURANCE TEAM (stamina=90)")
print("=" * 80)

random.seed(10000)
elite_home_data = generate_team(team_name="EliteEndurance", overall_rating=75)
elite_away_data = generate_team(team_name="Opponents", overall_rating=75)

# Override stamina attributes to 90 for all elite team players
for player in elite_home_data['roster']:
    player['stamina'] = 90

# Set away team to average (50) for comparison
for player in elite_away_data['roster']:
    player['stamina'] = 50

elite_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in elite_home_data['roster']}
)

away_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in elite_away_data['roster']}
)

elite_game_sim = GameSimulator(
    home_roster=elite_home_data['roster'],
    away_roster=elite_away_data['roster'],
    tactical_home=elite_tactics,
    tactical_away=away_tactics,
    home_team_name=elite_home_data['name'],
    away_team_name=elite_away_data['name']
)

print("\nSimulating game: Elite (stamina=90) vs Average (stamina=50)...")
elite_result = elite_game_sim.simulate_game(seed=10000)

elite_subs = 0
avg_subs = 0
for q_result in elite_result.quarter_results:
    q_subs = q_result.quarter_statistics.get('substitution_count', 0)
    elite_subs += q_subs

print(f"\nElite Team (stamina=90) total substitutions: {elite_subs}")

# Count home vs away subs (rough approximation: split evenly)
print(f"  > Elite home: ~{elite_subs // 2}")
print(f"  > Average away: ~{elite_subs // 2}")

# ============================================================================
# TEST 2: Poor Endurance Team (stamina=30)
# ============================================================================
print("\n" + "=" * 80)
print("TEST 2: POOR ENDURANCE TEAM (stamina=30)")
print("=" * 80)

random.seed(20000)
poor_home_data = generate_team(team_name="PoorEndurance", overall_rating=75)
poor_away_data = generate_team(team_name="Opponents2", overall_rating=75)

# Override stamina attributes to 30 for all poor team players
for player in poor_home_data['roster']:
    player['stamina'] = 30

# Set away team to average (50) for comparison
for player in poor_away_data['roster']:
    player['stamina'] = 50

poor_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in poor_home_data['roster']}
)

away_tactics2 = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in poor_away_data['roster']}
)

poor_game_sim = GameSimulator(
    home_roster=poor_home_data['roster'],
    away_roster=poor_away_data['roster'],
    tactical_home=poor_tactics,
    tactical_away=away_tactics2,
    home_team_name=poor_home_data['name'],
    away_team_name=poor_away_data['name']
)

print("\nSimulating game: Poor (stamina=30) vs Average (stamina=50)...")
poor_result = poor_game_sim.simulate_game(seed=20000)

poor_subs = 0
for q_result in poor_result.quarter_results:
    q_subs = q_result.quarter_statistics.get('substitution_count', 0)
    poor_subs += q_subs

print(f"\nPoor Team (stamina=30) total substitutions: {poor_subs}")
print(f"  > Poor home: ~{poor_subs // 2}")
print(f"  > Average away: ~{poor_subs // 2}")

# ============================================================================
# TEST 3: Average Endurance Team (stamina=50) - Baseline
# ============================================================================
print("\n" + "=" * 80)
print("TEST 3: AVERAGE ENDURANCE TEAM (stamina=50) - BASELINE")
print("=" * 80)

random.seed(30000)
avg_home_data = generate_team(team_name="AverageEndurance", overall_rating=75)
avg_away_data = generate_team(team_name="Opponents3", overall_rating=75)

# Set both teams to average (50)
for player in avg_home_data['roster']:
    player['stamina'] = 50

for player in avg_away_data['roster']:
    player['stamina'] = 50

avg_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in avg_home_data['roster']}
)

away_tactics3 = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in avg_away_data['roster']}
)

avg_game_sim = GameSimulator(
    home_roster=avg_home_data['roster'],
    away_roster=avg_away_data['roster'],
    tactical_home=avg_tactics,
    tactical_away=away_tactics3,
    home_team_name=avg_home_data['name'],
    away_team_name=avg_away_data['name']
)

print("\nSimulating game: Average (stamina=50) vs Average (stamina=50)...")
avg_result = avg_game_sim.simulate_game(seed=30000)

avg_team_subs = 0
for q_result in avg_result.quarter_results:
    q_subs = q_result.quarter_statistics.get('substitution_count', 0)
    avg_team_subs += q_subs

print(f"\nAverage Team (stamina=50) total substitutions: {avg_team_subs}")
print(f"  > Average home: ~{avg_team_subs // 2}")
print(f"  > Average away: ~{avg_team_subs // 2}")

# ============================================================================
# COMPARISON SUMMARY
# ============================================================================
print("\n" + "=" * 80)
print("COMPARISON SUMMARY")
print("=" * 80)

print(f"\nTotal substitutions by team stamina rating:")
print(f"  Elite (stamina=90):   {elite_subs} total subs  (~{elite_subs//2} per team)")
print(f"  Average (stamina=50): {avg_team_subs} total subs  (~{avg_team_subs//2} per team)")
print(f"  Poor (stamina=30):    {poor_subs} total subs  (~{poor_subs//2} per team)")

print("\n" + "=" * 80)
print("EXPECTED PATTERN:")
print("=" * 80)
print("Elite teams (90 stamina) should have FEWER subs than Average (50)")
print("Poor teams (30 stamina) should have MORE subs than Average (50)")
print()
print("Elite teams fatigue 20% slower and recover 20% faster")
print("Poor teams fatigue 20% faster and recover 20% slower")
print()

# Verify expected pattern
if elite_subs < avg_team_subs < poor_subs:
    print("[SUCCESS] Stamina attribute is working correctly!")
    print(f"  Elite < Average < Poor: {elite_subs} < {avg_team_subs} < {poor_subs}")
elif elite_subs == avg_team_subs == poor_subs:
    print("[FAILURE] No difference between stamina ratings - attribute not affecting gameplay")
else:
    print("[PARTIAL] Pattern exists but may not be in expected order")
    print(f"  Actual: Elite={elite_subs}, Average={avg_team_subs}, Poor={poor_subs}")

# Show final stamina values
print("\n" + "=" * 80)
print("FINAL STAMINA VALUES (End of Game)")
print("=" * 80)

print("\nElite Team (stamina=90) starters:")
for i, player in enumerate(elite_home_data['roster'][:5], 1):
    final = elite_result.final_stamina.get(player['name'], 0)
    minutes = elite_result.minutes_played.get(player['name'], 0)
    print(f"  {i}. {player['name']}: {final:.1f} stamina ({minutes:.1f} min)")

print("\nAverage Team (stamina=50) starters:")
for i, player in enumerate(avg_home_data['roster'][:5], 1):
    final = avg_result.final_stamina.get(player['name'], 0)
    minutes = avg_result.minutes_played.get(player['name'], 0)
    print(f"  {i}. {player['name']}: {final:.1f} stamina ({minutes:.1f} min)")

print("\nPoor Team (stamina=30) starters:")
for i, player in enumerate(poor_home_data['roster'][:5], 1):
    final = poor_result.final_stamina.get(player['name'], 0)
    minutes = poor_result.minutes_played.get(player['name'], 0)
    print(f"  {i}. {player['name']}: {final:.1f} stamina ({minutes:.1f} min)")

print("\n" + "=" * 80)
print("TEST COMPLETE")
print("=" * 80)
