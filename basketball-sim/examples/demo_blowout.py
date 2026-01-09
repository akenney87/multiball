"""
Demo script for M3 Phase 2b: End-Game Substitution Logic (Blowout Scenario)

Demonstrates:
1. Blowout detection in Q4 (winning by 20+ points with <6 min left)
2. Automatic starter resting when blowout is detected
3. Closer insertion logic
4. Full game with end-game substitution logic

Strategy: Create mismatched teams to induce blowout scenario
"""

import json
from src.core.data_structures import TacticalSettings
from src.systems.game_simulation import GameSimulator


def boost_team_attributes(team, boost_amount=15):
    """Boost all attributes of a team to create skill mismatch."""
    boosted_team = []
    for player in team:
        boosted_player = player.copy()
        # Boost all numeric attributes (skip 'name' and 'position')
        for key, value in player.items():
            if key not in ['name', 'position'] and isinstance(value, (int, float)):
                # Cap at 100
                boosted_player[key] = min(100, value + boost_amount)
        boosted_team.append(boosted_player)
    return boosted_team


def add_bench_players(team, num_bench=3):
    """Add bench players (clones of existing players with slightly lower attributes)."""
    extended_roster = team.copy()

    for i in range(num_bench):
        # Clone the first player and reduce attributes slightly
        base_player = team[i % len(team)]
        bench_player = base_player.copy()
        bench_player['name'] = f"{base_player['name']} (Bench-{i+1})"

        # Reduce attributes by 5-10 points
        for key, value in base_player.items():
            if key not in ['name', 'position'] and isinstance(value, (int, float)):
                bench_player[key] = max(30, value - 8)

        extended_roster.append(bench_player)

    return extended_roster


def main():
    # Load sample teams
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    # Boost Elite Shooters and add bench players to create blowout scenario
    ELITE_SHOOTERS_BASE = boost_team_attributes(data['teams']['Elite Shooters'], boost_amount=20)
    ELITE_SHOOTERS = add_bench_players(ELITE_SHOOTERS_BASE, num_bench=3)

    ELITE_DEFENDERS_BASE = data['teams']['Elite Defenders']
    ELITE_DEFENDERS = add_bench_players(ELITE_DEFENDERS_BASE, num_bench=3)

    print("=" * 80)
    print("M3 PHASE 2b DEMO: END-GAME SUBSTITUTION LOGIC (BLOWOUT SCENARIO)")
    print("=" * 80)
    print()
    print("Team Setup:")
    print(f"  Home Team: Elite Shooters ({len(ELITE_SHOOTERS)} players, BOOSTED +20)")
    print(f"  Away Team: Elite Defenders ({len(ELITE_DEFENDERS)} players, Normal)")
    print()
    print("Expected Outcome: Home team blowout win")
    print("Expected Behavior:")
    print("  - Q4 <6min with +20 lead: Rest home starters (sub in bench players)")
    print("  - Closers should NOT be inserted (blowout, not close game)")
    print()

    # Define tactical settings with closers
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
        rebounding_strategy='standard',
        closers=['Stephen Curry', 'Kevin Durant', 'Klay Thompson', 'Kyle Lowry', 'Shaquille O\'Neal']
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
        rebounding_strategy='crash_glass',
        closers=['Kawhi Leonard', 'Gary Payton', 'Draymond Green', 'Dennis Rodman', 'Rudy Gobert']
    )

    # Create game simulator
    print("Simulating full 48-minute game with blowout scenario...")
    print()

    game_sim = GameSimulator(
        home_roster=ELITE_SHOOTERS,
        away_roster=ELITE_DEFENDERS,
        tactical_home=tactical_shooters,
        tactical_away=tactical_defenders,
        home_team_name="Elite Shooters (Boosted)",
        away_team_name="Elite Defenders"
    )

    # Simulate game
    game_result = game_sim.simulate_game(seed=99)  # Different seed for variety

    # Display results
    print()
    print("=" * 80)
    print("GAME COMPLETE!")
    print("=" * 80)
    print()
    print(f"Final Score: {game_result.home_score} - {game_result.away_score}")
    print(f"Margin: {abs(game_result.home_score - game_result.away_score)} points")
    print()
    print("Quarter-by-Quarter:")
    for i, (home_q, away_q) in enumerate(game_result.quarter_scores, 1):
        cumulative_home = sum(h for h, _ in game_result.quarter_scores[:i])
        cumulative_away = sum(a for _, a in game_result.quarter_scores[:i])
        print(f"  Q{i}: Elite Shooters {home_q} (Total: {cumulative_home}), Elite Defenders {away_q} (Total: {cumulative_away})")
    print()

    # Save full play-by-play to file
    output_file = "output/demo_blowout.txt"
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(game_result.play_by_play_text)

    print(f"Full game play-by-play saved to: {output_file}")
    print()

    # Display summary statistics
    stats = game_result.game_statistics
    print("Game Statistics:")
    print(f"  Total Possessions: {stats['total_possessions']}")
    print(f"  {stats['home_team']}: {stats['home_stats']['points']} points, {stats['home_stats']['fgm']}/{stats['home_stats']['fga']} FG")
    print(f"  {stats['away_team']}: {stats['away_stats']['points']} points, {stats['away_stats']['fgm']}/{stats['away_stats']['fga']} FG")
    print()

    # Check for blowout substitutions in play-by-play
    print("Checking for end-game substitutions...")
    pbp_text = game_result.play_by_play_text
    if 'blowout_rest' in pbp_text:
        print("  [OK] Blowout substitutions detected in Q4!")
    else:
        print("  [NO] No blowout substitutions found (game may not have been blowout)")

    if 'close_game_closer' in pbp_text:
        print("  [OK] Close-game closer insertions detected")
    else:
        print("  [NO] No close-game closer insertions (expected for blowout)")
    print()

    print("Demo complete!")
    print()
    print("Review output/demo_blowout.txt to see Q4 substitution logic in action.")


if __name__ == '__main__':
    main()
