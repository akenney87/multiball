"""
Basketball Simulator - Play-by-Play Logger Test Suite

Comprehensive tests for M2 play-by-play system.
"""

import pytest
import os
from src.systems.play_by_play import (
    PlayByPlayLogger,
    PossessionEvent,
    SubstitutionEvent,
    QuarterStatistics,
    format_percentage,
    format_quarter_ordinal
)
from src.core.data_structures import PossessionResult


# =============================================================================
# TEST FIXTURES
# =============================================================================

@pytest.fixture
def sample_possession_result_made_shot():
    """Create a sample PossessionResult for a made 3-pointer with assist."""
    return PossessionResult(
        play_by_play_text="Curry attempts a 3-pointer from the top of the key. Wide open! Leonard is 7.2 feet away. CURRY MAKES IT! Assist: Green",
        possession_outcome='made_shot',
        scoring_player='Stephen Curry',
        assist_player='Draymond Green',
        points_scored=3,
        debug={
            'shot_type': '3pt',
            'shooter': 'Stephen Curry',
            'contest_distance': 7.2
        }
    )


@pytest.fixture
def sample_possession_result_missed_shot():
    """Create a sample PossessionResult for a missed shot with rebound."""
    return PossessionResult(
        play_by_play_text="Leonard drives to the basket. Heavily contested by Thompson (1.8 feet)! Leonard misses. Rebound secured by Green.",
        possession_outcome='missed_shot',
        rebound_player='Draymond Green',
        points_scored=0,
        debug={
            'shot_type': 'rim',
            'rebound': {
                'rebounder_name': 'Draymond Green',
                'offensive_rebound': False
            }
        }
    )


@pytest.fixture
def sample_possession_result_turnover():
    """Create a sample PossessionResult for a turnover."""
    return PossessionResult(
        play_by_play_text="Westbrook brings the ball up court. Bad pass by Westbrook, stolen by Curry!",
        possession_outcome='turnover',
        points_scored=0,
        debug={}
    )


@pytest.fixture
def sample_possession_result_offensive_rebound():
    """Create a sample PossessionResult for offensive rebound + putback."""
    return PossessionResult(
        play_by_play_text="Durant attempts a midrange jumper. Contested by Leonard (3.5 feet). Durant misses. Offensive rebound by Adams! Adams puts it back in!",
        possession_outcome='made_shot',
        scoring_player='Steven Adams',
        rebound_player='Steven Adams',
        points_scored=2,
        debug={
            'shot_type': 'midrange',
            'rebound': {
                'rebounder_name': 'Steven Adams',
                'offensive_rebound': True
            }
        }
    )


# =============================================================================
# TEST HELPER FUNCTIONS
# =============================================================================

def test_format_percentage_normal():
    """Test percentage formatting with normal values."""
    assert format_percentage(12, 24) == "12/24 (50.0%)"
    assert format_percentage(4, 10) == "4/10 (40.0%)"
    assert format_percentage(5, 5) == "5/5 (100.0%)"


def test_format_percentage_zero_attempts():
    """Test percentage formatting with zero attempts."""
    assert format_percentage(0, 0) == "0/0 (0.0%)"


def test_format_percentage_zero_makes():
    """Test percentage formatting with zero makes."""
    assert format_percentage(0, 10) == "0/10 (0.0%)"


def test_format_quarter_ordinal():
    """Test quarter ordinal formatting."""
    assert format_quarter_ordinal(1) == "1ST"
    assert format_quarter_ordinal(2) == "2ND"
    assert format_quarter_ordinal(3) == "3RD"
    assert format_quarter_ordinal(4) == "4TH"
    assert format_quarter_ordinal(5) == "5TH"


# =============================================================================
# TEST QUARTER STATISTICS
# =============================================================================

def test_quarter_statistics_initialization():
    """Test QuarterStatistics initializes correctly."""
    stats = QuarterStatistics("Warriors", "Lakers")

    assert stats.home_team_name == "Warriors"
    assert stats.away_team_name == "Lakers"
    assert stats.team_stats['Home']['points'] == 0
    assert stats.team_stats['Away']['points'] == 0


def test_quarter_statistics_made_shot(sample_possession_result_made_shot):
    """Test statistics tracking for made shot."""
    stats = QuarterStatistics("Warriors", "Lakers")

    # Create possession event
    event = PossessionEvent(
        game_clock=700,
        offense_team='Home',
        score_before=(0, 0),
        play_by_play_text=sample_possession_result_made_shot.play_by_play_text,
        points_scored=3,
        outcome='made_shot',
        scoring_player='Stephen Curry',
        assist_player='Draymond Green',
        shot_type='3pt'
    )

    stats.add_possession_result('Home', event)

    # Verify team stats
    assert stats.team_stats['Home']['points'] == 3
    assert stats.team_stats['Home']['fgm'] == 1
    assert stats.team_stats['Home']['fga'] == 1
    assert stats.team_stats['Home']['fg3m'] == 1
    assert stats.team_stats['Home']['fg3a'] == 1
    assert stats.team_stats['Home']['ast'] == 1

    # Verify player stats
    assert stats.player_stats['Stephen Curry']['points'] == 3
    assert stats.player_stats['Stephen Curry']['fgm'] == 1
    assert stats.player_stats['Stephen Curry']['fga'] == 1
    assert stats.player_stats['Draymond Green']['assists'] == 1


def test_quarter_statistics_missed_shot(sample_possession_result_missed_shot):
    """Test statistics tracking for missed shot."""
    stats = QuarterStatistics("Warriors", "Lakers")

    event = PossessionEvent(
        game_clock=680,
        offense_team='Away',
        score_before=(3, 0),
        play_by_play_text=sample_possession_result_missed_shot.play_by_play_text,
        points_scored=0,
        outcome='missed_shot',
        rebound_player='Draymond Green',
        shot_type='rim',
        is_offensive_rebound=False
    )

    stats.add_possession_result('Away', event)

    # Verify team stats
    assert stats.team_stats['Away']['fga'] == 1
    assert stats.team_stats['Away']['fgm'] == 0
    assert stats.team_stats['Home']['dreb'] == 1  # Defensive rebound for other team

    # Verify player stats
    assert stats.player_stats['Draymond Green']['rebounds'] == 1


def test_quarter_statistics_turnover(sample_possession_result_turnover):
    """Test statistics tracking for turnover."""
    stats = QuarterStatistics("Warriors", "Lakers")

    event = PossessionEvent(
        game_clock=660,
        offense_team='Away',
        score_before=(3, 0),
        play_by_play_text=sample_possession_result_turnover.play_by_play_text,
        points_scored=0,
        outcome='turnover'
    )

    stats.add_possession_result('Away', event)

    # Verify team stats
    assert stats.team_stats['Away']['tov'] == 1


def test_quarter_statistics_offensive_rebound(sample_possession_result_offensive_rebound):
    """Test statistics tracking for offensive rebound."""
    stats = QuarterStatistics("Warriors", "Lakers")

    # First attempt (miss)
    miss_event = PossessionEvent(
        game_clock=640,
        offense_team='Home',
        score_before=(3, 0),
        play_by_play_text="Durant misses",
        points_scored=0,
        outcome='missed_shot',
        rebound_player='Steven Adams',
        shot_type='midrange',
        is_offensive_rebound=True
    )

    stats.add_possession_result('Home', miss_event)

    # Verify offensive rebound
    assert stats.team_stats['Home']['oreb'] == 1


def test_quarter_statistics_get_team_summary():
    """Test team summary generation."""
    stats = QuarterStatistics("Warriors", "Lakers")

    # Manually set stats
    stats.team_stats['Home']['fgm'] = 12
    stats.team_stats['Home']['fga'] = 24
    stats.team_stats['Home']['fg3m'] = 4
    stats.team_stats['Home']['fg3a'] = 10
    stats.team_stats['Home']['oreb'] = 2
    stats.team_stats['Home']['dreb'] = 6
    stats.team_stats['Home']['ast'] = 7
    stats.team_stats['Home']['tov'] = 2

    summary = stats.get_team_summary('Home')

    assert "12/24 (50.0%)" in summary
    assert "4/10 (40.0%)" in summary
    assert "REB: 8 (2 off, 6 def)" in summary
    assert "AST: 7" in summary
    assert "TO: 2" in summary


def test_quarter_statistics_get_top_performers():
    """Test top performers retrieval."""
    stats = QuarterStatistics("Warriors", "Lakers")

    # Add player stats
    stats.player_stats['Curry']['points'] = 15
    stats.player_stats['Durant']['points'] = 12
    stats.player_stats['Thompson']['points'] = 8
    stats.player_stats['Green']['points'] = 3

    top_scorers = stats.get_top_performers('Home', 'points', top_n=3)

    assert len(top_scorers) == 3
    assert top_scorers[0] == ('Curry', 15)
    assert top_scorers[1] == ('Durant', 12)
    assert top_scorers[2] == ('Thompson', 8)


# =============================================================================
# TEST PLAY-BY-PLAY LOGGER
# =============================================================================

def test_logger_initialization():
    """Test PlayByPlayLogger initializes correctly."""
    logger = PlayByPlayLogger("Warriors", "Lakers", quarter_number=1)

    assert logger.home_team_name == "Warriors"
    assert logger.away_team_name == "Lakers"
    assert logger.quarter_number == 1
    assert logger.home_score == 0
    assert logger.away_score == 0
    assert len(logger.possession_events) == 0
    assert len(logger.substitution_events) == 0


def test_logger_add_possession_made_shot(sample_possession_result_made_shot):
    """Test adding a made shot possession."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    logger.add_possession(
        game_clock=700,
        offense_team='Home',
        possession_result=sample_possession_result_made_shot
    )

    assert logger.home_score == 3
    assert logger.away_score == 0
    assert len(logger.possession_events) == 1

    event = logger.possession_events[0]
    assert event.game_clock == 700
    assert event.offense_team == 'Home'
    assert event.points_scored == 3
    assert event.outcome == 'made_shot'
    assert event.scoring_player == 'Stephen Curry'
    assert event.assist_player == 'Draymond Green'


def test_logger_add_possession_missed_shot(sample_possession_result_missed_shot):
    """Test adding a missed shot possession."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    logger.add_possession(
        game_clock=680,
        offense_team='Away',
        possession_result=sample_possession_result_missed_shot
    )

    assert logger.home_score == 0
    assert logger.away_score == 0
    assert len(logger.possession_events) == 1

    event = logger.possession_events[0]
    assert event.outcome == 'missed_shot'
    assert event.rebound_player == 'Draymond Green'


def test_logger_add_substitution():
    """Test adding a substitution event."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    logger.add_substitution(
        game_clock=650,
        team='Home',
        player_out='Stephen Curry',
        player_in='Jordan Poole',
        reason='low_stamina',
        stamina_out=55.5
    )

    assert len(logger.substitution_events) == 1

    event = logger.substitution_events[0]
    assert event.game_clock == 650
    assert event.team == 'Home'
    assert event.player_out == 'Stephen Curry'
    assert event.player_in == 'Jordan Poole'
    assert event.reason == 'low_stamina'
    assert event.stamina_out == 55.5


def test_logger_format_game_clock():
    """Test game clock formatting."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    assert logger._format_game_clock(720) == "12:00"
    assert logger._format_game_clock(705) == "11:45"
    assert logger._format_game_clock(492) == "08:12"
    assert logger._format_game_clock(23) == "00:23"
    assert logger._format_game_clock(0) == "00:00"


def test_logger_render_possession_event(sample_possession_result_made_shot):
    """Test rendering a single possession event."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    event = PossessionEvent(
        game_clock=705,
        offense_team='Home',
        score_before=(0, 0),
        play_by_play_text=sample_possession_result_made_shot.play_by_play_text,
        points_scored=3,
        outcome='made_shot',
        scoring_player='Stephen Curry',
        assist_player='Draymond Green',
        shot_type='3pt'
    )

    rendered = logger._render_possession_event(event)

    assert "[11:45]" in rendered
    assert "Warriors possession" in rendered
    assert "(Score: 0-0)" in rendered
    assert "CURRY MAKES IT!" in rendered
    assert "Score: 3-0" in rendered


def test_logger_render_substitution_event():
    """Test rendering a substitution event."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    event = SubstitutionEvent(
        game_clock=632,
        team='Home',
        player_out='Stephen Curry',
        player_in='Jordan Poole',
        reason='low_stamina',
        stamina_out=55.5
    )

    rendered = logger._render_substitution_event(event)

    assert "[10:32]" in rendered
    assert "Substitution" in rendered
    assert "Warriors" in rendered
    assert "Stephen Curry OUT" in rendered
    assert "stamina: 56" in rendered  # 55.5 rounds to 56
    assert "Jordan Poole IN" in rendered
    assert "low stamina" in rendered


def test_logger_render_to_text_simple():
    """Test rendering full narrative with simple possessions."""
    logger = PlayByPlayLogger("Warriors", "Lakers", quarter_number=1)

    # Add made shot
    made_shot = PossessionResult(
        play_by_play_text="Curry makes a 3-pointer.",
        possession_outcome='made_shot',
        scoring_player='Stephen Curry',
        points_scored=3,
        debug={'shot_type': '3pt'}
    )

    logger.add_possession(720, 'Home', made_shot)

    # Add missed shot
    miss = PossessionResult(
        play_by_play_text="Leonard misses a layup.",
        possession_outcome='missed_shot',
        rebound_player='Draymond Green',
        points_scored=0,
        debug={
            'shot_type': 'rim',
            'rebound': {'offensive_rebound': False}
        }
    )

    logger.add_possession(700, 'Away', miss)

    # Render to text
    narrative = logger.render_to_text()

    # Verify header
    assert "1ST QUARTER - Warriors vs Lakers" in narrative
    assert "=" * 80 in narrative

    # Verify possessions
    assert "[12:00]" in narrative
    assert "Warriors possession" in narrative
    assert "Curry makes a 3-pointer" in narrative
    assert "Score: 3-0" in narrative

    assert "[11:40]" in narrative
    assert "Lakers possession" in narrative

    # Verify summary
    assert "1ST QUARTER COMPLETE" in narrative
    assert "FINAL SCORE: Warriors 3, Lakers 0" in narrative
    assert "QUARTER STATISTICS:" in narrative


def test_logger_render_to_text_with_substitutions():
    """Test rendering narrative with substitutions."""
    logger = PlayByPlayLogger("Warriors", "Lakers", quarter_number=2)

    # Add possession
    result = PossessionResult(
        play_by_play_text="Thompson makes a midrange jumper.",
        possession_outcome='made_shot',
        scoring_player='Klay Thompson',
        points_scored=2,
        debug={'shot_type': 'midrange'}
    )

    logger.add_possession(700, 'Home', result)

    # Add substitution
    logger.add_substitution(
        game_clock=680,
        team='Home',
        player_out='Klay Thompson',
        player_in='Andrew Wiggins',
        reason='minutes_allocation',
        stamina_out=75.0
    )

    narrative = logger.render_to_text()

    # Verify substitution appears
    assert "2ND QUARTER" in narrative
    assert "Substitution" in narrative
    assert "Klay Thompson OUT" in narrative
    assert "Andrew Wiggins IN" in narrative
    assert "minutes management" in narrative


def test_logger_write_to_file(tmp_path, sample_possession_result_made_shot):
    """Test writing narrative to file."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    logger.add_possession(720, 'Home', sample_possession_result_made_shot)

    # Write to temp file
    output_file = tmp_path / "test_playbyplay.txt"
    logger.write_to_file(str(output_file))

    # Verify file exists
    assert output_file.exists()

    # Verify content
    content = output_file.read_text(encoding='utf-8')
    assert "1ST QUARTER - Warriors vs Lakers" in content
    assert "CURRY MAKES IT!" in content


def test_logger_event_chronological_ordering():
    """Test that events are rendered in chronological order (descending clock)."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    # Add possessions out of order
    result1 = PossessionResult(
        play_by_play_text="First possession",
        possession_outcome='made_shot',
        scoring_player='Player A',
        points_scored=2,
        debug={'shot_type': 'rim'}
    )

    result2 = PossessionResult(
        play_by_play_text="Second possession",
        possession_outcome='missed_shot',
        rebound_player='Player B',
        points_scored=0,
        debug={'shot_type': 'rim', 'rebound': {'offensive_rebound': False}}
    )

    result3 = PossessionResult(
        play_by_play_text="Third possession",
        possession_outcome='made_shot',
        scoring_player='Player C',
        points_scored=3,
        debug={'shot_type': '3pt'}
    )

    # Add in non-chronological order
    logger.add_possession(700, 'Home', result2)  # Second
    logger.add_possession(720, 'Home', result1)  # First
    logger.add_possession(680, 'Away', result3)  # Third

    narrative = logger.render_to_text()

    # Find indices of each possession
    first_idx = narrative.find("First possession")
    second_idx = narrative.find("Second possession")
    third_idx = narrative.find("Third possession")

    # Verify chronological order
    assert first_idx < second_idx < third_idx


def test_logger_multiple_possessions_score_tracking():
    """Test that score updates correctly across multiple possessions."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    possessions = [
        ('Home', 3, 720),
        ('Away', 2, 700),
        ('Home', 2, 680),
        ('Away', 3, 660),
        ('Home', 0, 640),  # Turnover
    ]

    for team, points, clock in possessions:
        if points == 0:
            result = PossessionResult(
                play_by_play_text="Turnover",
                possession_outcome='turnover',
                points_scored=0,
                debug={}
            )
        else:
            shot_type = '3pt' if points == 3 else 'midrange'
            result = PossessionResult(
                play_by_play_text=f"Scored {points} points",
                possession_outcome='made_shot',
                scoring_player='Player',
                points_scored=points,
                debug={'shot_type': shot_type}
            )

        logger.add_possession(clock, team, result)

    # Verify final score
    assert logger.home_score == 5  # 3 + 2
    assert logger.away_score == 5  # 2 + 3

    # Verify score progression in narrative
    narrative = logger.render_to_text()
    assert "FINAL SCORE: Warriors 5, Lakers 5" in narrative


# =============================================================================
# EDGE CASES
# =============================================================================

def test_logger_no_possessions():
    """Test rendering with no possessions."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    narrative = logger.render_to_text()

    assert "1ST QUARTER - Warriors vs Lakers" in narrative
    assert "FINAL SCORE: Warriors 0, Lakers 0" in narrative


def test_logger_no_assists_on_made_shot():
    """Test handling made shot without assist."""
    logger = PlayByPlayLogger("Warriors", "Lakers")

    result = PossessionResult(
        play_by_play_text="Curry makes an unassisted 3-pointer.",
        possession_outcome='made_shot',
        scoring_player='Stephen Curry',
        assist_player=None,
        points_scored=3,
        debug={'shot_type': '3pt'}
    )

    logger.add_possession(720, 'Home', result)

    # Verify statistics
    assert logger.statistics.team_stats['Home']['ast'] == 0


def test_logger_quarter_number_variations():
    """Test rendering different quarter numbers."""
    for q in [1, 2, 3, 4]:
        logger = PlayByPlayLogger("Warriors", "Lakers", quarter_number=q)
        narrative = logger.render_to_text()

        ordinals = {1: '1ST', 2: '2ND', 3: '3RD', 4: '4TH'}
        expected = f"{ordinals[q]} QUARTER"
        assert expected in narrative


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
