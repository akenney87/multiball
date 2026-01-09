"""
Basketball Simulator - CLI Entry Point

Command-line interface for Milestone 1 (single possession simulation).

Usage:
    python main.py --offensive-team "Elite Shooters" --defensive-team "Elite Defenders"
    python main.py -o "Elite Shooters" -d "Elite Defenders" --seed 42 --debug
    python main.py -o "Elite Shooters" -d "G-League Rookies" --compact
    python main.py -o "Elite Defenders" -d "Elite Shooters" --json

Arguments:
    --offensive-team, -o: Name of offensive team (must exist in data/sample_teams.json)
    --defensive-team, -d: Name of defensive team (must exist in data/sample_teams.json)
    --seed, -s: Random seed for reproducibility (default: random)
    --debug: Include full debug output
    --compact: Use compact single-line output
    --json: Output raw JSON instead of formatted text
    --transition, -t: Set possession as transition (default: halfcourt)
    --shot-clock: Shot clock seconds (14 or 24, default: 24)

Examples:
    # Standard possession with debug info
    python main.py -o "Elite Shooters" -d "Elite Defenders" --seed 42 --debug

    # Transition possession
    python main.py -o "Elite Shooters" -d "Elite Defenders" --transition

    # Compact output for scripting
    python main.py -o "Elite Shooters" -d "Elite Defenders" --compact

    # JSON output for analysis
    python main.py -o "Elite Shooters" -d "Elite Defenders" --json --seed 42
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List, Any

from src.core.data_structures import PossessionContext, TacticalSettings
from src.simulation import (
    simulate_single_possession,
    format_possession_output
)


# =============================================================================
# TEAM LOADING
# =============================================================================

def load_teams_from_file(filepath: str = "data/sample_teams.json") -> Dict[str, List[Dict[str, Any]]]:
    """
    Load team data from JSON file.

    Args:
        filepath: Path to JSON file

    Returns:
        Dict mapping team name to list of players

    Raises:
        FileNotFoundError: If file doesn't exist
        ValueError: If JSON is malformed
    """
    file_path = Path(filepath)

    if not file_path.exists():
        raise FileNotFoundError(
            f"Team data file not found: {filepath}\n"
            f"Expected location: {file_path.absolute()}"
        )

    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {filepath}: {e}") from e

    if 'teams' not in data:
        raise ValueError(f"JSON file missing 'teams' key: {filepath}")

    return data['teams']


def get_team_by_name(teams: Dict[str, List[Dict[str, Any]]], team_name: str) -> List[Dict[str, Any]]:
    """
    Retrieve team by name from teams dict.

    Args:
        teams: Dict mapping team name to players
        team_name: Name of team to retrieve

    Returns:
        List of 5 players

    Raises:
        ValueError: If team name not found
    """
    if team_name not in teams:
        available_teams = ", ".join(teams.keys())
        raise ValueError(
            f"Team '{team_name}' not found in team data.\n"
            f"Available teams: {available_teams}"
        )

    return teams[team_name]


# =============================================================================
# CLI ARGUMENT PARSING
# =============================================================================

def parse_arguments() -> argparse.Namespace:
    """
    Parse command-line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="Basketball Simulator - Milestone 1 (Single Possession)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Standard possession with debug info
  python main.py -o "Elite Shooters" -d "Elite Defenders" --seed 42 --debug

  # Transition possession
  python main.py -o "Elite Shooters" -d "Elite Defenders" --transition

  # Compact output for scripting
  python main.py -o "Elite Shooters" -d "Elite Defenders" --compact

  # JSON output for analysis
  python main.py -o "Elite Shooters" -d "Elite Defenders" --json --seed 42
        """
    )

    # Required arguments
    parser.add_argument(
        '-o', '--offensive-team',
        required=True,
        help='Name of offensive team (must exist in data/sample_teams.json)'
    )

    parser.add_argument(
        '-d', '--defensive-team',
        required=True,
        help='Name of defensive team (must exist in data/sample_teams.json)'
    )

    # Optional arguments
    parser.add_argument(
        '-s', '--seed',
        type=int,
        default=None,
        help='Random seed for reproducibility (default: random)'
    )

    parser.add_argument(
        '--debug',
        action='store_true',
        help='Include full debug output'
    )

    parser.add_argument(
        '--compact',
        action='store_true',
        help='Use compact single-line output'
    )

    parser.add_argument(
        '--json',
        action='store_true',
        help='Output raw JSON instead of formatted text'
    )

    parser.add_argument(
        '-t', '--transition',
        action='store_true',
        help='Set possession as transition (default: halfcourt)'
    )

    parser.add_argument(
        '--shot-clock',
        type=int,
        choices=[14, 24],
        default=24,
        help='Shot clock seconds (14 or 24, default: 24)'
    )

    parser.add_argument(
        '--team-data',
        default='data/sample_teams.json',
        help='Path to team data JSON file (default: data/sample_teams.json)'
    )

    return parser.parse_args()


# =============================================================================
# MAIN
# =============================================================================

def main():
    """
    Main CLI entry point.

    Returns:
        Exit code (0 = success, 1 = error)
    """
    try:
        # Parse arguments
        args = parse_arguments()

        # Load team data
        try:
            teams = load_teams_from_file(args.team_data)
        except (FileNotFoundError, ValueError) as e:
            print(f"ERROR: Failed to load team data: {e}", file=sys.stderr)
            return 1

        # Get teams
        try:
            offensive_team = get_team_by_name(teams, args.offensive_team)
            defensive_team = get_team_by_name(teams, args.defensive_team)
        except ValueError as e:
            print(f"ERROR: {e}", file=sys.stderr)
            return 1

        # Build possession context
        possession_context = PossessionContext(
            is_transition=args.transition,
            shot_clock=args.shot_clock,
            score_differential=0,
            game_time_remaining=2880
        )

        # Build tactical settings (use defaults for M1)
        tactical_settings_offense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

        tactical_settings_defense = TacticalSettings(
            pace='standard',
            man_defense_pct=50,
            rebounding_strategy='standard'
        )

        # Run simulation
        try:
            result = simulate_single_possession(
                offensive_team=offensive_team,
                defensive_team=defensive_team,
                tactical_settings_offense=tactical_settings_offense,
                tactical_settings_defense=tactical_settings_defense,
                possession_context=possession_context,
                seed=args.seed
            )
        except (ValueError, RuntimeError) as e:
            print(f"ERROR: Simulation failed: {e}", file=sys.stderr)
            return 1

        # Output result
        if args.json:
            # JSON output
            output = json.dumps(result.to_dict(), indent=2)
            print(output)
        else:
            # Formatted text output
            output = format_possession_output(
                result,
                include_debug=args.debug,
                compact=args.compact
            )
            print(output)

        return 0

    except KeyboardInterrupt:
        print("\nInterrupted by user", file=sys.stderr)
        return 1

    except Exception as e:
        print(f"ERROR: Unexpected error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
