"""
Tests for substitution system.

Validates:
- LineupManager functionality
- Substitution triggers (stamina, minutes)
- Position compatibility
- Substitute selection logic
- SubstitutionManager integration
"""

import pytest
from src.systems.substitutions import (
    LineupManager,
    SubstitutionManager,
    SubstitutionEvent,
    check_substitution_needed,
    select_substitute,
    is_position_compatible,
    calculate_quarter_allocations,
    validate_minutes_allocation
)
from src.systems.stamina_manager import StaminaTracker


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def create_test_player(name, position, stamina=100):
    """Create a test player with minimal attributes."""
    return {
        'name': name,
        'position': position,
        'stamina': stamina,
        # Include required attributes for StaminaTracker
        'grip_strength': 70,
        'arm_strength': 70,
        'core_strength': 70,
        'agility': 70,
        'acceleration': 70,
        'top_speed': 70,
        'jumping': 70,
        'reactions': 70,
        'balance': 70,
        'height': 70,
        'durability': 70,
        'awareness': 70,
        'creativity': 70,
        'determination': 70,
        'bravery': 70,
        'consistency': 70,
        'composure': 70,
        'patience': 70,
        'hand_eye_coordination': 70,
        'throw_accuracy': 70,
        'form_technique': 70,
        'finesse': 70,
        'deception': 70,
        'teamwork': 70,
    }


def create_test_team(size=10):
    """Create a test team with standard positions."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C']
    team = []
    for i in range(size):
        pos = positions[i % len(positions)]
        team.append(create_test_player(f"Player{i+1}", pos))
    return team


# =============================================================================
# POSITION COMPATIBILITY TESTS
# =============================================================================

def test_position_compatible_guards():
    """Guards (PG/SG) should be interchangeable."""
    assert is_position_compatible('PG', 'SG') == True
    assert is_position_compatible('SG', 'PG') == True
    assert is_position_compatible('PG', 'PG') == True
    assert is_position_compatible('SG', 'SG') == True


def test_position_compatible_wings():
    """Wings (SF/PF) should be interchangeable."""
    assert is_position_compatible('SF', 'PF') == True
    assert is_position_compatible('PF', 'SF') == True
    assert is_position_compatible('SF', 'SF') == True
    assert is_position_compatible('PF', 'PF') == True


def test_position_compatible_centers():
    """Centers (C) should only match centers."""
    assert is_position_compatible('C', 'C') == True
    assert is_position_compatible('C', 'PF') == False
    assert is_position_compatible('C', 'SF') == False
    assert is_position_compatible('C', 'SG') == False
    assert is_position_compatible('C', 'PG') == False


def test_position_incompatible_guards_wings():
    """Guards and wings should not be compatible."""
    assert is_position_compatible('PG', 'SF') == False
    assert is_position_compatible('PG', 'PF') == False
    assert is_position_compatible('SG', 'SF') == False
    assert is_position_compatible('SG', 'PF') == False


def test_position_incompatible_guards_centers():
    """Guards and centers should not be compatible."""
    assert is_position_compatible('PG', 'C') == False
    assert is_position_compatible('SG', 'C') == False


# =============================================================================
# SUBSTITUTION CHECK TESTS
# =============================================================================

def test_check_substitution_needed_low_stamina():
    """Stamina < 60 should trigger substitution."""
    player = create_test_player("Test", "PG")
    needs_sub, reason = check_substitution_needed(
        player=player,
        current_stamina=55.0,
        minutes_played=5.0,
        minutes_allocation=12.0
    )
    assert needs_sub == True
    assert reason == 'stamina'


def test_check_substitution_needed_minutes_exceeded():
    """Minutes >= allocation should trigger substitution."""
    player = create_test_player("Test", "PG")
    needs_sub, reason = check_substitution_needed(
        player=player,
        current_stamina=75.0,
        minutes_played=12.2,
        minutes_allocation=12.0
    )
    assert needs_sub == True
    assert reason == 'minutes'


def test_check_substitution_needed_no_trigger():
    """No triggers should return False."""
    player = create_test_player("Test", "PG")
    needs_sub, reason = check_substitution_needed(
        player=player,
        current_stamina=70.0,
        minutes_played=8.0,
        minutes_allocation=12.0
    )
    assert needs_sub == False
    assert reason == ''


def test_check_substitution_priority_stamina_over_minutes():
    """Stamina trigger should take priority over minutes."""
    player = create_test_player("Test", "PG")
    needs_sub, reason = check_substitution_needed(
        player=player,
        current_stamina=55.0,
        minutes_played=12.5,
        minutes_allocation=12.0
    )
    assert needs_sub == True
    assert reason == 'stamina'  # Stamina reason, not minutes


def test_check_substitution_threshold_boundary():
    """Stamina exactly at threshold should not trigger."""
    player = create_test_player("Test", "PG")
    needs_sub, reason = check_substitution_needed(
        player=player,
        current_stamina=60.0,
        minutes_played=5.0,
        minutes_allocation=12.0
    )
    assert needs_sub == False


def test_check_substitution_minutes_tolerance():
    """Small tolerance for minutes should prevent premature substitution."""
    player = create_test_player("Test", "PG")
    # Exactly at allocation
    needs_sub1, _ = check_substitution_needed(
        player=player,
        current_stamina=70.0,
        minutes_played=12.0,
        minutes_allocation=12.0
    )
    # Just under tolerance (0.05 min = 3 sec)
    needs_sub2, _ = check_substitution_needed(
        player=player,
        current_stamina=70.0,
        minutes_played=12.05,
        minutes_allocation=12.0
    )
    # Over tolerance (0.2 min = 12 sec)
    needs_sub3, _ = check_substitution_needed(
        player=player,
        current_stamina=70.0,
        minutes_played=12.2,
        minutes_allocation=12.0
    )

    assert needs_sub1 == False
    assert needs_sub2 == False
    assert needs_sub3 == True


# =============================================================================
# SUBSTITUTE SELECTION TESTS
# =============================================================================

def test_select_substitute_position_match_preferred():
    """Position match should be preferred over higher stamina."""
    bench = [
        create_test_player("Guard", "PG", 80),
        create_test_player("Wing", "SF", 95),  # Higher stamina but wrong position
    ]
    stamina_values = {
        "Guard": 80.0,
        "Wing": 95.0
    }

    sub = select_substitute(bench, "SG", stamina_values)
    assert sub['name'] == "Guard"  # PG/SG compatible


def test_select_substitute_highest_stamina_among_compatible():
    """Among compatible positions, highest stamina wins."""
    bench = [
        create_test_player("Guard1", "PG", 70),
        create_test_player("Guard2", "SG", 90),
        create_test_player("Wing", "SF", 95),
    ]
    stamina_values = {
        "Guard1": 70.0,
        "Guard2": 90.0,
        "Wing": 95.0
    }

    sub = select_substitute(bench, "PG", stamina_values)
    assert sub['name'] == "Guard2"  # Highest stamina among guards


def test_select_substitute_no_position_match_fallback():
    """If no position match, choose highest stamina overall."""
    bench = [
        create_test_player("Wing1", "SF", 70),
        create_test_player("Wing2", "PF", 85),
    ]
    stamina_values = {
        "Wing1": 70.0,
        "Wing2": 85.0
    }

    sub = select_substitute(bench, "C", stamina_values)
    assert sub['name'] == "Wing2"  # Highest stamina


def test_select_substitute_empty_bench():
    """Empty bench should return None."""
    bench = []
    stamina_values = {}

    sub = select_substitute(bench, "PG", stamina_values)
    assert sub is None


def test_select_substitute_center_requires_center():
    """Center position should only match centers."""
    bench = [
        create_test_player("Guard", "PG", 90),
        create_test_player("Center", "C", 60),
    ]
    stamina_values = {
        "Guard": 90.0,
        "Center": 60.0
    }

    sub = select_substitute(bench, "C", stamina_values)
    assert sub['name'] == "Center"  # Only center compatible


# =============================================================================
# LINEUP MANAGER TESTS
# =============================================================================

def test_lineup_manager_initialization():
    """LineupManager should initialize with first 5 as starters."""
    team = create_test_team(10)
    manager = LineupManager(team)

    active = manager.get_active_players()
    bench = manager.get_bench_players()

    assert len(active) == 5
    assert len(bench) == 5
    assert active[0]['name'] == "Player1"
    assert bench[0]['name'] == "Player6"


def test_lineup_manager_initialization_exactly_5():
    """Team with exactly 5 players should have no bench."""
    team = create_test_team(5)
    manager = LineupManager(team)

    active = manager.get_active_players()
    bench = manager.get_bench_players()

    assert len(active) == 5
    assert len(bench) == 0


def test_lineup_manager_initialization_too_few():
    """Team with < 5 players should raise error."""
    team = create_test_team(4)

    with pytest.raises(ValueError, match="at least 5 players"):
        LineupManager(team)


def test_lineup_manager_get_player_by_name():
    """Should find player by name."""
    team = create_test_team(10)
    manager = LineupManager(team)

    player = manager.get_player_by_name("Player3")
    assert player is not None
    assert player['name'] == "Player3"

    player = manager.get_player_by_name("Nonexistent")
    assert player is None


def test_lineup_manager_substitute_success():
    """Valid substitution should succeed."""
    team = create_test_team(10)
    manager = LineupManager(team)

    player_out = manager.get_player_by_name("Player1")
    player_in = manager.get_player_by_name("Player6")

    success = manager.substitute(player_out, player_in)
    assert success == True

    active = manager.get_active_players()
    bench = manager.get_bench_players()

    # Player6 should now be active
    assert any(p['name'] == "Player6" for p in active)
    # Player1 should now be on bench
    assert any(p['name'] == "Player1" for p in bench)


def test_lineup_manager_substitute_player_not_active():
    """Substituting non-active player should fail."""
    team = create_test_team(10)
    manager = LineupManager(team)

    player_out = manager.get_player_by_name("Player6")  # On bench
    player_in = manager.get_player_by_name("Player7")

    success = manager.substitute(player_out, player_in)
    assert success == False


def test_lineup_manager_substitute_player_not_on_bench():
    """Substituting with non-bench player should fail."""
    team = create_test_team(10)
    manager = LineupManager(team)

    player_out = manager.get_player_by_name("Player1")
    player_in = manager.get_player_by_name("Player2")  # Active

    success = manager.substitute(player_out, player_in)
    assert success == False


def test_lineup_manager_validate_lineup():
    """Validate lineup should check for exactly 5 players."""
    team = create_test_team(10)
    manager = LineupManager(team)

    assert manager.validate_lineup() == True

    # Corrupt lineup
    manager.active_lineup.pop()
    assert manager.validate_lineup() == False


def test_lineup_manager_multiple_substitutions():
    """Should handle multiple substitutions correctly."""
    team = create_test_team(10)
    manager = LineupManager(team)

    # Sub Player1 -> Player6
    manager.substitute(
        manager.get_player_by_name("Player1"),
        manager.get_player_by_name("Player6")
    )

    # Sub Player2 -> Player7
    manager.substitute(
        manager.get_player_by_name("Player2"),
        manager.get_player_by_name("Player7")
    )

    active = manager.get_active_players()
    bench = manager.get_bench_players()

    assert len(active) == 5
    assert len(bench) == 5
    assert any(p['name'] == "Player6" for p in active)
    assert any(p['name'] == "Player7" for p in active)
    assert any(p['name'] == "Player1" for p in bench)
    assert any(p['name'] == "Player2" for p in bench)


# =============================================================================
# SUBSTITUTION MANAGER INTEGRATION TESTS
# =============================================================================

def test_substitution_manager_initialization():
    """SubstitutionManager should initialize with both teams."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 12.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    home_active = manager.get_home_active()
    away_active = manager.get_away_active()

    assert len(home_active) == 5
    assert len(away_active) == 5


def test_substitution_manager_check_stamina_trigger():
    """SubstitutionManager should trigger on low stamina."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 12.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Deplete Player1's stamina
    stamina_tracker.stamina_state["Player1"] = 55.0

    # Check substitutions
    events = manager.check_and_execute_substitutions(
        stamina_tracker=stamina_tracker,
        game_time_str="10:00"
    )

    assert len(events) >= 1
    assert any(e.player_out == "Player1" for e in events)
    assert any(e.reason == "stamina" for e in events)


def test_substitution_manager_check_minutes_trigger():
    """SubstitutionManager should trigger on minutes exceeded."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 8.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 8.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Set Player1's minutes to exceed allocation
    stamina_tracker.minutes_played["Player1"] = 8.5

    # Check substitutions
    events = manager.check_and_execute_substitutions(
        stamina_tracker=stamina_tracker,
        game_time_str="6:00"
    )

    assert len(events) >= 1
    assert any(e.player_out == "Player1" for e in events)
    assert any(e.reason == "minutes" for e in events)


def test_substitution_manager_no_trigger():
    """SubstitutionManager should not substitute when no triggers."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 12.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Check substitutions (all fresh)
    events = manager.check_and_execute_substitutions(
        stamina_tracker=stamina_tracker,
        game_time_str="11:00"
    )

    assert len(events) == 0


def test_substitution_manager_bench_exhausted():
    """SubstitutionManager should handle exhausted bench gracefully."""
    # Team with only 5 players (no bench)
    home_team = [create_test_player(f"HomePlayer{i+1}", "PG" if i==0 else "SG" if i==1 else "SF" if i==2 else "PF" if i==3 else "C") for i in range(5)]
    away_team = create_test_team(10)

    home_allocation = {f"HomePlayer{i+1}": 12.0 for i in range(5)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Deplete HomePlayer1's stamina
    stamina_tracker.stamina_state["HomePlayer1"] = 55.0

    # Check substitutions (should have no events since no bench)
    events = manager.check_and_execute_substitutions(
        stamina_tracker=stamina_tracker,
        game_time_str="8:00"
    )

    # No home team substitutions (no bench)
    home_events = [e for e in events if e.player_out in [f"HomePlayer{i+1}" for i in range(5)]]
    assert len(home_events) == 0

    # HomePlayer1 should still be active (no substitute available)
    home_active = manager.get_home_active()
    assert any(p['name'] == "HomePlayer1" for p in home_active)


def test_substitution_manager_multiple_simultaneous_subs():
    """SubstitutionManager should handle multiple subs in one check."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 12.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Deplete multiple players
    stamina_tracker.stamina_state["Player1"] = 55.0
    stamina_tracker.stamina_state["Player2"] = 58.0
    stamina_tracker.stamina_state["Player3"] = 59.0

    # Check substitutions
    events = manager.check_and_execute_substitutions(
        stamina_tracker=stamina_tracker,
        game_time_str="7:00"
    )

    assert len(events) >= 3


# =============================================================================
# HELPER FUNCTION TESTS
# =============================================================================

def test_calculate_quarter_allocations():
    """Should divide game minutes by 4."""
    total_allocations = {
        "Player1": 36,
        "Player2": 32,
        "Player3": 28,
        "Player4": 24,
        "Player5": 20,
    }

    quarter_allocations = calculate_quarter_allocations(total_allocations, 1)

    assert quarter_allocations["Player1"] == 9.0
    assert quarter_allocations["Player2"] == 8.0
    assert quarter_allocations["Player3"] == 7.0
    assert quarter_allocations["Player4"] == 6.0
    assert quarter_allocations["Player5"] == 5.0


def test_validate_minutes_allocation_valid():
    """Valid allocation should pass."""
    allocations = {
        "P1": 36,
        "P2": 32,
        "P3": 28,
        "P4": 24,
        "P5": 20,
        "P6": 20,
        "P7": 16,
        "P8": 16,
        "P9": 24,
        "P10": 24,
    }

    valid, msg = validate_minutes_allocation(allocations, 10)
    assert valid == True
    assert msg == ""


def test_validate_minutes_allocation_wrong_total():
    """Wrong total should fail."""
    allocations = {
        "P1": 36,
        "P2": 32,
    }

    valid, msg = validate_minutes_allocation(allocations, 2)
    assert valid == False
    assert "240" in msg


def test_validate_minutes_allocation_negative():
    """Negative minutes should fail."""
    allocations = {
        "P1": 36,
        "P2": -10,
        "P3": 214,
    }

    valid, msg = validate_minutes_allocation(allocations, 3)
    assert valid == False
    assert "negative" in msg.lower()


def test_validate_minutes_allocation_exceeds_48():
    """Minutes > 48 should fail."""
    allocations = {
        "P1": 50,
        "P2": 190,
    }

    valid, msg = validate_minutes_allocation(allocations, 2)
    assert valid == False
    assert "48" in msg


# =============================================================================
# EDGE CASE TESTS
# =============================================================================

def test_substitution_event_dataclass():
    """SubstitutionEvent should store all fields correctly."""
    event = SubstitutionEvent(
        quarter_time="8:32",
        player_out="Player1",
        player_in="Player6",
        reason="stamina",
        stamina_out=55.0,
        stamina_in=95.0
    )

    assert event.quarter_time == "8:32"
    assert event.player_out == "Player1"
    assert event.player_in == "Player6"
    assert event.reason == "stamina"
    assert event.stamina_out == 55.0
    assert event.stamina_in == 95.0


def test_substitution_manager_get_all_events():
    """Should track all substitution events."""
    home_team = create_test_team(10)
    away_team = create_test_team(10)

    home_allocation = {f"Player{i+1}": 12.0 for i in range(10)}
    away_allocation = {f"Player{i+1}": 12.0 for i in range(10)}

    manager = SubstitutionManager(
        home_team, away_team,
        home_allocation, away_allocation
    )

    # Create stamina tracker
    all_players = home_team + away_team
    stamina_tracker = StaminaTracker(all_players)

    # Trigger multiple substitutions
    stamina_tracker.stamina_state["Player1"] = 55.0
    manager.check_and_execute_substitutions(stamina_tracker, "10:00")

    stamina_tracker.stamina_state["Player2"] = 58.0
    manager.check_and_execute_substitutions(stamina_tracker, "8:00")

    all_events = manager.get_all_substitution_events()
    assert len(all_events) >= 2


def test_position_compatibility_all_combinations():
    """Test all position combinations systematically."""
    positions = ['PG', 'SG', 'SF', 'PF', 'C']

    # Expected compatibilities
    expected = {
        ('PG', 'PG'): True,
        ('PG', 'SG'): True,
        ('PG', 'SF'): False,
        ('PG', 'PF'): False,
        ('PG', 'C'): False,
        ('SG', 'PG'): True,
        ('SG', 'SG'): True,
        ('SG', 'SF'): False,
        ('SG', 'PF'): False,
        ('SG', 'C'): False,
        ('SF', 'PG'): False,
        ('SF', 'SG'): False,
        ('SF', 'SF'): True,
        ('SF', 'PF'): True,
        ('SF', 'C'): False,
        ('PF', 'PG'): False,
        ('PF', 'SG'): False,
        ('PF', 'SF'): True,
        ('PF', 'PF'): True,
        ('PF', 'C'): False,
        ('C', 'PG'): False,
        ('C', 'SG'): False,
        ('C', 'SF'): False,
        ('C', 'PF'): False,
        ('C', 'C'): True,
    }

    for (pos_out, pos_in), expected_result in expected.items():
        result = is_position_compatible(pos_out, pos_in)
        assert result == expected_result, f"{pos_out} -> {pos_in} expected {expected_result}, got {result}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
