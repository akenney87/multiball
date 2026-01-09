/**
 * Scouting Utilities
 *
 * Utilities for handling unscouted player attribute visibility.
 * Uses seeded random selection to ensure consistent visible attributes
 * that don't change on reload.
 */

// All attribute categories
export const attributeCategories = {
  physical: [
    'grip_strength', 'arm_strength', 'core_strength', 'agility',
    'acceleration', 'top_speed', 'jumping', 'reactions',
    'stamina', 'balance', 'height', 'durability',
  ],
  mental: [
    'awareness', 'creativity', 'determination', 'bravery',
    'consistency', 'composure', 'patience', 'teamwork',
  ],
  technical: [
    'hand_eye_coordination', 'throw_accuracy', 'form_technique',
    'finesse', 'deception', 'footwork',
  ],
};

// All attributes flattened
export const allAttributes = [
  ...attributeCategories.physical,
  ...attributeCategories.mental,
  ...attributeCategories.technical,
];

/**
 * Simple hash function for strings
 * Converts a player ID to a consistent numeric value
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Seeded random number generator
 * Returns a function that generates consistent random numbers for a given seed
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

/**
 * Get the visible attribute names for an unscouted player
 * Returns 2-3 attributes that are consistently the same for a given player ID
 *
 * @param playerId - The player's unique ID
 * @returns Array of attribute names that should be visible
 */
export function getVisibleAttributesForUnscouted(playerId: string): string[] {
  const hash = hashString(playerId);
  const random = seededRandom(hash);

  // Determine how many attributes to show (2 or 3)
  const count = random() < 0.5 ? 2 : 3;

  // Shuffle all attributes using seeded random
  const shuffled = [...allAttributes];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp;
  }

  // Return the first 2-3 attributes
  return shuffled.slice(0, count);
}

/**
 * Check if a specific attribute should be visible for an unscouted player
 *
 * @param playerId - The player's unique ID
 * @param attributeName - The attribute to check
 * @returns true if the attribute should be visible
 */
export function isAttributeVisibleForUnscouted(playerId: string, attributeName: string): boolean {
  const visibleAttributes = getVisibleAttributesForUnscouted(playerId);
  return visibleAttributes.includes(attributeName);
}

/**
 * Get which category an attribute belongs to
 */
export function getAttributeCategory(attributeName: string): 'physical' | 'mental' | 'technical' | null {
  if (attributeCategories.physical.includes(attributeName)) return 'physical';
  if (attributeCategories.mental.includes(attributeName)) return 'mental';
  if (attributeCategories.technical.includes(attributeName)) return 'technical';
  return null;
}
