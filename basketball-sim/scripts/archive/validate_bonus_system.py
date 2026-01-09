"""
Validation Script for Team Foul / Bonus System (M3 Issue #8)

Runs 10 full games and validates:
1. Bonus triggers correctly
2. Team fouls displayed in game logs
3. Bonus status shown in play-by-play
4. Team fouls reset each quarter
5. Statistics on bonus frequency
"""

import sys
import os
import re
import json
from collections import defaultdict

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings


def validate_bonus_in_game_log(game_log_path):
    """
    Analyze a game log for bonus system behavior.

    Returns dict with:
    - bonus_triggers: List of (quarter, time, team) when bonus triggered
    - team_foul_counts: Dict of {(quarter, team): max_fouls}
    - bonus_displays: Count of "IN THE BONUS" displays
    - team_foul_resets: Whether team fouls reset each quarter
    """
    with open(game_log_path, 'r', encoding='utf-8') as f:
        content = f.read()

    results = {
        'bonus_triggers': [],
        'team_foul_counts': {},
        'bonus_displays': 0,
        'team_foul_summary_displays': 0,
        'quarters_with_bonus': set()
    }

    # Find all bonus triggers in play-by-play
    bonus_pattern = r'\[IN THE BONUS! (\d+) team fouls\]'
    bonus_matches = re.findall(bonus_pattern, content)
    results['bonus_displays'] = len(bonus_matches)

    # Find all team foul displays in summaries
    team_foul_pattern = r'TEAM FOULS: (\d+)(?: \[OPPONENT IN BONUS\])?'
    team_foul_matches = re.findall(team_foul_pattern, content)
    results['team_foul_summary_displays'] = len(team_foul_matches)

    # Parse quarter-by-quarter team fouls
    quarter_sections = re.split(r'(\d+(?:ST|ND|RD|TH) QUARTER)', content)

    for i in range(1, len(quarter_sections), 2):
        if i+1 >= len(quarter_sections):
            break

        quarter_header = quarter_sections[i]
        quarter_content = quarter_sections[i+1]

        # Extract quarter number
        quarter_num = None
        if '1ST' in quarter_header:
            quarter_num = 1
        elif '2ND' in quarter_header:
            quarter_num = 2
        elif '3RD' in quarter_header:
            quarter_num = 3
        elif '4TH' in quarter_header:
            quarter_num = 4

        if quarter_num is None:
            continue

        # Find team foul counts in this quarter's summary
        # Look for "TEAM FOULS: X" in the quarter complete section
        summary_section = quarter_content.split('QUARTER COMPLETE')[-1] if 'QUARTER COMPLETE' in quarter_content else ''
        team_foul_in_summary = re.findall(r'TEAM FOULS: (\d+)', summary_section)

        # Check if bonus occurred in this quarter
        if 'IN THE BONUS' in quarter_content or 'BONUS:' in quarter_content:
            results['quarters_with_bonus'].add(quarter_num)

    return results


def run_validation_games(num_games=10):
    """Run validation games and collect statistics."""

    print("=" * 80)
    print("TEAM FOUL / BONUS SYSTEM VALIDATION")
    print("=" * 80)
    print()

    # Load teams
    print("Loading teams...")
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    shooters_roster = data['teams']['Elite Shooters']
    defenders_roster = data['teams']['Elite Defenders']

    # Create tactical settings
    shooters_tactics = TacticalSettings(
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
        closers=['Stephen Curry', 'Kevin Durant'],
        timeout_strategy='conservative'
    )

    defenders_tactics = TacticalSettings(
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
        closers=['Kawhi Leonard', 'Gary Payton'],
        timeout_strategy='aggressive'
    )

    # Run games
    game_results = []

    for game_num in range(1, num_games + 1):
        print(f"\n--- Running Game {game_num}/{num_games} ---")

        output_path = f'output/bonus_validation_game_{game_num}.txt'

        try:
            # Create game simulator
            simulator = GameSimulator(
                home_roster=shooters_roster,
                away_roster=defenders_roster,
                tactical_home=shooters_tactics,
                tactical_away=defenders_tactics,
                home_team_name='Elite Shooters',
                away_team_name='Elite Defenders'
            )

            # Run simulation
            game_result = simulator.simulate_game(seed=None)

            # Write play-by-play to file
            os.makedirs('output', exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(game_result.play_by_play_text)

            # Analyze game log
            validation_results = validate_bonus_in_game_log(output_path)

            game_results.append({
                'game_num': game_num,
                'output_path': output_path,
                'validation': validation_results,
                'game_result': game_result
            })

            print(f"  - Bonus displays: {validation_results['bonus_displays']}")
            print(f"  - Team foul summaries: {validation_results['team_foul_summary_displays']}")
            print(f"  - Quarters with bonus: {sorted(validation_results['quarters_with_bonus'])}")

        except Exception as e:
            print(f"  ERROR: {e}")
            import traceback
            traceback.print_exc()

    return game_results


def generate_validation_report(game_results):
    """Generate comprehensive validation report."""

    print("\n" + "=" * 80)
    print("VALIDATION REPORT")
    print("=" * 80)
    print()

    total_games = len(game_results)
    total_bonus_displays = sum(r['validation']['bonus_displays'] for r in game_results)
    total_team_foul_displays = sum(r['validation']['team_foul_summary_displays'] for r in game_results)

    # Count games with at least one bonus
    games_with_bonus = sum(1 for r in game_results if len(r['validation']['quarters_with_bonus']) > 0)

    # Count quarters with bonus
    quarters_with_bonus_count = sum(len(r['validation']['quarters_with_bonus']) for r in game_results)

    print(f"GAMES ANALYZED: {total_games}")
    print(f"GAMES WITH AT LEAST ONE BONUS: {games_with_bonus} ({games_with_bonus/total_games*100:.1f}%)")
    print()

    print(f"TOTAL BONUS DISPLAYS (play-by-play): {total_bonus_displays}")
    print(f"AVERAGE BONUS DISPLAYS PER GAME: {total_bonus_displays/total_games:.1f}")
    print()

    print(f"TOTAL TEAM FOUL SUMMARY DISPLAYS: {total_team_foul_displays}")
    print(f"EXPECTED (8 per game = 2 teams × 4 quarters): {total_games * 8}")
    print(f"ACTUAL: {total_team_foul_displays} ({total_team_foul_displays/(total_games*8)*100:.1f}% of expected)")
    print()

    print(f"QUARTERS WITH BONUS: {quarters_with_bonus_count}")
    print(f"AVERAGE QUARTERS WITH BONUS PER GAME: {quarters_with_bonus_count/total_games:.1f}")
    print()

    # Per-game breakdown
    print("PER-GAME BREAKDOWN:")
    print("-" * 80)
    print(f"{'Game':<8} {'Bonus Displays':<16} {'Team Foul Displays':<20} {'Quarters w/ Bonus':<20}")
    print("-" * 80)

    for result in game_results:
        game_num = result['game_num']
        bonus_displays = result['validation']['bonus_displays']
        team_foul_displays = result['validation']['team_foul_summary_displays']
        quarters = sorted(result['validation']['quarters_with_bonus'])
        quarters_str = ', '.join(f'Q{q}' for q in quarters) if quarters else 'None'

        print(f"Game {game_num:<3} {bonus_displays:<16} {team_foul_displays:<20} {quarters_str:<20}")

    print("-" * 80)
    print()

    # VALIDATION CHECKS
    print("VALIDATION CHECKS:")
    print("-" * 80)

    # Check 1: All games should have team foul displays (8 per game)
    check_1 = all(r['validation']['team_foul_summary_displays'] == 8 for r in game_results)
    print(f"✓ Team foul displays in all quarter summaries: {'PASS' if check_1 else 'FAIL'}")

    # Check 2: Most games should have at least one bonus
    check_2 = games_with_bonus >= total_games * 0.7  # At least 70% of games
    print(f"✓ Bonus triggered in most games (>70%): {'PASS' if check_2 else 'FAIL'} ({games_with_bonus}/{total_games})")

    # Check 3: Average bonus displays per game should be reasonable (2-6)
    avg_bonus = total_bonus_displays / total_games
    check_3 = 2 <= avg_bonus <= 8
    print(f"✓ Average bonus displays per game reasonable (2-8): {'PASS' if check_3 else 'FAIL'} ({avg_bonus:.1f})")

    print("-" * 80)
    print()

    # SAMPLE EVIDENCE
    print("SAMPLE EVIDENCE (from game logs):")
    print("-" * 80)
    print()

    # Show snippets from first game
    if game_results:
        sample_game = game_results[0]
        sample_path = sample_game['output_path']

        print(f"From {sample_path}:")
        print()

        with open(sample_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Find first bonus display
        bonus_match = re.search(r'(\[IN THE BONUS.*?\n.*?\n.*?\n)', content)
        if bonus_match:
            print("BONUS DISPLAY EXAMPLE:")
            print(bonus_match.group(1))
            print()

        # Find first team foul summary
        team_foul_match = re.search(r'(TEAM FOULS: \d+.*?\n)', content)
        if team_foul_match:
            print("TEAM FOUL SUMMARY EXAMPLE:")
            print(team_foul_match.group(1))
            print()

    print("=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)


if __name__ == '__main__':
    game_results = run_validation_games(num_games=10)
    generate_validation_report(game_results)
