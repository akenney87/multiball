"""
Quick 3-game validation script to gather statistics.
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator


def run_game(seed):
    """Run a single game and return stats."""
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    ELITE_SHOOTERS = data['teams']['Elite Shooters']
    ELITE_DEFENDERS = data['teams']['Elite Defenders']

    tactical_shooters = TacticalSettings(
        pace='fast',
        man_defense_pct=80,
        scoring_option_1='Stephen Curry',
        scoring_option_2='Kevin Durant',
        scoring_option_3='Klay Thompson',
        minutes_allotment={
            'Stephen Curry': 36,
            'Kevin Durant': 36,
            'Klay Thompson': 34,
            'Kyle Lowry': 28,
            'Shaquille O\'Neal': 30,
        },
        rebounding_strategy='standard'
    )

    tactical_defenders = TacticalSettings(
        pace='slow',
        man_defense_pct=30,
        scoring_option_1='Kawhi Leonard',
        scoring_option_2='Gary Payton',
        scoring_option_3='Draymond Green',
        minutes_allotment={
            'Kawhi Leonard': 36,
            'Gary Payton': 34,
            'Draymond Green': 32,
            'Dennis Rodman': 30,
            'Rudy Gobert': 28,
        },
        rebounding_strategy='crash_glass'
    )

    game_sim = GameSimulator(
        home_roster=ELITE_SHOOTERS,
        away_roster=ELITE_DEFENDERS,
        tactical_home=tactical_shooters,
        tactical_away=tactical_defenders,
        home_team_name="Elite Shooters",
        away_team_name="Elite Defenders"
    )

    game_result = game_sim.simulate_game(seed=seed)

    # Count fouls in play-by-play
    foul_count = game_result.play_by_play_text.count("FOUL!")

    return {
        'home_score': game_result.home_score,
        'away_score': game_result.away_score,
        'possessions': game_result.game_statistics['total_possessions'],
        'fouls': foul_count,
    }


def main():
    print("=" * 80)
    print("QUICK 3-GAME VALIDATION")
    print("=" * 80)
    print()

    games = []
    for i in range(1, 4):
        print(f"Running game {i}...")
        stats = run_game(seed=100+i)
        games.append(stats)
        print(f"  Final: {stats['home_score']}-{stats['away_score']}, "
              f"Possessions: {stats['possessions']}, Fouls: {stats['fouls']}")

    print()
    print("-" * 80)
    print("SUMMARY")
    print("-" * 80)

    avg_home_score = sum(g['home_score'] for g in games) / 3
    avg_away_score = sum(g['away_score'] for g in games) / 3
    avg_possessions = sum(g['possessions'] for g in games) / 3
    avg_fouls = sum(g['fouls'] for g in games) / 3

    print(f"Average Home Score: {avg_home_score:.1f}")
    print(f"Average Away Score: {avg_away_score:.1f}")
    print(f"Average Total Score: {avg_home_score + avg_away_score:.1f}")
    print(f"Average Possessions: {avg_possessions:.1f}")
    print(f"Average Fouls per Game: {avg_fouls:.1f}")
    print()
    print(f"Points per Possession: {(avg_home_score + avg_away_score) / avg_possessions:.3f}")
    print(f"Fouls per Team per Game: {avg_fouls / 2:.1f}")
    print()
    print("NBA Targets:")
    print("  PPP: 1.05-1.15")
    print("  Fouls per Team: 18-24")
    print()


if __name__ == '__main__':
    main()
