/**
 * Connected Leaderboard Screen
 *
 * Connects LeaderboardScreen to game state via GameContext.
 */

import React from 'react';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useGame } from '../context/GameContext';

export function ConnectedLeaderboardScreen() {
  const { state } = useGame();

  return <LeaderboardScreen managerCareer={state.managerCareer} />;
}

export default ConnectedLeaderboardScreen;
