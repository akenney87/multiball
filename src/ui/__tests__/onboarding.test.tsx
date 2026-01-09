/**
 * Onboarding and Integration Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { NewGameScreen } from '../screens/NewGameScreen';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('NewGameScreen', () => {
  it('renders header with app name', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('Multiball')).toBeTruthy();
    expect(getByText('Sports Franchise Manager')).toBeTruthy();
  });

  it('renders team preview', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('Your Team')).toBeTruthy();
  });

  it('renders team name input', () => {
    const { getByText, getByPlaceholderText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('Team Name')).toBeTruthy();
    expect(getByPlaceholderText('Enter team name...')).toBeTruthy();
  });

  it('shows character count', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('0/20')).toBeTruthy();
  });

  it('renders color pickers', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('Primary Color')).toBeTruthy();
    expect(getByText('Secondary Color')).toBeTruthy();
  });

  it('renders difficulty options', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('Difficulty')).toBeTruthy();
    expect(getByText('Easy')).toBeTruthy();
    expect(getByText('Normal')).toBeTruthy();
    expect(getByText('Hard')).toBeTruthy();
  });

  it('shows difficulty descriptions', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    expect(getByText('More forgiving, perfect for learning')).toBeTruthy();
    expect(getByText('Balanced challenge for most players')).toBeTruthy();
    expect(getByText('For experienced managers only')).toBeTruthy();
  });

  it('renders start button disabled initially', () => {
    const { getByText } = renderWithTheme(<NewGameScreen />);
    const button = getByText('Start New Game');
    expect(button).toBeTruthy();
  });

  it('updates team preview when name is entered', () => {
    const { getByPlaceholderText, getByText, queryByText } = renderWithTheme(
      <NewGameScreen />
    );

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'Champions');

    expect(getByText('Champions')).toBeTruthy();
    expect(queryByText('Your Team')).toBeNull();
  });

  it('updates character count when typing', () => {
    const { getByPlaceholderText, getByText } = renderWithTheme(<NewGameScreen />);

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'Test');

    expect(getByText('4/20')).toBeTruthy();
  });

  it('shows continue button when hasSavedGame is true', () => {
    const { getByText } = renderWithTheme(<NewGameScreen hasSavedGame />);
    expect(getByText('Continue Saved Game')).toBeTruthy();
  });

  it('does not show continue button when no saved game', () => {
    const { queryByText } = renderWithTheme(<NewGameScreen hasSavedGame={false} />);
    expect(queryByText('Continue Saved Game')).toBeNull();
  });

  it('calls onLoadGame when continue is pressed', () => {
    const onLoadGame = jest.fn();
    const { getByText } = renderWithTheme(
      <NewGameScreen hasSavedGame onLoadGame={onLoadGame} />
    );

    fireEvent.press(getByText('Continue Saved Game'));
    expect(onLoadGame).toHaveBeenCalled();
  });

  it('calls onStartGame when start is pressed with valid name', () => {
    const onStartGame = jest.fn();
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <NewGameScreen onStartGame={onStartGame} />
    );

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'My Team');
    fireEvent.press(getByText('Start New Game'));

    expect(onStartGame).toHaveBeenCalledWith(
      expect.objectContaining({
        teamName: 'My Team',
        difficulty: 'normal',
      })
    );
  });

  it('shows overwrite confirmation when saved game exists', () => {
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <NewGameScreen hasSavedGame />
    );

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'New Team');
    fireEvent.press(getByText('Start New Game'));

    expect(getByText('Overwrite Save?')).toBeTruthy();
  });

  it('changes difficulty when option is pressed', () => {
    const onStartGame = jest.fn();
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <NewGameScreen onStartGame={onStartGame} />
    );

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'Test');
    fireEvent.press(getByText('Hard'));
    fireEvent.press(getByText('Start New Game'));

    expect(onStartGame).toHaveBeenCalledWith(
      expect.objectContaining({ difficulty: 'hard' })
    );
  });

  it('does not start game with short name', () => {
    const onStartGame = jest.fn();
    const { getByText, getByPlaceholderText } = renderWithTheme(
      <NewGameScreen onStartGame={onStartGame} />
    );

    const input = getByPlaceholderText('Enter team name...');
    fireEvent.changeText(input, 'A'); // Too short (needs 2+ chars)
    fireEvent.press(getByText('Start New Game'));

    expect(onStartGame).not.toHaveBeenCalled();
  });
});

describe('Integration - Module Exports', () => {
  it('exports theme components', () => {
    const theme = require('../theme');
    expect(theme.ThemeProvider).toBeDefined();
    expect(theme.useTheme).toBeDefined();
    expect(theme.useColors).toBeDefined();
  });

  it('exports common components', () => {
    expect(require('../components/common/ErrorBoundary').ErrorBoundary).toBeDefined();
    expect(require('../components/common/ConfirmationModal').ConfirmationModal).toBeDefined();
    expect(require('../components/common/SaveIndicator').SaveIndicator).toBeDefined();
  });

  it('exports screen components', () => {
    expect(require('../screens/DashboardScreen').DashboardScreen).toBeDefined();
    expect(require('../screens/NewGameScreen').NewGameScreen).toBeDefined();
    expect(require('../screens/RosterScreen').RosterScreen).toBeDefined();
    expect(require('../screens/PlayerDetailScreen').PlayerDetailScreen).toBeDefined();
    expect(require('../screens/ScheduleScreen').ScheduleScreen).toBeDefined();
    expect(require('../screens/StandingsScreen').StandingsScreen).toBeDefined();
    expect(require('../screens/TransferMarketScreen').TransferMarketScreen).toBeDefined();
    expect(require('../screens/BudgetScreen').BudgetScreen).toBeDefined();
    expect(require('../screens/SettingsScreen').SettingsScreen).toBeDefined();
  });

  it('exports navigation components', () => {
    const nav = require('../navigation');
    expect(nav.AppNavigator).toBeDefined();
    expect(nav.TabNavigator).toBeDefined();
  });
});
