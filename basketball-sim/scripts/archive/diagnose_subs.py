"""
M4.5 PHASE 4: Diagnose substitution reasons
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("SUBSTITUTION DIAGNOSIS")
print("=" * 80)

random.seed(88888)

home_team_data = generate_team(team_name="TestHome", overall_rating=75)
away_team_data = generate_team(team_name="TestAway", overall_rating=75)

home_tactics = TacticalSettings(
    minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
)
away_tactics = TacticalSettings(
    minutes_allotment={p['name']: 24 for p in away_team_data['roster']}
)

game_sim = GameSimulator(
    home_roster=home_team_data['roster'],
    away_roster=away_team_data['roster'],
    tactical_home=home_tactics,
    tactical_away=away_tactics,
    home_team_name=home_team_data['name'],
    away_team_name=away_team_data['name']
)

result = game_sim.simulate_game(seed=88888)

# Access substitution events from quarter simulators
all_subs = []
for i, q_sim in enumerate(game_sim.quarter_simulators, 1):
    if hasattr(q_sim, 'substitution_manager') and q_sim.substitution_manager:
        sub_events = q_sim.substitution_manager.get_all_substitution_events()
        for sub in sub_events:
            all_subs.append({
                'quarter': i,
                'time': sub.quarter_time,
                'player_out': sub.player_out,
                'player_in': sub.player_in,
                'reason': sub.reason,
                'stamina_out': sub.stamina_out,
                'stamina_in': sub.stamina_in
            })

# Count by reason
reason_counts = {}
for sub in all_subs:
    reason = sub['reason']
    reason_counts[reason] = reason_counts.get(reason, 0) + 1

print(f"\nTotal substitutions: {len(all_subs)}")
print(f"\nSubstitutions by reason:")
for reason, count in sorted(reason_counts.items(), key=lambda x: -x[1]):
    print(f"  {reason}: {count} ({100*count/len(all_subs):.1f}%)")

# Show first 10 substitutions
print(f"\n{'-' * 80}")
print("First 10 substitutions:")
print(f"{'-' * 80}")
for i, sub in enumerate(all_subs[:10]):
    print(f"Q{sub['quarter']} {sub['time']}: {sub['player_out']} OUT ({sub['stamina_out']:.0f} stam)")
    print(f"             {sub['player_in']} IN  ({sub['stamina_in']:.0f} stam) - Reason: {sub['reason']}")
    print()

# Show Q1 substitutions only
q1_subs = [s for s in all_subs if s['quarter'] == 1]
print(f"{'-' * 80}")
print(f"Q1 substitutions ({len(q1_subs)} total):")
print(f"{'-' * 80}")
for sub in q1_subs:
    print(f"{sub['time']}: {sub['player_out']} OUT ({sub['stamina_out']:.0f}) → {sub['player_in']} IN ({sub['stamina_in']:.0f}) - {sub['reason']}")
