/**
 * Phase 5 Week 2: Dashboard & Match Integration Tests
 *
 * Tests for connected screens and match hooks.
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { renderHook, act } from '@testing-library/react-native';
import { GameProvider, useGame } from '../context/GameContext';
import { useMatch } from '../hooks/useMatch';
import { ConnectedDashboardScreen } from '../screens/ConnectedDashboardScreen';
import { ConnectedMatchPreviewScreen } from '../screens/ConnectedMatchPreviewScreen';
import { ConnectedMatchResultScreen } from '../screens/ConnectedMatchResultScreen';
import { ThemeProvider } from '../theme';
import type { NewGameConfig } from '../screens/NewGameScreen';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => `mock-uuid-${Math.random().toString(36).substring(7)}`,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiGet: jest.fn(() => Promise.resolve([])),
  multiSet: jest.fn(() => Promise.resolve()),
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <ThemeProvider>
      <GameProvider>{component}</GameProvider>
    </ThemeProvider>
  );
};

// Helper to create a test config
const createTestConfig = (): NewGameConfig => ({
  teamName: 'Test Team',
  primaryColor: '#FF0000',
  secondaryColor: '#FFFFFF',
  difficulty: 'normal',
});

// =============================================================================
// useMatch HOOK TESTS
// =============================================================================

describe('useMatch hook', () => {
  it('returns null when matchId is undefined', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    const { result } = renderHook(() => useMatch(undefined), { wrapper });

    expect(result.current.match).toBeNull();
    expect(result.current.matchData).toBeNull();
    expect(result.current.isReady).toBe(false);
  });

  it('returns match data when game is initialized', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    // Use a custom hook that combines both
    const { result } = renderHook(
      () => {
        const game = useGame();
        const matchId = game.state.season.matches[0]?.id;
        const match = useMatch(matchId);
        return { game, match, matchId };
      },
      { wrapper }
    );

    // Initialize game
    await act(async () => {
      await result.current.game.startNewGame(createTestConfig());
    });

    // Now check the match data
    await waitFor(() => {
      expect(result.current.match.match).not.toBeNull();
    });
  });

  it('provides user lineup data', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    // Use a custom hook that combines both
    const { result } = renderHook(
      () => {
        const game = useGame();
        const matchId = game.state.season.matches[0]?.id;
        const match = useMatch(matchId);
        return { game, match };
      },
      { wrapper }
    );

    await act(async () => {
      await result.current.game.startNewGame(createTestConfig());
    });

    // Check lineup is populated after initialization
    await waitFor(() => {
      expect(result.current.match.userLineup).toBeDefined();
      expect(result.current.match.userLineup.starters.length).toBe(5);
    });
  });

  it('provides tactics data', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    const { result: gameResult } = renderHook(() => useGame(), { wrapper });

    await act(async () => {
      await gameResult.current.startNewGame(createTestConfig());
    });

    const matchId = gameResult.current.state.season.matches[0]?.id;

    if (matchId) {
      const { result: matchResult } = renderHook(() => useMatch(matchId), { wrapper });

      expect(matchResult.current.tactics).toBeDefined();
      expect(matchResult.current.tactics.pace).toBeDefined();
    }
  });
});

// =============================================================================
// ConnectedDashboardScreen TESTS
// =============================================================================

describe('ConnectedDashboardScreen', () => {
  it('renders empty state when not initialized', () => {
    const { getByText } = renderWithProviders(<ConnectedDashboardScreen />);
    expect(getByText('No game in progress')).toBeTruthy();
  });

  it('renders team name when initialized', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Test Team')).toBeTruthy();
    });
  });

  it('shows budget when initialized', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    // Budget should show (format depends on amount)
    await waitFor(async () => {
      // Look for M (millions) in the budget display
      const budgetElement = await findByText(/Budget/);
      expect(budgetElement).toBeTruthy();
    });
  });

  it('shows season progress', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('SEASON PROGRESS')).toBeTruthy();
      expect(await findByText('Week 1')).toBeTruthy();
    });
  });

  it('shows roster summary', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('ROSTER')).toBeTruthy();
      expect(await findByText('12 players')).toBeTruthy();
    });
  });

  it('shows alerts section', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('ALERTS')).toBeTruthy();
    });
  });

  it('shows recent news section', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('RECENT NEWS')).toBeTruthy();
    });
  });

  it('shows quick action buttons', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        }
      }, [state.initialized, startNewGame]);

      return <ConnectedDashboardScreen />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Sim Match')).toBeTruthy();
      expect(await findByText('Advance Week')).toBeTruthy();
    });
  });
});

// =============================================================================
// GAME SIMULATION TESTS
// =============================================================================

describe('Match Simulation', () => {
  it('updates standings after match simulation', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    const { result } = renderHook(() => useGame(), { wrapper });

    // Initialize game
    await act(async () => {
      await result.current.startNewGame(createTestConfig());
    });

    // Get user standing before
    const standingBefore = result.current.getUserStanding();
    const totalGamesBefore = standingBefore
      ? standingBefore.wins + standingBefore.losses
      : 0;

    // Find a user match
    const userMatch = result.current.state.season.matches.find(
      (m) => m.homeTeamId === 'user' || m.awayTeamId === 'user'
    );

    if (userMatch) {
      // Simulate the match
      await act(async () => {
        await result.current.simulateMatch(userMatch.id);
      });

      // Check standings updated
      const standingAfter = result.current.getUserStanding();
      const totalGamesAfter = standingAfter
        ? standingAfter.wins + standingAfter.losses
        : 0;

      expect(totalGamesAfter).toBe(totalGamesBefore + 1);
    }
  });

  it('marks match as completed after simulation', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => {
      await result.current.startNewGame(createTestConfig());
    });

    const userMatch = result.current.state.season.matches.find(
      (m) =>
        (m.homeTeamId === 'user' || m.awayTeamId === 'user') &&
        m.status === 'scheduled'
    );

    if (userMatch) {
      await act(async () => {
        await result.current.simulateMatch(userMatch.id);
      });

      const updatedMatch = result.current.state.season.matches.find(
        (m) => m.id === userMatch.id
      );

      expect(updatedMatch?.status).toBe('completed');
      expect(updatedMatch?.result).toBeDefined();
    }
  });

  it('advances week correctly', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>
        <GameProvider>{children}</GameProvider>
      </ThemeProvider>
    );

    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => {
      await result.current.startNewGame(createTestConfig());
    });

    expect(result.current.state.season.currentWeek).toBe(1);

    await act(async () => {
      await result.current.advanceWeek();
    });

    expect(result.current.state.season.currentWeek).toBe(2);
  });
});

// =============================================================================
// NAVIGATION CALLBACK TESTS
// =============================================================================

describe('Dashboard Navigation', () => {
  // Test skipped - Roster card was removed from Dashboard in UI overhaul
  // Roster is now accessed via Manage tab > Squad > Roster
  it.skip('calls onNavigateToRoster when roster card pressed', async () => {
    // Test no longer applicable after UI consolidation
  });
});

// =============================================================================
// CONNECTED MATCH PREVIEW TESTS
// =============================================================================

describe('ConnectedMatchPreviewScreen', () => {
  it('renders loading state initially', () => {
    const { getByText } = renderWithProviders(
      <ConnectedMatchPreviewScreen matchId="nonexistent" />
    );
    expect(getByText('Loading match...')).toBeTruthy();
  });

  it('renders match data when match exists', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();
      const [matchId, setMatchId] = React.useState<string | null>(null);

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        } else if (!matchId && state.season.matches.length > 0) {
          setMatchId(state.season.matches[0]?.id || null);
        }
      }, [state.initialized, state.season.matches, startNewGame, matchId]);

      if (!matchId) return null;
      return <ConnectedMatchPreviewScreen matchId={matchId} />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Starting Lineup')).toBeTruthy();
    });
  });

  it('shows tactics section', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();
      const [matchId, setMatchId] = React.useState<string | null>(null);

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        } else if (!matchId && state.season.matches.length > 0) {
          setMatchId(state.season.matches[0]?.id || null);
        }
      }, [state.initialized, state.season.matches, startNewGame, matchId]);

      if (!matchId) return null;
      return <ConnectedMatchPreviewScreen matchId={matchId} />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Tactics')).toBeTruthy();
    });
  });

  it('shows action buttons', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();
      const [matchId, setMatchId] = React.useState<string | null>(null);

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        } else if (!matchId && state.season.matches.length > 0) {
          setMatchId(state.season.matches[0]?.id || null);
        }
      }, [state.initialized, state.season.matches, startNewGame, matchId]);

      if (!matchId) return null;
      return <ConnectedMatchPreviewScreen matchId={matchId} />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Watch Match')).toBeTruthy();
      expect(await findByText('Quick Sim')).toBeTruthy();
    });
  });
});

// =============================================================================
// CONNECTED MATCH RESULT TESTS
// =============================================================================

describe('ConnectedMatchResultScreen', () => {
  it('renders loading state for invalid match', () => {
    const { getByText } = renderWithProviders(
      <ConnectedMatchResultScreen matchId="nonexistent" />
    );
    expect(getByText('Loading result...')).toBeTruthy();
  });

  it('shows match not completed for scheduled match', async () => {
    const TestComponent = () => {
      const { startNewGame, state } = useGame();
      const [matchId, setMatchId] = React.useState<string | null>(null);

      React.useEffect(() => {
        if (!state.initialized) {
          startNewGame(createTestConfig());
        } else if (!matchId && state.season.matches.length > 0) {
          setMatchId(state.season.matches[0]?.id || null);
        }
      }, [state.initialized, state.season.matches, startNewGame, matchId]);

      if (!matchId) return null;
      return <ConnectedMatchResultScreen matchId={matchId} />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    await waitFor(async () => {
      expect(await findByText('Match not yet completed')).toBeTruthy();
    });
  });

  it('shows result after match simulation', async () => {
    const TestComponent = () => {
      const { startNewGame, state, simulateMatch } = useGame();
      const [matchId, setMatchId] = React.useState<string | null>(null);
      const [simulated, setSimulated] = React.useState(false);

      React.useEffect(() => {
        const init = async () => {
          if (!state.initialized) {
            await startNewGame(createTestConfig());
          } else if (!matchId && state.season.matches.length > 0) {
            const id = state.season.matches[0]?.id || null;
            setMatchId(id);
          } else if (matchId && !simulated) {
            setSimulated(true);
            await simulateMatch(matchId);
          }
        };
        init();
      }, [state.initialized, state.season.matches, startNewGame, matchId, simulated, simulateMatch]);

      if (!matchId) return null;
      return <ConnectedMatchResultScreen matchId={matchId} />;
    };

    const { findByText } = renderWithProviders(<TestComponent />);

    // Wait for simulation to complete and result to show
    await waitFor(
      async () => {
        const victory = await findByText(/VICTORY|DEFEAT/);
        expect(victory).toBeTruthy();
      },
      { timeout: 10000 }
    );
  });
});
