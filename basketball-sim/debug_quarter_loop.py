"""
Debug the quarter simulation loop to see why it's exiting early.

Add logging to trace the exact execution flow.
"""

import sys
sys.path.insert(0, '.')

# Patch the QuarterSimulator to add debug logging
import src.systems.quarter_simulation as qs_module
original_simulate_quarter = qs_module.QuarterSimulator.simulate_quarter

def patched_simulate_quarter(self, seed=None):
    """Patched version with debug logging."""
    import random
    if seed is not None:
        random.seed(seed)

    # [Copy logic from original but add logging for final possessions]
    # For brevity, just log key checkpoints

    home_has_possession = True
    possession_count = 0

    # Simple implementation: just monitor the main loop
    from src.systems.possession_state import PossessionState, DeadBallReason
    possession_state = PossessionState(starting_team='home')

    print(f"\n{'='*80}")
    print(f"QUARTER {self.quarter_number} STARTING - DEBUG MODE")
    print(f"{'='*80}\n")

    iteration = 0
    MAX_ITERATIONS = 200

    while not self.game_clock.is_quarter_over() and iteration < MAX_ITERATIONS:
        iteration += 1
        time_remaining = self.game_clock.get_time_remaining()

        # Log only final 10 seconds
        if time_remaining <= 10:
            print(f"[DEBUG] Iteration {iteration}: time_remaining={time_remaining}s, possession_count={possession_count}")
            print(f"        is_quarter_over()={self.game_clock.is_quarter_over()}")

        # ... rest of simulation (call original implementation)
        # For now, just break to avoid infinite loop
        if iteration >= MAX_ITERATIONS:
            print(f"[DEBUG] Hit max iterations safety limit")
            break

        # Simulate minimal possession (just tick clock)
        self.game_clock.tick(14)  # avg possession
        possession_count += 1

    print(f"\n[DEBUG] Loop exited after {iteration} iterations")
    print(f"[DEBUG] Final time_remaining: {self.game_clock.get_time_remaining()}s")
    print(f"[DEBUG] is_quarter_over(): {self.game_clock.is_quarter_over()}")
    print(f"[DEBUG] Total possessions: {possession_count}\n")

    # Call original for real result
    return self._build_quarter_result()

# Apply patch
qs_module.QuarterSimulator.simulate_quarter = patched_simulate_quarter

# Now run a game
from src.game_simulator import GameSimulator
from src.core.tactical_settings import TacticalSettings
from src.data.team_loader import load_team

print("Loading teams...")
team1 = load_team('Team_001')
team2 = load_team('Team_002')

tactical = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={p['name']: 48 for p in team1['roster'][:5]},
    rebounding_strategy='standard'
)

tactical2 = TacticalSettings(
    pace='standard',
    man_defense_pct=50,
    scoring_option_1=None,
    scoring_option_2=None,
    scoring_option_3=None,
    minutes_allotment={p['name']: 48 for p in team2['roster'][:5]},
    rebounding_strategy='standard'
)

print("Simulating game...\n")
game_sim = GameSimulator(
    home_team=team1,
    away_team=team2,
    tactical_home=tactical,
    tactical_away=tactical2
)

# Only simulate one quarter for speed
result = game_sim.simulate_game()

print(f"\nFinal: {result.home_score} - {result.away_score}")
