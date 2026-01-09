/**
 * Match Screens Tests
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MatchPreviewScreen } from '../screens/MatchPreviewScreen';
import { MatchResultScreen } from '../screens/MatchResultScreen';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('MatchPreviewScreen', () => {
  it('renders team names', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    expect(getByText('My Team')).toBeTruthy();
    expect(getByText('Opponent')).toBeTruthy();
  });

  it('renders sport badge', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    expect(getByText('Basketball')).toBeTruthy();
  });

  it('renders lineup section', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    expect(getByText('Starting Lineup')).toBeTruthy();
    expect(getByText('PG')).toBeTruthy();
    expect(getByText('SG')).toBeTruthy();
    expect(getByText('SF')).toBeTruthy();
    expect(getByText('PF')).toBeTruthy();
    expect(getByText('C')).toBeTruthy();
  });

  it('renders tactics section', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    expect(getByText('Tactics')).toBeTruthy();
    expect(getByText('Pace')).toBeTruthy();
    expect(getByText('Defense')).toBeTruthy();
  });

  it('renders action buttons', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    expect(getByText('Watch Match')).toBeTruthy();
    expect(getByText('Quick Sim')).toBeTruthy();
  });

  it('calls onStartMatch when Watch Match is pressed', () => {
    const onStartMatch = jest.fn();
    const { getByText } = renderWithTheme(
      <MatchPreviewScreen onStartMatch={onStartMatch} />
    );

    fireEvent.press(getByText('Watch Match'));
    expect(onStartMatch).toHaveBeenCalledTimes(1);
  });

  it('shows confirmation modal when Quick Sim is pressed', () => {
    const { getByText } = renderWithTheme(<MatchPreviewScreen />);

    fireEvent.press(getByText('Quick Sim'));
    expect(getByText('Quick Simulate?')).toBeTruthy();
  });
});

describe('MatchResultScreen', () => {
  it('renders victory banner for wins', () => {
    const { getByText } = renderWithTheme(
      <MatchResultScreen homeScore={105} awayScore={98} />
    );

    expect(getByText('VICTORY')).toBeTruthy();
  });

  it('renders defeat banner for losses', () => {
    const { getByText } = renderWithTheme(
      <MatchResultScreen homeScore={90} awayScore={105} />
    );

    expect(getByText('DEFEAT')).toBeTruthy();
  });

  it('renders final scores', () => {
    const { getAllByText } = renderWithTheme(
      <MatchResultScreen homeScore={105} awayScore={98} />
    );

    // Scores appear multiple times (header + quarter table total)
    expect(getAllByText('105').length).toBeGreaterThan(0);
    expect(getAllByText('98').length).toBeGreaterThan(0);
  });

  it('renders quarter scores section', () => {
    const { getByText, getAllByText } = renderWithTheme(<MatchResultScreen />);

    expect(getByText('QUARTER SCORES')).toBeTruthy();
    expect(getByText('Q1')).toBeTruthy();
    expect(getByText('Q2')).toBeTruthy();
    expect(getByText('Q3')).toBeTruthy();
    expect(getByText('Q4')).toBeTruthy();
  });

  it('renders top performers section', () => {
    const { getByText } = renderWithTheme(<MatchResultScreen />);

    expect(getByText('TOP PERFORMERS')).toBeTruthy();
    expect(getByText('Player A')).toBeTruthy();
    expect(getByText('Player B')).toBeTruthy();
    expect(getByText('Player C')).toBeTruthy();
  });

  it('renders stat labels for performers', () => {
    const { getAllByText } = renderWithTheme(<MatchResultScreen />);

    expect(getAllByText('PTS').length).toBeGreaterThan(0);
    expect(getAllByText('REB').length).toBeGreaterThan(0);
    expect(getAllByText('AST').length).toBeGreaterThan(0);
  });

  it('renders continue button', () => {
    const { getByText } = renderWithTheme(<MatchResultScreen />);

    expect(getByText('Continue')).toBeTruthy();
  });

  it('calls onContinue when Continue is pressed', () => {
    const onContinue = jest.fn();
    const { getByText } = renderWithTheme(
      <MatchResultScreen onContinue={onContinue} />
    );

    fireEvent.press(getByText('Continue'));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('accepts custom team names', () => {
    const { getAllByText } = renderWithTheme(
      <MatchResultScreen homeTeam="Lakers" awayTeam="Celtics" />
    );

    // Team names appear multiple times (header + quarter table)
    expect(getAllByText('Lakers').length).toBeGreaterThan(0);
    expect(getAllByText('Celtics').length).toBeGreaterThan(0);
  });
});
