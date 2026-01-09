/**
 * Persistence Layer Tests
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  GameStorage,
  SavedGameState,
  GameSettings,
} from '../persistence/gameStorage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  multiRemove: jest.fn(() => Promise.resolve()),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('GameStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('saveGameState', () => {
    const mockState = {
      teamId: 'team-1',
      teamName: 'My Team',
      seasonNumber: 1,
      currentWeek: 5,
      budget: 1000000,
      roster: [],
      seasonRecord: { wins: 3, losses: 2, draws: 0 },
      standings: {},
      schedule: [],
    };

    it('saves game state to AsyncStorage', async () => {
      const result = await GameStorage.saveGameState(mockState);

      expect(result.success).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('includes version and savedAt in saved data', async () => {
      await GameStorage.saveGameState(mockState);

      const savedData = JSON.parse(
        mockAsyncStorage.setItem.mock.calls[0][1] as string
      );
      expect(savedData.version).toBe(1);
      expect(savedData.savedAt).toBeDefined();
    });

    it('returns error on failure', async () => {
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

      const result = await GameStorage.saveGameState(mockState);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage full');
    });
  });

  describe('loadGameState', () => {
    it('returns undefined when no saved game exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await GameStorage.loadGameState();

      expect(result.success).toBe(true);
      expect(result.data).toBeUndefined();
    });

    it('loads saved game state', async () => {
      const savedState: SavedGameState = {
        version: 1,
        savedAt: new Date().toISOString(),
        teamId: 'team-1',
        teamName: 'My Team',
        seasonNumber: 1,
        currentWeek: 5,
        budget: 1000000,
        roster: [],
        seasonRecord: { wins: 3, losses: 2, draws: 0 },
        standings: {},
        schedule: [],
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedState));

      const result = await GameStorage.loadGameState();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(savedState);
    });

    it('returns error on parse failure', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const result = await GameStorage.loadGameState();

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('saveSettings', () => {
    it('saves settings to AsyncStorage', async () => {
      const settings: GameSettings = {
        simulationSpeed: 'fast',
        soundEnabled: false,
        notificationsEnabled: true,
        autoSave: true,
        theme: 'dark',
      };

      const result = await GameStorage.saveSettings(settings);

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        '@multiball/settings',
        JSON.stringify(settings)
      );
    });
  });

  describe('loadSettings', () => {
    it('returns default settings when none saved', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await GameStorage.loadSettings();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(GameStorage.DEFAULT_SETTINGS);
    });

    it('loads saved settings', async () => {
      const settings: GameSettings = {
        simulationSpeed: 'fast',
        soundEnabled: false,
        notificationsEnabled: true,
        autoSave: false,
        theme: 'dark',
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(settings));

      const result = await GameStorage.loadSettings();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(settings);
    });

    it('merges partial settings with defaults', async () => {
      const partialSettings = { simulationSpeed: 'slow' };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(partialSettings));

      const result = await GameStorage.loadSettings();

      expect(result.success).toBe(true);
      expect(result.data?.simulationSpeed).toBe('slow');
      expect(result.data?.soundEnabled).toBe(true); // Default
    });
  });

  describe('deleteGameState', () => {
    it('removes game state from AsyncStorage', async () => {
      const result = await GameStorage.deleteGameState();

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearAllData', () => {
    it('removes all app data', async () => {
      const result = await GameStorage.clearAllData();

      expect(result.success).toBe(true);
      expect(mockAsyncStorage.multiRemove).toHaveBeenCalled();
    });
  });

  describe('hasSavedGame', () => {
    it('returns true when saved game exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('{"version":1}');

      const result = await GameStorage.hasSavedGame();

      expect(result).toBe(true);
    });

    it('returns false when no saved game', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await GameStorage.hasSavedGame();

      expect(result).toBe(false);
    });
  });

  describe('getSaveInfo', () => {
    it('returns save info without loading full state', async () => {
      const savedState = {
        savedAt: '2025-01-15T10:00:00Z',
        teamName: 'Champions',
        seasonNumber: 2,
      };
      mockAsyncStorage.getItem.mockResolvedValueOnce(JSON.stringify(savedState));

      const result = await GameStorage.getSaveInfo();

      expect(result.exists).toBe(true);
      expect(result.savedAt).toBe('2025-01-15T10:00:00Z');
      expect(result.teamName).toBe('Champions');
      expect(result.seasonNumber).toBe(2);
    });

    it('returns exists:false when no save', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await GameStorage.getSaveInfo();

      expect(result.exists).toBe(false);
    });
  });

  describe('getLastSaveTime', () => {
    it('returns last save timestamp', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('2025-01-15T10:00:00Z');

      const result = await GameStorage.getLastSaveTime();

      expect(result).toBe('2025-01-15T10:00:00Z');
    });

    it('returns null when no timestamp', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await GameStorage.getLastSaveTime();

      expect(result).toBeNull();
    });
  });
});
