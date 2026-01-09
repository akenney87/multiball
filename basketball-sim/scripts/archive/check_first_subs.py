"""
M4.5 PHASE 4: Check timing of first substitutions
"""

import random
from generate_teams import generate_team
from src.systems.quarter_simulation import QuarterSimulator
from src.core.data_structures import TacticalSettings

print("=" * 80)
print("FIRST SUBSTITUTION TIMING CHECK")
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

# Simulate just Q1
q1_sim = QuarterSimulator(
    quarter_number=1,
    home_roster=home_team_data['roster'],
    away_roster=away_team_data['roster'],
    tactical_home=home_tactics,
    tactical_away=away_tactics,
    cumulative_home_score=0,
    cumulative_away_score=0,
    home_team_name=home_team_data['name'],
    away_team_name=away_team_data['name']
)

print("\nSimulating Q1 with all players starting at 100% stamina...")
result = q1_sim.simulate_quarter(seed=88888)

# Get all substitution events
if hasattr(q1_sim, 'substitution_manager') and q1_sim.substitution_manager:
    sub_events = q1_sim.substitution_manager.get_all_substitution_events()

    print(f"\nTotal Q1 substitutions: {len(sub_events)}")

    if sub_events:
        print("\n" + "=" * 80)
        print("FIRST 5 SUBSTITUTIONS:")
        print("=" * 80)

        for i, sub in enumerate(sub_events[:5], 1):
            # Calculate elapsed time (12:00 - current time)
            time_parts = sub.quarter_time.split(':')
            minutes = int(time_parts[0])
            seconds = int(time_parts[1])
            elapsed_seconds = (12 * 60) - (minutes * 60 + seconds)
            elapsed_minutes = elapsed_seconds / 60.0

            print(f"\n#{i}: {sub.quarter_time} (elapsed: {elapsed_minutes:.2f} min)")
            print(f"   OUT: {sub.player_out} (stamina: {sub.stamina_out:.1f})")
            print(f"   IN:  {sub.player_in} (stamina: {sub.stamina_in:.1f})")
            print(f"   REASON: {sub.reason}")

        # Check stamina of all starters at time of first sub
        first_sub = sub_events[0]
        print("\n" + "=" * 80)
        print(f"STAMINA OF ALL PLAYERS AT FIRST SUB ({first_sub.quarter_time}):")
        print("=" * 80)

        # Get final stamina values
        stamina_values = result.stamina_final

        # Show starters (first 5 from each team)
        print("\nHome Starters:")
        for i, player in enumerate(home_team_data['roster'][:5], 1):
            final_stam = stamina_values.get(player['name'], 0)
            print(f"  {i}. {player['name']} ({player['position']}): {final_stam:.1f} stamina at end of Q1")

        print("\nAway Starters:")
        for i, player in enumerate(away_team_data['roster'][:5], 1):
            final_stam = stamina_values.get(player['name'], 0)
            print(f"  {i}. {player['name']} ({player['position']}): {final_stam:.1f} stamina at end of Q1")

        # Analyze first sub
        elapsed_seconds = (12 * 60) - (int(first_sub.quarter_time.split(':')[0]) * 60 + int(first_sub.quarter_time.split(':')[1]))
        elapsed_minutes = elapsed_seconds / 60.0

        print("\n" + "=" * 80)
        print("ANALYSIS:")
        print("=" * 80)
        print(f"First substitution occurred after {elapsed_minutes:.2f} minutes of play")
        print(f"Player subbed out had {first_sub.stamina_out:.1f} stamina")
        print(f"Reason: {first_sub.reason}")

        if first_sub.stamina_out < 75:
            print(f"\n⚠️  Player dropped below 75 stamina threshold after {elapsed_minutes:.2f} minutes!")
            print(f"   Stamina degradation rate: {(100 - first_sub.stamina_out) / elapsed_minutes:.2f} stamina per minute")
        else:
            print(f"\n✓ Substitution was NOT due to low stamina (stamina was {first_sub.stamina_out:.1f})")
    else:
        print("\nNo substitutions occurred in Q1")
else:
    print("\nNo substitution manager found")
