"""
Unit tests for Team Foul Tracking and Bonus System (M3 Issue #8)

Tests:
1. Team foul counter increments correctly
2. Bonus triggers at 5 fouls
3. Team fouls reset each quarter
4. Both teams tracked independently
5. Bonus status displayed in play-by-play
6. Free throws awarded correctly for bonus
7. Non-shooting fouls award 2 FTs when in bonus
8. Edge cases (0 fouls, 10+ fouls, simultaneous bonus)
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import unittest
from src.systems.fouls import FoulSystem, FoulEvent
from src.core.data_structures import TacticalSettings


class TestTeamFoulTracking(unittest.TestCase):
    """Test team foul tracking system."""

    def setUp(self):
        """Create test rosters and foul system."""
        self.home_roster = [
            {'name': f'Home_{i}', 'position': 'PG'} for i in range(1, 6)
        ]
        self.away_roster = [
            {'name': f'Away_{i}', 'position': 'PG'} for i in range(1, 6)
        ]
        self.foul_system = FoulSystem(self.home_roster, self.away_roster)

    def test_team_foul_initialization(self):
        """Test team fouls start at 0."""
        self.assertEqual(self.foul_system.get_team_fouls('Home'), 0)
        self.assertEqual(self.foul_system.get_team_fouls('Away'), 0)

    def test_team_foul_increment_shooting(self):
        """Test team fouls increment on shooting foul."""
        foul_event = self.foul_system._record_shooting_foul(
            fouling_player='Home_1',
            fouled_player='Away_1',
            shot_type='3pt',
            shot_made=False,
            fouling_team='Home',
            quarter=1,
            game_time='11:30'
        )

        self.assertEqual(self.foul_system.get_team_fouls('Home'), 1)
        self.assertEqual(foul_event.team_fouls_after, 1)

    def test_team_foul_increment_non_shooting(self):
        """Test team fouls increment on non-shooting foul."""
        foul_event = self.foul_system._record_non_shooting_foul(
            fouling_player='Away_2',
            fouled_player='Home_1',
            fouling_team='Away',
            quarter=1,
            game_time='10:15'
        )

        self.assertEqual(self.foul_system.get_team_fouls('Away'), 1)
        self.assertEqual(foul_event.team_fouls_after, 1)

    def test_bonus_triggers_at_5_fouls(self):
        """Test bonus triggers when team reaches 5 fouls."""
        # Commit 4 fouls (no bonus)
        for i in range(4):
            foul = self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{i+1}',
                fouled_player='Away_1',
                shot_type='midrange',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )
            self.assertFalse(foul.bonus_triggered, f"Foul {i+1} should not trigger bonus")

        # 5th foul triggers bonus
        foul_5 = self.foul_system._record_shooting_foul(
            fouling_player='Home_5',
            fouled_player='Away_2',
            shot_type='rim',
            shot_made=False,
            fouling_team='Home',
            quarter=1,
            game_time='11:00'
        )

        self.assertTrue(foul_5.bonus_triggered, "5th foul should trigger bonus")
        self.assertEqual(self.foul_system.get_team_fouls('Home'), 5)

    def test_bonus_free_throws_non_shooting(self):
        """Test non-shooting fouls award 2 FTs when in bonus."""
        # Commit 5 fouls to trigger bonus
        for i in range(5):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{(i % 5) + 1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Non-shooting foul should award 2 FTs
        non_shooting_foul = self.foul_system._record_non_shooting_foul(
            fouling_player='Home_1',
            fouled_player='Away_2',
            fouling_team='Home',
            quarter=1,
            game_time='10:00'
        )

        self.assertTrue(non_shooting_foul.bonus_triggered)
        self.assertEqual(non_shooting_foul.free_throws_awarded, 2)

    def test_no_free_throws_before_bonus(self):
        """Test non-shooting fouls award 0 FTs before bonus."""
        # Commit 2 fouls (no bonus)
        for i in range(2):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{i+1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Non-shooting foul should award 0 FTs (side out)
        non_shooting_foul = self.foul_system._record_non_shooting_foul(
            fouling_player='Home_3',
            fouled_player='Away_2',
            fouling_team='Home',
            quarter=1,
            game_time='11:00'
        )

        self.assertFalse(non_shooting_foul.bonus_triggered)
        self.assertEqual(non_shooting_foul.free_throws_awarded, 0)

    def test_team_fouls_reset_each_quarter(self):
        """Test team fouls reset to 0 at start of new quarter."""
        # Commit 7 fouls in Q1
        for i in range(7):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{(i % 5) + 1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*3:02d}'
            )

        self.assertEqual(self.foul_system.get_team_fouls('Home'), 7)

        # Reset for Q2
        self.foul_system.reset_team_fouls_for_quarter(2)

        self.assertEqual(self.foul_system.get_team_fouls('Home'), 0)
        self.assertEqual(self.foul_system.get_team_fouls('Away'), 0)
        self.assertEqual(self.foul_system.current_quarter, 2)

    def test_both_teams_tracked_independently(self):
        """Test home and away team fouls tracked separately."""
        # Home team commits 3 fouls
        for i in range(3):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{i+1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Away team commits 6 fouls
        for i in range(6):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Away_{(i % 5) + 1}',
                fouled_player='Home_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Away',
                quarter=1,
                game_time=f'10:{30-i*5:02d}'
            )

        self.assertEqual(self.foul_system.get_team_fouls('Home'), 3)
        self.assertEqual(self.foul_system.get_team_fouls('Away'), 6)

        # Home not in bonus, Away in bonus
        self.assertFalse(self.foul_system.is_in_bonus('Away'))  # Away offense, Home defense (3 fouls)
        self.assertTrue(self.foul_system.is_in_bonus('Home'))   # Home offense, Away defense (6 fouls)

    def test_is_in_bonus_checks_opponent_fouls(self):
        """Test is_in_bonus() checks opponent's foul count."""
        # Away team commits 5 fouls
        for i in range(5):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Away_{(i % 5) + 1}',
                fouled_player='Home_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Away',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Home team is in bonus (Away has 5+ fouls)
        self.assertTrue(self.foul_system.is_in_bonus('Home'))
        # Away team is NOT in bonus (Home has 0 fouls)
        self.assertFalse(self.foul_system.is_in_bonus('Away'))

    def test_personal_fouls_still_tracked(self):
        """Test personal fouls still increment (don't break existing system)."""
        # Player commits 3 fouls
        for i in range(3):
            self.foul_system._record_shooting_foul(
                fouling_player='Home_1',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        self.assertEqual(self.foul_system.get_personal_fouls('Home_1'), 3)
        self.assertEqual(self.foul_system.get_team_fouls('Home'), 3)

    def test_foul_out_still_works(self):
        """Test player foul-out detection still works with team fouls."""
        # Player commits 6 fouls
        for i in range(6):
            foul = self.foul_system._record_shooting_foul(
                fouling_player='Home_1',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*3:02d}'
            )

        # 6th foul should mark fouled out
        self.assertTrue(foul.fouled_out)
        self.assertTrue(self.foul_system.is_fouled_out('Home_1'))

    def test_edge_case_zero_fouls(self):
        """Test behavior with 0 fouls."""
        self.assertEqual(self.foul_system.get_team_fouls('Home'), 0)
        self.assertFalse(self.foul_system.is_in_bonus('Away'))

    def test_edge_case_many_fouls(self):
        """Test behavior with 10+ fouls."""
        # Commit 12 fouls
        for i in range(12):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{(i % 5) + 1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*3:02d}'
            )

        self.assertEqual(self.foul_system.get_team_fouls('Home'), 12)
        self.assertTrue(self.foul_system.is_in_bonus('Away'))

        # Non-shooting foul should still award 2 FTs
        foul = self.foul_system._record_non_shooting_foul(
            fouling_player='Home_1',
            fouled_player='Away_2',
            fouling_team='Home',
            quarter=1,
            game_time='10:00'
        )
        self.assertEqual(foul.free_throws_awarded, 2)

    def test_both_teams_in_bonus_simultaneously(self):
        """Test both teams can be in bonus at same time."""
        # Home commits 5 fouls
        for i in range(5):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Home_{(i % 5) + 1}',
                fouled_player='Away_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Away commits 5 fouls
        for i in range(5):
            self.foul_system._record_shooting_foul(
                fouling_player=f'Away_{(i % 5) + 1}',
                fouled_player='Home_1',
                shot_type='rim',
                shot_made=False,
                fouling_team='Away',
                quarter=1,
                game_time=f'10:{30-i*5:02d}'
            )

        # Both teams should be in bonus
        self.assertTrue(self.foul_system.is_in_bonus('Home'))
        self.assertTrue(self.foul_system.is_in_bonus('Away'))


class TestBonusDisplay(unittest.TestCase):
    """Test bonus status display in play-by-play."""

    def test_bonus_triggered_field_in_foul_event(self):
        """Test FoulEvent includes bonus_triggered field."""
        home_roster = [{'name': 'Player1', 'position': 'PG'}]
        away_roster = [{'name': 'Player2', 'position': 'SG'}]
        foul_system = FoulSystem(home_roster, away_roster)

        # Commit 5 fouls to trigger bonus
        for i in range(5):
            foul_system._record_shooting_foul(
                fouling_player='Player1',
                fouled_player='Player2',
                shot_type='rim',
                shot_made=False,
                fouling_team='Home',
                quarter=1,
                game_time=f'11:{30-i*5:02d}'
            )

        # Next foul should have bonus_triggered = True
        foul = foul_system._record_shooting_foul(
            fouling_player='Player1',
            fouled_player='Player2',
            shot_type='rim',
            shot_made=False,
            fouling_team='Home',
            quarter=1,
            game_time='10:00'
        )

        self.assertTrue(hasattr(foul, 'bonus_triggered'))
        self.assertTrue(foul.bonus_triggered)


if __name__ == '__main__':
    unittest.main()
