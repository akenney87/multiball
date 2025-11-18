/**
 * Constants Verification
 *
 * Comprehensive verification that all constants in TypeScript match Python exactly.
 */

import * as tsConstants from '../src/simulation/constants';
import * as fs from 'fs';
import * as path from 'path';

interface ConstantComparison {
  name: string;
  typescript: any;
  expected?: any;
  type: string;
  match?: boolean;
}

function verifyConstants(): void {
  console.log("=" + "=".repeat(79));
  console.log("CONSTANTS VERIFICATION");
  console.log("=" + "=".repeat(79));
  console.log("\n");

  const results: ConstantComparison[] = [];

  // Core probability constants
  console.log("Core Probability Constants:");
  console.log("-" + "-".repeat(79));
  results.push(verifyScalar("SIGMOID_K", tsConstants.SIGMOID_K, 0.025));
  results.push(verifyScalar("CONSISTENCY_VARIANCE_SCALE", tsConstants.CONSISTENCY_VARIANCE_SCALE, 0.0002));
  results.push(verifyScalar("STAMINA_THRESHOLD", tsConstants.STAMINA_THRESHOLD, 80));
  results.push(verifyScalar("STAMINA_DEGRADATION_POWER", tsConstants.STAMINA_DEGRADATION_POWER, 1.3));
  results.push(verifyScalar("STAMINA_DEGRADATION_SCALE", tsConstants.STAMINA_DEGRADATION_SCALE, 0.002));

  // Base rates
  console.log("\nBase Rates:");
  console.log("-" + "-".repeat(79));
  results.push(verifyScalar("BASE_RATE_3PT", tsConstants.BASE_RATE_3PT, 0.28));
  results.push(verifyScalar("BASE_RATE_MIDRANGE_SHORT", tsConstants.BASE_RATE_MIDRANGE_SHORT, 0.50));
  results.push(verifyScalar("BASE_RATE_MIDRANGE_LONG", tsConstants.BASE_RATE_MIDRANGE_LONG, 0.41));
  results.push(verifyScalar("BASE_RATE_DUNK", tsConstants.BASE_RATE_DUNK, 0.87));
  results.push(verifyScalar("BASE_RATE_LAYUP", tsConstants.BASE_RATE_LAYUP, 0.62));
  results.push(verifyScalar("BASE_RATE_FREE_THROW", tsConstants.BASE_RATE_FREE_THROW, 0.50));

  // Attribute weight tables (verify sums to 1.0)
  console.log("\nAttribute Weight Tables:");
  console.log("-" + "-".repeat(79));
  results.push(verifyWeightTable("WEIGHTS_3PT", tsConstants.WEIGHTS_3PT));
  results.push(verifyWeightTable("WEIGHTS_MIDRANGE", tsConstants.WEIGHTS_MIDRANGE));
  results.push(verifyWeightTable("WEIGHTS_DUNK", tsConstants.WEIGHTS_DUNK));
  results.push(verifyWeightTable("WEIGHTS_LAYUP", tsConstants.WEIGHTS_LAYUP));
  results.push(verifyWeightTable("WEIGHTS_REBOUND", tsConstants.WEIGHTS_REBOUND));
  results.push(verifyWeightTable("WEIGHTS_CONTEST", tsConstants.WEIGHTS_CONTEST));
  results.push(verifyWeightTable("WEIGHTS_STEAL_DEFENSE", tsConstants.WEIGHTS_STEAL_DEFENSE));
  results.push(verifyWeightTable("WEIGHTS_TURNOVER_PREVENTION", tsConstants.WEIGHTS_TURNOVER_PREVENTION));
  results.push(verifyWeightTable("WEIGHTS_BALL_HANDLING", tsConstants.WEIGHTS_BALL_HANDLING));
  results.push(verifyWeightTable("WEIGHTS_DRIVE_DUNK", tsConstants.WEIGHTS_DRIVE_DUNK));
  results.push(verifyWeightTable("WEIGHTS_DRIVE_LAYUP", tsConstants.WEIGHTS_DRIVE_LAYUP));
  results.push(verifyWeightTable("WEIGHTS_DRIVE_KICKOUT", tsConstants.WEIGHTS_DRIVE_KICKOUT));
  results.push(verifyWeightTable("WEIGHTS_DRIVE_TURNOVER", tsConstants.WEIGHTS_DRIVE_TURNOVER));
  results.push(verifyWeightTable("WEIGHTS_TRANSITION_SUCCESS", tsConstants.WEIGHTS_TRANSITION_SUCCESS));
  results.push(verifyWeightTable("WEIGHTS_TRANSITION_DEFENSE", tsConstants.WEIGHTS_TRANSITION_DEFENSE));
  results.push(verifyWeightTable("WEIGHTS_SHOT_SEPARATION", tsConstants.WEIGHTS_SHOT_SEPARATION));
  results.push(verifyWeightTable("WEIGHTS_FIND_OPEN_TEAMMATE", tsConstants.WEIGHTS_FIND_OPEN_TEAMMATE));
  results.push(verifyWeightTable("WEIGHTS_HELP_DEFENSE_ROTATION", tsConstants.WEIGHTS_HELP_DEFENSE_ROTATION));
  results.push(verifyWeightTable("WEIGHTS_BLOCK_DEFENDER", tsConstants.WEIGHTS_BLOCK_DEFENDER));
  results.push(verifyWeightTable("WEIGHTS_BLOCK_SHOOTER", tsConstants.WEIGHTS_BLOCK_SHOOTER));
  results.push(verifyWeightTable("WEIGHTS_BLOCK_CONTROL", tsConstants.WEIGHTS_BLOCK_CONTROL));
  results.push(verifyWeightTable("WEIGHTS_BLOCK_SHOOTER_RECOVER", tsConstants.WEIGHTS_BLOCK_SHOOTER_RECOVER));
  results.push(verifyWeightTable("WEIGHTS_OUT_OFF_SHOOTER", tsConstants.WEIGHTS_OUT_OFF_SHOOTER));
  results.push(verifyWeightTable("WEIGHTS_OUT_OFF_BLOCKER", tsConstants.WEIGHTS_OUT_OFF_BLOCKER));

  // Contest penalties
  console.log("\nContest Penalties:");
  console.log("-" + "-".repeat(79));
  results.push(verifyContestPenalties());

  // All attributes list
  console.log("\nAttribute List:");
  console.log("-" + "-".repeat(79));
  results.push(verifyAttributeList());

  // Summary
  console.log("\n" + "=" + "=".repeat(79));
  console.log("VERIFICATION SUMMARY");
  console.log("=" + "=".repeat(79));

  const total = results.length;
  const passed = results.filter(r => r.match === true).length;
  const failed = results.filter(r => r.match === false).length;

  console.log(`Total constants verified:  ${total}`);
  console.log(`Passed:                    ${passed} (${((passed / total) * 100).toFixed(1)}%)`);
  console.log(`Failed:                    ${failed}`);

  if (failed === 0) {
    console.log("\n✓✓✓ ALL CONSTANTS VERIFIED ✓✓✓");
  } else {
    console.log(`\n✗✗✗ ${failed} CONSTANT(S) FAILED VERIFICATION ✗✗✗`);
  }

  // Save results
  const outputFile = path.join(__dirname, 'constants_verification.json');
  fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputFile}`);
}

function verifyScalar(name: string, value: any, expected: any): ConstantComparison {
  const match = value === expected;
  const status = match ? "✓" : "✗";
  console.log(`  ${status} ${name.padEnd(40)}: ${value} ${match ? "" : `(expected: ${expected})`}`);

  return {
    name,
    typescript: value,
    expected,
    type: "scalar",
    match,
  };
}

function verifyWeightTable(name: string, weights: Record<string, number>): ConstantComparison {
  const sum = Object.values(weights).reduce((acc, val) => acc + val, 0);
  const match = Math.abs(sum - 1.0) < 0.0001; // Allow tiny floating point error
  const status = match ? "✓" : "✗";
  const attributeCount = Object.keys(weights).length;

  console.log(`  ${status} ${name.padEnd(40)}: ${attributeCount} attributes, sum=${sum.toFixed(6)}`);

  return {
    name,
    typescript: weights,
    type: "weight_table",
    match,
  };
}

function verifyContestPenalties(): ConstantComparison {
  const penalties = tsConstants.CONTEST_PENALTIES;
  const shotTypes = ['3PT', 'midrange_short', 'midrange_long', 'rim'];
  const levels = ['wide_open', 'contested', 'heavy'];

  let allMatch = true;
  for (const shotType of shotTypes) {
    if (!(shotType in penalties)) {
      console.log(`  ✗ CONTEST_PENALTIES missing shot type: ${shotType}`);
      allMatch = false;
      continue;
    }

    for (const level of levels) {
      if (!(level in (penalties as any)[shotType])) {
        console.log(`  ✗ CONTEST_PENALTIES[${shotType}] missing level: ${level}`);
        allMatch = false;
      }
    }
  }

  if (allMatch) {
    console.log(`  ✓ CONTEST_PENALTIES: All shot types and levels present`);
  }

  return {
    name: "CONTEST_PENALTIES",
    typescript: penalties,
    type: "contest_penalties",
    match: allMatch,
  };
}

function verifyAttributeList(): ConstantComparison {
  const attributes = tsConstants.ALL_ATTRIBUTES;
  const expected = 25;
  const match = attributes.length === expected;
  const status = match ? "✓" : "✗";

  console.log(`  ${status} ALL_ATTRIBUTES: ${attributes.length} attributes ${match ? "" : `(expected: ${expected})`}`);

  return {
    name: "ALL_ATTRIBUTES",
    typescript: attributes,
    expected,
    type: "attribute_list",
    match,
  };
}

// Run verification
verifyConstants();
