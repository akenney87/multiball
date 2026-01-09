// Quick test to verify rotation fix - Q1 only
const { SubstitutionManager, calculateMinutesTargets } = require('./dist/src/simulation/systems/substitutions');
const { StaminaTracker } = require('./dist/src/simulation/stamina/staminaManager');
const { lakers, celtics } = require('./dist/src/data/exampleTeams');

console.log('[TEST] Starting Q1 rotation test...\n');

// Create substitution manager
const subManager = new SubstitutionManager(lakers, celtics);

// Start Q1
subManager.startQuarter(1);

// Create stamina tracker
const staminaTracker = new StaminaTracker([...lakers, ...celtics]);

// Simulate Q1 with rotation checks every ~15 seconds
const Q1_DURATION = 12 * 60; // 12 minutes in seconds
let gameTime = 0;

console.log('=== Q1 START ===');
console.log('Home active:', subManager.getHomeActive().map(p => p.name).join(', '));
console.log('Away active:', subManager.getAwayActive().map(p => p.name).join(', '));
console.log('');

for (let i = 0; i < 48; i++) {  // Check ~48 times during Q1
  gameTime += 15; // Advance 15 seconds
  const timeRemaining = Q1_DURATION - gameTime;
  const minutesRemaining = Math.floor(timeRemaining / 60);
  const secondsRemaining = timeRemaining % 60;
  const gameTimeStr = `${minutesRemaining}:${secondsRemaining.toString().padStart(2, '0')}`;

  // Drain stamina slightly
  const activePlayers = [...subManager.getHomeActive(), ...subManager.getAwayActive()];
  for (const player of activePlayers) {
    staminaTracker.updateStamina(player.name, -0.5);
  }

  // Check for substitutions
  const subs = subManager.checkAndExecuteSubstitutions(
    staminaTracker,
    gameTimeStr,
    timeRemaining,
    1,  // Quarter 1
    50, // Home score
    48, // Away score
    null,
    false
  );

  if (subs.length > 0) {
    console.log(`\n[${gameTimeStr}] Substitutions:`, subs.map(s => `${s.playerOut} → ${s.playerIn}`).join(', '));
  }
}

console.log('\n=== Q1 END ===');
console.log('Home active:', subManager.getHomeActive().map(p => p.name).join(', '));
console.log('Away active:', subManager.getAwayActive().map(p => p.name).join(', '));
console.log('\n[TEST] Complete!');
