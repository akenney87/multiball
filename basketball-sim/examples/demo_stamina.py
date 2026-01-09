"""
Stamina System Demonstration

Simulates a realistic quarter to show:
- Stamina depletion over 25 possessions
- Exponential bench recovery
- Attribute degradation at various stamina levels
- Minutes tracking
"""

from src.systems.stamina_manager import StaminaTracker
from src.core.probability import calculate_stamina_penalty


def create_demo_player(name, position, base_rating=80):
    """Create a demo player with all 25 attributes."""
    return {
        'name': name,
        'position': position,
        # Physical (12)
        'grip_strength': base_rating,
        'arm_strength': base_rating,
        'core_strength': base_rating,
        'agility': base_rating,
        'acceleration': base_rating,
        'top_speed': base_rating,
        'jumping': base_rating,
        'reactions': base_rating,
        'stamina': base_rating,
        'balance': base_rating,
        'height': base_rating,
        'durability': base_rating,
        # Mental (7)
        'awareness': base_rating,
        'creativity': base_rating,
        'determination': base_rating,
        'bravery': base_rating,
        'consistency': base_rating,
        'composure': base_rating,
        'patience': base_rating,
        # Technical (6)
        'hand_eye_coordination': base_rating,
        'throw_accuracy': base_rating,
        'form_technique': base_rating,
        'finesse': base_rating,
        'deception': base_rating,
        'teamwork': base_rating,
    }


def print_header(text):
    """Print a formatted header."""
    print(f"\n{'=' * 80}")
    print(f"{text:^80}")
    print(f"{'=' * 80}\n")


def print_player_stamina(tracker, players, title):
    """Print current stamina for a list of players."""
    print(f"\n{title}:")
    for player in players:
        stamina = tracker.get_current_stamina(player['name'])
        penalty = calculate_stamina_penalty(stamina)
        penalty_pct = penalty * 100

        status = "FRESH" if stamina >= 80 else f"FATIGUED (-{penalty_pct:.1f}%)"
        print(f"  {player['name']:<15} Stamina: {stamina:5.1f}/100  [{status}]")


def demo_stamina_degradation_curve():
    """Demonstrate attribute degradation at different stamina levels."""
    print_header("Stamina Degradation Curve (Polynomial Formula)")

    print("Formula: penalty = 0.002 * (80 - stamina)^1.3")
    print("\nStamina Level -> Penalty% -> Effective Attribute (if base = 90)")
    print("-" * 70)

    test_player = create_demo_player("Test Player", "PG", base_rating=90)

    for stamina_level in [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0]:
        penalty = calculate_stamina_penalty(stamina_level)
        penalty_pct = penalty * 100

        # Example: agility at 90 base
        effective_agility = max(1.0, test_player['agility'] * (1 - penalty))

        status = ""
        if stamina_level >= 80:
            status = "(No degradation)"
        elif stamina_level >= 60:
            status = "(Moderate fatigue)"
        elif stamina_level >= 40:
            status = "(Significant fatigue)"
        elif stamina_level >= 20:
            status = "(Heavy fatigue)"
        else:
            status = "(Near exhaustion)"

        print(f"  {stamina_level:3.0f} stamina -> {penalty_pct:5.1f}% penalty -> "
              f"Agility: {effective_agility:5.1f}/90  {status}")


def demo_quarter_simulation():
    """Simulate a full quarter with starters and bench."""
    print_header("Quarter Simulation (25 Possessions)")

    # Create team
    starters = [
        create_demo_player("Stephen Curry", "PG", 95),
        create_demo_player("Klay Thompson", "SG", 88),
        create_demo_player("Andrew Wiggins", "SF", 82),
        create_demo_player("Draymond Green", "PF", 85),
        create_demo_player("Kevon Looney", "C", 78),
    ]

    bench = [
        create_demo_player("Jordan Poole", "PG", 80),
        create_demo_player("Gary Payton II", "SG", 75),
        create_demo_player("Jonathan Kuminga", "SF", 76),
    ]

    all_players = starters + bench
    tracker = StaminaTracker(all_players)

    # Scoring options (higher usage = more fatigue)
    scoring_options = ['Stephen Curry', 'Klay Thompson']

    print("Configuration:")
    print(f"  Pace: Standard (0.8 stamina/possession base)")
    print(f"  Scoring Options: {', '.join(scoring_options)} (+0.2 stamina cost)")
    print(f"  Possessions: 25 (typical quarter)")
    print(f"  Possession Duration: 30 seconds average\n")

    # Print initial stamina
    print_player_stamina(tracker, starters, "STARTING LINEUP - Initial Stamina")
    print_player_stamina(tracker, bench, "BENCH - Initial Stamina")

    # Simulate quarter
    print(f"\n{'-' * 80}")
    print("SIMULATING QUARTER...")
    print(f"{'-' * 80}\n")

    for possession in range(1, 26):
        # Apply stamina cost to active players (starters)
        tracker.apply_possession_cost(starters, 'standard', scoring_options, is_transition=False)

        # Bench recovers (30 seconds = 0.5 minutes)
        tracker.recover_bench_stamina(bench, minutes_elapsed=0.5)

        # Add minutes to active players
        for player in starters:
            tracker.add_minutes(player['name'], 30.0)

        # Print progress at key intervals
        if possession in [5, 10, 15, 20, 25]:
            print(f"After Possession {possession}:")
            for player in starters:
                stamina = tracker.get_current_stamina(player['name'])
                minutes = tracker.get_minutes_played(player['name'])
                penalty = calculate_stamina_penalty(stamina)

                symbol = "***" if stamina < 60 else "**" if stamina < 70 else "*" if stamina < 80 else " "
                print(f"  {symbol} {player['name']:<20} "
                      f"Stamina: {stamina:5.1f}  "
                      f"Minutes: {minutes:4.1f}  "
                      f"Penalty: {penalty*100:5.1f}%")
            print()

    # Final summary
    print_header("QUARTER COMPLETE - Final State")

    print_player_stamina(tracker, starters, "STARTERS (Played Full Quarter)")
    print_player_stamina(tracker, bench, "BENCH (Recovered)")

    print("\n" + "=" * 80)
    print("MINUTES PLAYED:")
    print("=" * 80)
    for player in all_players:
        minutes = tracker.get_minutes_played(player['name'])
        print(f"  {player['name']:<20} {minutes:5.2f} minutes")

    # Demonstrate attribute degradation
    print("\n" + "=" * 80)
    print("ATTRIBUTE DEGRADATION EXAMPLES (Curry vs Looney):")
    print("=" * 80)

    curry = starters[0]
    looney = starters[4]

    curry_stamina = tracker.get_current_stamina(curry['name'])
    looney_stamina = tracker.get_current_stamina(looney['name'])

    curry_degraded = tracker.get_degraded_player(curry)
    looney_degraded = tracker.get_degraded_player(looney)

    print(f"\nStephen Curry (Stamina: {curry_stamina:.1f}):")
    print(f"  Throw Accuracy:  {curry['throw_accuracy']:.1f} -> {curry_degraded['throw_accuracy']:.1f}")
    print(f"  Form Technique:  {curry['form_technique']:.1f} -> {curry_degraded['form_technique']:.1f}")
    print(f"  Agility:         {curry['agility']:.1f} -> {curry_degraded['agility']:.1f}")

    print(f"\nKevon Looney (Stamina: {looney_stamina:.1f}):")
    print(f"  Jumping:         {looney['jumping']:.1f} -> {looney_degraded['jumping']:.1f}")
    print(f"  Core Strength:   {looney['core_strength']:.1f} -> {looney_degraded['core_strength']:.1f}")
    print(f"  Awareness:       {looney['awareness']:.1f} -> {looney_degraded['awareness']:.1f}")


def demo_recovery_curve():
    """Demonstrate exponential recovery on the bench."""
    print_header("Exponential Recovery Demonstration")

    player = create_demo_player("Bench Player", "PG", 85)
    tracker = StaminaTracker([player])

    # Deplete to 40 stamina
    tracker.stamina_state[player['name']] = 40.0

    print("Player sits on bench at 40 stamina")
    print("Recovery formula: 8 * (1 - current_stamina/100) per minute\n")

    print(f"{'Time':<15} {'Stamina':<15} {'Recovery Rate':<20} {'Recovery Amount':<20}")
    print("-" * 70)

    current_stamina = 40.0
    for minute in range(11):
        recovery_rate = 8 * (1 - current_stamina / 100)
        recovery = recovery_rate * 1.0  # 1 minute

        print(f"Minute {minute:<8} {current_stamina:6.2f} / 100   "
              f"{recovery_rate:5.2f} per min      "
              f"+{recovery:5.2f}")

        # Apply recovery
        if minute < 10:  # Don't apply after last print
            current_stamina = min(100.0, current_stamina + recovery)

    print("\nNotice:")
    print("  - Recovery is FASTEST at low stamina (exponential)")
    print("  - Recovery SLOWS as stamina approaches 100 (diminishing returns)")
    print("  - Biological realism: body compensates more when more fatigued")


def demo_pace_impact():
    """Demonstrate how pace affects stamina drain."""
    print_header("Pace Impact on Stamina Drain")

    player = create_demo_player("Demo Player", "PG", 85)

    print("Stamina cost per possession by pace:\n")

    for pace in ['slow', 'standard', 'fast']:
        # Non-scoring option
        cost_regular = 0.8 + (0.3 if pace == 'fast' else -0.3 if pace == 'slow' else 0.0)

        # Scoring option
        cost_option = cost_regular + 0.2

        # Over 25 possessions
        total_regular = cost_regular * 25
        total_option = cost_option * 25

        print(f"{pace.upper()} Pace:")
        print(f"  Regular player:  {cost_regular:.1f} per possession -> {total_regular:.1f} total (25 poss)")
        print(f"  Scoring option:  {cost_option:.1f} per possession -> {total_option:.1f} total (25 poss)")
        print()

    print("Impact on game:")
    print("  - Fast pace: ~32.5 stamina lost (scoring option) -> HIGH fatigue")
    print("  - Standard pace: ~25.0 stamina lost (scoring option) -> MODERATE fatigue")
    print("  - Slow pace: ~17.5 stamina lost (scoring option) -> LOW fatigue")


def main():
    """Run all demonstrations."""
    print("\n")
    print("+" + "=" * 78 + "+")
    print("|" + " " * 78 + "|")
    print("|" + "BASKETBALL SIMULATOR - STAMINA SYSTEM DEMONSTRATION".center(78) + "|")
    print("|" + " " * 78 + "|")
    print("+" + "=" * 78 + "+")

    # Demo 1: Degradation curve
    demo_stamina_degradation_curve()

    # Demo 2: Full quarter
    demo_quarter_simulation()

    # Demo 3: Recovery curve
    demo_recovery_curve()

    # Demo 4: Pace impact
    demo_pace_impact()

    print_header("DEMONSTRATION COMPLETE")

    print("Key Takeaways:")
    print("  [*] Stamina depletes per possession (pace + role dependent)")
    print("  [*] Degradation starts at 80 stamina threshold")
    print("  [*] Penalty follows polynomial curve (exponent 1.3)")
    print("  [*] All 25 attributes affected equally")
    print("  [*] Bench recovery is exponential (faster when more fatigued)")
    print("  [*] Attributes floor at 1.0 (never zero)")
    print("  [*] Minutes tracked accurately (seconds -> minutes)")
    print("\n" + "=" * 80 + "\n")


if __name__ == "__main__":
    main()
