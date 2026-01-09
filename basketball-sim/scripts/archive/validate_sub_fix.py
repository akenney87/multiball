"""
Validation script for substitution fix.

Tests that NO substitutions occur during live play (offensive/defensive rebounds).
"""

import sys
import os
import json

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings

def validate_substitutions(game_log: str, game_num: int):
    """
    Parse game log and verify all substitutions occur during legal dead balls.

    Returns:
        (total_subs, illegal_subs, violations)
    """
    lines = game_log.split('\n')

    total_subs = 0
    illegal_subs = 0
    violations = []

    # Track last event
    last_event = None

    for i, line in enumerate(lines):
        # Track shot outcomes
        if 'makes' in line or 'misses' in line:
            if 'misses' in line:
                # Check for rebound
                if i + 1 < len(lines):
                    next_line = lines[i + 1]
                    if 'Rebound secured by' in next_line:
                        last_event = 'defensive_rebound'
                    elif 'Offensive rebound' in next_line:
                        last_event = 'offensive_rebound'
            elif 'makes' in line:
                last_event = 'made_shot'

        # Track turnovers
        if 'TURNOVER' in line or 'OUT OF BOUNDS' in line or 'VIOLATION' in line:
            last_event = 'turnover'

        # Track fouls
        if 'FOUL' in line and 'FREE THROW' not in line:
            last_event = 'foul'

        # Track free throws
        if 'FREE THROW' in line:
            if 'makes' in line:
                last_event = 'made_ft'
            else:
                last_event = 'missed_ft'

        # Track quarter boundaries
        if 'QUARTER' in line or '=====' in line:
            last_event = 'quarter_boundary'

        # Track timeouts
        if 'TIMEOUT' in line:
            last_event = 'timeout'

        # Check for substitutions
        if 'Substitution' in line:
            total_subs += 1

            # Check if last event allows substitutions
            legal_events = ['foul', 'turnover', 'timeout', 'quarter_boundary', 'missed_ft']
            illegal_events = ['defensive_rebound', 'offensive_rebound', 'made_shot', 'made_ft']

            if last_event in illegal_events:
                illegal_subs += 1
                violations.append({
                    'game': game_num,
                    'line_num': i,
                    'sub_line': line,
                    'previous_event': last_event,
                    'context': lines[max(0, i-3):i+1]
                })

    return total_subs, illegal_subs, violations

def main():
    print("=" * 80)
    print("SUBSTITUTION FIX VALIDATION - 5 GAME TEST")
    print("=" * 80)
    print()

    # Load sample teams
    with open('data/sample_teams.json') as f:
        data = json.load(f)

    elite_shooters = data['teams']['Elite Shooters']
    elite_defenders = data['teams']['Elite Defenders']

    # Tactical settings for shooters
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
            'Damian Lillard': 24,
            'Dirk Nowitzki': 22,
            'Paul George': 18,
            'Chris Paul': 12,
        },
        rebounding_strategy='standard',
        timeout_strategy='moderate',
        closers=['Stephen Curry', 'Kevin Durant']
    )

    # Tactical settings for defenders
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
            'Ben Wallace': 26,
            'Scottie Pippen': 22,
            'Tony Allen': 18,
            'Marcus Smart': 14,
        },
        rebounding_strategy='crash_glass',
        timeout_strategy='aggressive',
        closers=['Kawhi Leonard', 'Gary Payton']
    )

    all_violations = []
    total_subs_all = 0

    # Run 5 games
    for game_num in range(1, 6):
        print(f"\n{'=' * 80}")
        print(f"GAME {game_num}")
        print(f"{'=' * 80}")

        # Simulate game
        game_sim = GameSimulator(
            home_roster=elite_shooters,
            away_roster=elite_defenders,
            tactical_home=tactical_shooters,
            tactical_away=tactical_defenders,
            home_team_name='Elite Shooters',
            away_team_name='Elite Defenders'
        )
        game_result = game_sim.simulate_game(seed=100 + game_num)

        # Save game log
        output_path = os.path.join('output', f'sub_fix_validation_game_{game_num}.txt')
        os.makedirs('output', exist_ok=True)
        with open(output_path, 'w') as f:
            f.write(game_result.play_by_play_text)

        print(f"Game log saved to: {output_path}")

        # Validate substitutions
        total_subs, illegal_subs, violations = validate_substitutions(
            game_result.play_by_play_text,
            game_num
        )

        total_subs_all += total_subs
        all_violations.extend(violations)

        print(f"\nSubstitution Summary:")
        print(f"  Total substitutions: {total_subs}")
        print(f"  Illegal substitutions: {illegal_subs}")

        if illegal_subs > 0:
            print(f"\n  WARNING: {illegal_subs} ILLEGAL SUBSTITUTION(S) DETECTED!")
            for v in violations:
                print(f"\n  Violation at line {v['line_num']}:")
                print(f"    Previous event: {v['previous_event']}")
                print(f"    Substitution: {v['sub_line']}")
        else:
            print(f"  [OK] All substitutions legal")

    # Final summary
    print("\n" + "=" * 80)
    print("FINAL VALIDATION SUMMARY")
    print("=" * 80)
    print(f"\nTotal games simulated: 5")
    print(f"Total substitutions: {total_subs_all}")
    print(f"Total illegal substitutions: {len(all_violations)}")

    if len(all_violations) == 0:
        print("\n[SUCCESS]")
        print("ZERO illegal substitutions found across all 5 games!")
        print("All substitutions occurred during legal dead ball situations.")
    else:
        print(f"\n[FAILURE]")
        print(f"{len(all_violations)} illegal substitution(s) detected!")
        print("\nDetailed violations:")
        for v in all_violations:
            print(f"\nGame {v['game']}, Line {v['line_num']}:")
            print(f"  Previous event: {v['previous_event']}")
            print(f"  Substitution: {v['sub_line']}")
            print(f"  Context:")
            for ctx_line in v['context']:
                print(f"    {ctx_line}")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
