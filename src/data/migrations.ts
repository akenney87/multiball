/**
 * Data Migration System for Multiball
 *
 * Handles versioned data migrations to safely upgrade save files
 * when game structure changes between updates.
 *
 * @module data/migrations
 */

import { GameSave } from './types';

// =============================================================================
// MIGRATION TYPES
// =============================================================================

/**
 * Migration handler interface
 */
export interface MigrationHandler {
  /** Source version */
  fromVersion: string;

  /** Target version */
  toVersion: string;

  /** Migration description */
  description: string;

  /** Migration function */
  migrate: (oldData: any) => GameSave;
}

/**
 * Migration result
 */
export interface MigrationResult {
  /** Was migration successful? */
  success: boolean;

  /** Original version */
  fromVersion: string;

  /** Final version */
  toVersion: string;

  /** Applied migrations */
  appliedMigrations: string[];

  /** Error (if failed) */
  error?: Error;
}

// =============================================================================
// MIGRATION REGISTRY
// =============================================================================

/**
 * All registered migrations
 * Migrations are applied in order from oldest to newest
 */
const migrations: MigrationHandler[] = [
  // Example migration (0.1.0 -> 0.2.0)
  {
    fromVersion: '0.1.0',
    toVersion: '0.2.0',
    description: 'Add new fields for multi-sport expansion',
    migrate: (old: any): GameSave => {
      // Example: Add new fields, transform data
      return {
        ...old,
        version: '0.2.0',
        // Add any new fields with defaults
        // Transform existing fields if needed
      };
    },
  },

  // Add future migrations here as game evolves
];

// =============================================================================
// MIGRATION UTILITIES
// =============================================================================

/**
 * Get current game version
 * This should match the version in package.json
 */
export const CURRENT_VERSION = '0.1.0';

/**
 * Check if migration is needed
 *
 * @param saveVersion - Version of save file
 * @returns True if migration needed
 */
export function needsMigration(saveVersion: string): boolean {
  return saveVersion !== CURRENT_VERSION;
}

/**
 * Get migration path from one version to another
 *
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns Array of migrations to apply, or null if no path exists
 */
export function getMigrationPath(
  fromVersion: string,
  toVersion: string
): MigrationHandler[] | null {
  const path: MigrationHandler[] = [];
  let currentVersion = fromVersion;

  // Find migration path
  while (currentVersion !== toVersion) {
    const nextMigration = migrations.find((m) => m.fromVersion === currentVersion);

    if (!nextMigration) {
      // No migration path exists
      return null;
    }

    path.push(nextMigration);
    currentVersion = nextMigration.toVersion;

    // Prevent infinite loops
    if (path.length > 100) {
      console.error('[Migration] Too many migrations in path, possible circular dependency');
      return null;
    }
  }

  return path;
}

/**
 * Apply migrations to save data
 *
 * @param saveData - Save data to migrate
 * @param targetVersion - Target version (default: CURRENT_VERSION)
 * @returns Migration result
 */
export function migrateData(
  saveData: any,
  targetVersion: string = CURRENT_VERSION
): MigrationResult {
  const fromVersion = saveData.version || '0.1.0';
  const appliedMigrations: string[] = [];

  try {
    // Check if migration needed
    if (fromVersion === targetVersion) {
      return {
        success: true,
        fromVersion,
        toVersion: targetVersion,
        appliedMigrations: [],
      };
    }

    // Get migration path
    const migrationPath = getMigrationPath(fromVersion, targetVersion);

    if (!migrationPath) {
      throw new Error(
        `No migration path from version ${fromVersion} to ${targetVersion}`
      );
    }

    console.log(
      `[Migration] Migrating from ${fromVersion} to ${targetVersion} (${migrationPath.length} steps)`
    );

    // Apply migrations in sequence
    let currentData = saveData;
    for (const migration of migrationPath) {
      console.log(
        `[Migration] Applying: ${migration.fromVersion} -> ${migration.toVersion} (${migration.description})`
      );

      currentData = migration.migrate(currentData);
      appliedMigrations.push(
        `${migration.fromVersion} -> ${migration.toVersion}: ${migration.description}`
      );
    }

    console.log(
      `[Migration] Successfully migrated to version ${targetVersion}`
    );

    return {
      success: true,
      fromVersion,
      toVersion: targetVersion,
      appliedMigrations,
    };
  } catch (error) {
    console.error('[Migration] Migration failed:', error);

    return {
      success: false,
      fromVersion,
      toVersion: targetVersion,
      appliedMigrations,
      error: error as Error,
    };
  }
}

/**
 * Validate migration path exists
 *
 * @param fromVersion - Starting version
 * @param toVersion - Target version
 * @returns True if migration path exists
 */
export function validateMigrationPath(
  fromVersion: string,
  toVersion: string
): boolean {
  const path = getMigrationPath(fromVersion, toVersion);
  return path !== null;
}

/**
 * Get all available migrations
 *
 * @returns All registered migrations
 */
export function getAllMigrations(): MigrationHandler[] {
  return [...migrations];
}

/**
 * Check if version is supported
 *
 * @param version - Version to check
 * @returns True if version can be migrated to current
 */
export function isVersionSupported(version: string): boolean {
  // Current version always supported
  if (version === CURRENT_VERSION) {
    return true;
  }

  // Check if migration path exists
  return validateMigrationPath(version, CURRENT_VERSION);
}

// =============================================================================
// MIGRATION ERRORS
// =============================================================================

export class MigrationError extends Error {
  constructor(message: string, public readonly fromVersion: string, public readonly toVersion: string) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class UnsupportedVersionError extends MigrationError {
  constructor(version: string) {
    super(
      `Save version ${version} is not supported. Cannot migrate to current version ${CURRENT_VERSION}.`,
      version,
      CURRENT_VERSION
    );
    this.name = 'UnsupportedVersionError';
  }
}

// =============================================================================
// AUTO-MIGRATION ON LOAD
// =============================================================================

/**
 * Auto-migrate save data when loading
 *
 * @param saveData - Raw save data
 * @returns Migrated save data
 * @throws {UnsupportedVersionError} If version not supported
 * @throws {MigrationError} If migration fails
 */
export function autoMigrate(saveData: any): GameSave {
  const saveVersion = saveData.version || '0.1.0';

  // Check if supported
  if (!isVersionSupported(saveVersion)) {
    throw new UnsupportedVersionError(saveVersion);
  }

  // Check if migration needed
  if (!needsMigration(saveVersion)) {
    return saveData as GameSave;
  }

  // Apply migrations
  const result = migrateData(saveData, CURRENT_VERSION);

  if (!result.success) {
    throw new MigrationError(
      `Migration failed: ${result.error?.message}`,
      result.fromVersion,
      result.toVersion
    );
  }

  // Log applied migrations
  if (result.appliedMigrations.length > 0) {
    console.log('[Migration] Applied migrations:');
    for (const migration of result.appliedMigrations) {
      console.log(`  - ${migration}`);
    }
  }

  return saveData as GameSave;
}

// =============================================================================
// MIGRATION TESTING
// =============================================================================

/**
 * Test all migrations (for development/testing)
 *
 * @returns Test results
 */
export function testAllMigrations(): {
  passed: number;
  failed: number;
  errors: Array<{ migration: string; error: Error }>;
} {
  const errors: Array<{ migration: string; error: Error }> = [];
  let passed = 0;
  let failed = 0;

  console.log('[Migration Test] Testing all migrations...');

  for (const migration of migrations) {
    try {
      // Create dummy data
      const dummyData = {
        version: migration.fromVersion,
        saveId: 'test',
        saveName: 'Test Save',
      };

      // Apply migration
      const result = migration.migrate(dummyData);

      // Verify version updated
      if (result.version !== migration.toVersion) {
        throw new Error(
          `Migration did not update version (expected ${migration.toVersion}, got ${result.version})`
        );
      }

      passed++;
      console.log(
        `  ✓ ${migration.fromVersion} -> ${migration.toVersion}: ${migration.description}`
      );
    } catch (error) {
      failed++;
      errors.push({
        migration: `${migration.fromVersion} -> ${migration.toVersion}`,
        error: error as Error,
      });
      console.error(
        `  ✗ ${migration.fromVersion} -> ${migration.toVersion}: ${(error as Error).message}`
      );
    }
  }

  console.log(
    `[Migration Test] Complete: ${passed} passed, ${failed} failed`
  );

  return { passed, failed, errors };
}
