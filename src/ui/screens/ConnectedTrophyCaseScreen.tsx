/**
 * Connected Trophy Case Screen
 *
 * Connects TrophyCaseScreen to game state via GameContext.
 */

import React from 'react';
import { TrophyCaseScreen } from './TrophyCaseScreen';
import { useGame } from '../context/GameContext';

export function ConnectedTrophyCaseScreen() {
  const { state } = useGame();

  return (
    <TrophyCaseScreen
      trophies={state.trophies}
      playerAwards={state.playerAwards}
      teamName={state.userTeam.name}
    />
  );
}

export default ConnectedTrophyCaseScreen;
