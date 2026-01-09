"""
M4.5 PHASE 4: Check timing and stamina levels of first substitutions
"""

import random
from generate_teams import generate_team
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("SUBSTITUTION TIMING & STAMINA ANALYSIS")
print("=" * 80)

random.seed(88888)

home_team_data = generate_team(team_name="TestHome", overall_rating=75)
away_team_data = generate_team(team_name="TestAway", overall_rating=75)

home_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    minutes_allotment={p['name']: 24 for p in home_team_data['roster']}
)

away_tactics = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
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

print("\nSimulating game with all players starting at 100% stamina...")
result = game_sim.simulate_game(seed=88888)

# Collect substitution events from Q1 only
q1_subs = []
q1_sim = game_sim.quarter_simulators[0]
if hasattr(q1_sim, 'substitution_manager') and q1_sim.substitution_manager:
    for sub in q1_sim.substitution_manager.get_all_substitution_events():
        # Parse time to get elapsed minutes
        time_parts = sub.quarter_time.split(':')
        minutes = int(time_parts[0])
        seconds = int(time_parts[1])
        elapsed_seconds = (12 * 60) - (minutes * 60 + seconds)
        elapsed_minutes = elapsed_seconds / 60.0

        q1_subs.append({
            'time': sub.quarter_time,
            'elapsed_min': elapsed_minutes,
            'player_out': sub.player_out,
            'player_in': sub.player_in,
            'reason': sub.reason,
            'stamina_out': sub.stamina_out,
            'stamina_in': sub.stamina_in
        })

print(f"\nQ1 Total: {len(q1_subs)} substitutions")

if q1_subs:
    first_sub = q1_subs[0]

    print("\n" + "=" * 80)
    print("FIRST SUBSTITUTION:")
    print("=" * 80)
    print(f"Time: {first_sub['time']} (elapsed: {first_sub['elapsed_min']:.2f} minutes)")
    print(f"OUT: {first_sub['player_out']} (stamina: {first_sub['stamina_out']:.1f})")
    print(f"IN:  {first_sub['player_in']} (stamina: {first_sub['stamina_in']:.1f})")
    print(f"Reason: {first_sub['reason']}")

    # Calculate degradation rate
    if first_sub['elapsed_min'] > 0:
        degradation_rate = (100 - first_sub['stamina_out']) / first_sub['elapsed_min']
        print(f"\nStamina degradation rate: {degradation_rate:.2f} stamina per minute")
        print(f"(Player went from 100 → {first_sub['stamina_out']:.1f} in {first_sub['elapsed_min']:.2f} minutes)")

    # Show first 5 subs
    print("\n" + "=" * 80)
    print("FIRST 5 SUBSTITUTIONS:")
    print("=" * 80)
    for i, sub in enumerate(q1_subs[:5], 1):
        print(f"{i}. {sub['time']} ({sub['elapsed_min']:.2f}min): {sub['player_out']} ({sub['stamina_out']:.0f}) → {sub['player_in']} ({sub['stamina_in']:.0f}) [{sub['reason']}]")

    # Analyze reasons
    reason_counts = {}
    for sub in q1_subs:
        reason = sub['reason']
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    print("\n" + "=" * 80)
    print("Q1 SUBSTITUTION REASONS:")
    print("=" * 80)
    for reason, count in sorted(reason_counts.items(), key=lambda x: -x[1]):
        print(f"{reason}: {count} ({100*count/len(q1_subs):.1f}%)")

    # Check stamina distribution
    stamina_out_values = [s['stamina_out'] for s in q1_subs]
    avg_stamina_out = sum(stamina_out_values) / len(stamina_out_values)
    min_stamina_out = min(stamina_out_values)
    max_stamina_out = max(stamina_out_values)

    print("\n" + "=" * 80)
    print("STAMINA STATISTICS (Players Being Subbed Out):")
    print("=" * 80)
    print(f"Average: {avg_stamina_out:.1f}")
    print(f"Minimum: {min_stamina_out:.1f}")
    print(f"Maximum: {max_stamina_out:.1f}")

    # Count how many subs were due to low stamina (<75)
    low_stamina_subs = [s for s in q1_subs if s['stamina_out'] < 75]
    print(f"\nSubs due to stamina <75: {len(low_stamina_subs)} ({100*len(low_stamina_subs)/len(q1_subs):.1f}%)")
else:
    print("\nNo substitutions occurred in Q1!")
