/**
 * Game Storage - Persistence Layer
 *
 * Handles saving and loading game state using AsyncStorage:
 * - Save game state on key actions
 * - Load game state on app launch
 * - Auto-save after match completion
 * - Manual save option
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const STORAGE_KEYS = {
  GAME_STATE: '@multiball/game_state',
  FULL_GAME_STATE: '@multiball/full_game_state',
  SETTINGS: '@multiball/settings',
  SAVE_TIMESTAMP: '@multiball/save_timestamp',
} as const;

// =============================================================================
// DATE SERIALIZATION HELPERS
// =============================================================================

/**
 * Custom JSON replacer to handle Date objects
 * Converts Date objects to a special format that can be revived
 */
function dateReplacer(_key: string, value: any): any {
  if (value instanceof Date) {
    return { __type: 'Date', __value: value.toISOString() };
  }
  return value;
}

/**
 * Custom JSON reviver to restore Date objects
 * Converts our special Date format back to Date objects
 */
function dateReviver(_key: string, value: any): any {
  if (value && value.__type === 'Date') {
    return new Date(value.__value);
  }
  return value;
}

// =============================================================================
// TYPES
// =============================================================================

export interface SavedGameState {
  version: number;
  savedAt: string;
  teamId: string;
  teamName: string;
  seasonNumber: number;
  currentWeek: number;
  budget: number;
  roster: SavedPlayer[];
  seasonRecord: SeasonRecord;
  standings: Record<string, StandingEntry[]>;
  schedule: SavedMatch[];
}

export interface SavedPlayer {
  id: string;
  name: string;
  position: string;
  overall: number;
  age: number;
  salary: number;
  isStarter: boolean;
  attributes: Record<string, number>;
}

export interface SeasonRecord {
  wins: number;
  losses: number;
  draws: number;
}

export interface StandingEntry {
  teamId: string;
  teamName: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

export interface SavedMatch {
  id: string;
  week: number;
  sport: string;
  opponent: string;
  isHome: boolean;
  status: 'scheduled' | 'completed';
  result?: {
    homeScore: number;
    awayScore: number;
    winner: 'home' | 'away';
  };
}

export interface GameSettings {
  simulationSpeed: 'slow' | 'normal' | 'fast';
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoSave: boolean;
  theme: 'light' | 'dark' | 'system';
}

export interface SaveResult {
  success: boolean;
  timestamp?: string;
  error?: string;
}

export interface LoadResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// =============================================================================
// CURRENT SAVE VERSION
// =============================================================================

const CURRENT_SAVE_VERSION = 1;

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULT_SETTINGS: GameSettings = {
  simulationSpeed: 'normal',
  soundEnabled: true,
  notificationsEnabled: true,
  autoSave: true,
  theme: 'system',
};

// =============================================================================
// SAVE FUNCTIONS
// =============================================================================

/**
 * Save game state to AsyncStorage
 */
export async function saveGameState(state: Omit<SavedGameState, 'version' | 'savedAt'>): Promise<SaveResult> {
  try {
    const timestamp = new Date().toISOString();
    const saveData: SavedGameState = {
      ...state,
      version: CURRENT_SAVE_VERSION,
      savedAt: timestamp,
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.GAME_STATE,
      JSON.stringify(saveData)
    );
    await AsyncStorage.setItem(STORAGE_KEYS.SAVE_TIMESTAMP, timestamp);

    return { success: true, timestamp };
  } catch (error) {
    console.error('Failed to save game state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Save game settings
 */
export async function saveSettings(settings: GameSettings): Promise<SaveResult> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEYS.SETTINGS,
      JSON.stringify(settings)
    );
    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// LOAD FUNCTIONS
// =============================================================================

/**
 * Load game state from AsyncStorage
 */
export async function loadGameState(): Promise<LoadResult<SavedGameState>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);

    if (!data) {
      return { success: true, data: undefined };
    }

    const parsed = JSON.parse(data) as SavedGameState;

    // Handle version migrations if needed
    if (parsed.version !== CURRENT_SAVE_VERSION) {
      const migrated = migrateGameState(parsed);
      // Save migrated state
      await AsyncStorage.setItem(
        STORAGE_KEYS.GAME_STATE,
        JSON.stringify(migrated)
      );
      return { success: true, data: migrated };
    }

    return { success: true, data: parsed };
  } catch (error) {
    console.error('Failed to load game state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load game settings
 */
export async function loadSettings(): Promise<LoadResult<GameSettings>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);

    if (!data) {
      return { success: true, data: DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(data) as GameSettings;
    // Merge with defaults for any missing keys
    const merged = { ...DEFAULT_SETTINGS, ...parsed };

    return { success: true, data: merged };
  } catch (error) {
    console.error('Failed to load settings:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get last save timestamp
 */
export async function getLastSaveTime(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.SAVE_TIMESTAMP);
  } catch {
    return null;
  }
}

// =============================================================================
// DELETE FUNCTIONS
// =============================================================================

/**
 * Delete saved game (reset)
 */
export async function deleteGameState(): Promise<SaveResult> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    await AsyncStorage.removeItem(STORAGE_KEYS.SAVE_TIMESTAMP);
    return { success: true };
  } catch (error) {
    console.error('Failed to delete game state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Clear all app data
 */
export async function clearAllData(): Promise<SaveResult> {
  try {
    const keys = Object.values(STORAGE_KEYS);
    await AsyncStorage.multiRemove(keys);
    return { success: true };
  } catch (error) {
    console.error('Failed to clear all data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a saved game exists
 */
export async function hasSavedGame(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);
    return data !== null;
  } catch {
    return false;
  }
}

/**
 * Get save file info without loading full state
 */
export async function getSaveInfo(): Promise<{
  exists: boolean;
  savedAt?: string;
  teamName?: string;
  seasonNumber?: number;
}> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);
    if (!data) {
      return { exists: false };
    }

    const parsed = JSON.parse(data) as SavedGameState;
    return {
      exists: true,
      savedAt: parsed.savedAt,
      teamName: parsed.teamName,
      seasonNumber: parsed.seasonNumber,
    };
  } catch {
    return { exists: false };
  }
}

// =============================================================================
// MIGRATION
// =============================================================================

/**
 * Migrate old save format to current version
 */
function migrateGameState(oldState: SavedGameState): SavedGameState {
  // For now, just update version
  // Future migrations would transform data here
  return {
    ...oldState,
    version: CURRENT_SAVE_VERSION,
  };
}

// =============================================================================
// FULL STATE SAVE/LOAD (for proper game restoration)
// =============================================================================

/**
 * Save the complete game state for proper restoration
 * This saves everything needed to restore the exact game state
 */
export async function saveFullGameState(state: unknown): Promise<SaveResult> {
  try {
    const timestamp = new Date().toISOString();
    const saveData = {
      version: CURRENT_SAVE_VERSION,
      savedAt: timestamp,
      state,
    };

    await AsyncStorage.setItem(
      STORAGE_KEYS.FULL_GAME_STATE,
      JSON.stringify(saveData, dateReplacer)
    );
    await AsyncStorage.setItem(STORAGE_KEYS.SAVE_TIMESTAMP, timestamp);

    return { success: true, timestamp };
  } catch (error) {
    console.error('Failed to save full game state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Load the complete game state
 */
export async function loadFullGameState(): Promise<LoadResult<unknown>> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FULL_GAME_STATE);

    if (!data) {
      return { success: true, data: undefined };
    }

    const parsed = JSON.parse(data, dateReviver);
    return { success: true, data: parsed.state };
  } catch (error) {
    console.error('Failed to load full game state:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a full saved game exists
 */
export async function hasFullSavedGame(): Promise<boolean> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FULL_GAME_STATE);
    return data !== null;
  } catch {
    return false;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const GameStorage = {
  // Save
  saveGameState,
  saveSettings,
  saveFullGameState,
  // Load
  loadGameState,
  loadSettings,
  loadFullGameState,
  getLastSaveTime,
  // Delete
  deleteGameState,
  clearAllData,
  // Utility
  hasSavedGame,
  hasFullSavedGame,
  getSaveInfo,
  // Constants
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
};

export default GameStorage;
