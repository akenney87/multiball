"""
M4.5 PHASE 4: Debug substitution enforcement

Run a single game to see why players with stamina 13-37 aren't being substituted.
"""

import random
from generate_teams import generate_team
from src.systems.quarter_simulation import QuarterSimulator
from src.core.data_structures import TacticalSettings

# Fixed seed for reproducibility
random.seed(99999)

# Generate two NBA-caliber teams
home_team_data = generate_team(team_name="Home_Team", overall_rating=80)
away_team_data = generate_team(team_name="Away_Team", overall_rating=80)

home_team = home_team_data['roster']
away_team = away_team_data['roster']

# Simple minutes allocation (uniform)
home_minutes = {p['name']: 12 for p in home_team}
away_minutes = {p['name']: 12 for p in away_team}

# Tactical settings (standard)
tactics_home = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment=home_minutes,
    rebounding_strategy='standard'
)

tactics_away = TacticalSettings(
    pace='standard',
    man_defense_pct=70,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment=away_minutes,
    rebounding_strategy='standard'
)

print("=" * 80)
print("M4.5 PHASE 4: SUBSTITUTION DEBUG TEST")
print("=" * 80)
print("\nRunning Q1 to observe substitution enforcement...\n")

# Run Q1
simulator = QuarterSimulator(
    home_roster=home_team,
    away_roster=away_team,
    tactical_home=tactics_home,
    tactical_away=tactics_away,
    home_team_name="Home_Team",
    away_team_name="Away_Team",
    quarter_number=1,
    cumulative_home_score=0,
    cumulative_away_score=0
)

result = simulator.simulate_quarter()

print("\n" + "=" * 80)
print("QUARTER 1 COMPLETE")
print("=" * 80)
print(f"Final Score: Home {result.home_score} - {result.away_score} Away")
print(f"Total Substitutions: {len(simulator.substitution_manager.substitution_events)}")
print("\nSubstitution Events:")
for event in simulator.substitution_manager.substitution_events:
    print(f"  {event.quarter_time}: {event.player_out} OUT (stamina={event.stamina_out:.1f}) -> {event.player_in} IN (stamina={event.stamina_in:.1f}) [reason: {event.reason}]")

print("\n" + "=" * 80)
print("FINAL STAMINA LEVELS")
print("=" * 80)
print("\nHome Team:")
for player in home_team:
    stamina = simulator.stamina_tracker.get_current_stamina(player['name'])
    minutes = simulator.stamina_tracker.get_minutes_played(player['name'])
    status = "ON COURT" if player in simulator.substitution_manager.get_home_active() else "BENCH"
    warning = " [CRITICAL!]" if stamina < 60 and status == "ON COURT" else ""
    print(f"  {player['name']}: {stamina:.1f} stamina, {minutes:.1f} min [{status}]{warning}")

print("\nAway Team:")
for player in away_team:
    stamina = simulator.stamina_tracker.get_current_stamina(player['name'])
    minutes = simulator.stamina_tracker.get_minutes_played(player['name'])
    status = "ON COURT" if player in simulator.substitution_manager.get_away_active() else "BENCH"
    warning = " [CRITICAL!]" if stamina < 60 and status == "ON COURT" else ""
    print(f"  {player['name']}: {stamina:.1f} stamina, {minutes:.1f} min [{status}]{warning}")
