/**
 * Confirmation Modal Tests
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ConfirmationModal } from '../components/common/ConfirmationModal';
import { ThemeProvider } from '../theme';

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ConfirmationModal', () => {
  const defaultProps = {
    visible: true,
    title: 'Test Title',
    message: 'Test message',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders title and message', () => {
    const { getByText } = renderWithTheme(<ConfirmationModal {...defaultProps} />);

    expect(getByText('Test Title')).toBeTruthy();
    expect(getByText('Test message')).toBeTruthy();
  });

  it('renders default button text', () => {
    const { getByText } = renderWithTheme(<ConfirmationModal {...defaultProps} />);

    expect(getByText('Confirm')).toBeTruthy();
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders custom button text', () => {
    const { getByText } = renderWithTheme(
      <ConfirmationModal
        {...defaultProps}
        confirmText="Yes, do it"
        cancelText="No thanks"
      />
    );

    expect(getByText('Yes, do it')).toBeTruthy();
    expect(getByText('No thanks')).toBeTruthy();
  });

  it('calls onConfirm when confirm button is pressed', () => {
    const onConfirm = jest.fn();
    const { getByText } = renderWithTheme(
      <ConfirmationModal {...defaultProps} onConfirm={onConfirm} />
    );

    fireEvent.press(getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button is pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = renderWithTheme(
      <ConfirmationModal {...defaultProps} onCancel={onCancel} />
    );

    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('does not render when visible is false', () => {
    const { queryByText } = renderWithTheme(
      <ConfirmationModal {...defaultProps} visible={false} />
    );

    expect(queryByText('Test Title')).toBeNull();
  });

  it('supports destructive confirm style', () => {
    const { getByText } = renderWithTheme(
      <ConfirmationModal {...defaultProps} confirmStyle="destructive" />
    );

    // Component renders (style would be applied)
    expect(getByText('Confirm')).toBeTruthy();
  });
});
