"""
Validation Test for Missed Final Free Throw Rebound Fix

Tests that 100% of missed final free throws trigger rebound situations.

Expected behavior:
1. Missed final FT → rebound battle occurs
2. Either offensive or defensive rebound
3. If offensive rebound:
   - Tall rebounder (height > 75) → putback attempt
   - Short rebounder (height <= 75) → kickout
4. If defensive rebound → possession changes
5. Play-by-play includes rebound narrative

Target rates (NBA averages):
- Offensive rebound on missed FT: ~25-30%
- Defensive rebound on missed FT: ~70-75%
"""

import sys
import os
import random

# Add current directory to path
sys.path.insert(0, os.path.abspath('.'))

from src.core.data_structures import PossessionContext, TacticalSettings, create_player
from src.systems import possession
from src.systems.fouls import FoulSystem

# Sample teams for testing
def create_test_team(team_name: str, is_home: bool) -> list:
    """Create a test team with varied heights for putback testing."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    heights = [70, 72, 75, 80, 85]  # Mix of guards, wings, bigs

    team = []
    for i, (pos, height) in enumerate(zip(positions, heights)):
        player = create_player(
            name=f"{team_name}_{i}_{pos}",
            position=pos,
            # Physical
            grip_strength=60,
            arm_strength=60,
            core_strength=65,
            agility=70,
            acceleration=70,
            top_speed=70,
            jumping=75,
            reactions=70,
            stamina=80,
            balance=70,
            height=height,  # Varied heights
            durability=80,
            # Mental
            awareness=70,
            creativity=65,
            determination=75,
            bravery=70,
            consistency=70,
            composure=70,
            patience=65,
            # Technical
            hand_eye_coordination=70,
            throw_accuracy=70,
            form_technique=70,
            finesse=70,
            deception=65,
            teamwork=70
        )
        team.append(player)

    return team


def run_ft_rebound_validation(num_games: int = 5, seed_start: int = 1000):
    """
    Run validation test across multiple games.

    Track every missed final FT and verify rebound occurs.
    """
    print("=" * 80)
    print("MISSED FINAL FREE THROW REBOUND VALIDATION TEST")
    print("=" * 80)
    print(f"\nRunning {num_games} games to validate missed FT rebound coverage...\n")

    # Statistics tracking
    total_final_fts_missed = 0
    total_rebounds_triggered = 0
    offensive_rebounds = 0
    defensive_rebounds = 0
    putback_attempts = 0
    putback_makes = 0
    kickouts = 0

    # Detailed examples
    examples = []

    for game_num in range(1, num_games + 1):
        print(f"\n{'=' * 80}")
        print(f"GAME {game_num}/{num_games}")
        print(f"{'=' * 80}\n")

        # Create teams
        home_team = create_test_team("Lakers", True)
        away_team = create_test_team("Warriors", False)

        # Tactical settings
        tactics_home = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )
        tactics_away = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

        # Create foul system with rosters
        foul_system = FoulSystem(home_roster=home_team, away_roster=away_team)

        # Simulate 200 possessions (roughly a full game)
        # Force high foul rate by using random seeds that trigger fouls
        for poss_num in range(200):
            seed = seed_start + (game_num - 1) * 200 + poss_num

            # Alternate possession
            if poss_num % 2 == 0:
                off_team = home_team
                def_team = away_team
                defending_team_name = "Away"
                tactics_off = tactics_home
                tactics_def = tactics_away
            else:
                off_team = away_team
                def_team = home_team
                defending_team_name = "Home"
                tactics_off = tactics_away
                tactics_def = tactics_home

            context = PossessionContext(
                is_transition=False,
                shot_clock=24,
                score_differential=0,
                game_time_remaining=720
            )

            result = possession.simulate_possession(
                offensive_team=off_team,
                defensive_team=def_team,
                tactical_settings_offense=tactics_off,
                tactical_settings_defense=tactics_def,
                possession_context=context,
                seed=seed,
                foul_system=foul_system,
                quarter=2,
                game_time="08:30",
                defending_team_name=defending_team_name
            )

            # Check if this possession had free throws
            if result.free_throw_result:
                ft_result = result.free_throw_result

                # Check if final FT was missed
                if ft_result.results and ft_result.results[-1] == False:
                    total_final_fts_missed += 1

                    # Check if rebound occurred
                    if result.rebound_player:
                        total_rebounds_triggered += 1

                        # Determine if offensive or defensive
                        if result.possession_outcome == 'offensive_rebound':
                            offensive_rebounds += 1
                        elif result.possession_outcome == 'missed_shot':
                            defensive_rebounds += 1
                        elif result.possession_outcome == 'made_shot':
                            # Putback made after missed FT
                            offensive_rebounds += 1
                            putback_makes += 1

                        # Check debug info for putback details
                        if 'ft_rebound' in result.debug:
                            ft_reb = result.debug['ft_rebound']
                            if ft_reb.get('putback_attempted'):
                                putback_attempts += 1
                                if ft_reb.get('putback_made'):
                                    # Already counted above
                                    pass
                            else:
                                # Kickout
                                if ft_reb.get('offensive_rebound'):
                                    kickouts += 1

                        # Save example
                        if len(examples) < 10:
                            examples.append({
                                'game': game_num,
                                'possession': poss_num,
                                'shooter': ft_result.shooter,
                                'ft_made': ft_result.made,
                                'ft_attempts': ft_result.attempts,
                                'rebounder': result.rebound_player,
                                'is_offensive': result.possession_outcome in ['offensive_rebound', 'made_shot'],
                                'putback': 'putback_made' if result.possession_outcome == 'made_shot' else
                                          ('putback_missed' if result.debug.get('ft_rebound', {}).get('putback_attempted') else 'kickout'),
                                'play_by_play': result.play_by_play_text
                            })
                    else:
                        # ERROR: Missed final FT but no rebound!
                        print(f"\n{'!' * 80}")
                        print(f"ERROR: Missed final FT without rebound detected!")
                        print(f"Game {game_num}, Possession {poss_num}")
                        print(f"Shooter: {ft_result.shooter}")
                        print(f"FT Result: {ft_result.made}/{ft_result.attempts}")
                        print(f"FT Results: {ft_result.results}")
                        print(f"Possession Outcome: {result.possession_outcome}")
                        print(f"Rebound Player: {result.rebound_player}")
                        print(f"\nPlay-by-play:")
                        print(result.play_by_play_text)
                        print(f"{'!' * 80}\n")

    # Print results
    print("\n" + "=" * 80)
    print("VALIDATION RESULTS")
    print("=" * 80)

    print(f"\nTotal final FTs missed: {total_final_fts_missed}")
    print(f"Total rebounds triggered: {total_rebounds_triggered}")

    if total_final_fts_missed > 0:
        coverage_pct = (total_rebounds_triggered / total_final_fts_missed) * 100
        print(f"\nCOVERAGE: {coverage_pct:.1f}%")

        if coverage_pct == 100.0:
            print("[SUCCESS] 100% of missed final FTs triggered rebounds!")
        else:
            print(f"[FAILURE] Only {coverage_pct:.1f}% of missed FTs triggered rebounds!")
            print(f"  Missing rebounds: {total_final_fts_missed - total_rebounds_triggered}")
    else:
        print("\nNo missed final FTs detected in test games.")
        print("This is unusual - may need to run more games or adjust seed range.")

    if total_rebounds_triggered > 0:
        print(f"\n--- Rebound Distribution ---")
        print(f"Offensive rebounds: {offensive_rebounds} ({offensive_rebounds/total_rebounds_triggered*100:.1f}%)")
        print(f"Defensive rebounds: {defensive_rebounds} ({defensive_rebounds/total_rebounds_triggered*100:.1f}%)")

        print(f"\n--- Offensive Rebound Outcomes ---")
        print(f"Putback attempts: {putback_attempts}")
        print(f"Putback makes: {putback_makes}")
        print(f"Kickouts: {kickouts}")

        # Check if rates are realistic
        oreb_pct = offensive_rebounds / total_rebounds_triggered * 100
        dreb_pct = defensive_rebounds / total_rebounds_triggered * 100

        print(f"\n--- NBA Realism Check ---")
        print(f"Target OREB rate: 25-30%")
        print(f"Actual OREB rate: {oreb_pct:.1f}%")

        if 20 <= oreb_pct <= 35:
            print("[OK] OREB rate is within realistic range")
        else:
            print(f"[WARNING] OREB rate is outside realistic range (20-35%)")

    # Print examples
    if examples:
        print(f"\n{'=' * 80}")
        print("EXAMPLE MISSED FT REBOUNDS")
        print("=" * 80)

        for i, ex in enumerate(examples[:5], 1):
            print(f"\n--- Example {i} ---")
            print(f"Game {ex['game']}, Possession {ex['possession']}")
            print(f"Shooter: {ex['shooter']} ({ex['ft_made']}/{ex['ft_attempts']} FT)")
            print(f"Rebounder: {ex['rebounder']}")
            print(f"Type: {'OFFENSIVE' if ex['is_offensive'] else 'DEFENSIVE'}")
            if ex['is_offensive']:
                print(f"Outcome: {ex['putback']}")
            print(f"\nPlay-by-play:")
            print(ex['play_by_play'])

    print("\n" + "=" * 80)

    # Save detailed report
    report_path = os.path.join('output', 'ft_rebound_fix_validation_report.txt')
    os.makedirs('output', exist_ok=True)

    with open(report_path, 'w') as f:
        f.write("MISSED FINAL FREE THROW REBOUND VALIDATION REPORT\n")
        f.write("=" * 80 + "\n\n")
        f.write(f"Test Configuration:\n")
        f.write(f"- Games simulated: {num_games}\n")
        f.write(f"- Possessions per game: 200\n")
        f.write(f"- Total possessions: {num_games * 200}\n\n")

        f.write(f"Results:\n")
        f.write(f"- Total final FTs missed: {total_final_fts_missed}\n")
        f.write(f"- Total rebounds triggered: {total_rebounds_triggered}\n")
        f.write(f"- Coverage: {(total_rebounds_triggered/total_final_fts_missed*100) if total_final_fts_missed > 0 else 0:.1f}%\n\n")

        if total_rebounds_triggered > 0:
            f.write(f"Rebound Distribution:\n")
            f.write(f"- Offensive: {offensive_rebounds} ({offensive_rebounds/total_rebounds_triggered*100:.1f}%)\n")
            f.write(f"- Defensive: {defensive_rebounds} ({defensive_rebounds/total_rebounds_triggered*100:.1f}%)\n\n")

            f.write(f"Offensive Rebound Outcomes:\n")
            f.write(f"- Putback attempts: {putback_attempts}\n")
            f.write(f"- Putback makes: {putback_makes}\n")
            f.write(f"- Kickouts: {kickouts}\n\n")

        f.write(f"\nDetailed Examples:\n")
        f.write("=" * 80 + "\n\n")

        for i, ex in enumerate(examples, 1):
            f.write(f"Example {i}:\n")
            f.write(f"Game {ex['game']}, Possession {ex['possession']}\n")
            f.write(f"Shooter: {ex['shooter']} ({ex['ft_made']}/{ex['ft_attempts']} FT)\n")
            f.write(f"Rebounder: {ex['rebounder']}\n")
            f.write(f"Type: {'OFFENSIVE' if ex['is_offensive'] else 'DEFENSIVE'}\n")
            if ex['is_offensive']:
                f.write(f"Outcome: {ex['putback']}\n")
            f.write(f"\nPlay-by-play:\n{ex['play_by_play']}\n")
            f.write("\n" + "-" * 80 + "\n\n")

    print(f"\nDetailed report saved to: {report_path}")

    return {
        'total_missed_fts': total_final_fts_missed,
        'total_rebounds': total_rebounds_triggered,
        'coverage_pct': (total_rebounds_triggered/total_final_fts_missed*100) if total_final_fts_missed > 0 else 0,
        'offensive_rebounds': offensive_rebounds,
        'defensive_rebounds': defensive_rebounds
    }


if __name__ == "__main__":
    random.seed(42)  # For reproducibility
    results = run_ft_rebound_validation(num_games=5, seed_start=1000)

    print("\n" + "=" * 80)
    print("TEST SUMMARY")
    print("=" * 80)

    if results['coverage_pct'] == 100.0:
        print("\n>>> TEST PASSED <<<")
        print("All missed final free throws triggered rebound situations!")
    else:
        print("\n>>> TEST FAILED <<<")
        print(f"Only {results['coverage_pct']:.1f}% coverage achieved.")
        print(f"Missing: {results['total_missed_fts'] - results['total_rebounds']} rebounds")

    print("\n" + "=" * 80)
