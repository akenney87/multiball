/**
 * Market & Settings Screens Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TransferMarketScreen } from '../screens/TransferMarketScreen';
import { BudgetScreen } from '../screens/BudgetScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('TransferMarketScreen', () => {
  it('renders budget bar', () => {
    const { getByText, getAllByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('Transfer Budget')).toBeTruthy();
    // $5.0M appears in budget bar
    expect(getAllByText('$5.0M').length).toBeGreaterThan(0);
  });

  it('renders tabs', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('Browse Players')).toBeTruthy();
    expect(getByText('Incoming Offers')).toBeTruthy();
  });

  it('renders position filters', () => {
    const { getAllByText, getByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('ALL')).toBeTruthy();
    expect(getAllByText('PG').length).toBeGreaterThan(0);
    expect(getAllByText('SG').length).toBeGreaterThan(0);
  });

  it('renders transfer targets', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('Marcus Thompson')).toBeTruthy();
    expect(getByText('Warriors')).toBeTruthy();
  });

  it('shows asking price for targets', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('$3.5M')).toBeTruthy();
  });

  it('shows negotiating badge when applicable', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);
    expect(getByText('Negotiating')).toBeTruthy();
  });

  it('switches to offers tab', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);

    fireEvent.press(getByText('Incoming Offers'));
    expect(getByText('Offer from Thunder')).toBeTruthy();
  });

  it('shows offer expiration', () => {
    const { getByText } = renderWithTheme(<TransferMarketScreen />);

    fireEvent.press(getByText('Incoming Offers'));
    expect(getByText('3d left')).toBeTruthy();
  });

  it('shows accept and reject buttons for offers', () => {
    const { getByText, getAllByText } = renderWithTheme(<TransferMarketScreen />);

    fireEvent.press(getByText('Incoming Offers'));
    expect(getAllByText('Accept').length).toBeGreaterThan(0);
    expect(getAllByText('Reject').length).toBeGreaterThan(0);
  });

  it('shows confirmation modal when clicking on target', () => {
    const { getByText, getAllByText } = renderWithTheme(<TransferMarketScreen />);

    fireEvent.press(getByText('Marcus Thompson'));
    // "Make Offer" appears as modal title
    expect(getAllByText('Make Offer').length).toBeGreaterThan(0);
  });

  it('calls onMakeOffer when confirmed', () => {
    const onMakeOffer = jest.fn();
    const { getByText, getAllByText } = renderWithTheme(
      <TransferMarketScreen onMakeOffer={onMakeOffer} />
    );

    fireEvent.press(getByText('Marcus Thompson'));
    // There are two "Make Offer" texts - one is the modal title
    const makeOfferButtons = getAllByText('Make Offer');
    fireEvent.press(makeOfferButtons[makeOfferButtons.length - 1]);
    expect(onMakeOffer).toHaveBeenCalled();
  });
});

describe('BudgetScreen', () => {
  it('renders budget overview', () => {
    const { getByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('Budget Overview')).toBeTruthy();
    expect(getByText('Total Budget')).toBeTruthy();
    expect(getByText('Salary Commitment')).toBeTruthy();
    expect(getByText('Available for Ops')).toBeTruthy();
  });

  it('renders budget amounts', () => {
    const { getByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('$10.0M')).toBeTruthy();
    expect(getByText('-$7.5M')).toBeTruthy();
    expect(getByText('$2.5M')).toBeTruthy();
  });

  it('renders allocation categories', () => {
    const { getByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('Budget Allocation')).toBeTruthy();
    expect(getByText('Training')).toBeTruthy();
    expect(getByText('Scouting')).toBeTruthy();
    expect(getByText('Facilities')).toBeTruthy();
    expect(getByText('Youth Development')).toBeTruthy();
    expect(getByText('Marketing')).toBeTruthy();
  });

  it('shows allocation percentages', () => {
    const { getByText, getAllByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('30%')).toBeTruthy();
    // 20% appears twice (Scouting, Facilities)
    expect(getAllByText('20%').length).toBeGreaterThan(0);
    // 15% appears twice (Youth, Marketing)
    expect(getAllByText('15%').length).toBeGreaterThan(0);
  });

  it('shows valid allocation status', () => {
    const { getByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('Allocation is valid (100%)')).toBeTruthy();
  });

  it('shows save button', () => {
    const { getByText } = renderWithTheme(<BudgetScreen />);
    expect(getByText('Save Allocation')).toBeTruthy();
  });

  it('adjusts allocation when buttons pressed', () => {
    const { getAllByText, getByText, queryByText } = renderWithTheme(<BudgetScreen />);

    // Initially no reset button (no changes)
    expect(queryByText('Reset')).toBeNull();

    // Press +5 on first slider (Training)
    const plusButtons = getAllByText('+5');
    fireEvent.press(plusButtons[0]);

    // Reset button should appear
    expect(getByText('Reset')).toBeTruthy();
    // Training should now be 35%
    expect(getByText('35%')).toBeTruthy();
  });

  it('shows confirmation when saving', () => {
    const { getAllByText, getByText } = renderWithTheme(<BudgetScreen />);

    // Make a change first
    const plusButtons = getAllByText('+5');
    fireEvent.press(plusButtons[0]);

    // Try to save
    fireEvent.press(getByText('Save Allocation'));
    expect(getByText('Save Budget Allocation?')).toBeTruthy();
  });
});

describe('SettingsScreen', () => {
  it('renders gameplay section', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);
    expect(getByText('GAMEPLAY')).toBeTruthy();
    expect(getByText('Simulation Speed')).toBeTruthy();
    expect(getByText('Sound Effects')).toBeTruthy();
    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Auto-Save')).toBeTruthy();
  });

  it('renders speed selector', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);
    expect(getByText('Slow')).toBeTruthy();
    expect(getByText('Normal')).toBeTruthy();
    expect(getByText('Fast')).toBeTruthy();
  });

  it('renders appearance section', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);
    expect(getByText('APPEARANCE')).toBeTruthy();
    expect(getByText('Theme')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
    expect(getByText('Dark')).toBeTruthy();
    expect(getByText('System')).toBeTruthy();
  });

  it('renders data section', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);
    expect(getByText('DATA')).toBeTruthy();
    expect(getByText('Reset Game')).toBeTruthy();
  });

  it('renders about section', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);
    expect(getByText('ABOUT')).toBeTruthy();
    expect(getByText('Version')).toBeTruthy();
    expect(getByText('1.0.0')).toBeTruthy();
    expect(getByText('Multiball Studios')).toBeTruthy();
  });

  it('shows reset confirmation', () => {
    const { getByText } = renderWithTheme(<SettingsScreen />);

    fireEvent.press(getByText('Reset Game'));
    expect(getByText('Reset Game?')).toBeTruthy();
    expect(getByText(/delete all your saved progress/)).toBeTruthy();
  });

  it('calls onResetGame when confirmed', () => {
    const onResetGame = jest.fn();
    const { getByText, getAllByText } = renderWithTheme(
      <SettingsScreen onResetGame={onResetGame} />
    );

    fireEvent.press(getByText('Reset Game'));
    // There are two "Reset" buttons - one in data section, one in modal
    const resetButtons = getAllByText('Reset');
    fireEvent.press(resetButtons[resetButtons.length - 1]);
    expect(onResetGame).toHaveBeenCalled();
  });

  it('calls onSettingsChange when speed changes', () => {
    const onSettingsChange = jest.fn();
    const { getByText } = renderWithTheme(
      <SettingsScreen onSettingsChange={onSettingsChange} />
    );

    fireEvent.press(getByText('Fast'));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ simulationSpeed: 'fast' })
    );
  });

  it('calls onSettingsChange when theme changes', () => {
    const onSettingsChange = jest.fn();
    const { getByText } = renderWithTheme(
      <SettingsScreen onSettingsChange={onSettingsChange} />
    );

    fireEvent.press(getByText('Dark'));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'dark' })
    );
  });
});
