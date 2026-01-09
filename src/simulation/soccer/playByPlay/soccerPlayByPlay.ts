/**
 * Soccer Play-by-Play Generator
 *
 * Creates rich narrative text for match events.
 * Provides engaging commentary for "Watch Sim" experience.
 *
 * @module simulation/soccer/playByPlay/soccerPlayByPlay
 */

import { Player } from '../../../data/types';
import { SoccerEvent } from '../types';
import { ShotQuality } from '../systems/goalkeeperSystem';

// =============================================================================
// NARRATIVE TEMPLATES
// =============================================================================

/**
 * Goal templates by shot quality
 */
const GOAL_TEMPLATES: Record<ShotQuality, string[]> = {
  fullChance: [
    '{scorer} finds the back of the net! Clinical finish from close range.',
    'GOAL! {scorer} makes no mistake from inside the box!',
    '{scorer} slots it home! Great composure in front of goal.',
    'Brilliant finish by {scorer}! The keeper had no chance.',
    '{scorer} taps it in from close range!',
    'Cool as you like from {scorer}! Never in doubt.',
  ],
  halfChance: [
    '{scorer} with a well-placed shot into the corner!',
    'GOAL! {scorer} finds space and fires home!',
    '{scorer} takes aim and scores! What a strike!',
    '{scorer} buries it! Great technique on that finish.',
    'Lovely finish from {scorer}! Picked out the corner.',
  ],
  longRange: [
    'WHAT A GOAL! {scorer} unleashes a thunderbolt from distance!',
    '{scorer} tries their luck from range and IT FLIES IN!',
    'Spectacular strike from {scorer}! The keeper was beaten all ends up!',
    'STUNNING! {scorer} with a worldie from 25 yards!',
    '{scorer} lets fly and it arrows into the top corner!',
  ],
};

/**
 * Assist phrases
 */
const ASSIST_PHRASES = [
  'Assisted by {assister}.',
  'Set up brilliantly by {assister}!',
  '{assister} with the key pass.',
  'Great vision from {assister} to find the pass.',
  '{assister} picks out the perfect ball.',
];

/**
 * Save templates
 */
const SAVE_TEMPLATES = [
  'Great save by {goalkeeper}! Denies {shooter} from close range.',
  '{goalkeeper} gets down well to palm away {shooter}\'s effort.',
  'Brilliant reflexes from {goalkeeper} to keep out {shooter}\'s shot!',
  '{goalkeeper} stands tall and makes the save look easy.',
  'What a stop! {goalkeeper} keeps {shooter}\'s shot out.',
  '{goalkeeper} with a fine save to deny {shooter}!',
];

/**
 * Miss templates
 */
const MISS_TEMPLATES = [
  '{shooter} blazes over from a good position!',
  'Off target from {shooter} - should have done better there.',
  '{shooter}\'s shot drifts wide of the post.',
  'Opportunity wasted by {shooter} as the ball goes high and wide.',
  '{shooter} fires wide! The fans hold their heads.',
  'Wide from {shooter}! Not the {shooter}\'s best effort.',
];

/**
 * Yellow card templates
 */
const YELLOW_CARD_TEMPLATES = [
  'Yellow card shown to {player} for a reckless challenge.',
  '{player} goes into the book for persistent fouling.',
  'The referee reaches for yellow - {player} has been cautioned.',
  '{player} picks up a booking for that tackle.',
  'Caution for {player} after a late challenge.',
  '{player} receives a yellow card. Has to be careful now.',
];

/**
 * Red card templates
 */
const RED_CARD_TEMPLATES = {
  secondYellow: [
    'SECOND YELLOW! {player} is off! A moment of madness!',
    '{player} sees red! Two yellows mean an early shower!',
    'That\'s a second yellow for {player}! Down to ten men!',
    '{player} gets their marching orders! Second bookable offense!',
  ],
  straight: [
    'STRAIGHT RED! {player} is sent off for violent conduct!',
    'The referee has no hesitation - {player} is dismissed!',
    'Red card! {player} is off for serious foul play!',
    '{player} shown a straight red! An awful challenge!',
  ],
};

// Corner kick templates - TODO: Add corner event generation
// const CORNER_TEMPLATES = [
//   'Corner to {team}. {taker} to deliver.',
//   '{team} have a corner. Good chance here.',
//   '{taker} swings in the corner for {team}.',
// ];

/**
 * General match narrative templates
 */
const KICKOFF_TEMPLATES = [
  'Kickoff! The match is underway.',
  'And we\'re off! {homeTeam} get us started.',
  'The referee blows the whistle and we\'re underway!',
];

const HALFTIME_TEMPLATES = [
  '--- Half Time ---',
  'The referee blows for half time.',
  'That\'s the end of the first half.',
];

const FULLTIME_TEMPLATES = [
  '--- Full Time ---',
  'The final whistle goes!',
  'It\'s all over!',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Select a random template from an array
 */
function selectTemplate(templates: string[]): string {
  const selected = templates[Math.floor(Math.random() * templates.length)];
  return selected ?? templates[0] ?? '';
}

/**
 * Fill template variables
 */
function fillTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

// =============================================================================
// NARRATIVE GENERATORS
// =============================================================================

/**
 * Generate narrative for a goal event
 */
export function generateGoalNarrative(
  scorer: Player,
  assister: Player | null,
  quality: ShotQuality = 'halfChance'
): string {
  const templates = GOAL_TEMPLATES[quality] || GOAL_TEMPLATES.halfChance;
  let narrative = fillTemplate(selectTemplate(templates), { scorer: scorer.name });

  if (assister) {
    const assistPhrase = fillTemplate(selectTemplate(ASSIST_PHRASES), {
      assister: assister.name,
    });
    narrative += ' ' + assistPhrase;
  }

  return narrative;
}

/**
 * Generate narrative for a save event
 */
export function generateSaveNarrative(
  goalkeeper: Player,
  shooter: Player
): string {
  return fillTemplate(selectTemplate(SAVE_TEMPLATES), {
    goalkeeper: goalkeeper.name,
    shooter: shooter.name,
  });
}

/**
 * Generate narrative for a missed shot
 */
export function generateMissNarrative(shooter: Player): string {
  return fillTemplate(selectTemplate(MISS_TEMPLATES), { shooter: shooter.name });
}

/**
 * Generate narrative for a card event
 */
export function generateCardNarrative(
  player: Player,
  isRed: boolean,
  isSecondYellow: boolean = false
): string {
  if (isRed) {
    const templates = isSecondYellow
      ? RED_CARD_TEMPLATES.secondYellow
      : RED_CARD_TEMPLATES.straight;
    return fillTemplate(selectTemplate(templates), { player: player.name });
  }
  return fillTemplate(selectTemplate(YELLOW_CARD_TEMPLATES), { player: player.name });
}

/**
 * Generate full play-by-play array from events
 */
export function generatePlayByPlay(
  events: SoccerEvent[],
  homeTeamName: string,
  awayTeamName: string
): string[] {
  const playByPlay: string[] = [];

  // Match header
  playByPlay.push(`--- ${homeTeamName} vs ${awayTeamName} ---`);
  playByPlay.push(selectTemplate(KICKOFF_TEMPLATES).replace('{homeTeam}', homeTeamName));

  // Track score for context
  let homeScore = 0;
  let awayScore = 0;

  for (const event of events) {
    const teamName = event.team === 'home' ? homeTeamName : awayTeamName;
    const prefix = `${event.minute}'`;

    switch (event.type) {
      case 'goal':
        if (event.team === 'home') homeScore++;
        else awayScore++;
        const goalText = event.description || 'GOAL!';
        playByPlay.push(
          `${prefix} GOAL! (${teamName}) ${goalText} [${homeScore}-${awayScore}]`
        );
        break;

      case 'shot_saved':
        playByPlay.push(`${prefix} ${event.description || 'Shot saved!'}`);
        break;

      case 'shot_missed':
        playByPlay.push(`${prefix} ${event.description || 'Shot goes wide.'}`);
        break;

      case 'yellow_card':
        playByPlay.push(
          `${prefix} YELLOW CARD (${teamName}) ${event.description || ''}`
        );
        break;

      case 'red_card':
        playByPlay.push(
          `${prefix} RED CARD! (${teamName}) ${event.description || ''}`
        );
        break;

      case 'half_time':
        playByPlay.push('');
        playByPlay.push(selectTemplate(HALFTIME_TEMPLATES));
        playByPlay.push(`Score: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}`);
        playByPlay.push('');
        break;

      case 'full_time':
        playByPlay.push('');
        playByPlay.push(selectTemplate(FULLTIME_TEMPLATES));
        playByPlay.push(`Final Score: ${homeTeamName} ${homeScore} - ${awayScore} ${awayTeamName}`);
        break;

      default:
        if (event.description) {
          playByPlay.push(`${prefix} ${event.description}`);
        }
    }
  }

  return playByPlay;
}

/**
 * Extend event types for enriched play-by-play
 * These are additional event types beyond the core goal/card events
 */
export type EnrichedEventType =
  | 'goal'
  | 'shot_saved'
  | 'shot_missed'
  | 'shot_blocked'
  | 'corner'
  | 'free_kick'
  | 'yellow_card'
  | 'red_card'
  | 'substitution'
  | 'half_time'
  | 'full_time'
  | 'kickoff'
  | 'foul'
  | 'offside';
