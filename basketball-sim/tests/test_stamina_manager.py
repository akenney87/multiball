"""
Unit tests for stamina management system.

Validates:
- Stamina cost calculations
- Exponential recovery
- Attribute degradation
- Bounds enforcement
- Minutes tracking
- Reset functions
"""

import pytest
from src.systems.stamina_manager import (
    StaminaTracker,
    calculate_stamina_cost,
    recover_stamina,
    apply_stamina_cost,
    recover_bench_stamina,
    get_degraded_team
)
from src.core.probability import calculate_stamina_penalty


# =============================================================================
# FIXTURES
# =============================================================================

@pytest.fixture
def sample_player():
    """Create a sample player with all 25 attributes."""
    return {
        'name': 'Test Player',
        'position': 'PG',
        # Physical (12)
        'grip_strength': 80,
        'arm_strength': 75,
        'core_strength': 82,
        'agility': 88,
        'acceleration': 85,
        'top_speed': 83,
        'jumping': 78,
        'reactions': 90,
        'stamina': 86,
        'balance': 84,
        'height': 76,
        'durability': 80,
        # Mental (7)
        'awareness': 92,
        'creativity': 85,
        'determination': 88,
        'bravery': 82,
        'consistency': 87,
        'composure': 91,
        'patience': 84,
        # Technical (6)
        'hand_eye_coordination': 93,
        'throw_accuracy': 89,
        'form_technique': 90,
        'finesse': 86,
        'deception': 83,
        'teamwork': 88,
    }


@pytest.fixture
def sample_roster():
    """Create a sample 10-player roster (5 per team)."""
    players = []
    for i in range(10):
        player = {
            'name': f'Player {i+1}',
            'position': ['PG', 'SG', 'SF', 'PF', 'C'][i % 5],
            # Physical
            'grip_strength': 70 + i,
            'arm_strength': 70 + i,
            'core_strength': 70 + i,
            'agility': 70 + i,
            'acceleration': 70 + i,
            'top_speed': 70 + i,
            'jumping': 70 + i,
            'reactions': 70 + i,
            'stamina': 70 + i,
            'balance': 70 + i,
            'height': 70 + i,
            'durability': 70 + i,
            # Mental
            'awareness': 70 + i,
            'creativity': 70 + i,
            'determination': 70 + i,
            'bravery': 70 + i,
            'consistency': 70 + i,
            'composure': 70 + i,
            'patience': 70 + i,
            # Technical
            'hand_eye_coordination': 70 + i,
            'throw_accuracy': 70 + i,
            'form_technique': 70 + i,
            'finesse': 70 + i,
            'deception': 70 + i,
            'teamwork': 70 + i,
        }
        players.append(player)
    return players


# =============================================================================
# TEST STAMINA COST CALCULATION
# =============================================================================

def test_stamina_cost_standard_pace_non_option():
    """Standard pace, non-scoring option = 0.8 stamina."""
    cost = calculate_stamina_cost('standard', is_scoring_option=False)
    assert cost == 0.8


def test_stamina_cost_fast_pace_scoring_option():
    """Fast pace, scoring option = 0.8 + 0.3 + 0.2 = 1.3."""
    cost = calculate_stamina_cost('fast', is_scoring_option=True)
    assert cost == 1.3


def test_stamina_cost_slow_pace_non_option():
    """Slow pace, non-option = 0.8 - 0.3 = 0.5."""
    cost = calculate_stamina_cost('slow', is_scoring_option=False)
    assert cost == 0.5


def test_stamina_cost_transition_bonus():
    """Transition adds +0.1."""
    cost = calculate_stamina_cost('standard', is_scoring_option=False, is_transition=True)
    assert cost == 0.9  # 0.8 + 0.1


def test_stamina_cost_all_modifiers():
    """Fast, scoring option, transition = 0.8 + 0.3 + 0.2 + 0.1 = 1.4."""
    cost = calculate_stamina_cost('fast', is_scoring_option=True, is_transition=True)
    assert cost == pytest.approx(1.4, abs=0.01)


def test_stamina_cost_never_negative():
    """Even with negative modifiers, cost cannot go negative."""
    # Slow pace gives -0.3, but base is 0.8, so result is 0.5 (positive)
    cost = calculate_stamina_cost('slow')
    assert cost >= 0.0


# =============================================================================
# TEST STAMINA RECOVERY
# =============================================================================

def test_recover_stamina_at_50():
    """At 50 stamina, recover 8 * 0.5 = 4.0 per minute."""
    recovery = recover_stamina(50.0, 1.0)
    assert recovery == pytest.approx(4.0, abs=0.01)


def test_recover_stamina_at_80():
    """At 80 stamina, recover 8 * 0.2 = 1.6 per minute."""
    recovery = recover_stamina(80.0, 1.0)
    assert recovery == pytest.approx(1.6, abs=0.01)


def test_recover_stamina_at_0():
    """At 0 stamina, recover 8 * 1.0 = 8.0 per minute."""
    recovery = recover_stamina(0.0, 1.0)
    assert recovery == pytest.approx(8.0, abs=0.01)


def test_recover_stamina_at_100():
    """At 100 stamina, recover 8 * 0.0 = 0.0 per minute."""
    recovery = recover_stamina(100.0, 1.0)
    assert recovery == pytest.approx(0.0, abs=0.01)


def test_recover_stamina_multiple_minutes():
    """Recovery scales with minutes: at 60 for 2 minutes = 8 * 0.4 * 2 = 6.4."""
    recovery = recover_stamina(60.0, 2.0)
    assert recovery == pytest.approx(6.4, abs=0.01)


def test_recover_stamina_exponential_curve():
    """Lower stamina recovers faster (exponential curve)."""
    recovery_at_20 = recover_stamina(20.0, 1.0)  # 8 * 0.8 = 6.4
    recovery_at_80 = recover_stamina(80.0, 1.0)  # 8 * 0.2 = 1.6

    assert recovery_at_20 > recovery_at_80
    assert recovery_at_20 == pytest.approx(6.4, abs=0.01)
    assert recovery_at_80 == pytest.approx(1.6, abs=0.01)


# =============================================================================
# TEST STAMINA TRACKER INITIALIZATION
# =============================================================================

def test_tracker_initialization(sample_roster):
    """StaminaTracker initializes all players to their stamina attribute."""
    tracker = StaminaTracker(sample_roster)

    for player in sample_roster:
        stamina = tracker.get_current_stamina(player['name'])
        assert stamina == player['stamina']


def test_tracker_initial_minutes_zero(sample_roster):
    """All players start with 0 minutes played."""
    tracker = StaminaTracker(sample_roster)

    for player in sample_roster:
        minutes = tracker.get_minutes_played(player['name'])
        assert minutes == 0.0


def test_tracker_stores_original_players(sample_roster):
    """Tracker stores reference to original player dicts."""
    tracker = StaminaTracker(sample_roster)

    for player in sample_roster:
        assert player['name'] in tracker.original_players
        assert tracker.original_players[player['name']] == player


# =============================================================================
# TEST STAMINA DEPLETION
# =============================================================================

def test_apply_possession_cost_standard(sample_roster):
    """Apply standard pace cost to 5 active players."""
    tracker = StaminaTracker(sample_roster)

    # First 5 players are active
    active = sample_roster[:5]
    initial_stamina = [tracker.get_current_stamina(p['name']) for p in active]

    tracker.apply_possession_cost(active, 'standard', scoring_options=None)

    # Each should have lost 0.8 stamina
    for i, player in enumerate(active):
        new_stamina = tracker.get_current_stamina(player['name'])
        expected = initial_stamina[i] - 0.8
        assert new_stamina == pytest.approx(expected, abs=0.01)


def test_apply_possession_cost_with_scoring_option(sample_roster):
    """Scoring options lose extra 0.2 stamina."""
    tracker = StaminaTracker(sample_roster)

    active = sample_roster[:5]
    scoring_options = [active[0]['name'], active[1]['name']]  # First 2 are options

    initial_0 = tracker.get_current_stamina(active[0]['name'])
    initial_2 = tracker.get_current_stamina(active[2]['name'])

    tracker.apply_possession_cost(active, 'standard', scoring_options)

    # Player 0 (scoring option): loses 0.8 + 0.2 = 1.0
    assert tracker.get_current_stamina(active[0]['name']) == pytest.approx(initial_0 - 1.0, abs=0.01)

    # Player 2 (non-option): loses 0.8
    assert tracker.get_current_stamina(active[2]['name']) == pytest.approx(initial_2 - 0.8, abs=0.01)


def test_stamina_clamped_to_zero(sample_roster):
    """Stamina cannot go below 0."""
    tracker = StaminaTracker(sample_roster)

    # Manually set stamina very low
    tracker.stamina_state[sample_roster[0]['name']] = 0.3

    # Apply cost that would push below 0
    tracker.apply_possession_cost([sample_roster[0]], 'fast', scoring_options=[sample_roster[0]['name']])

    # Should be clamped to 0
    assert tracker.get_current_stamina(sample_roster[0]['name']) == 0.0


def test_stamina_clamped_to_100(sample_roster):
    """Stamina cannot exceed 100 after recovery."""
    tracker = StaminaTracker(sample_roster)

    # Set stamina to 95 manually
    tracker.stamina_state[sample_roster[0]['name']] = 95.0

    # Recover for enough time to exceed 100
    # At 95: recovery_rate = 8 * (1 - 0.95) = 0.4 per minute
    # To reach 100: need 5 stamina, so 5/0.4 = 12.5 minutes minimum
    # Use 20 minutes to definitely exceed
    tracker.recover_bench_stamina([sample_roster[0]], minutes_elapsed=20.0)

    # Should be clamped to 100
    assert tracker.get_current_stamina(sample_roster[0]['name']) == 100.0


# =============================================================================
# TEST STAMINA RECOVERY (BENCH)
# =============================================================================

def test_bench_recovery_single_minute(sample_roster):
    """Bench player at 50 stamina recovers 4.0 in 1 minute."""
    tracker = StaminaTracker(sample_roster)

    # Set player to 50 stamina
    player = sample_roster[5]
    tracker.stamina_state[player['name']] = 50.0

    # Recover for 1 minute
    tracker.recover_bench_stamina([player], minutes_elapsed=1.0)

    # Should be at 54.0
    assert tracker.get_current_stamina(player['name']) == pytest.approx(54.0, abs=0.01)


def test_bench_recovery_multiple_players(sample_roster):
    """Multiple bench players recover independently."""
    tracker = StaminaTracker(sample_roster)

    bench = sample_roster[5:8]
    tracker.stamina_state[bench[0]['name']] = 40.0
    tracker.stamina_state[bench[1]['name']] = 60.0
    tracker.stamina_state[bench[2]['name']] = 80.0

    tracker.recover_bench_stamina(bench, minutes_elapsed=1.0)

    # Player at 40: recovers 8 * 0.6 = 4.8 → 44.8
    assert tracker.get_current_stamina(bench[0]['name']) == pytest.approx(44.8, abs=0.01)

    # Player at 60: recovers 8 * 0.4 = 3.2 → 63.2
    assert tracker.get_current_stamina(bench[1]['name']) == pytest.approx(63.2, abs=0.01)

    # Player at 80: recovers 8 * 0.2 = 1.6 → 81.6
    assert tracker.get_current_stamina(bench[2]['name']) == pytest.approx(81.6, abs=0.01)


# =============================================================================
# TEST STAMINA DEGRADATION
# =============================================================================

def test_degraded_player_above_threshold(sample_player):
    """At 80+ stamina, no degradation applied."""
    tracker = StaminaTracker([sample_player])

    # Stamina is 86 (above 80 threshold)
    degraded = tracker.get_degraded_player(sample_player)

    # All attributes should be unchanged
    assert degraded['agility'] == sample_player['agility']
    assert degraded['awareness'] == sample_player['awareness']
    assert degraded['form_technique'] == sample_player['form_technique']


def test_degraded_player_below_threshold(sample_player):
    """Below 80 stamina, attributes degrade."""
    tracker = StaminaTracker([sample_player])

    # Set stamina to 60
    tracker.stamina_state[sample_player['name']] = 60.0

    degraded = tracker.get_degraded_player(sample_player)

    # Penalty at 60: 0.002 * (20)^1.3 ≈ 0.098 (9.8%)
    expected_penalty = calculate_stamina_penalty(60.0)

    # Check agility: 88 * (1 - penalty)
    expected_agility = sample_player['agility'] * (1.0 - expected_penalty)
    assert degraded['agility'] == pytest.approx(expected_agility, abs=0.5)

    # Check that attribute is degraded
    assert degraded['agility'] < sample_player['agility']


def test_degraded_player_at_40_stamina(sample_player):
    """At 40 stamina, penalty ≈ 24%."""
    tracker = StaminaTracker([sample_player])
    tracker.stamina_state[sample_player['name']] = 40.0

    degraded = tracker.get_degraded_player(sample_player)

    # Penalty at 40: 0.002 * (40)^1.3 ≈ 0.242 (24.2%)
    expected_penalty = calculate_stamina_penalty(40.0)
    assert expected_penalty == pytest.approx(0.242, abs=0.01)

    # All attributes should be degraded by ~24%
    for attr in ['agility', 'awareness', 'form_technique', 'jumping', 'composure']:
        original_value = sample_player[attr]
        degraded_value = degraded[attr]
        expected_value = original_value * (1.0 - expected_penalty)

        assert degraded_value == pytest.approx(expected_value, abs=0.5)
        assert degraded_value < original_value


def test_degraded_player_all_25_attributes(sample_player):
    """Degradation applies to ALL 25 attributes uniformly."""
    tracker = StaminaTracker([sample_player])
    tracker.stamina_state[sample_player['name']] = 50.0

    degraded = tracker.get_degraded_player(sample_player)

    expected_penalty = calculate_stamina_penalty(50.0)

    # Check all 25 attributes
    all_attributes = [
        # Physical
        'grip_strength', 'arm_strength', 'core_strength', 'agility',
        'acceleration', 'top_speed', 'jumping', 'reactions',
        'stamina', 'balance', 'height', 'durability',
        # Mental
        'awareness', 'creativity', 'determination', 'bravery',
        'consistency', 'composure', 'patience',
        # Technical
        'hand_eye_coordination', 'throw_accuracy', 'form_technique',
        'finesse', 'deception', 'teamwork',
    ]

    for attr in all_attributes:
        original = sample_player[attr]
        degraded_val = degraded[attr]
        expected = original * (1.0 - expected_penalty)

        # Attributes floor at 1.0, so use max(1.0, expected)
        expected = max(1.0, expected)
        assert degraded_val == pytest.approx(expected, abs=0.5)


def test_degraded_player_floor_at_1():
    """Attributes cannot drop below 1, even with max degradation."""
    player = {
        'name': 'Weak Player',
        'agility': 5,
        'awareness': 3,
        'form_technique': 2,
        'stamina': 100,
        # ... other attributes
    }

    tracker = StaminaTracker([player])
    tracker.stamina_state['Weak Player'] = 0.0  # Max degradation

    degraded = tracker.get_degraded_player(player)

    # At 0 stamina, penalty is massive, but attributes floor at 1
    assert degraded['agility'] >= 1.0
    assert degraded['awareness'] >= 1.0
    assert degraded['form_technique'] >= 1.0


def test_degraded_player_does_not_modify_original(sample_player):
    """get_degraded_player() does not modify original player dict."""
    tracker = StaminaTracker([sample_player])
    tracker.stamina_state[sample_player['name']] = 40.0

    original_agility = sample_player['agility']

    degraded = tracker.get_degraded_player(sample_player)

    # Original should be unchanged
    assert sample_player['agility'] == original_agility
    assert degraded['agility'] != original_agility


# =============================================================================
# TEST MINUTES TRACKING
# =============================================================================

def test_add_minutes_converts_seconds(sample_roster):
    """add_minutes() converts seconds to minutes."""
    tracker = StaminaTracker(sample_roster)

    player = sample_roster[0]

    # Add 120 seconds (2 minutes)
    tracker.add_minutes(player['name'], 120.0)

    assert tracker.get_minutes_played(player['name']) == pytest.approx(2.0, abs=0.01)


def test_add_minutes_accumulates(sample_roster):
    """Multiple add_minutes() calls accumulate."""
    tracker = StaminaTracker(sample_roster)

    player = sample_roster[0]

    tracker.add_minutes(player['name'], 60.0)  # +1 min
    tracker.add_minutes(player['name'], 90.0)  # +1.5 min
    tracker.add_minutes(player['name'], 30.0)  # +0.5 min

    assert tracker.get_minutes_played(player['name']) == pytest.approx(3.0, abs=0.01)


# =============================================================================
# TEST RESET FUNCTIONS
# =============================================================================

def test_reset_stamina_single_player(sample_roster):
    """reset_stamina() restores player to original stamina."""
    tracker = StaminaTracker(sample_roster)

    player = sample_roster[0]
    original_stamina = player['stamina']

    # Deplete stamina
    tracker.stamina_state[player['name']] = 40.0

    # Reset
    tracker.reset_stamina(player['name'])

    assert tracker.get_current_stamina(player['name']) == original_stamina


def test_reset_quarter_all_players(sample_roster):
    """reset_quarter() sets all stamina to 100, keeps minutes."""
    tracker = StaminaTracker(sample_roster)

    # Deplete stamina and add minutes
    for player in sample_roster[:3]:
        tracker.stamina_state[player['name']] = 50.0
        tracker.add_minutes(player['name'], 360.0)  # 6 minutes

    # Reset quarter
    tracker.reset_quarter()

    # All stamina should be 100
    for player in sample_roster:
        assert tracker.get_current_stamina(player['name']) == 100.0

    # Minutes should be preserved
    for player in sample_roster[:3]:
        assert tracker.get_minutes_played(player['name']) == pytest.approx(6.0, abs=0.01)


def test_reset_game_clears_everything(sample_roster):
    """reset_game() sets stamina to 100 and clears minutes."""
    tracker = StaminaTracker(sample_roster)

    # Deplete stamina and add minutes
    for player in sample_roster[:3]:
        tracker.stamina_state[player['name']] = 30.0
        tracker.add_minutes(player['name'], 600.0)  # 10 minutes

    # Reset game
    tracker.reset_game()

    # All stamina should be 100
    for player in sample_roster:
        assert tracker.get_current_stamina(player['name']) == 100.0

    # Minutes should be cleared
    for player in sample_roster:
        assert tracker.get_minutes_played(player['name']) == 0.0


# =============================================================================
# TEST HELPER FUNCTIONS
# =============================================================================

def test_get_degraded_team(sample_roster):
    """get_degraded_team() returns degraded copies of all players."""
    tracker = StaminaTracker(sample_roster)

    # Set varying stamina levels
    tracker.stamina_state[sample_roster[0]['name']] = 90.0  # No degradation
    tracker.stamina_state[sample_roster[1]['name']] = 60.0  # Some degradation

    degraded_team = get_degraded_team(sample_roster[:2], tracker)

    # Should return list of degraded players
    assert len(degraded_team) == 2

    # Player 0 at 90: no degradation
    assert degraded_team[0]['agility'] == sample_roster[0]['agility']

    # Player 1 at 60: some degradation
    assert degraded_team[1]['agility'] < sample_roster[1]['agility']


def test_get_all_stamina_values(sample_roster):
    """get_all_stamina_values() returns dict copy."""
    tracker = StaminaTracker(sample_roster)

    all_stamina = tracker.get_all_stamina_values()

    # Should return dict with all player names
    assert len(all_stamina) == len(sample_roster)

    for player in sample_roster:
        assert player['name'] in all_stamina
        assert all_stamina[player['name']] == tracker.get_current_stamina(player['name'])

    # Should be a copy (modifying it doesn't affect tracker)
    all_stamina[sample_roster[0]['name']] = 999.0
    assert tracker.get_current_stamina(sample_roster[0]['name']) != 999.0


# =============================================================================
# TEST EDGE CASES
# =============================================================================

def test_player_not_found_raises_error(sample_roster):
    """Accessing non-existent player raises KeyError."""
    tracker = StaminaTracker(sample_roster)

    with pytest.raises(KeyError):
        tracker.get_current_stamina('Nonexistent Player')

    with pytest.raises(KeyError):
        tracker.get_minutes_played('Nonexistent Player')

    with pytest.raises(KeyError):
        tracker.add_minutes('Nonexistent Player', 60.0)


def test_stamina_penalty_formula_matches_spec():
    """Validate stamina penalty formula with corrected coefficient."""
    # At 80: penalty = 0
    assert calculate_stamina_penalty(80.0) == pytest.approx(0.0, abs=0.001)

    # At 60: penalty = 0.002 * (20)^1.3 ≈ 0.098 (9.8%)
    assert calculate_stamina_penalty(60.0) == pytest.approx(0.098, abs=0.003)

    # At 40: penalty = 0.002 * (40)^1.3 ≈ 0.242 (24.2%)
    assert calculate_stamina_penalty(40.0) == pytest.approx(0.242, abs=0.005)

    # At 20: penalty = 0.002 * (60)^1.3 ≈ 0.410 (41.0%)
    assert calculate_stamina_penalty(20.0) == pytest.approx(0.410, abs=0.010)

    # At 0: penalty = 0.002 * (80)^1.3 ≈ 0.596 (59.6%), capped at 1.0
    penalty_at_0 = calculate_stamina_penalty(0.0)
    assert penalty_at_0 > 0.50  # Significant degradation
    assert penalty_at_0 <= 1.0  # Capped at 100%


def test_realistic_quarter_simulation(sample_roster):
    """Simulate 25 possessions to validate realistic stamina degradation."""
    tracker = StaminaTracker(sample_roster)

    active = sample_roster[:5]  # Starters
    bench = sample_roster[5:]

    scoring_options = [active[0]['name'], active[1]['name']]

    # Simulate 25 possessions (typical quarter)
    for i in range(25):
        # Apply cost to active players
        tracker.apply_possession_cost(active, 'standard', scoring_options)

        # Recover bench
        tracker.recover_bench_stamina(bench, minutes_elapsed=0.5)

        # Add 30 seconds to active players
        for player in active:
            tracker.add_minutes(player['name'], 30.0)

    # After 25 possessions:
    # - Active players: 25 * 1.0 (option) or 25 * 0.8 (non-option) cost
    # - Bench players: should be near 100 (recovering)

    # Scoring option 1: lost ~25 stamina, starting from 70 → ~45
    player0_stamina = tracker.get_current_stamina(active[0]['name'])
    assert player0_stamina < 50.0  # Should be fatigued

    # Non-option: lost ~20 stamina, starting from 72 → ~52
    player2_stamina = tracker.get_current_stamina(active[2]['name'])
    assert player2_stamina > 45.0
    assert player2_stamina < 60.0

    # Bench players: should be high (recovering exponentially)
    # Starting from 75, after 25 * 0.5 = 12.5 minutes of recovery
    # This is complex to calculate exactly, so just check it increased significantly
    bench0_stamina = tracker.get_current_stamina(bench[0]['name'])
    assert bench0_stamina > bench[0]['stamina']  # Should have recovered above initial

    # Minutes: each active player should have ~12.5 minutes
    for player in active:
        minutes = tracker.get_minutes_played(player['name'])
        assert minutes == pytest.approx(12.5, abs=0.1)  # 25 * 30 sec = 750 sec = 12.5 min
