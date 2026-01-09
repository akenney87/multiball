"""
Test to reproduce the end-game clock bug.

Simulates the scenario:
- 7 seconds remaining
- Intentional foul takes 6 seconds (1-3s for foul + 4s for 2 FTs)
- Should have 1 second remaining for next possession
- But game ends instead
"""

import sys
sys.path.append('C:\\Users\\alexa\\desktop\\projects\\simulator')

from src.systems.game_clock import GameClock

def test_clock_bug():
    """Test the clock tick scenario."""
    clock = GameClock(quarter_length_minutes=12)

    # Simulate game progressing to final seconds
    # 12 minutes = 720 seconds, so 7 seconds left means 713 elapsed
    clock.tick(713)

    print(f"Starting time: {clock.format_time()} ({clock.get_time_remaining()}s)")
    print(f"Is quarter over? {clock.is_quarter_over()}")
    print()

    # Intentional foul possession
    elapsed_time_seconds = 6.0  # 1-3s foul + 4s for 2 FTs
    possession_duration_sec = int(round(elapsed_time_seconds))

    print(f"Possession elapsed time: {elapsed_time_seconds}s")
    print(f"Possession duration (rounded): {possession_duration_sec}s")
    print()

    # Log play-by-play BEFORE tick (this is what quarter_simulation.py does)
    print(f"[{clock.format_time()}] Intentional foul happens")

    # Tick the clock
    remaining_after_tick = clock.tick(possession_duration_sec)

    print(f"After tick: {clock.format_time()} ({remaining_after_tick}s)")
    print(f"Is quarter over? {clock.is_quarter_over()}")
    print()

    # Check if next possession should start
    if not clock.is_quarter_over():
        print("✓ CORRECT: Next possession should start!")
    else:
        print("✗ BUG: Quarter ended prematurely!")

if __name__ == '__main__':
    test_clock_bug()
