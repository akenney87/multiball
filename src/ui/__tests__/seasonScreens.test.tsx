/**
 * Season Screens Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ScheduleScreen, ScheduleMatch } from '../screens/ScheduleScreen';
import { StandingsScreen, TeamStanding } from '../screens/StandingsScreen';
import { SeasonProgressWidget, SeasonProgressData } from '../components/season/SeasonProgressWidget';
import { SaveIndicator } from '../components/common/SaveIndicator';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ScheduleScreen', () => {
  it('renders record bar', () => {
    const { getByText } = renderWithTheme(<ScheduleScreen />);
    expect(getByText('Wins')).toBeTruthy();
    expect(getByText('Losses')).toBeTruthy();
    expect(getByText('Left')).toBeTruthy();
  });

  it('renders sport filter buttons', () => {
    const { getAllByText, getByText } = renderWithTheme(<ScheduleScreen />);
    expect(getByText('All')).toBeTruthy();
    // BBall appears in filter and match cards
    expect(getAllByText('BBall').length).toBeGreaterThan(0);
    expect(getAllByText('Base').length).toBeGreaterThan(0);
    expect(getAllByText('Soccer').length).toBeGreaterThan(0);
  });

  it('renders week sections', () => {
    const { getByText } = renderWithTheme(<ScheduleScreen />);
    expect(getByText('Week 1')).toBeTruthy();
    expect(getByText('Week 2')).toBeTruthy();
  });

  it('shows current week badge', () => {
    const { getByText } = renderWithTheme(<ScheduleScreen />);
    expect(getByText('Current')).toBeTruthy();
  });

  it('renders match cards with opponent', () => {
    const { getByText } = renderWithTheme(<ScheduleScreen />);
    expect(getByText('vs Warriors')).toBeTruthy();
    expect(getByText('@ Eagles')).toBeTruthy();
  });

  it('shows win/loss results for completed matches', () => {
    const { getAllByText } = renderWithTheme(<ScheduleScreen />);
    expect(getAllByText('W').length).toBeGreaterThan(0);
    expect(getAllByText('L').length).toBeGreaterThan(0);
  });

  it('shows upcoming badge for scheduled matches', () => {
    const { getAllByText } = renderWithTheme(<ScheduleScreen />);
    expect(getAllByText('Upcoming').length).toBeGreaterThan(0);
  });

  it('filters by sport when filter is pressed', () => {
    const { getAllByText, queryByText } = renderWithTheme(<ScheduleScreen />);

    // Press Basketball filter (first element is the filter button)
    fireEvent.press(getAllByText('BBall')[0]);

    // Should show basketball matches
    expect(getAllByText('vs Warriors').length).toBeGreaterThan(0);

    // Should not show soccer matches (Eagles is soccer)
    expect(queryByText('@ Eagles')).toBeNull();
  });

  it('calls onMatchPress when match card is pressed', () => {
    const onMatchPress = jest.fn();
    const { getByText } = renderWithTheme(
      <ScheduleScreen onMatchPress={onMatchPress} />
    );

    fireEvent.press(getByText('vs Warriors'));
    expect(onMatchPress).toHaveBeenCalled();
  });
});

describe('StandingsScreen', () => {
  it('renders sport tabs', () => {
    const { getByText } = renderWithTheme(<StandingsScreen />);
    expect(getByText('Basketball')).toBeTruthy();
    expect(getByText('Baseball')).toBeTruthy();
    expect(getByText('Soccer')).toBeTruthy();
  });

  it('renders zone legend', () => {
    const { getByText } = renderWithTheme(<StandingsScreen />);
    expect(getByText('Promotion Zone')).toBeTruthy();
    expect(getByText('Relegation Zone')).toBeTruthy();
  });

  it('renders table header', () => {
    const { getByText } = renderWithTheme(<StandingsScreen />);
    expect(getByText('Team')).toBeTruthy();
    expect(getByText('W')).toBeTruthy();
    expect(getByText('L')).toBeTruthy();
    expect(getByText('Pts')).toBeTruthy();
  });

  it('renders team names', () => {
    const { getByText } = renderWithTheme(<StandingsScreen />);
    expect(getByText('My Team')).toBeTruthy();
    expect(getByText('Warriors')).toBeTruthy();
    expect(getByText('Thunder')).toBeTruthy();
  });

  it('renders streak badges', () => {
    const { getAllByText, getByText } = renderWithTheme(<StandingsScreen />);
    expect(getByText('W2')).toBeTruthy();
    // W1 appears multiple times (multiple teams have W1 streak)
    expect(getAllByText('W1').length).toBeGreaterThan(0);
  });

  it('switches sport when tab is pressed', () => {
    const { getByText, queryByText } = renderWithTheme(<StandingsScreen />);

    // Initially shows basketball teams
    expect(getByText('Warriors')).toBeTruthy();

    // Switch to baseball
    fireEvent.press(getByText('Baseball'));

    // Should show baseball teams
    expect(getByText('Sluggers')).toBeTruthy();
    // Warriors is only in basketball
    expect(queryByText('Warriors')).toBeNull();
  });

  it('shows draws column for soccer', () => {
    const { getByText, queryByText } = renderWithTheme(<StandingsScreen />);

    // Basketball doesn't have draws
    expect(queryByText('D')).toBeNull();

    // Switch to soccer
    fireEvent.press(getByText('Soccer'));

    // Soccer has draws column
    expect(getByText('D')).toBeTruthy();
  });

  it('calls onTeamPress when team row is pressed', () => {
    const onTeamPress = jest.fn();
    const { getByText } = renderWithTheme(
      <StandingsScreen onTeamPress={onTeamPress} />
    );

    fireEvent.press(getByText('Warriors'));
    expect(onTeamPress).toHaveBeenCalled();
  });
});

describe('SeasonProgressWidget', () => {
  const mockData: SeasonProgressData = {
    currentWeek: 5,
    totalWeeks: 40,
    phase: 'regular_season',
    seasonNumber: 1,
    matchesPlayed: 12,
    totalMatches: 57,
    nextMatchDate: new Date(Date.now() + 86400000 * 2), // 2 days from now
  };

  it('renders season number', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('Season 1')).toBeTruthy();
  });

  it('renders season phase badge', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('Regular Season')).toBeTruthy();
  });

  it('renders current week', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('5')).toBeTruthy();
    expect(getByText('of 40')).toBeTruthy();
  });

  it('renders progress bars', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('Season Progress')).toBeTruthy();
    expect(getByText('Matches Played')).toBeTruthy();
    expect(getByText('12/57')).toBeTruthy();
  });

  it('renders next match info', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('Next Match')).toBeTruthy();
    expect(getByText('In 2 days')).toBeTruthy();
  });

  it('renders action buttons', () => {
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} />
    );
    expect(getByText('Advance Week')).toBeTruthy();
    expect(getByText('View Schedule')).toBeTruthy();
  });

  it('calls onAdvanceWeek when button is pressed', () => {
    const onAdvanceWeek = jest.fn();
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} onAdvanceWeek={onAdvanceWeek} />
    );

    fireEvent.press(getByText('Advance Week'));
    expect(onAdvanceWeek).toHaveBeenCalled();
  });

  it('calls onViewSchedule when button is pressed', () => {
    const onViewSchedule = jest.fn();
    const { getByText } = renderWithTheme(
      <SeasonProgressWidget data={mockData} onViewSchedule={onViewSchedule} />
    );

    fireEvent.press(getByText('View Schedule'));
    expect(onViewSchedule).toHaveBeenCalled();
  });

  it('shows different phase badges', () => {
    const preSeasonData = { ...mockData, phase: 'pre_season' as const };
    const { getByText, rerender } = renderWithTheme(
      <SeasonProgressWidget data={preSeasonData} />
    );
    expect(getByText('Pre-Season')).toBeTruthy();

    const postSeasonData = { ...mockData, phase: 'post_season' as const };
    rerender(
      <ThemeProvider>
        <SeasonProgressWidget data={postSeasonData} />
      </ThemeProvider>
    );
    expect(getByText('Playoffs')).toBeTruthy();
  });
});

describe('SaveIndicator', () => {
  it('renders saving status', () => {
    const { getByText } = renderWithTheme(
      <SaveIndicator status="saving" />
    );
    expect(getByText('Saving')).toBeTruthy();
  });

  it('renders saved status', () => {
    const { getByText } = renderWithTheme(
      <SaveIndicator status="saved" autoHide={false} />
    );
    expect(getByText('Saved')).toBeTruthy();
  });

  it('renders error status', () => {
    const { getByText } = renderWithTheme(
      <SaveIndicator status="error" errorMessage="Network error" autoHide={false} />
    );
    expect(getByText('Network error')).toBeTruthy();
  });

  it('shows checkmark for saved', () => {
    const { getByText } = renderWithTheme(
      <SaveIndicator status="saved" autoHide={false} />
    );
    expect(getByText('\u2713')).toBeTruthy();
  });

  it('shows last saved time', () => {
    const { getByText } = renderWithTheme(
      <SaveIndicator
        status="saved"
        lastSaved={new Date().toISOString()}
        autoHide={false}
      />
    );
    expect(getByText('Saved Just now')).toBeTruthy();
  });
});
