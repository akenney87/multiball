"""
Test script to validate substitution logic fix.

This script runs 5 full games and validates that ALL substitutions
occur during legal dead ball situations only.

Legal substitution windows:
1. Quarter start (before first possession)
2. After foul (before FTs)
3. After timeout
4. After violation
5. After missed final FT

ILLEGAL substitutions (must have ZERO occurrences):
1. After made basket (unless timeout called first)
2. After made FT
3. After defensive rebound (live play)
4. After offensive rebound (live play)
5. During live play
"""

import sys
import os
import random

# Add project root to path
sys.path.insert(0, os.path.abspath('.'))

from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings, create_player


def create_extended_roster(team_name: str, base_rating: int = 75) -> list:
    """Create a 10-player roster for testing."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    players = []
    for i, pos in enumerate(positions):
        is_starter = i < 5
        rating = base_rating + (5 if is_starter else -5) + random.randint(-5, 5)
        rating = max(50, min(95, rating))
        player = create_player(
            name=f"{team_name}_{i+1}_{pos}",
            position=pos,
            grip_strength=rating, arm_strength=rating, core_strength=rating,
            agility=rating + random.randint(-3, 3),
            acceleration=rating + random.randint(-3, 3),
            top_speed=rating + random.randint(-3, 3),
            jumping=rating + random.randint(-3, 3),
            reactions=rating + random.randint(-3, 3),
            stamina=rating + random.randint(-3, 3),
            balance=rating + random.randint(-3, 3),
            height=75 if pos in ['PG', 'SG'] else 85 if pos == 'SF' else 90,
            durability=rating,
            awareness=rating + random.randint(-3, 3),
            creativity=rating + random.randint(-3, 3),
            determination=rating + random.randint(-3, 3),
            bravery=rating,
            consistency=rating + random.randint(-3, 3),
            composure=rating + random.randint(-3, 3),
            patience=rating,
            hand_eye_coordination=rating + random.randint(-3, 3),
            throw_accuracy=rating + random.randint(-3, 3),
            form_technique=rating + random.randint(-3, 3),
            finesse=rating + random.randint(-3, 3),
            deception=rating,
            teamwork=rating
        )
        players.append(player)
    return players


def create_minutes_allotment(roster: list) -> dict:
    """Create minutes allocation that totals 240."""
    allotment = {}
    for i in range(5):
        allotment[roster[i]['name']] = 32
    for i in range(5, 8):
        allotment[roster[i]['name']] = 18
    for i in range(8, 10):
        allotment[roster[i]['name']] = 13
    return allotment


def create_tactical_settings(roster, pace='standard', man_defense_pct=50):
    """Create tactical settings for a team."""
    return TacticalSettings(
        pace=pace,
        man_defense_pct=man_defense_pct,
        scoring_option_1=roster[0]['name'],
        scoring_option_2=roster[1]['name'],
        scoring_option_3=roster[2]['name'],
        minutes_allotment=create_minutes_allotment(roster),
        rebounding_strategy='standard',
        timeout_strategy='balanced',
        closers=[roster[0]['name'], roster[1]['name'], roster[2]['name']]
    )


def parse_play_by_play(pbp_text):
    """
    Parse play-by-play text to extract substitutions and their contexts.

    Returns:
        List of dicts with:
        - time: game time
        - substitution: sub details
        - previous_event: what happened immediately before
        - is_legal: whether substitution was legal
    """
    lines = pbp_text.strip().split('\n')
    events = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines and quarter headers
        if not line or line.startswith('===') or line.startswith('QUARTER') or line.startswith('FINAL'):
            i += 1
            continue

        # Check if this is a substitution line
        if 'Substitution' in line and '→' in line:
            # Extract substitution details
            sub_details = {
                'time': None,
                'line': line,
                'previous_event': None,
                'is_legal': None,
                'reason': None
            }

            # Look for previous non-sub event
            j = i - 1
            while j >= 0:
                prev_line = lines[j].strip()
                if prev_line and not prev_line.startswith('===') and 'Substitution' not in prev_line:
                    sub_details['previous_event'] = prev_line
                    break
                j -= 1

            # Determine if substitution is legal based on previous event
            prev = sub_details['previous_event']
            if prev is None:
                # Start of quarter - LEGAL
                sub_details['is_legal'] = True
                sub_details['reason'] = 'quarter_start'
            elif 'Timeout' in prev:
                # After timeout - LEGAL
                sub_details['is_legal'] = True
                sub_details['reason'] = 'after_timeout'
            elif 'Foul' in prev or 'foul' in prev:
                # After foul - need to check if FTs were made
                # Look ahead to see FT outcome
                k = i - 1
                ft_made_all = False
                while k >= j and k >= 0:
                    check_line = lines[k].strip()
                    if 'free throw' in check_line.lower() and 'makes' in check_line.lower():
                        # Check if this was the final FT and all were made
                        # For now, we'll mark as ILLEGAL if we see made FTs
                        # This is conservative - may need refinement
                        ft_made_all = True
                        break
                    elif 'free throw' in check_line.lower() and 'misses' in check_line.lower():
                        # Missed FT - LEGAL
                        ft_made_all = False
                        break
                    k -= 1

                if ft_made_all:
                    # Made all FTs - treat like made basket - ILLEGAL
                    sub_details['is_legal'] = False
                    sub_details['reason'] = 'after_made_ft_ILLEGAL'
                else:
                    # Foul without made FTs or missed FT - LEGAL
                    sub_details['is_legal'] = True
                    sub_details['reason'] = 'after_foul_or_missed_ft'
            elif 'MAKES' in prev or 'makes' in prev:
                # After made basket - ILLEGAL (unless timeout occurred between)
                # Check if timeout happened between made basket and sub
                timeout_between = False
                k = i - 1
                while k > j and k >= 0:
                    check_line = lines[k].strip()
                    if 'Timeout' in check_line:
                        timeout_between = True
                        break
                    k -= 1

                if timeout_between:
                    sub_details['is_legal'] = True
                    sub_details['reason'] = 'timeout_after_made_basket'
                else:
                    sub_details['is_legal'] = False
                    sub_details['reason'] = 'after_made_basket_ILLEGAL'
            elif 'Turnover' in prev or 'turnover' in prev or 'Out of bounds' in prev:
                # After violation/turnover - LEGAL
                sub_details['is_legal'] = True
                sub_details['reason'] = 'after_violation'
            elif 'Rebound' in prev or 'rebound' in prev:
                # After rebound - ILLEGAL (live play)
                sub_details['is_legal'] = False
                sub_details['reason'] = 'after_rebound_ILLEGAL'
            elif 'misses' in prev or 'MISSES' in prev:
                # After missed shot - depends on context
                # If followed by defensive rebound, ILLEGAL
                # If missed final FT, LEGAL
                if 'free throw' in prev.lower():
                    # Missed FT - LEGAL
                    sub_details['is_legal'] = True
                    sub_details['reason'] = 'after_missed_ft'
                else:
                    # Missed shot with rebound - ILLEGAL (checked via rebound above)
                    # But if we see "misses" without seeing rebound, assume defensive rebound occurred
                    sub_details['is_legal'] = False
                    sub_details['reason'] = 'after_missed_shot_rebound_ILLEGAL'
            else:
                # Unknown context - mark as UNKNOWN for manual review
                sub_details['is_legal'] = None
                sub_details['reason'] = 'UNKNOWN_CONTEXT'

            events.append(sub_details)

        i += 1

    return events


def validate_game(game_num, output_file):
    """Run one game and validate substitutions."""
    print(f"\n{'='*80}")
    print(f"GAME {game_num}: Starting validation")
    print(f"{'='*80}\n")

    # Set seed for reproducibility
    random.seed(game_num * 1000)

    # Create teams
    home_roster = create_extended_roster("Lakers", base_rating=75 + random.randint(-3, 3))
    away_roster = create_extended_roster("Warriors", base_rating=75 + random.randint(-3, 3))

    # Create tactical settings
    tactical_home = create_tactical_settings(home_roster, pace='standard', man_defense_pct=60)
    tactical_away = create_tactical_settings(away_roster, pace='fast', man_defense_pct=40)

    # Run game
    game_sim = GameSimulator(
        home_roster=home_roster,
        away_roster=away_roster,
        tactical_home=tactical_home,
        tactical_away=tactical_away,
        home_team_name='Lakers',
        away_team_name='Warriors'
    )

    result = game_sim.simulate_game(seed=game_num * 1000)

    # Write full output to file
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(result.play_by_play_text)

    print(f"Full play-by-play written to: {output_file}")

    # Parse and validate substitutions
    sub_events = parse_play_by_play(result.play_by_play_text)

    total_subs = len(sub_events)
    legal_subs = sum(1 for e in sub_events if e['is_legal'] == True)
    illegal_subs = sum(1 for e in sub_events if e['is_legal'] == False)
    unknown_subs = sum(1 for e in sub_events if e['is_legal'] is None)

    print(f"\nGAME {game_num} SUBSTITUTION ANALYSIS:")
    print(f"{'='*80}")
    print(f"Total substitutions: {total_subs}")
    print(f"Legal substitutions: {legal_subs}")
    print(f"ILLEGAL substitutions: {illegal_subs}")
    print(f"Unknown context: {unknown_subs}")
    print(f"{'='*80}\n")

    # Count by reason
    reason_counts = {}
    for event in sub_events:
        reason = event['reason'] or 'NONE'
        reason_counts[reason] = reason_counts.get(reason, 0) + 1

    print("Substitution breakdown by context:")
    for reason, count in sorted(reason_counts.items()):
        legal_marker = "✓ LEGAL" if "ILLEGAL" not in reason else "✗ ILLEGAL"
        print(f"  {reason:40s}: {count:3d} {legal_marker}")

    # Show illegal substitutions if any
    if illegal_subs > 0:
        print(f"\n{'!'*80}")
        print(f"ILLEGAL SUBSTITUTIONS DETECTED ({illegal_subs} violations):")
        print(f"{'!'*80}")
        for event in sub_events:
            if event['is_legal'] == False:
                print(f"\nContext: {event['previous_event']}")
                print(f"Sub: {event['line']}")
                print(f"Reason: {event['reason']}")

    # Show unknown substitutions for manual review
    if unknown_subs > 0:
        print(f"\n{'?'*80}")
        print(f"UNKNOWN CONTEXT SUBSTITUTIONS ({unknown_subs} need manual review):")
        print(f"{'?'*80}")
        for event in sub_events:
            if event['is_legal'] is None:
                print(f"\nContext: {event['previous_event']}")
                print(f"Sub: {event['line']}")

    return {
        'total': total_subs,
        'legal': legal_subs,
        'illegal': illegal_subs,
        'unknown': unknown_subs,
        'reason_counts': reason_counts
    }


def main():
    """Run 5 games and validate all substitutions."""
    print("SUBSTITUTION LOGIC FIX VALIDATION")
    print("="*80)
    print("Testing 5 complete games for substitution violations")
    print("="*80)

    # Create output directory
    os.makedirs('output', exist_ok=True)

    # Run 5 games
    all_results = []
    for game_num in range(1, 6):
        output_file = f'output/substitution_logic_fix_validation_game_{game_num}.txt'
        result = validate_game(game_num, output_file)
        all_results.append(result)

    # Summary report
    print(f"\n\n{'='*80}")
    print("FINAL SUMMARY - ALL 5 GAMES")
    print(f"{'='*80}\n")

    total_subs_all = sum(r['total'] for r in all_results)
    legal_subs_all = sum(r['legal'] for r in all_results)
    illegal_subs_all = sum(r['illegal'] for r in all_results)
    unknown_subs_all = sum(r['unknown'] for r in all_results)

    print(f"Total substitutions across all games: {total_subs_all}")
    print(f"Legal substitutions: {legal_subs_all}")
    print(f"ILLEGAL substitutions: {illegal_subs_all}")
    print(f"Unknown context: {unknown_subs_all}")
    print()

    # Aggregate reason counts
    all_reason_counts = {}
    for result in all_results:
        for reason, count in result['reason_counts'].items():
            all_reason_counts[reason] = all_reason_counts.get(reason, 0) + count

    print("Overall substitution breakdown:")
    for reason, count in sorted(all_reason_counts.items()):
        legal_marker = "✓ LEGAL" if "ILLEGAL" not in reason else "✗ ILLEGAL"
        pct = (count / total_subs_all * 100) if total_subs_all > 0 else 0
        print(f"  {reason:40s}: {count:4d} ({pct:5.1f}%) {legal_marker}")

    print(f"\n{'='*80}")
    if illegal_subs_all == 0 and unknown_subs_all == 0:
        print("✓✓✓ SUCCESS: ZERO ILLEGAL SUBSTITUTIONS DETECTED ✓✓✓")
        print("All substitutions occurred during legal dead ball situations.")
    elif illegal_subs_all == 0 and unknown_subs_all > 0:
        print(f"⚠ PARTIAL SUCCESS: No illegal subs, but {unknown_subs_all} need manual review")
    else:
        print(f"✗✗✗ FAILURE: {illegal_subs_all} ILLEGAL SUBSTITUTIONS DETECTED ✗✗✗")
        print("Fix is incomplete. Review illegal substitutions above.")
    print(f"{'='*80}\n")


if __name__ == '__main__':
    main()
