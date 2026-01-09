"""
Demonstration of the Substitution System

Shows:
1. Stamina-based substitutions
2. Minutes-based substitutions
3. Position-compatible substitution selection
4. Full quarter rotation patterns
5. Realistic rotation management
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.systems.substitutions import (
    LineupManager,
    SubstitutionManager,
    calculate_quarter_allocations,
    check_substitution_needed,
    select_substitute,
    is_position_compatible
)
from src.systems.stamina_manager import StaminaTracker, calculate_stamina_cost
from src.systems.game_clock import GameClock


# =============================================================================
# TEST DATA CREATION
# =============================================================================

def create_player(name, position, rating=75):
    """Create a player with realistic attributes."""
    return {
        'name': name,
        'position': position,
        'stamina': 100,
        'grip_strength': rating,
        'arm_strength': rating,
        'core_strength': rating,
        'agility': rating,
        'acceleration': rating,
        'top_speed': rating,
        'jumping': rating,
        'reactions': rating,
        'balance': rating,
        'height': rating,
        'durability': rating,
        'awareness': rating,
        'creativity': rating,
        'determination': rating,
        'bravery': rating,
        'consistency': rating,
        'composure': rating,
        'patience': rating,
        'hand_eye_coordination': rating,
        'throw_accuracy': rating,
        'form_technique': rating,
        'finesse': rating,
        'deception': rating,
        'teamwork': rating,
    }


def create_realistic_team(team_name, star_rating=85):
    """Create a realistic 10-player roster."""
    return [
        # Starters (higher rated)
        create_player(f"{team_name} PG Starter", "PG", star_rating),
        create_player(f"{team_name} SG Starter", "SG", star_rating),
        create_player(f"{team_name} SF Starter", "SF", star_rating),
        create_player(f"{team_name} PF Starter", "PF", star_rating),
        create_player(f"{team_name} C Starter", "C", star_rating),
        # Bench (lower rated)
        create_player(f"{team_name} PG Bench", "PG", star_rating - 10),
        create_player(f"{team_name} SG Bench", "SG", star_rating - 10),
        create_player(f"{team_name} SF Bench", "SF", star_rating - 10),
        create_player(f"{team_name} PF Bench", "PF", star_rating - 10),
        create_player(f"{team_name} C Bench", "C", star_rating - 10),
    ]


def create_minutes_allocation(team):
    """Create realistic minutes allocation (total = 240)."""
    # Starters: 32 min, Bench: 16 min
    return {
        team[0]['name']: 32,  # PG Starter
        team[1]['name']: 32,  # SG Starter
        team[2]['name']: 32,  # SF Starter
        team[3]['name']: 32,  # PF Starter
        team[4]['name']: 32,  # C Starter
        team[5]['name']: 16,  # PG Bench
        team[6]['name']: 16,  # SG Bench
        team[7]['name']: 16,  # SF Bench
        team[8]['name']: 16,  # PF Bench
        team[9]['name']: 16,  # C Bench
    }


# =============================================================================
# DEMO FUNCTIONS
# =============================================================================

def demo_position_compatibility():
    """Demonstrate position compatibility rules."""
    print("=" * 70)
    print("DEMO 1: Position Compatibility")
    print("=" * 70)
    print()

    positions = ['PG', 'SG', 'SF', 'PF', 'C']
    print("Position Compatibility Matrix:")
    print()
    print("        PG    SG    SF    PF    C")

    for pos_out in positions:
        row = f"{pos_out:5s}"
        for pos_in in positions:
            compatible = is_position_compatible(pos_out, pos_in)
            symbol = "Y" if compatible else "N"
            row += f"   {symbol}  "
        print(row)

    print()
    print("Key findings:")
    print("  - Guards (PG/SG) are interchangeable")
    print("  - Wings (SF/PF) are interchangeable")
    print("  - Centers (C) only match centers")
    print()


def demo_substitution_triggers():
    """Demonstrate substitution trigger logic."""
    print("=" * 70)
    print("DEMO 2: Substitution Triggers")
    print("=" * 70)
    print()

    player = create_player("Test Player", "PG")

    # Test various scenarios
    scenarios = [
        ("Normal play", 75.0, 5.0, 12.0, False, ""),
        ("Low stamina", 55.0, 5.0, 12.0, True, "stamina"),
        ("Minutes exceeded", 75.0, 12.5, 12.0, True, "minutes"),
        ("Both triggers", 55.0, 12.5, 12.0, True, "stamina"),
        ("At threshold", 60.0, 5.0, 12.0, False, ""),
    ]

    print(f"{'Scenario':<20} {'Stamina':<10} {'Minutes':<10} {'Allocation':<12} {'Needs Sub?':<12} {'Reason'}")
    print("-" * 70)

    for scenario_name, stamina, minutes, allocation, expected_needs, expected_reason in scenarios:
        needs_sub, reason = check_substitution_needed(
            player=player,
            current_stamina=stamina,
            minutes_played=minutes,
            minutes_allocation=allocation
        )
        status = "YES" if needs_sub else "NO"
        print(f"{scenario_name:<20} {stamina:<10.1f} {minutes:<10.1f} {allocation:<12.1f} {status:<12} {reason}")

    print()


def demo_substitute_selection():
    """Demonstrate substitute selection logic."""
    print("=" * 70)
    print("DEMO 3: Substitute Selection")
    print("=" * 70)
    print()

    # Create bench with various positions and stamina
    bench = [
        create_player("Guard A", "PG", 70),
        create_player("Guard B", "SG", 70),
        create_player("Wing A", "SF", 70),
        create_player("Wing B", "PF", 70),
        create_player("Center", "C", 70),
    ]

    stamina_values = {
        "Guard A": 60.0,
        "Guard B": 90.0,
        "Wing A": 85.0,
        "Wing B": 80.0,
        "Center": 95.0,
    }

    scenarios = [
        ("PG", "Guard B (SG, 90.0)"),  # Position match, highest stamina
        ("SF", "Wing A (SF, 85.0)"),   # Position match
        ("C", "Center (C, 95.0)"),     # Only center
    ]

    print(f"{'Position Out':<15} {'Selected Substitute':<30} {'Reason'}")
    print("-" * 70)

    for position_out, expected_name in scenarios:
        sub = select_substitute(bench, position_out, stamina_values)
        reason = f"Compatible, stamina={stamina_values[sub['name']]:.1f}"
        print(f"{position_out:<15} {sub['name']} ({sub['position']}, {stamina_values[sub['name']]:.1f})")

    print()


def demo_lineup_manager():
    """Demonstrate LineupManager functionality."""
    print("=" * 70)
    print("DEMO 4: Lineup Manager")
    print("=" * 70)
    print()

    team = create_realistic_team("Lakers")
    manager = LineupManager(team)

    print("Initial Lineup:")
    print("-" * 70)
    active = manager.get_active_players()
    bench = manager.get_bench_players()

    print("\nActive (5 players):")
    for i, player in enumerate(active, 1):
        print(f"  {i}. {player['name']} ({player['position']})")

    print("\nBench (5 players):")
    for i, player in enumerate(bench, 1):
        print(f"  {i}. {player['name']} ({player['position']})")

    # Perform substitution
    print("\n\nExecuting Substitution:")
    print("-" * 70)
    player_out = manager.get_player_by_name("Lakers PG Starter")
    player_in = manager.get_player_by_name("Lakers PG Bench")

    print(f"OUT: {player_out['name']} ({player_out['position']})")
    print(f"IN:  {player_in['name']} ({player_in['position']})")

    success = manager.substitute(player_out, player_in)
    print(f"\nSubstitution successful: {success}")

    print("\n\nUpdated Lineup:")
    print("-" * 70)
    active = manager.get_active_players()
    bench = manager.get_bench_players()

    print("\nActive (5 players):")
    for i, player in enumerate(active, 1):
        print(f"  {i}. {player['name']} ({player['position']})")

    print("\nBench (5 players):")
    for i, player in enumerate(bench, 1):
        print(f"  {i}. {player['name']} ({player['position']})")

    print()


def demo_quarter_simulation_with_subs():
    """Demonstrate full quarter with realistic substitution patterns."""
    print("=" * 70)
    print("DEMO 5: Quarter Simulation with Substitutions")
    print("=" * 70)
    print()

    # Create teams
    home_team = create_realistic_team("Lakers", 85)
    away_team = create_realistic_team("Celtics", 85)

    # Create minutes allocations (starters: 8 min, bench: 4 min per quarter)
    home_allocation = calculate_quarter_allocations(create_minutes_allocation(home_team), 1)
    away_allocation = calculate_quarter_allocations(create_minutes_allocation(away_team), 1)

    # Create substitution manager
    sub_manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Create game clock
    clock = GameClock(quarter_length_minutes=12)

    print("Starting Quarter 1 Simulation")
    print(f"Starters play 8 minutes, bench plays 4 minutes")
    print()

    # Simulate possessions
    possession_count = 0
    substitution_count = 0
    pace = 'standard'  # 30 sec per possession average

    print("Possession Log:")
    print("-" * 70)

    while not clock.is_quarter_over():
        possession_count += 1

        # Get current lineups
        home_active = sub_manager.get_home_active()
        away_active = sub_manager.get_away_active()
        home_bench = sub_manager.get_home_bench()
        away_bench = sub_manager.get_away_bench()

        # Apply stamina cost to active players
        active_players = home_active + away_active
        stamina_tracker.apply_possession_cost(
            active_players=active_players,
            pace=pace,
            scoring_options=[],
            is_transition=False
        )

        # Recover bench stamina (30 seconds = 0.5 minutes)
        bench_players = home_bench + away_bench
        stamina_tracker.recover_bench_stamina(bench_players, 0.5)

        # Update clock (30 seconds per possession)
        possession_duration = 30
        clock.tick(possession_duration)

        # Update minutes played for active players
        for player in active_players:
            stamina_tracker.add_minutes(player['name'], possession_duration)

        # Check for substitutions
        game_time_str = clock.format_time()
        events = sub_manager.check_and_execute_substitutions(
            stamina_tracker=stamina_tracker,
            game_time_str=game_time_str
        )

        # Log possession
        print(f"[{game_time_str}] Possession #{possession_count}")

        if events:
            for event in events:
                substitution_count += 1
                print(f"  SUB: {event.player_out} OUT (stamina: {event.stamina_out:.1f}, reason: {event.reason})")
                print(f"       {event.player_in} IN (stamina: {event.stamina_in:.1f})")

    print()
    print("=" * 70)
    print("Quarter Complete!")
    print("=" * 70)
    print()
    print(f"Total Possessions: {possession_count}")
    print(f"Total Substitutions: {substitution_count}")
    print()

    # Show final minutes played
    print("Final Minutes Played:")
    print("-" * 70)
    print(f"{'Player':<30} {'Allocation':<12} {'Actual':<12} {'Difference'}")
    print("-" * 70)

    for team_name, allocation in [("HOME", home_allocation), ("AWAY", away_allocation)]:
        print(f"\n{team_name} TEAM:")
        for player_name, allocated_min in allocation.items():
            actual_min = stamina_tracker.get_minutes_played(player_name)
            diff = actual_min - allocated_min
            diff_str = f"{diff:+.1f}" if abs(diff) > 0.01 else "0.0"
            print(f"  {player_name:<28} {allocated_min:<12.1f} {actual_min:<12.1f} {diff_str}")

    print()

    # Show final stamina
    print("\nFinal Stamina Values:")
    print("-" * 70)
    print(f"{'Player':<30} {'Final Stamina'}")
    print("-" * 70)

    for team_name, team in [("HOME", home_team), ("AWAY", away_team)]:
        print(f"\n{team_name} TEAM:")
        for player in team:
            stamina = stamina_tracker.get_current_stamina(player['name'])
            stamina_bar = "#" * int(stamina / 5)
            print(f"  {player['name']:<28} {stamina:>5.1f} {stamina_bar}")

    print()


# =============================================================================
# MAIN
# =============================================================================

def main():
    """Run all demonstrations."""
    print("\n")
    print("=" * 70)
    print(" " * 15 + "SUBSTITUTION SYSTEM DEMONSTRATION")
    print("=" * 70)
    print()

    demo_position_compatibility()
    input("Press Enter to continue...")
    print("\n")

    demo_substitution_triggers()
    input("Press Enter to continue...")
    print("\n")

    demo_substitute_selection()
    input("Press Enter to continue...")
    print("\n")

    demo_lineup_manager()
    input("Press Enter to continue...")
    print("\n")

    demo_quarter_simulation_with_subs()

    print("\n")
    print("=" * 70)
    print(" " * 18 + "DEMONSTRATION COMPLETE")
    print("=" * 70)
    print()


if __name__ == "__main__":
    main()
