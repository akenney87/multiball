/**
 * Training Analyzer
 *
 * Analyzes which attributes would most efficiently improve
 * a player's sport ratings and provides smart recommendations.
 *
 * The algorithm calculates marginal impact per attribute point
 * across all sports, factoring in potential ceilings.
 */

import type { Player, PlayerAttributes } from '../data/types';
import {
  calculateBasketballOverall,
  calculateBaseballOverall,
  calculateSoccerOverall,
} from './overallRating';
import { getAttributeCategory } from '../systems/trainingSystem';

// =============================================================================
// TYPES
// =============================================================================

export type AttributeCategory = 'physical' | 'mental' | 'technical';

/**
 * Training suggestion for a single attribute
 */
export interface TrainingSuggestion {
  /** Attribute name (e.g., "throw_accuracy") */
  attribute: string;
  /** Display name (e.g., "Throw Accuracy") */
  displayName: string;
  /** Current attribute value */
  currentValue: number;
  /** Attribute category */
  category: AttributeCategory;
  /** Total impact score across all sports */
  impactScore: number;
  /** Text explanation of why this is recommended */
  rationale: string;
  /** How close to potential ceiling (0-1, 1 = at ceiling) */
  potentialUsed: number;
  /** Impact breakdown by sport */
  affectedSports: Array<{
    sport: 'basketball' | 'baseball' | 'soccer';
    currentOverall: number;
    projectedImprovement: number;
  }>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All trainable attribute names
 * Note: height is excluded as it's genetic and cannot be trained
 */
const TRAINABLE_ATTRIBUTES: Array<keyof PlayerAttributes> = [
  'grip_strength',
  'arm_strength',
  'core_strength',
  'agility',
  'acceleration',
  'top_speed',
  'jumping',
  'reactions',
  'stamina',
  'balance',
  'durability',
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
  'teamwork',
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'footwork',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format attribute name for display
 * "throw_accuracy" -> "Throw Accuracy"
 */
function formatAttributeName(name: string): string {
  return name
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Calculate how much +1 point in an attribute improves a sport overall
 */
function calculateAttributeImpact(
  attributes: PlayerAttributes,
  attributeName: keyof PlayerAttributes,
  sport: 'basketball' | 'baseball' | 'soccer'
): number {
  const currentValue = attributes[attributeName];
  if (typeof currentValue !== 'number') return 0;

  // Don't suggest maxed attributes
  if (currentValue >= 99) return 0;

  // Create modified attributes with +1 to target
  const modifiedAttrs: PlayerAttributes = { ...attributes };
  (modifiedAttrs[attributeName] as number) = currentValue + 1;

  // Calculate before and after
  let before: number;
  let after: number;

  switch (sport) {
    case 'basketball':
      before = calculateBasketballOverall(attributes);
      after = calculateBasketballOverall(modifiedAttrs);
      break;
    case 'baseball':
      before = calculateBaseballOverall(attributes);
      after = calculateBaseballOverall(modifiedAttrs);
      break;
    case 'soccer':
      before = calculateSoccerOverall(attributes);
      after = calculateSoccerOverall(modifiedAttrs);
      break;
  }

  return after - before;
}

/**
 * Generate rationale text for a suggestion
 */
function generateRationale(
  _attr: string,
  displayName: string,
  value: number,
  potentialUsed: number,
  affectedSports: TrainingSuggestion['affectedSports']
): string {
  const sportNames = affectedSports
    .filter((s) => s.projectedImprovement > 0)
    .map((s) => s.sport.charAt(0).toUpperCase() + s.sport.slice(1))
    .join(', ');

  const valueDesc =
    value < 50 ? 'Low' : value < 65 ? 'Below average' : value < 75 ? 'Average' : 'Good';

  const potentialNote =
    potentialUsed > 0.9
      ? ' Near ceiling - slower gains expected.'
      : potentialUsed > 0.75
        ? ' Approaching ceiling.'
        : '';

  return `${valueDesc} ${displayName} (${value}) impacts ${sportNames || 'no sports'}.${potentialNote}`;
}

// =============================================================================
// MAIN FUNCTIONS
// =============================================================================

/**
 * Generate training suggestions for a player
 *
 * Analyzes all trainable attributes and ranks them by potential impact
 * across all sports (or a specific target sport).
 *
 * @param player - Player to analyze
 * @param targetSport - Optional: focus suggestions on a specific sport
 * @param maxSuggestions - Maximum number of suggestions to return (default: 5)
 * @returns Ranked list of training suggestions
 */
export function generateTrainingSuggestions(
  player: Player,
  targetSport?: 'basketball' | 'baseball' | 'soccer',
  maxSuggestions: number = 5
): TrainingSuggestion[] {
  const suggestions: TrainingSuggestion[] = [];
  const attrs = player.attributes;
  const potentials = player.potentials;

  // Sports to analyze
  const sports: Array<'basketball' | 'baseball' | 'soccer'> = targetSport
    ? [targetSport]
    : ['basketball', 'baseball', 'soccer'];

  for (const attr of TRAINABLE_ATTRIBUTES) {
    const currentValue = attrs[attr];
    if (typeof currentValue !== 'number') continue;

    // Skip maxed attributes
    if (currentValue >= 99) continue;

    // Get attribute category and potential
    const category = getAttributeCategory(attr) as AttributeCategory | null;
    if (!category) continue;

    const potential = potentials[category];
    const potentialUsed = currentValue / potential;

    // Calculate impact across sports
    let totalImpact = 0;
    const affectedSports: TrainingSuggestion['affectedSports'] = [];

    for (const sport of sports) {
      const impact = calculateAttributeImpact(attrs, attr, sport);

      let currentOverall: number;
      switch (sport) {
        case 'basketball':
          currentOverall = calculateBasketballOverall(attrs);
          break;
        case 'baseball':
          currentOverall = calculateBaseballOverall(attrs);
          break;
        case 'soccer':
          currentOverall = calculateSoccerOverall(attrs);
          break;
      }

      if (impact > 0) {
        totalImpact += impact;
        affectedSports.push({
          sport,
          currentOverall: Math.round(currentOverall * 10) / 10,
          projectedImprovement: Math.round(impact * 100) / 100,
        });
      }
    }

    // Apply efficiency penalty if near/above potential
    // Training above potential is slower and less efficient
    const efficiencyMultiplier = potentialUsed >= 1.0 ? 0.25 : potentialUsed > 0.9 ? 0.5 : 1.0;

    const impactScore = totalImpact * efficiencyMultiplier;

    // Only include if there's some positive impact
    if (impactScore > 0) {
      const displayName = formatAttributeName(attr);

      suggestions.push({
        attribute: attr,
        displayName,
        currentValue,
        category,
        impactScore,
        potentialUsed: Math.min(potentialUsed, 1.0),
        rationale: generateRationale(attr, displayName, currentValue, potentialUsed, affectedSports),
        affectedSports,
      });
    }
  }

  // Sort by impact score (highest first) and return top N
  return suggestions.sort((a, b) => b.impactScore - a.impactScore).slice(0, maxSuggestions);
}

/**
 * Get suggested training focus percentages based on analysis
 *
 * Analyzes the top suggestions and recommends how to allocate
 * training focus across physical/mental/technical.
 *
 * @param player - Player to analyze
 * @returns Recommended training focus allocation
 */
export function getSuggestedTrainingFocus(player: Player): {
  physical: number;
  mental: number;
  technical: number;
  rationale: string;
} {
  const suggestions = generateTrainingSuggestions(player, undefined, 10);

  // Tally impact scores by category
  const categoryScores = { physical: 0, mental: 0, technical: 0 };

  for (const suggestion of suggestions) {
    categoryScores[suggestion.category] += suggestion.impactScore;
  }

  const total = categoryScores.physical + categoryScores.mental + categoryScores.technical;

  if (total === 0) {
    // No clear direction - balanced approach
    return {
      physical: 34,
      mental: 33,
      technical: 33,
      rationale: 'No clear priority - balanced training recommended.',
    };
  }

  // Convert to percentages (rounded to nearest 5)
  const roundTo5 = (n: number) => Math.round(n / 5) * 5;

  let physical = roundTo5((categoryScores.physical / total) * 100);
  let mental = roundTo5((categoryScores.mental / total) * 100);
  let technical = roundTo5((categoryScores.technical / total) * 100);

  // Ensure they sum to 100
  const sum = physical + mental + technical;
  if (sum !== 100) {
    // Adjust the largest category
    const largest =
      physical >= mental && physical >= technical
        ? 'physical'
        : mental >= technical
          ? 'mental'
          : 'technical';

    if (largest === 'physical') physical += 100 - sum;
    else if (largest === 'mental') mental += 100 - sum;
    else technical += 100 - sum;
  }

  // Generate rationale
  const dominant =
    physical > mental && physical > technical
      ? 'Physical'
      : mental > physical && mental > technical
        ? 'Mental'
        : technical > physical && technical > mental
          ? 'Technical'
          : 'Balanced';

  const rationale =
    dominant === 'Balanced'
      ? 'Well-rounded player - balanced training recommended.'
      : `${dominant} attributes offer the most improvement potential.`;

  return { physical, mental, technical, rationale };
}

/**
 * Get a quick summary of training priorities
 *
 * @param player - Player to analyze
 * @returns Short description of top priority
 */
export function getTrainingSummary(player: Player): string {
  const suggestions = generateTrainingSuggestions(player, undefined, 1);

  const top = suggestions[0];
  if (!top) {
    return 'No clear training priority - player is well-rounded.';
  }

  return `Focus on ${top.displayName} for maximum improvement.`;
}
