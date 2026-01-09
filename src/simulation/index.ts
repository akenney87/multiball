/**
 * Basketball Simulation Engine - Main Exports
 *
 * Entry point for the basketball simulation system.
 * This is a TypeScript port of the Python basketball-sim.
 *
 * @module simulation
 */

// Core modules
export * from './core/probability';
export * from './core/types';
export * from './constants';

// Game Simulation (main entry point for UI)
export { GameSimulator, type GameResult } from './game/gameSimulation';
export { QuarterSimulator, type QuarterResult } from './game/quarterSimulation';

// Systems (lower-level, used internally)
export { FoulSystem } from './systems/fouls';
export { TimeoutManager } from './systems/timeoutManager';
export { SubstitutionManager } from './systems/substitutions';

// Stamina
export { StaminaManager, recoverStamina } from './stamina/staminaManager';

// Play-by-play
export { PlayByPlayLog } from './playByPlay/playByPlay';
