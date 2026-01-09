"""Quick test to validate parameter tuning."""
import sys
import os
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import TacticalSettings, create_player
from src.systems.game_simulation import GameSimulator
import random


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster with varied attributes."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []

    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5) + random.randint(-5, 5)
        rating = max(50, min(95, rating))

        player = create_player(
            name=f"{team_name}_{pos}{i+1}",
            position=pos,
            grip_strength=rating,
            arm_strength=rating,
            core_strength=rating,
            agility=rating,
            acceleration=rating,
            top_speed=rating,
            jumping=rating,
            reactions=rating,
            stamina=rating,
            balance=rating,
            height=75 if pos in ['PG', 'SG'] else 85 if pos == 'SF' else 90,
            durability=rating,
            awareness=rating,
            creativity=rating,
            determination=rating,
            bravery=rating,
            consistency=rating,
            composure=rating,
            patience=rating,
            hand_eye_coordination=rating,
            throw_accuracy=rating,
            form_technique=rating,
            finesse=rating,
            deception=rating,
            teamwork=rating
        )
        players.append(player)

    return players


def create_minutes_allotment(roster: list) -> dict:
    """Create realistic minutes allocation (must sum to 240)."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment


# Test with 3 games
seeds = [801, 802, 803]
results = []

for seed in seeds:
    random.seed(seed)

    home_roster = create_extended_roster("Home", base_rating=75)
    away_roster = create_extended_roster("Away", base_rating=75)

    tactical_home = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=home_roster[0]['name'],
        scoring_option_2=home_roster[1]['name'],
        scoring_option_3=home_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(home_roster),
        rebounding_strategy='standard',
        closers=[p['name'] for p in home_roster[:7]],
        timeout_strategy='standard'
    )

    tactical_away = TacticalSettings(
        pace='standard',
        man_defense_pct=50,
        scoring_option_1=away_roster[0]['name'],
        scoring_option_2=away_roster[1]['name'],
        scoring_option_3=away_roster[2]['name'],
        minutes_allotment=create_minutes_allotment(away_roster),
        rebounding_strategy='standard',
        closers=[p['name'] for p in away_roster[:7]],
        timeout_strategy='standard'
    )

    game = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name='Home',
        away_team_name='Away'
    )

    result = game.simulate_game()

    # Extract stats from GameResult dataclass
    home_score = result.home_score
    away_score = result.away_score
    total_score = home_score + away_score

    # Access fouls directly from the game's foul_system
    # The foul_system is attached to the GameSimulator instance
    total_fouls = len(game.foul_system.foul_events)

    # Count FT stats from foul events
    ft_att_total = sum(f.free_throws_awarded for f in game.foul_system.foul_events)

    # To get FT made, we need to parse from play-by-play or count differently
    # Let's parse the play-by-play text for "FT X/Y: GOOD"
    import re
    pbp_text = result.play_by_play_text
    ft_made_total = len(re.findall(r'FT \d+/\d+: GOOD', pbp_text))

    ft_pct = 100 * ft_made_total / ft_att_total if ft_att_total > 0 else 0

    results.append({
        'seed': seed,
        'total_score': total_score,
        'fouls': total_fouls,
        'ft_made': ft_made_total,
        'ft_att': ft_att_total,
        'ft_pct': ft_pct
    })

    print(f"Game {seed}: Score={home_score}-{away_score} (Total {total_score}), "
          f"Fouls={total_fouls}, FT={ft_made_total}/{ft_att_total} ({ft_pct:.1f}%)")

# Summary
print("\n" + "="*60)
print("SUMMARY:")
print("="*60)
avg_score = sum(r['total_score'] for r in results) / len(results)
avg_fouls = sum(r['fouls'] for r in results) / len(results)
total_ft_made = sum(r['ft_made'] for r in results)
total_ft_att = sum(r['ft_att'] for r in results)
avg_ft_pct = 100 * total_ft_made / total_ft_att if total_ft_att > 0 else 0

print(f"Average Total Score: {avg_score:.1f} (Target: 180-220)")
print(f"Average Fouls/Game: {avg_fouls:.1f} (Target: 18-25)")
print(f"Overall FT%: {avg_ft_pct:.1f}% (Target: 75-80%)")
print()

# Check targets
score_ok = 180 <= avg_score <= 220
fouls_ok = 18 <= avg_fouls <= 25
ft_ok = 73 <= avg_ft_pct <= 83  # Slight buffer

if score_ok and fouls_ok and ft_ok:
    print("STATUS: ALL METRICS IN RANGE!")
else:
    print("STATUS: NEEDS ADJUSTMENT")
    if not score_ok:
        print(f"  - Score out of range: {avg_score:.1f}")
    if not fouls_ok:
        print(f"  - Fouls out of range: {avg_fouls:.1f}")
    if not ft_ok:
        print(f"  - FT% out of range: {avg_ft_pct:.1f}%")
