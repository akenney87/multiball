/**
 * Data Validation Schemas for Multiball
 *
 * Runtime validation for all game entities.
 * Ensures data integrity and provides helpful error messages.
 *
 * @module data/validation
 */

import {
  Player,
  PlayerAttributes,
  PlayerPotentials,
  PeakAges,
  TrainingFocus,
  Contract,
  Injury,
  Franchise,
  TacticalSettings,
  Budget,
  Season,
  Match,
  ScoutingReport,
  YouthProspect,
  TransferOffer,
  NewsItem,
  GameSave,
} from './types';

// =============================================================================
// VALIDATION ERRORS
// =============================================================================

export class ValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// =============================================================================
// ATTRIBUTE VALIDATION
// =============================================================================

/** Valid attribute range */
const ATTRIBUTE_MIN = 1;
const ATTRIBUTE_MAX = 100;

/** All 25 attribute names */
const ALL_ATTRIBUTES = [
  // Physical (12)
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
  'height',
  'durability',
  // Mental (7)
  'awareness',
  'creativity',
  'determination',
  'bravery',
  'consistency',
  'composure',
  'patience',
  // Technical (6)
  'hand_eye_coordination',
  'throw_accuracy',
  'form_technique',
  'finesse',
  'deception',
  'teamwork',
];

/**
 * Validate single attribute value
 */
function validateAttributeValue(name: string, value: number): void {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new ValidationError(`Attribute ${name} must be a number`, name);
  }

  if (value < ATTRIBUTE_MIN || value > ATTRIBUTE_MAX) {
    throw new ValidationError(
      `Attribute ${name} must be between ${ATTRIBUTE_MIN} and ${ATTRIBUTE_MAX}, got ${value}`,
      name
    );
  }
}

/**
 * Validate all 25 player attributes
 */
export function validatePlayerAttributes(attributes: Partial<PlayerAttributes>): void {
  // Check all attributes present
  const missing = ALL_ATTRIBUTES.filter((attr) => !(attr in attributes));
  if (missing.length > 0) {
    throw new ValidationError(`Missing attributes: ${missing.join(', ')}`);
  }

  // Validate each attribute value
  for (const attr of ALL_ATTRIBUTES) {
    validateAttributeValue(attr, (attributes as any)[attr]);
  }
}

/**
 * Validate player potentials
 */
export function validatePlayerPotentials(potentials: PlayerPotentials): void {
  validateAttributeValue('physical potential', potentials.physical);
  validateAttributeValue('mental potential', potentials.mental);
  validateAttributeValue('technical potential', potentials.technical);
}

/**
 * Validate peak ages
 */
export function validatePeakAges(peakAges: PeakAges): void {
  // Physical: 22-30
  if (peakAges.physical < 22 || peakAges.physical > 30) {
    throw new ValidationError(
      `Physical peak age must be between 22 and 30, got ${peakAges.physical}`,
      'peakAges.physical'
    );
  }

  // Technical: 24-32
  if (peakAges.technical < 24 || peakAges.technical > 32) {
    throw new ValidationError(
      `Technical peak age must be between 24 and 32, got ${peakAges.technical}`,
      'peakAges.technical'
    );
  }

  // Mental: 26-34
  if (peakAges.mental < 26 || peakAges.mental > 34) {
    throw new ValidationError(
      `Mental peak age must be between 26 and 34, got ${peakAges.mental}`,
      'peakAges.mental'
    );
  }
}

/**
 * Validate training focus (must sum to 100)
 */
export function validateTrainingFocus(focus: TrainingFocus): void {
  const total = focus.physical + focus.mental + focus.technical;

  if (total !== 100) {
    throw new ValidationError(
      `Training focus must sum to 100, got ${total}`,
      'trainingFocus'
    );
  }

  if (focus.physical < 0 || focus.mental < 0 || focus.technical < 0) {
    throw new ValidationError(
      'Training focus percentages cannot be negative',
      'trainingFocus'
    );
  }
}

// =============================================================================
// PLAYER VALIDATION
// =============================================================================

/**
 * Validate complete player entity
 */
export function validatePlayer(player: Player): void {
  // Basic fields
  if (!player.id) {
    throw new ValidationError('Player must have an ID', 'id');
  }

  if (!player.name || player.name.trim().length === 0) {
    throw new ValidationError('Player must have a name', 'name');
  }

  if (player.age < 15 || player.age > 45) {
    throw new ValidationError(
      `Player age must be between 15 and 45, got ${player.age}`,
      'age'
    );
  }

  // Attributes
  validatePlayerAttributes(player.attributes);

  // Potentials
  validatePlayerPotentials(player.potentials);

  // Peak ages
  validatePeakAges(player.peakAges);

  // Training focus (if set)
  if (player.trainingFocus) {
    validateTrainingFocus(player.trainingFocus);
  }

  // Team ID
  if (!player.teamId) {
    throw new ValidationError('Player must have a team ID', 'teamId');
  }
}

// =============================================================================
// CONTRACT VALIDATION
// =============================================================================

/**
 * Validate contract
 */
export function validateContract(contract: Contract): void {
  if (contract.salary < 0) {
    throw new ValidationError('Contract salary cannot be negative', 'salary');
  }

  if (contract.signingBonus < 0) {
    throw new ValidationError('Signing bonus cannot be negative', 'signingBonus');
  }

  if (contract.contractLength < 1 || contract.contractLength > 5) {
    throw new ValidationError(
      `Contract length must be 1-5 years, got ${contract.contractLength}`,
      'contractLength'
    );
  }

  if (contract.expiryDate <= contract.startDate) {
    throw new ValidationError(
      'Contract expiry date must be after start date',
      'expiryDate'
    );
  }

  if (contract.releaseClause !== null && contract.releaseClause < 0) {
    throw new ValidationError('Release clause cannot be negative', 'releaseClause');
  }
}

// =============================================================================
// INJURY VALIDATION
// =============================================================================

/**
 * Validate injury
 */
export function validateInjury(injury: Injury): void {
  const validTypes = ['minor', 'moderate', 'severe'];
  if (!validTypes.includes(injury.injuryType)) {
    throw new ValidationError(
      `Injury type must be one of ${validTypes.join(', ')}, got ${injury.injuryType}`,
      'injuryType'
    );
  }

  if (injury.recoveryWeeks < 0) {
    throw new ValidationError('Recovery weeks cannot be negative', 'recoveryWeeks');
  }

  if (injury.returnDate <= injury.occurredDate) {
    throw new ValidationError(
      'Return date must be after occurred date',
      'returnDate'
    );
  }
}

// =============================================================================
// FRANCHISE VALIDATION
// =============================================================================

/**
 * Validate tactical settings
 */
export function validateTacticalSettings(settings: TacticalSettings): void {
  // Pace
  const validPaces = ['fast', 'standard', 'slow'];
  if (!validPaces.includes(settings.pace)) {
    throw new ValidationError(
      `Pace must be one of ${validPaces.join(', ')}, got ${settings.pace}`,
      'pace'
    );
  }

  // Man defense percentage
  if (settings.manDefensePct < 0 || settings.manDefensePct > 100) {
    throw new ValidationError(
      `Man defense % must be 0-100, got ${settings.manDefensePct}`,
      'manDefensePct'
    );
  }

  // Minutes allotment must sum to 240
  const totalMinutes = Object.values(settings.minutesAllotment).reduce(
    (sum, mins) => sum + mins,
    0
  );

  if (totalMinutes !== 240 && totalMinutes !== 0) {
    throw new ValidationError(
      `Minutes allotment must sum to 240, got ${totalMinutes}`,
      'minutesAllotment'
    );
  }

  // Max 48 minutes per player
  for (const [playerId, minutes] of Object.entries(settings.minutesAllotment)) {
    if (minutes > 48) {
      throw new ValidationError(
        `Player ${playerId} cannot play more than 48 minutes, got ${minutes}`,
        'minutesAllotment'
      );
    }
  }

  // Rebounding strategy
  const validStrategies = ['crash_glass', 'standard', 'prevent_transition'];
  if (!validStrategies.includes(settings.reboundingStrategy)) {
    throw new ValidationError(
      `Rebounding strategy must be one of ${validStrategies.join(', ')}, got ${settings.reboundingStrategy}`,
      'reboundingStrategy'
    );
  }

  // Timeout strategy
  const validTimeoutStrategies = ['aggressive', 'standard', 'conservative'];
  if (!validTimeoutStrategies.includes(settings.timeoutStrategy)) {
    throw new ValidationError(
      `Timeout strategy must be one of ${validTimeoutStrategies.join(', ')}, got ${settings.timeoutStrategy}`,
      'timeoutStrategy'
    );
  }
}

/**
 * Validate budget
 */
export function validateBudget(budget: Budget): void {
  if (budget.total < 0) {
    throw new ValidationError('Total budget cannot be negative', 'total');
  }

  const allocations = Object.values(budget.allocated);
  for (const allocation of allocations) {
    if (allocation < 0) {
      throw new ValidationError('Budget allocations cannot be negative', 'allocated');
    }
  }

  const totalAllocated =
    budget.allocated.salaries +
    budget.allocated.coaching +
    budget.allocated.medical +
    budget.allocated.youthAcademy +
    budget.allocated.scouting +
    budget.allocated.freeAgentTryouts;

  if (totalAllocated > budget.total) {
    throw new ValidationError(
      `Total allocated (${totalAllocated}) cannot exceed total budget (${budget.total})`,
      'allocated'
    );
  }
}

/**
 * Validate franchise
 */
export function validateFranchise(franchise: Franchise): void {
  if (!franchise.id) {
    throw new ValidationError('Franchise must have an ID', 'id');
  }

  if (!franchise.name || franchise.name.trim().length === 0) {
    throw new ValidationError('Franchise must have a name', 'name');
  }

  if (franchise.division < 1 || franchise.division > 5) {
    throw new ValidationError(
      `Division must be 1-5, got ${franchise.division}`,
      'division'
    );
  }

  validateBudget(franchise.budget);
  validateTacticalSettings(franchise.tacticalSettings);
  validateTrainingFocus(franchise.trainingSettings.teamWide);
}

// =============================================================================
// SEASON & MATCH VALIDATION
// =============================================================================

/**
 * Validate match
 */
export function validateMatch(match: Match): void {
  if (!match.id) {
    throw new ValidationError('Match must have an ID', 'id');
  }

  if (!match.homeTeamId || !match.awayTeamId) {
    throw new ValidationError('Match must have home and away team IDs');
  }

  if (match.homeTeamId === match.awayTeamId) {
    throw new ValidationError('Home and away teams must be different');
  }

  const validSports = ['basketball', 'baseball', 'soccer'];
  if (!validSports.includes(match.sport)) {
    throw new ValidationError(
      `Sport must be one of ${validSports.join(', ')}, got ${match.sport}`,
      'sport'
    );
  }

  const validStatuses = ['scheduled', 'in_progress', 'completed'];
  if (!validStatuses.includes(match.status)) {
    throw new ValidationError(
      `Match status must be one of ${validStatuses.join(', ')}, got ${match.status}`,
      'status'
    );
  }
}

/**
 * Validate season
 */
export function validateSeason(season: Season): void {
  if (!season.id) {
    throw new ValidationError('Season must have an ID', 'id');
  }

  if (season.seasonNumber < 1) {
    throw new ValidationError(
      `Season number must be >= 1, got ${season.seasonNumber}`,
      'seasonNumber'
    );
  }

  if (season.endDate <= season.startDate) {
    throw new ValidationError('Season end date must be after start date');
  }

  const validStatuses = ['pre_season', 'regular_season', 'post_season', 'off_season'];
  if (!validStatuses.includes(season.status)) {
    throw new ValidationError(
      `Season status must be one of ${validStatuses.join(', ')}, got ${season.status}`,
      'status'
    );
  }

  if (season.currentWeek < 0) {
    throw new ValidationError('Current week cannot be negative', 'currentWeek');
  }
}

// =============================================================================
// SCOUTING VALIDATION
// =============================================================================

/**
 * Validate scouting report
 */
export function validateScoutingReport(report: ScoutingReport): void {
  if (!report.id) {
    throw new ValidationError('Scouting report must have an ID', 'id');
  }

  if (!report.playerId) {
    throw new ValidationError('Scouting report must have a player ID', 'playerId');
  }

  if (report.scoutingQuality < 0 || report.scoutingQuality > 100) {
    throw new ValidationError(
      `Scouting quality must be 0-100, got ${report.scoutingQuality}`,
      'scoutingQuality'
    );
  }

  // Validate attribute ranges
  for (const [attr, range] of Object.entries(report.attributeRanges)) {
    if (range.min > range.max) {
      throw new ValidationError(
        `Attribute range min cannot exceed max for ${attr}`,
        'attributeRanges'
      );
    }

    if (range.min < ATTRIBUTE_MIN || range.max > ATTRIBUTE_MAX) {
      throw new ValidationError(
        `Attribute range for ${attr} must be within ${ATTRIBUTE_MIN}-${ATTRIBUTE_MAX}`,
        'attributeRanges'
      );
    }
  }
}

// =============================================================================
// YOUTH PROSPECT VALIDATION
// =============================================================================

/**
 * Validate youth prospect
 */
export function validateYouthProspect(prospect: YouthProspect): void {
  if (!prospect.id) {
    throw new ValidationError('Youth prospect must have an ID', 'id');
  }

  if (!prospect.name || prospect.name.trim().length === 0) {
    throw new ValidationError('Youth prospect must have a name', 'name');
  }

  if (prospect.age < 15 || prospect.age > 18) {
    throw new ValidationError(
      `Youth prospect age must be 15-18, got ${prospect.age}`,
      'age'
    );
  }

  if (prospect.mustPromoteBy <= prospect.joinedAcademyDate) {
    throw new ValidationError(
      'Promotion deadline must be after join date',
      'mustPromoteBy'
    );
  }

  validatePlayerAttributes(prospect.attributes);
  validatePlayerPotentials(prospect.potentials);

  if (prospect.trainingFocus) {
    validateTrainingFocus(prospect.trainingFocus);
  }
}

// =============================================================================
// TRANSFER VALIDATION
// =============================================================================

/**
 * Validate transfer offer
 */
export function validateTransferOffer(offer: TransferOffer): void {
  if (!offer.id) {
    throw new ValidationError('Transfer offer must have an ID', 'id');
  }

  if (offer.transferFee < 0) {
    throw new ValidationError('Transfer fee cannot be negative', 'transferFee');
  }

  if (offer.offeringTeamId === offer.receivingTeamId) {
    throw new ValidationError('Offering and receiving teams must be different');
  }

  const validStatuses = ['pending', 'accepted', 'rejected', 'countered', 'expired'];
  if (!validStatuses.includes(offer.status)) {
    throw new ValidationError(
      `Transfer status must be one of ${validStatuses.join(', ')}, got ${offer.status}`,
      'status'
    );
  }

  if (offer.expiryDate <= offer.createdDate) {
    throw new ValidationError('Expiry date must be after creation date');
  }
}

// =============================================================================
// NEWS VALIDATION
// =============================================================================

/**
 * Validate news item
 */
export function validateNewsItem(news: NewsItem): void {
  if (!news.id) {
    throw new ValidationError('News item must have an ID', 'id');
  }

  const validTypes = [
    'injury',
    'contract',
    'scouting',
    'transfer',
    'match',
    'youth',
    'general',
  ];
  if (!validTypes.includes(news.type)) {
    throw new ValidationError(
      `News type must be one of ${validTypes.join(', ')}, got ${news.type}`,
      'type'
    );
  }

  const validPriorities = ['critical', 'important', 'info'];
  if (!validPriorities.includes(news.priority)) {
    throw new ValidationError(
      `News priority must be one of ${validPriorities.join(', ')}, got ${news.priority}`,
      'priority'
    );
  }

  if (!news.title || news.title.trim().length === 0) {
    throw new ValidationError('News item must have a title', 'title');
  }

  if (!news.message || news.message.trim().length === 0) {
    throw new ValidationError('News item must have a message', 'message');
  }
}

// =============================================================================
// GAME SAVE VALIDATION
// =============================================================================

/**
 * Validate complete game save
 */
export function validateGameSave(save: GameSave): void {
  if (!save.version) {
    throw new ValidationError('Game save must have a version', 'version');
  }

  if (!save.saveId) {
    throw new ValidationError('Game save must have a save ID', 'saveId');
  }

  if (!save.saveName || save.saveName.trim().length === 0) {
    throw new ValidationError('Game save must have a name', 'saveName');
  }

  // Validate core entities
  validateFranchise(save.franchise);
  validateSeason(save.season);

  // Validate all players
  for (const player of save.players) {
    try {
      validatePlayer(player);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Player ${player.name}: ${error.message}`,
          `players.${player.id}`
        );
      }
      throw error;
    }
  }

  // Validate youth prospects
  for (const prospect of save.youthProspects) {
    try {
      validateYouthProspect(prospect);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `Youth prospect ${prospect.name}: ${error.message}`,
          `youthProspects.${prospect.id}`
        );
      }
      throw error;
    }
  }

  // Validate AI teams
  for (const team of save.aiTeams) {
    try {
      validateFranchise(team);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ValidationError(
          `AI team ${team.name}: ${error.message}`,
          `aiTeams.${team.id}`
        );
      }
      throw error;
    }
  }
}

// =============================================================================
// UTILITY VALIDATORS
// =============================================================================

/**
 * Validate UUID format
 */
export function validateUUID(id: string): boolean {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Validate hex color format
 */
export function validateHexColor(color: string): boolean {
  const hexRegex = /^#[0-9A-F]{6}$/i;
  return hexRegex.test(color);
}

/**
 * Validate percentage (0-100)
 */
export function validatePercentage(value: number): boolean {
  return value >= 0 && value <= 100;
}

/**
 * Validate non-negative number
 */
export function validateNonNegative(value: number): boolean {
  return value >= 0;
}

/**
 * Validate date is in the future
 */
export function validateFutureDate(date: Date): boolean {
  return date > new Date();
}

/**
 * Validate date range (start < end)
 */
export function validateDateRange(start: Date, end: Date): boolean {
  return end > start;
}
