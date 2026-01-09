"""
Test the full end-game scenario to find where the loop exits.

Simulates:
1. Team_002 on offense at 7 seconds (ahead 74-78)
2. Team_001 fouls (6 seconds elapse)
3. FTs made (score: 74-80)
4. Team_001 should get possession with 1 second left
"""

import sys
sys.path.append('C:\\Users\\alexa\\desktop\\projects\\simulator')

# Simple mock to trace execution
class MockGameClock:
    def __init__(self):
        self.time_remaining = 7

    def is_quarter_over(self):
        result = self.time_remaining <= 0
        print(f"  is_quarter_over() called: time_remaining={self.time_remaining}, returning {result}")
        return result

    def tick(self, seconds):
        print(f"  tick({seconds}) called: {self.time_remaining}s -> ", end='')
        self.time_remaining -= seconds
        print(f"{self.time_remaining}s")
        return self.time_remaining

    def get_time_remaining(self):
        return self.time_remaining

def simulate_loop():
    """Simulate the main quarter loop."""
    clock = MockGameClock()
    possession_count = 0

    print("Starting main quarter loop simulation:")
    print(f"Initial time: {clock.time_remaining}s\n")

    # Iteration 1: Intentional foul possession
    print(f"=== Iteration {possession_count + 1} ===")
    print(f"Loop condition check:")
    if clock.is_quarter_over():
        print("Loop exits - quarter is over")
        return

    print(f"Simulating possession (intentional foul)...")
    print(f"  Elapsed time: 6 seconds (1-3s foul + 4s for 2 FTs)")
    clock.tick(6)
    possession_count += 1
    print()

    # Iteration 2: Fouling team's final possession
    print(f"=== Iteration {possession_count + 1} ===")
    print(f"Loop condition check:")
    if clock.is_quarter_over():
        print("** BUG: Loop exits - quarter is over (but shouldn't be!) **")
        return

    print(f"Simulating possession (final shot attempt)...")
    print(f"  This possession should happen with {clock.time_remaining}s remaining!")
    print(f"  SUCCESS: Fouling team gets their final possession")

if __name__ == '__main__':
    simulate_loop()
