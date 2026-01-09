/**
 * Roster Screens Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PlayerCard, PlayerCardData } from '../components/roster/PlayerCard';
import { RosterScreen } from '../screens/RosterScreen';
import { PlayerDetailScreen } from '../screens/PlayerDetailScreen';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockPlayer: PlayerCardData = {
  id: '1',
  name: 'John Smith',
  overall: 82,
  age: 25,
  salary: 2500000,
  isStarter: true,
};

describe('PlayerCard', () => {
  it('renders player name', () => {
    const { getByText } = renderWithTheme(<PlayerCard player={mockPlayer} />);
    expect(getByText('John Smith')).toBeTruthy();
  });

  it('renders overall rating', () => {
    const { getByText } = renderWithTheme(<PlayerCard player={mockPlayer} />);
    expect(getByText('82')).toBeTruthy();
    expect(getByText('OVR')).toBeTruthy();
  });

  it('renders player age', () => {
    const { getByText } = renderWithTheme(<PlayerCard player={mockPlayer} />);
    expect(getByText('Age 25')).toBeTruthy();
  });

  it('shows starter badge when isStarter is true', () => {
    const { getByText } = renderWithTheme(<PlayerCard player={mockPlayer} />);
    expect(getByText('S')).toBeTruthy();
  });

  it('does not show starter badge when isStarter is false', () => {
    const nonStarter = { ...mockPlayer, isStarter: false };
    const { queryByText } = renderWithTheme(<PlayerCard player={nonStarter} />);
    expect(queryByText('S')).toBeNull();
  });

  it('shows injury badge when isInjured is true', () => {
    const injured = { ...mockPlayer, isInjured: true };
    const { getByText } = renderWithTheme(<PlayerCard player={injured} />);
    expect(getByText('INJ')).toBeTruthy();
  });

  it('does not show injury badge when isInjured is false', () => {
    const { queryByText } = renderWithTheme(<PlayerCard player={mockPlayer} />);
    expect(queryByText('INJ')).toBeNull();
  });

  it('shows salary when showSalary is true', () => {
    const { getByText } = renderWithTheme(
      <PlayerCard player={mockPlayer} showSalary />
    );
    expect(getByText('$2.5M')).toBeTruthy();
  });

  it('formats salary in K for smaller amounts', () => {
    const lowSalary = { ...mockPlayer, salary: 800000 };
    const { getByText } = renderWithTheme(
      <PlayerCard player={lowSalary} showSalary />
    );
    expect(getByText('$800K')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = renderWithTheme(
      <PlayerCard player={mockPlayer} onPress={onPress} />
    );
    fireEvent.press(getByText('John Smith'));
    expect(onPress).toHaveBeenCalledWith(mockPlayer);
  });
});

describe('RosterScreen', () => {
  it('renders stats bar', () => {
    const { getByText } = renderWithTheme(<RosterScreen />);
    expect(getByText('Players')).toBeTruthy();
    expect(getByText('Starters')).toBeTruthy();
    expect(getByText('Injured')).toBeTruthy();
  });

  it('renders sort options', () => {
    const { getAllByText, getByText } = renderWithTheme(<RosterScreen />);
    expect(getByText('Sort by:')).toBeTruthy();
    // OVR appears in sort option and player cards
    expect(getAllByText('OVR').length).toBeGreaterThan(0);
    expect(getAllByText('Age').length).toBeGreaterThan(0);
    expect(getByText('Salary')).toBeTruthy();
    expect(getByText('Name')).toBeTruthy();
  });

  it('renders player cards', () => {
    const { getByText } = renderWithTheme(<RosterScreen />);
    expect(getByText('John Smith')).toBeTruthy();
    expect(getByText('Mike Johnson')).toBeTruthy();
  });

  it('calls onPlayerPress when player is pressed', () => {
    const onPlayerPress = jest.fn();
    const { getByText } = renderWithTheme(
      <RosterScreen onPlayerPress={onPlayerPress} />
    );

    fireEvent.press(getByText('John Smith'));
    expect(onPlayerPress).toHaveBeenCalled();
  });
});

describe('PlayerDetailScreen', () => {
  it('renders player name', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('John Smith')).toBeTruthy();
  });

  it('renders age', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText(/Age 25/)).toBeTruthy();
  });

  it('renders overall rating', () => {
    const { getAllByText } = renderWithTheme(<PlayerDetailScreen />);
    // 82 appears as overall rating and some attribute values
    expect(getAllByText('82').length).toBeGreaterThan(0);
    expect(getAllByText('OVR').length).toBeGreaterThan(0);
  });

  it('renders contract info', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Salary')).toBeTruthy();
    expect(getByText('$2.5M/yr')).toBeTruthy();
    expect(getByText('Contract')).toBeTruthy();
    expect(getByText('2 years')).toBeTruthy();
  });

  it('renders season stats', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Season Stats')).toBeTruthy();
    expect(getByText('GP')).toBeTruthy();
    expect(getByText('PPG')).toBeTruthy();
    expect(getByText('RPG')).toBeTruthy();
    expect(getByText('APG')).toBeTruthy();
  });

  it('renders attribute categories', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Physical')).toBeTruthy();
    expect(getByText('Mental')).toBeTruthy();
    expect(getByText('Technical')).toBeTruthy();
  });

  it('renders physical attributes', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Grip Strength')).toBeTruthy();
    expect(getByText('Arm Strength')).toBeTruthy();
    expect(getByText('Agility')).toBeTruthy();
    expect(getByText('Stamina')).toBeTruthy();
  });

  it('renders mental attributes', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Awareness')).toBeTruthy();
    expect(getByText('Creativity')).toBeTruthy();
    expect(getByText('Determination')).toBeTruthy();
    expect(getByText('Composure')).toBeTruthy();
  });

  it('renders technical attributes', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Hand Eye Coordination')).toBeTruthy();
    expect(getByText('Throw Accuracy')).toBeTruthy();
    expect(getByText('Finesse')).toBeTruthy();
    expect(getByText('Teamwork')).toBeTruthy();
  });

  it('renders release player button', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);
    expect(getByText('Release Player')).toBeTruthy();
  });

  it('shows confirmation modal when release is pressed', () => {
    const { getByText } = renderWithTheme(<PlayerDetailScreen />);

    fireEvent.press(getByText('Release Player'));
    expect(getByText('Release Player?')).toBeTruthy();
    expect(getByText(/Are you sure you want to release/)).toBeTruthy();
  });

  it('calls onRelease when confirmed', () => {
    const onRelease = jest.fn();
    const { getByText } = renderWithTheme(
      <PlayerDetailScreen onRelease={onRelease} />
    );

    fireEvent.press(getByText('Release Player'));
    fireEvent.press(getByText('Release'));
    expect(onRelease).toHaveBeenCalled();
  });

  it('closes modal when cancelled', () => {
    const { getByText, queryByText } = renderWithTheme(<PlayerDetailScreen />);

    fireEvent.press(getByText('Release Player'));
    expect(getByText('Release Player?')).toBeTruthy();

    fireEvent.press(getByText('Cancel'));
    expect(queryByText('Release Player?')).toBeNull();
  });
});
