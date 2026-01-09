"""
Basketball Simulator - Game Clock System

Manages quarter clock and possession duration calculation.

Key Responsibilities:
1. Track time remaining in quarter (12 minutes = 720 seconds)
2. Calculate realistic possession durations (based on pace)
3. Handle end-of-quarter logic
4. Prevent negative time values

Integrates with:
- src/systems/quarter_simulation.py (main loop)
- src/systems/play_by_play.py (timestamps)
"""

import random
from typing import Dict, List, Optional, Tuple


# =============================================================================
# POSSESSION DURATION CALCULATION
# =============================================================================

def calculate_possession_duration(
    pace: str,
    is_transition: bool = False
) -> int:
    """
    Calculate possession duration in seconds (probabilistic with variance).

    Uses triangular distribution to weight toward target averages while
    allowing variance. Fast pace teams CAN have 20s possessions occasionally.

    Args:
        pace: 'fast', 'standard', 'slow'
        is_transition: True if possession is transition (faster)

    Returns:
        Possession duration in seconds (integer)

    Target Averages & Ranges (M4.5 TUNED, M4.6 UPDATED):
        Fast pace: 12.8s avg (range 7.7-17.9s, mode 12.8s) → 113 poss/team/game (+12.5%)
        Standard pace: 14.4s avg (range 8.6-20.2s, mode 14.4s) → 100 poss/team/game
        Slow pace: 16.5s avg (range 9.9-23.1s, mode 16.5s) → 87 poss/team/game (-12.5%)
        Transition: 8s avg (range 6-12s, fast break)

    Distribution: Triangular (weighted toward mode, allows outliers)

    M4.5 Tuning Notes:
        - Original settings produced ~88 possessions/team/game (standard pace)
        - Adjusted to match NBA target of ~100 possessions/team/game
        - Reduced average possession duration by ~12% across all pace settings

    M4.6 Tuning Notes:
        - Increased pace differentiation to meet specification (+/-10-15%)
        - FAST pace now 12.5% faster (was ~5%), SLOW pace now 12.5% slower (was ~5%)
        - Verified via tactical validation testing (150 games)

    Examples:
        >>> random.seed(42)
        >>> calculate_possession_duration('standard', False)
        14
        >>> calculate_possession_duration('fast', False)
        13
        >>> calculate_possession_duration('slow', False)
        15
        >>> calculate_possession_duration('standard', True)
        8
    """
    # Transition possessions are fast breaks
    if is_transition:
        # Fast break: 6-12 seconds, mode at 8
        duration = random.triangular(6, 12, 8)
    else:
        # M4.5 TUNED: Pace-specific ranges targeting NBA possession counts
        # M4.6 UPDATE: Increased pace differentiation to meet +/-10-15% spec
        if pace == 'fast':
            # Fast pace: 7.7-17.9s, mode 12.8s → ~113 possessions/team/game (+12.5%)
            duration = random.triangular(7.7, 17.9, 12.8)
        elif pace == 'standard':
            # Standard pace: 8.6-20.2s, mode 14.4s → ~100 possessions/team/game
            duration = random.triangular(8.6, 20.2, 14.4)
        elif pace == 'slow':
            # Slow pace: 9.9-23.1s, mode 16.5s → ~87 possessions/team/game (-12.5%)
            duration = random.triangular(9.9, 23.1, 16.5)
        else:
            raise ValueError(f"Invalid pace: {pace}. Must be 'fast', 'standard', or 'slow'")

    return int(round(duration))


def estimate_possessions_per_quarter(pace: str) -> int:
    """
    Estimate total possessions for quarter based on pace.

    Args:
        pace: 'fast', 'standard', 'slow'

    Returns:
        Estimated possession count (integer)

    Calculation (M4.5 TUNED, M4.6 UPDATED):
        12 minutes = 720 seconds
        - fast: 720/12.8 ≈ 56.3 possessions (total) → 28.1 per team (+12.5%)
        - standard: 720/14.4 = 50.0 possessions (total) → 25.0 per team
        - slow: 720/16.5 ≈ 43.6 possessions (total) → 21.8 per team (-12.5%)

    Note: M4.6 increased pace differentiation to meet +/-10-15% specification.

    Examples:
        >>> estimate_possessions_per_quarter('fast')
        56
        >>> estimate_possessions_per_quarter('standard')
        50
        >>> estimate_possessions_per_quarter('slow')
        44
    """
    quarter_seconds = 720

    if pace == 'fast':
        avg_duration = 12.8  # M4.6 UPDATED for +12.5% possessions
    elif pace == 'standard':
        avg_duration = 14.4  # M4.5 TUNED
    elif pace == 'slow':
        avg_duration = 16.5  # M4.6 UPDATED for -12.5% possessions
    else:
        raise ValueError(f"Invalid pace: {pace}. Must be 'fast', 'standard', or 'slow'")

    return int(round(quarter_seconds / avg_duration))


# =============================================================================
# GAME CLOCK CLASS
# =============================================================================

class GameClock:
    """
    Manages quarter clock and possession counting.

    Tracks time remaining and provides methods for time management.

    Attributes:
        total_seconds: Total quarter length in seconds (default 720)
        elapsed_seconds: Time elapsed since start of quarter
    """

    def __init__(self, quarter_length_minutes: int = 12):
        """
        Initialize game clock.

        Args:
            quarter_length_minutes: Length of quarter in minutes (default 12)

        Examples:
            >>> clock = GameClock()
            >>> clock.get_time_remaining()
            720
            >>> clock.format_time()
            '12:00'
        """
        self.total_seconds = quarter_length_minutes * 60
        self.elapsed_seconds = 0

    def tick(self, duration: int) -> int:
        """
        Advance clock by duration.

        Args:
            duration: Seconds to deduct from clock

        Returns:
            Time remaining after tick (clamped to 0)

        Side Effects:
            Updates elapsed_seconds

        Examples:
            >>> clock = GameClock()
            >>> clock.tick(30)
            690
            >>> clock.tick(700)
            0
            >>> clock.tick(10)  # Already at 0
            0
        """
        self.elapsed_seconds += duration

        # Never go negative
        if self.elapsed_seconds > self.total_seconds:
            self.elapsed_seconds = self.total_seconds

        return self.get_time_remaining()

    def get_time_remaining(self) -> int:
        """
        Get current time remaining.

        Returns:
            Seconds remaining (0-720)

        Examples:
            >>> clock = GameClock()
            >>> clock.tick(120)
            600
            >>> clock.get_time_remaining()
            600
        """
        remaining = self.total_seconds - self.elapsed_seconds
        return max(0, remaining)

    def is_quarter_over(self) -> bool:
        """
        Check if quarter has ended.

        Returns:
            True if time_remaining <= 0

        Examples:
            >>> clock = GameClock()
            >>> clock.is_quarter_over()
            False
            >>> clock.tick(720)
            0
            >>> clock.is_quarter_over()
            True
        """
        return self.get_time_remaining() <= 0

    def is_final_possession(self, avg_possession_duration: int = 30) -> bool:
        """
        Check if this is the final possession of quarter.

        Heuristic: If time_remaining < avg_possession_duration, it's likely final.

        Args:
            avg_possession_duration: Expected possession length (default 30 sec)

        Returns:
            True if this should be the last possession

        Examples:
            >>> clock = GameClock()
            >>> clock.is_final_possession()
            False
            >>> clock.tick(695)  # 25 seconds left
            25
            >>> clock.is_final_possession()
            True
        """
        return self.get_time_remaining() < avg_possession_duration

    def reset(self) -> None:
        """
        Reset clock to start of quarter.

        Examples:
            >>> clock = GameClock()
            >>> clock.tick(300)
            420
            >>> clock.reset()
            >>> clock.get_time_remaining()
            720
        """
        self.elapsed_seconds = 0

    def format_time(self) -> str:
        """
        Format time remaining as MM:SS.

        Returns:
            Formatted string (e.g., "11:45", "08:12", "00:23")

        Examples:
            >>> clock = GameClock()
            >>> clock.format_time()
            '12:00'
            >>> clock.tick(195)
            525
            >>> clock.format_time()
            '08:45'
            >>> clock.tick(525)
            0
            >>> clock.format_time()
            '00:00'
        """
        remaining = self.get_time_remaining()
        minutes = remaining // 60
        seconds = remaining % 60
        return f"{minutes:02d}:{seconds:02d}"

    def get_time_remaining_formatted(self) -> str:
        """
        Alias for format_time() for backwards compatibility.

        Returns:
            Formatted string (e.g., "11:45")
        """
        return self.format_time()

    def advance_clock(self, seconds: int) -> None:
        """
        Alias for tick() for backwards compatibility.

        Args:
            seconds: Seconds to advance

        Side Effects:
            Updates elapsed_seconds
        """
        self.tick(seconds)


# =============================================================================
# QUARTER FLOW HELPERS
# =============================================================================

def should_end_quarter(
    clock: GameClock,
    possession_started: bool
) -> bool:
    """
    Determine if quarter should end.

    Rules:
    - If possession not started and time < 25 sec: end quarter
    - If possession started: allow it to complete
    - Never cut off mid-possession

    Args:
        clock: GameClock instance
        possession_started: True if possession has begun

    Returns:
        True if quarter should end now

    Examples:
        >>> clock = GameClock()
        >>> clock.tick(695)  # 25 seconds left
        25
        >>> should_end_quarter(clock, False)
        False
        >>> clock.tick(5)  # 20 seconds left
        20
        >>> should_end_quarter(clock, False)
        True
        >>> should_end_quarter(clock, True)  # Possession in progress
        False
    """
    # If possession already started, let it finish
    if possession_started:
        return False

    # If time expired, end quarter
    if clock.is_quarter_over():
        return True

    # If less than 25 seconds and no possession started, end quarter
    # (not enough time for a meaningful possession)
    if clock.get_time_remaining() < 25:
        return True

    return False


def simulate_quarter_clock(
    pace: str,
    seed: Optional[int] = None
) -> List[Dict]:
    """
    Simulate possession timing for entire quarter.

    Args:
        pace: 'fast', 'standard', 'slow'
        seed: Random seed for reproducibility (optional)

    Returns:
        List of possession timing info:
        [
            {
                'possession_num': 1,
                'start_time': '12:00',
                'duration': 28,
                'end_time': '11:32'
            },
            ...
        ]

    Examples:
        >>> results = simulate_quarter_clock('standard', seed=42)
        >>> len(results)
        24
        >>> results[0]['start_time']
        '12:00'
        >>> results[-1]['possession_num']
        24
    """
    if seed is not None:
        random.seed(seed)

    clock = GameClock()
    possessions = []
    possession_num = 1

    while not should_end_quarter(clock, possession_started=False):
        start_time = clock.format_time()
        duration = calculate_possession_duration(pace)

        # Advance clock
        clock.tick(duration)
        end_time = clock.format_time()

        possessions.append({
            'possession_num': possession_num,
            'start_time': start_time,
            'duration': duration,
            'end_time': end_time
        })

        possession_num += 1

    return possessions


# =============================================================================
# VALIDATION UTILITIES
# =============================================================================

def validate_possession_counts(
    pace: str,
    num_simulations: int = 100,
    seed: Optional[int] = None
) -> Dict:
    """
    Validate that possession counts match expected ranges.

    Args:
        pace: 'fast', 'standard', 'slow'
        num_simulations: Number of quarters to simulate
        seed: Random seed for reproducibility

    Returns:
        Dict with statistics:
        {
            'pace': str,
            'expected': int,
            'min': int,
            'max': int,
            'avg': float,
            'all_counts': List[int]
        }

    Expected Ranges:
        - Fast: 60-85 possessions (avg ~72)
        - Standard: 40-56 possessions (avg ~48)
        - Slow: 30-42 possessions (avg ~36)
    """
    if seed is not None:
        random.seed(seed)

    counts = []

    for _ in range(num_simulations):
        possessions = simulate_quarter_clock(pace)
        counts.append(len(possessions))

    return {
        'pace': pace,
        'expected': estimate_possessions_per_quarter(pace),
        'min': min(counts),
        'max': max(counts),
        'avg': sum(counts) / len(counts),
        'all_counts': counts
    }
