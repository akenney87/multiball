"""
Analyze passing composites for all players to understand assist distribution.
"""

import json
from src.constants import WEIGHTS_FIND_OPEN_TEAMMATE

# Load team rosters
with open('teams/review/team_specialists_a.json', 'r') as f:
    team_alpha_data = json.load(f)
    team_alpha = team_alpha_data['players']
    team_alpha_name = team_alpha_data['team_name']

with open('teams/review/team_specialists_b.json', 'r') as f:
    team_beta_data = json.load(f)
    team_beta = team_beta_data['players']
    team_beta_name = team_beta_data['team_name']


def calculate_passing_composite(player):
    """Calculate passing composite using WEIGHTS_FIND_OPEN_TEAMMATE."""
    composite = sum(
        player.get(attr, 50) * weight
        for attr, weight in WEIGHTS_FIND_OPEN_TEAMMATE.items()
    )
    return composite


def analyze_team(team_name, roster):
    """Analyze and report passing composites for a team."""
    print(f"\n{'='*80}")
    print(f"{team_name} - Passing Composite Analysis")
    print(f"{'='*80}")

    # Calculate composites
    player_data = []
    for player in roster:
        composite = calculate_passing_composite(player)
        player_data.append({
            'name': player['name'],
            'position': player['position'],
            'composite': composite,
            'creativity': player.get('creativity', 50),
            'awareness': player.get('awareness', 50),
            'teamwork': player.get('teamwork', 50),
            'throw_accuracy': player.get('throw_accuracy', 50),
            'composure': player.get('composure', 50),
            'hand_eye_coordination': player.get('hand_eye_coordination', 50),
        })

    # Sort by composite (highest first)
    player_data.sort(key=lambda x: x['composite'], reverse=True)

    # Print results
    print(f"\n{'Player':<20} {'Pos':<5} {'Composite':<12} {'Creativity':<12} {'Awareness':<12} {'Teamwork':<10}")
    print("-" * 80)

    for p in player_data:
        print(f"{p['name']:<20} {p['position']:<5} {p['composite']:<12.2f} "
              f"{p['creativity']:<12} {p['awareness']:<12} {p['teamwork']:<10}")

    # Show power law effect (exponent = 4.0)
    print(f"\n{'Power Law Weights (Exponent = 4.0):'}")
    print(f"{'Player':<20} {'Composite':<12} {'Weight^4':<15} {'Share %':<10}")
    print("-" * 80)

    EXPONENT = 4.0
    total_weight_powered = sum(p['composite'] ** EXPONENT for p in player_data)

    for p in player_data:
        weight_powered = p['composite'] ** EXPONENT
        share_pct = (weight_powered / total_weight_powered) * 100
        print(f"{p['name']:<20} {p['composite']:<12.2f} {weight_powered:<15.2f} {share_pct:<10.1f}%")


# Analyze both teams
analyze_team(team_alpha_name, team_alpha)
analyze_team(team_beta_name, team_beta)

print("\n" + "="*80)
print("INTERPRETATION:")
print("="*80)
print("- Higher composite = better passer (more likely to get assists)")
print("- 'Share %' shows expected percentage of team assists with Exponent=4.0")
print("- Elite point guards should get ~25-40% of team assists (8-12 APG in 48 min)")
print("- Role players should get ~5-10% of team assists (1-3 APG)")
print("="*80)
