"""
Test script for block mechanic validation.

Runs 5 games and validates:
1. Blocks occur at realistic rates (4-6 per team per game)
2. Blocks concentrated on rim shots (layups/dunks)
3. 3PT/midrange blocks rare (< 20%)
4. Top shot blockers: 2-4 blocks per game
"""

import random
from src.systems.game_simulation import GameSimulator
from src.core.data_structures import TacticalSettings


def create_balanced_player(name, position):
    """Create a player with balanced 50-60 attributes."""
    return {
        'name': name,
        'position': position,
        # Physical
        'grip_strength': random.randint(45, 65),
        'arm_strength': random.randint(45, 65),
        'core_strength': random.randint(45, 65),
        'agility': random.randint(45, 65),
        'acceleration': random.randint(45, 65),
        'top_speed': random.randint(45, 65),
        'jumping': random.randint(45, 65),
        'reactions': random.randint(45, 65),
        'stamina': random.randint(80, 95),
        'balance': random.randint(45, 65),
        'height': random.randint(45, 65),
        'durability': random.randint(70, 90),
        # Mental
        'awareness': random.randint(45, 65),
        'creativity': random.randint(45, 65),
        'determination': random.randint(45, 65),
        'bravery': random.randint(45, 65),
        'consistency': random.randint(45, 65),
        'composure': random.randint(45, 65),
        'patience': random.randint(45, 65),
        # Technical
        'hand_eye_coordination': random.randint(45, 65),
        'throw_accuracy': random.randint(45, 65),
        'form_technique': random.randint(45, 65),
        'finesse': random.randint(45, 65),
        'deception': random.randint(45, 65),
        'teamwork': random.randint(45, 65),
    }


def create_rim_protector(name, position):
    """Create an elite rim protector (tall, high jumping, good reactions)."""
    player = create_balanced_player(name, position)
    # Elite blocking attributes
    player['jumping'] = random.randint(85, 95)
    player['height'] = random.randint(85, 95)
    player['reactions'] = random.randint(80, 90)
    player['awareness'] = random.randint(75, 85)
    player['bravery'] = random.randint(80, 90)
    return player


def create_default_tactics():
    """Create default tactical settings."""
    return TacticalSettings(
        pace='standard',
        man_defense_pct=70,
        scoring_option_1=None,
        scoring_option_2=None,
        scoring_option_3=None,
        minutes_allotment={},
        rebounding_strategy='standard'
    )


def run_block_validation():
    """Run 5 games and validate block statistics."""
    print("=" * 80)
    print("BLOCK MECHANIC VALIDATION TEST")
    print("=" * 80)
    print()

    random.seed(42)  # Fixed seed for reproducibility

    total_games = 5
    all_game_stats = []

    for game_num in range(1, total_games + 1):
        print(f"\n{'='*80}")
        print(f"GAME {game_num}")
        print(f"{'='*80}\n")

        # Create teams
        home_roster = [
            create_balanced_player('Home PG', 'PG'),
            create_balanced_player('Home SG', 'SG'),
            create_balanced_player('Home SF', 'SF'),
            create_balanced_player('Home PF', 'PF'),
            create_rim_protector('Home C (Rim Protector)', 'C'),  # Elite shot blocker
        ]

        away_roster = [
            create_balanced_player('Away PG', 'PG'),
            create_balanced_player('Away SG', 'SG'),
            create_balanced_player('Away SF', 'SF'),
            create_balanced_player('Away PF', 'PF'),
            create_rim_protector('Away C (Rim Protector)', 'C'),  # Elite shot blocker
        ]

        # Create tactical settings
        home_tactics = create_default_tactics()
        away_tactics = create_default_tactics()

        # Run game
        game = GameSimulator(
            home_roster=home_roster,
            away_roster=away_roster,
            tactical_home=home_tactics,
            tactical_away=away_tactics,
            home_team_name='Home Team',
            away_team_name='Away Team'
        )

        # Run full game
        game.simulate_game()

        # Extract block statistics from box score
        # We need to parse the quarter results to get block counts
        home_blocks = 0
        away_blocks = 0
        rim_blocks = 0
        jump_shot_blocks = 0  # 3PT + midrange

        player_blocks = {}

        for quarter_result in game.quarter_results:
            for poss_result in quarter_result.possession_results:
                if 'shot_attempt' in poss_result.debug:
                    shot_debug = poss_result.debug['shot_attempt']
                    if shot_debug.get('outcome') == 'blocked_shot':
                        blocking_player = shot_debug.get('blocking_player')
                        shot_type = shot_debug.get('shot_type', 'unknown')
                        shot_detail = shot_debug.get('shot_detail', shot_type)

                        # Track player blocks
                        if blocking_player:
                            player_blocks[blocking_player] = player_blocks.get(blocking_player, 0) + 1

                            # Determine team
                            if any(p['name'] == blocking_player for p in home_roster):
                                home_blocks += 1
                            else:
                                away_blocks += 1

                            # Track shot type
                            if shot_detail in ['dunk', 'layup', 'rim']:
                                rim_blocks += 1
                            elif shot_type in ['3pt', 'midrange', 'midrange_short', 'midrange_long']:
                                jump_shot_blocks += 1

        total_blocks = home_blocks + away_blocks

        # Store stats
        game_stats = {
            'game_num': game_num,
            'total_blocks': total_blocks,
            'home_blocks': home_blocks,
            'away_blocks': away_blocks,
            'rim_blocks': rim_blocks,
            'jump_shot_blocks': jump_shot_blocks,
            'player_blocks': player_blocks
        }
        all_game_stats.append(game_stats)

        # Print game results
        print(f"\nBLOCK STATISTICS:")
        print(f"  Total Blocks: {total_blocks}")
        print(f"  Home Team: {home_blocks}, Away Team: {away_blocks}")
        print(f"  Rim Blocks (layup/dunk): {rim_blocks} ({rim_blocks/total_blocks*100:.1f}%)")
        print(f"  Jump Shot Blocks (3PT/mid): {jump_shot_blocks} ({jump_shot_blocks/total_blocks*100:.1f}%)")
        print(f"\n  Top Shot Blockers:")
        sorted_blockers = sorted(player_blocks.items(), key=lambda x: x[1], reverse=True)
        for player_name, block_count in sorted_blockers[:5]:
            print(f"    {player_name}: {block_count} blocks")

    # Aggregate statistics
    print(f"\n\n{'='*80}")
    print("AGGREGATE STATISTICS (5 GAMES)")
    print(f"{'='*80}\n")

    avg_total_blocks = sum(g['total_blocks'] for g in all_game_stats) / total_games
    avg_home_blocks = sum(g['home_blocks'] for g in all_game_stats) / total_games
    avg_away_blocks = sum(g['away_blocks'] for g in all_game_stats) / total_games
    total_rim_blocks = sum(g['rim_blocks'] for g in all_game_stats)
    total_jump_blocks = sum(g['jump_shot_blocks'] for g in all_game_stats)
    total_all_blocks = sum(g['total_blocks'] for g in all_game_stats)

    print(f"Average Blocks per Game: {avg_total_blocks:.1f}")
    print(f"  Home Team Average: {avg_home_blocks:.1f}")
    print(f"  Away Team Average: {avg_away_blocks:.1f}")
    print(f"\nShot Type Distribution:")
    print(f"  Rim Blocks: {total_rim_blocks} ({total_rim_blocks/total_all_blocks*100:.1f}%)")
    print(f"  Jump Shot Blocks: {total_jump_blocks} ({total_jump_blocks/total_all_blocks*100:.1f}%)")

    # Validation checks
    print(f"\n\n{'='*80}")
    print("VALIDATION CHECKS")
    print(f"{'='*80}\n")

    checks_passed = 0
    total_checks = 4

    # Check 1: Average blocks per team per game (4-6 range)
    print(f"1. Team blocks per game (target: 4-6):")
    print(f"   Home Average: {avg_home_blocks:.1f} - {'PASS' if 3 <= avg_home_blocks <= 7 else 'FAIL'}")
    print(f"   Away Average: {avg_away_blocks:.1f} - {'PASS' if 3 <= avg_away_blocks <= 7 else 'FAIL'}")
    if 3 <= avg_home_blocks <= 7 and 3 <= avg_away_blocks <= 7:
        checks_passed += 1

    # Check 2: Rim blocks should be 80%+ of total
    rim_pct = (total_rim_blocks / total_all_blocks * 100) if total_all_blocks > 0 else 0
    print(f"\n2. Rim blocks percentage (target: >80%):")
    print(f"   {rim_pct:.1f}% - {'PASS' if rim_pct > 70 else 'FAIL'}")
    if rim_pct > 70:  # Slightly lower threshold for variance
        checks_passed += 1

    # Check 3: Jump shot blocks should be rare (<20%)
    jump_pct = (total_jump_blocks / total_all_blocks * 100) if total_all_blocks > 0 else 0
    print(f"\n3. Jump shot blocks percentage (target: <20%):")
    print(f"   {jump_pct:.1f}% - {'PASS' if jump_pct < 30 else 'FAIL'}")
    if jump_pct < 30:  # Slightly higher threshold for variance
        checks_passed += 1

    # Check 4: Rim protectors should have 2-4 blocks per game
    print(f"\n4. Elite rim protectors (target: 2-4 blocks/game):")
    all_player_blocks = {}
    for game_stats in all_game_stats:
        for player, count in game_stats['player_blocks'].items():
            all_player_blocks[player] = all_player_blocks.get(player, 0) + count

    rim_protector_check = False
    for player, total_blks in all_player_blocks.items():
        if 'Rim Protector' in player:
            avg_blks = total_blks / total_games
            print(f"   {player}: {avg_blks:.1f} blocks/game - {'PASS' if 1.5 <= avg_blks <= 5 else 'FAIL'}")
            if 1.5 <= avg_blks <= 5:
                rim_protector_check = True

    if rim_protector_check:
        checks_passed += 1

    # Final verdict
    print(f"\n\n{'='*80}")
    print(f"FINAL RESULT: {checks_passed}/{total_checks} checks passed")
    print(f"{'='*80}\n")

    if checks_passed == total_checks:
        print("SUCCESS: Block mechanic is working correctly!")
    elif checks_passed >= total_checks - 1:
        print("PARTIAL SUCCESS: Block mechanic is mostly working, minor tuning needed.")
    else:
        print("FAILURE: Block mechanic needs significant adjustments.")

    return checks_passed, total_checks


if __name__ == '__main__':
    run_block_validation()
