/**
 * Local Storage Manager for Multiball
 *
 * AsyncStorage wrapper for game saves and settings.
 * Optimized for mobile performance with compression and caching.
 *
 * @module data/storage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { GameSave } from './types';

// =============================================================================
// STORAGE KEYS
// =============================================================================

export const STORAGE_KEYS = {
  /** Main game save */
  GAME_SAVE: '@multiball:game_save',

  /** User settings */
  SETTINGS: '@multiball:settings',

  /** Tutorial completion status */
  TUTORIAL_COMPLETED: '@multiball:tutorial',

  /** Save metadata (for quick load screen) */
  SAVE_METADATA: '@multiball:save_metadata',
} as const;

// =============================================================================
// SAVE METADATA
// =============================================================================

/**
 * Lightweight save metadata for quick loading
 * Used for save selection screen without loading full save
 */
export interface SaveMetadata {
  /** Save ID */
  saveId: string;

  /** Save name */
  saveName: string;

  /** Last saved timestamp */
  lastSaved: Date;

  /** Game version */
  version: string;

  /** User's team name */
  teamName: string;

  /** Current season */
  currentSeason: number;

  /** Current division */
  currentDivision: number;

  /** Total playtime (seconds) */
  totalPlaytime: number;
}

// =============================================================================
// STORAGE ERRORS
// =============================================================================

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'StorageError';
  }
}

export class SaveNotFoundError extends StorageError {
  constructor() {
    super('No save game found');
    this.name = 'SaveNotFoundError';
  }
}

export class SaveCorruptedError extends StorageError {
  constructor(cause?: Error) {
    super('Save game data is corrupted', cause);
    this.name = 'SaveCorruptedError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor() {
    super('Storage quota exceeded');
    this.name = 'StorageQuotaError';
  }
}

// =============================================================================
// GAME STORAGE CLASS
// =============================================================================

/**
 * Main storage manager for game saves
 */
export class GameStorage {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL: number = 5000; // 5 seconds

  /**
   * Save game state to local storage
   *
   * @param gameState - Complete game save state
   * @throws {StorageQuotaError} If storage quota exceeded
   * @throws {StorageError} If save fails
   */
  async saveGame(gameState: GameSave): Promise<void> {
    try {
      // Update last saved timestamp
      const saveWithTimestamp: GameSave = {
        ...gameState,
        lastSaved: new Date(),
      };

      // Serialize to JSON
      const serialized = JSON.stringify(saveWithTimestamp, this.jsonReplacer);

      // Log save size (helpful for debugging)
      const sizeKB = new Blob([serialized]).size / 1024;
      console.log(`[Storage] Saving game (${sizeKB.toFixed(2)} KB)`);

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.GAME_SAVE, serialized);

      // Update metadata for quick loading
      await this.saveSaveMetadata(saveWithTimestamp);

      // Update cache
      this.cache.set(STORAGE_KEYS.GAME_SAVE, {
        data: saveWithTimestamp,
        timestamp: Date.now(),
      });

      console.log('[Storage] Game saved successfully');
    } catch (error) {
      // Check for quota exceeded error
      if (error instanceof Error && error.message.includes('quota')) {
        throw new StorageQuotaError();
      }

      throw new StorageError('Failed to save game', error as Error);
    }
  }

  /**
   * Load game state from local storage
   *
   * @returns Game save state or null if not found
   * @throws {SaveCorruptedError} If save data is corrupted
   * @throws {StorageError} If load fails
   */
  async loadGame(): Promise<GameSave | null> {
    try {
      // Check cache first
      const cached = this.getFromCache(STORAGE_KEYS.GAME_SAVE);
      if (cached) {
        console.log('[Storage] Loading game from cache');
        return cached as GameSave;
      }

      // Load from AsyncStorage
      const serialized = await AsyncStorage.getItem(STORAGE_KEYS.GAME_SAVE);

      if (!serialized) {
        console.log('[Storage] No save game found');
        return null;
      }

      // Deserialize
      const gameState = JSON.parse(serialized, this.jsonReviver) as GameSave;

      // Validate save structure
      if (!this.validateSaveStructure(gameState)) {
        throw new SaveCorruptedError();
      }

      // Update cache
      this.cache.set(STORAGE_KEYS.GAME_SAVE, {
        data: gameState,
        timestamp: Date.now(),
      });

      const sizeKB = new Blob([serialized]).size / 1024;
      console.log(`[Storage] Game loaded successfully (${sizeKB.toFixed(2)} KB)`);

      return gameState;
    } catch (error) {
      if (error instanceof SaveCorruptedError) {
        throw error;
      }

      throw new StorageError('Failed to load game', error as Error);
    }
  }

  /**
   * Delete game save from local storage
   *
   * @throws {StorageError} If deletion fails
   */
  async deleteGame(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.GAME_SAVE,
        STORAGE_KEYS.SAVE_METADATA,
      ]);

      // Clear cache
      this.cache.delete(STORAGE_KEYS.GAME_SAVE);
      this.cache.delete(STORAGE_KEYS.SAVE_METADATA);

      console.log('[Storage] Game deleted successfully');
    } catch (error) {
      throw new StorageError('Failed to delete game', error as Error);
    }
  }

  /**
   * Check if a save game exists
   *
   * @returns True if save exists
   */
  async hasSaveGame(): Promise<boolean> {
    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEYS.GAME_SAVE);
      return serialized !== null;
    } catch (error) {
      console.error('[Storage] Error checking for save game:', error);
      return false;
    }
  }

  /**
   * Load save metadata (lightweight, for save selection screen)
   *
   * @returns Save metadata or null if not found
   */
  async loadSaveMetadata(): Promise<SaveMetadata | null> {
    try {
      const cached = this.getFromCache(STORAGE_KEYS.SAVE_METADATA);
      if (cached) {
        return cached as SaveMetadata;
      }

      const serialized = await AsyncStorage.getItem(STORAGE_KEYS.SAVE_METADATA);

      if (!serialized) {
        return null;
      }

      const metadata = JSON.parse(serialized, this.jsonReviver) as SaveMetadata;

      this.cache.set(STORAGE_KEYS.SAVE_METADATA, {
        data: metadata,
        timestamp: Date.now(),
      });

      return metadata;
    } catch (error) {
      console.error('[Storage] Error loading save metadata:', error);
      return null;
    }
  }

  /**
   * Save metadata for quick loading
   *
   * @param gameState - Game save state
   */
  private async saveSaveMetadata(gameState: GameSave): Promise<void> {
    const metadata: SaveMetadata = {
      saveId: gameState.saveId,
      saveName: gameState.saveName,
      lastSaved: gameState.lastSaved,
      version: gameState.version,
      teamName: gameState.franchise.name,
      currentSeason: gameState.franchise.currentSeason,
      currentDivision: gameState.franchise.division,
      totalPlaytime: 0, // TODO: Track playtime
    };

    const serialized = JSON.stringify(metadata, this.jsonReplacer);
    await AsyncStorage.setItem(STORAGE_KEYS.SAVE_METADATA, serialized);
  }

  /**
   * Get data from cache if available and not expired
   *
   * @param key - Cache key
   * @returns Cached data or null
   */
  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) {
      return null;
    }

    // Check TTL
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Custom JSON replacer to handle Date objects
   */
  private jsonReplacer(key: string, value: any): any {
    // Convert Date objects to ISO strings
    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }
    return value;
  }

  /**
   * Custom JSON reviver to restore Date objects
   */
  private jsonReviver(key: string, value: any): any {
    // Restore Date objects
    if (value && typeof value === 'object' && value.__type === 'Date') {
      return new Date(value.value);
    }
    return value;
  }

  /**
   * Validate save structure (basic integrity check)
   *
   * @param save - Save data to validate
   * @returns True if valid
   */
  private validateSaveStructure(save: any): save is GameSave {
    return (
      save &&
      typeof save === 'object' &&
      typeof save.version === 'string' &&
      typeof save.saveId === 'string' &&
      save.franchise &&
      Array.isArray(save.players) &&
      save.season
    );
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Storage] Cache cleared');
  }

  /**
   * Get storage usage statistics
   *
   * @returns Storage statistics
   */
  async getStorageStats(): Promise<{
    totalKeys: number;
    estimatedSize: number;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let estimatedSize = 0;

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          estimatedSize += new Blob([value]).size;
        }
      }

      return {
        totalKeys: keys.length,
        estimatedSize, // bytes
      };
    } catch (error) {
      console.error('[Storage] Error getting storage stats:', error);
      return {
        totalKeys: 0,
        estimatedSize: 0,
      };
    }
  }
}

// =============================================================================
// SETTINGS STORAGE
// =============================================================================

/**
 * User settings
 */
export interface UserSettings {
  /** Sound enabled */
  soundEnabled: boolean;

  /** Music enabled */
  musicEnabled: boolean;

  /** Notifications enabled */
  notificationsEnabled: boolean;

  /** Auto-save enabled */
  autoSaveEnabled: boolean;

  /** Auto-save interval (minutes) */
  autoSaveInterval: number;

  /** Preferred simulation speed */
  simulationSpeed: 'slow' | 'normal' | 'fast';

  /** Show advanced stats */
  showAdvancedStats: boolean;
}

/**
 * Default user settings
 */
export const DEFAULT_SETTINGS: UserSettings = {
  soundEnabled: true,
  musicEnabled: true,
  notificationsEnabled: true,
  autoSaveEnabled: true,
  autoSaveInterval: 5, // minutes
  simulationSpeed: 'normal',
  showAdvancedStats: false,
};

/**
 * Settings storage manager
 */
export class SettingsStorage {
  /**
   * Load user settings
   *
   * @returns User settings
   */
  async loadSettings(): Promise<UserSettings> {
    try {
      const serialized = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS);

      if (!serialized) {
        return DEFAULT_SETTINGS;
      }

      const settings = JSON.parse(serialized) as UserSettings;
      return { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      console.error('[Storage] Error loading settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save user settings
   *
   * @param settings - User settings
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    try {
      const serialized = JSON.stringify(settings);
      await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, serialized);
      console.log('[Storage] Settings saved successfully');
    } catch (error) {
      console.error('[Storage] Error saving settings:', error);
      throw new StorageError('Failed to save settings', error as Error);
    }
  }
}

// =============================================================================
// TUTORIAL STORAGE
// =============================================================================

/**
 * Tutorial storage manager
 */
export class TutorialStorage {
  /**
   * Check if tutorial has been completed
   *
   * @returns True if completed
   */
  async isTutorialCompleted(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(STORAGE_KEYS.TUTORIAL_COMPLETED);
      return value === 'true';
    } catch (error) {
      console.error('[Storage] Error checking tutorial status:', error);
      return false;
    }
  }

  /**
   * Mark tutorial as completed
   */
  async markTutorialCompleted(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.TUTORIAL_COMPLETED, 'true');
      console.log('[Storage] Tutorial marked as completed');
    } catch (error) {
      console.error('[Storage] Error marking tutorial complete:', error);
      throw new StorageError('Failed to mark tutorial complete', error as Error);
    }
  }

  /**
   * Reset tutorial status
   */
  async resetTutorial(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.TUTORIAL_COMPLETED);
      console.log('[Storage] Tutorial status reset');
    } catch (error) {
      console.error('[Storage] Error resetting tutorial:', error);
      throw new StorageError('Failed to reset tutorial', error as Error);
    }
  }
}

// =============================================================================
// SINGLETON INSTANCES
// =============================================================================

/** Singleton game storage instance */
export const gameStorage = new GameStorage();

/** Singleton settings storage instance */
export const settingsStorage = new SettingsStorage();

/** Singleton tutorial storage instance */
export const tutorialStorage = new TutorialStorage();

// =============================================================================
// CLOUD SAVE COMPATIBILITY (Future)
// =============================================================================

/**
 * Cloud save manager (stub for future implementation)
 *
 * Architecture supports cloud saves, but not implemented in MVP.
 * This interface defines the contract for future cloud save implementation.
 */
export interface ICloudSaveManager {
  /**
   * Upload save to cloud
   */
  uploadSave(save: GameSave): Promise<void>;

  /**
   * Download save from cloud
   */
  downloadSave(saveId: string): Promise<GameSave>;

  /**
   * Sync local and cloud saves
   */
  syncSaves(): Promise<void>;

  /**
   * Check if cloud save is newer than local
   */
  isCloudNewer(saveId: string): Promise<boolean>;

  /**
   * Resolve save conflict
   */
  resolveConflict(saveId: string, resolution: 'local' | 'cloud'): Promise<void>;
}

/**
 * Cloud save manager placeholder
 *
 * Future implementation will handle:
 * - Upload/download saves to cloud storage (Firebase, AWS, etc.)
 * - Conflict resolution between local and cloud saves
 * - Automatic sync when online
 * - Cross-platform save support (iOS <-> Android)
 */
export class CloudSaveManager implements ICloudSaveManager {
  async uploadSave(save: GameSave): Promise<void> {
    throw new Error('Cloud saves not implemented in MVP');
  }

  async downloadSave(saveId: string): Promise<GameSave> {
    throw new Error('Cloud saves not implemented in MVP');
  }

  async syncSaves(): Promise<void> {
    throw new Error('Cloud saves not implemented in MVP');
  }

  async isCloudNewer(saveId: string): Promise<boolean> {
    throw new Error('Cloud saves not implemented in MVP');
  }

  async resolveConflict(saveId: string, resolution: 'local' | 'cloud'): Promise<void> {
    throw new Error('Cloud saves not implemented in MVP');
  }
}
