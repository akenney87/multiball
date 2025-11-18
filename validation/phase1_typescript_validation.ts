/**
 * Phase 1 Validation - TypeScript Outputs
 *
 * This script generates outputs from TypeScript implementation
 * for comparison against Python reference outputs.
 *
 * Agent 4 will compare these outputs to validate translation accuracy.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  sigmoid,
  calculateComposite,
  weightedSigmoidProbability,
  calculateStaminaPenalty,
  setSeed,
  rollSuccess,
} from '../src/simulation/core/probability';
import { WEIGHTS_3PT, SIGMOID_K, STAMINA_THRESHOLD } from '../src/simulation/constants';

interface TestResult {
  [key: string]: any;
}

function testSigmoid(): TestResult {
  console.log("=" + "=".repeat(79));
  console.log("TEST 1: SIGMOID FUNCTION");
  console.log("=" + "=".repeat(79));

  const testCases: Array<[string, number]> = [
    ["Zero input", 0],
    ["Positive small", 1],
    ["Positive large", 10],
    ["Positive extreme", 100],
    ["Negative small", -1],
    ["Negative large", -10],
    ["Negative extreme", -100],
  ];

  const results: TestResult = {};
  for (const [name, x] of testCases) {
    const result = sigmoid(x);
    results[name] = { input: x, output: result };
    console.log(`${name.padEnd(20)}: sigmoid(${x.toString().padStart(6)}) = ${result.toFixed(10)}`);
  }

  return results;
}

function testWeightedSigmoid(): TestResult {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("TEST 2: WEIGHTED SIGMOID PROBABILITY (CRITICAL)");
  console.log("=" + "=".repeat(79));

  const testCases: Array<[string, number, number]> = [
    ["Neutral matchup", 0.28, 0],
    ["Elite offense +20", 0.28, 20],
    ["Elite offense +40", 0.28, 40],
    ["Elite offense +60 (capped)", 0.28, 60],
    ["Elite defense -20", 0.28, -20],
    ["Elite defense -40", 0.28, -40],
    ["Elite defense -60 (capped)", 0.28, -60],
    ["Extreme +100 (capped at 40)", 0.28, 100],
    ["Extreme -100 (capped at -40)", 0.28, -100],
    ["High base rate neutral", 0.62, 0],
    ["High base rate +30", 0.62, 30],
    ["High base rate -30", 0.62, -30],
  ];

  const results: TestResult = {};
  for (const [name, baseRate, diff] of testCases) {
    const result = weightedSigmoidProbability(baseRate, diff, SIGMOID_K);
    results[name] = {
      base_rate: baseRate,
      attribute_diff: diff,
      k: SIGMOID_K,
      output: result,
    };
    const diffStr = diff.toString().padStart(4);
    console.log(`${name.padEnd(30)}: P(${baseRate.toFixed(2)}, ${diffStr}) = ${result.toFixed(6)}`);
  }

  return results;
}

function testCompositeCalculation(): TestResult {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("TEST 3: COMPOSITE CALCULATION");
  console.log("=" + "=".repeat(79));

  const allAttributes = Object.keys(WEIGHTS_3PT);

  const testPlayers: Array<[string, Record<string, number>]> = [
    ["All 50s", Object.fromEntries(allAttributes.map(attr => [attr, 50]))],
    ["All 80s", Object.fromEntries(allAttributes.map(attr => [attr, 80]))],
    ["Mixed attributes", {
      form_technique: 90,
      throw_accuracy: 85,
      finesse: 80,
      hand_eye_coordination: 75,
      balance: 70,
      composure: 65,
      consistency: 60,
      agility: 55,
    }],
    ["Elite shooter", {
      form_technique: 95,
      throw_accuracy: 92,
      finesse: 88,
      hand_eye_coordination: 90,
      balance: 85,
      composure: 87,
      consistency: 84,
      agility: 80,
    }],
    ["Poor shooter", {
      form_technique: 20,
      throw_accuracy: 18,
      finesse: 15,
      hand_eye_coordination: 22,
      balance: 25,
      composure: 19,
      consistency: 17,
      agility: 16,
    }],
  ];

  const results: TestResult = {};
  for (const [name, player] of testPlayers) {
    const composite = calculateComposite(player, WEIGHTS_3PT);
    results[name] = {
      attributes: player,
      weights: WEIGHTS_3PT,
      composite: composite,
    };
    console.log(`${name.padEnd(20)}: composite = ${composite.toFixed(6)}`);
  }

  return results;
}

function testStaminaDegradation(): TestResult {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("TEST 4: STAMINA DEGRADATION");
  console.log("=" + "=".repeat(79));

  const testCases: Array<[string, number]> = [
    ["Full stamina", 100],
    ["At threshold", 80],
    ["Above threshold", 85],
    ["Below threshold", 75],
    ["Moderate fatigue", 60],
    ["Significant fatigue", 40],
    ["Exhausted", 20],
    ["Fully exhausted", 0],
  ];

  const results: TestResult = {};
  for (const [name, stamina] of testCases) {
    const penalty = calculateStaminaPenalty(stamina);
    results[name] = {
      stamina: stamina,
      penalty: penalty,
      threshold: STAMINA_THRESHOLD,
    };
    console.log(`${name.padEnd(25)}: stamina=${stamina.toString().padStart(3)} -> penalty=${penalty.toFixed(6)} (${(penalty * 100).toFixed(2)}%)`);
  }

  return results;
}

function testRandomSeeding(): TestResult {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("TEST 5: RANDOM SEED DETERMINISM");
  console.log("=" + "=".repeat(79));

  // Test with seed 42
  setSeed(42);
  const rollsSeed42 = Array.from({ length: 20 }, () => rollSuccess(0.5));

  // Reset and try again
  setSeed(42);
  const rollsSeed42Repeat = Array.from({ length: 20 }, () => rollSuccess(0.5));

  // Try different seed
  setSeed(123);
  const rollsSeed123 = Array.from({ length: 20 }, () => rollSuccess(0.5));

  const match = JSON.stringify(rollsSeed42) === JSON.stringify(rollsSeed42Repeat);
  const different = JSON.stringify(rollsSeed42) !== JSON.stringify(rollsSeed123);

  const results: TestResult = {
    seed_42_first: rollsSeed42,
    seed_42_repeat: rollsSeed42Repeat,
    seed_123: rollsSeed123,
    reproducible: match,
    different_seeds_differ: different,
  };

  console.log(`Seed 42 (first run):  [${rollsSeed42.slice(0, 10).join(', ')}]`);
  console.log(`Seed 42 (repeat):     [${rollsSeed42Repeat.slice(0, 10).join(', ')}]`);
  console.log(`Seed 123:             [${rollsSeed123.slice(0, 10).join(', ')}]`);
  console.log(`\nReproducible: ${match}`);
  console.log(`Different seeds differ: ${different}`);

  return results;
}

function testEdgeCases(): TestResult {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("TEST 6: EDGE CASES");
  console.log("=" + "=".repeat(79));

  const edgeCases: Array<[string, number, number, boolean]> = [];

  // Test attribute diff = exactly 0
  const result1 = weightedSigmoidProbability(0.30, 0);
  edgeCases.push(["diff=0 returns base_rate", 0.30, result1, Math.abs(result1 - 0.30) < 0.01]);

  // Test floor (5%)
  const result2 = weightedSigmoidProbability(0.30, -200);
  edgeCases.push(["floor at 5%", 0.05, result2, result2 >= 0.05]);

  // Test ceiling (95%)
  const result3 = weightedSigmoidProbability(0.30, 200);
  edgeCases.push(["ceiling at 95%", 0.95, result3, result3 <= 0.95]);

  // Test capping at +40
  const result4a = weightedSigmoidProbability(0.30, 40);
  const result4b = weightedSigmoidProbability(0.30, 100);
  edgeCases.push(["cap at +40", result4a, result4b, Math.abs(result4a - result4b) < 0.001]);

  // Test capping at -40
  const result5a = weightedSigmoidProbability(0.30, -40);
  const result5b = weightedSigmoidProbability(0.30, -100);
  edgeCases.push(["cap at -40", result5a, result5b, Math.abs(result5a - result5b) < 0.001]);

  const results: TestResult = {};
  for (const [name, expected, actual, passes] of edgeCases) {
    results[name] = {
      expected: expected,
      actual: actual,
      passes: passes,
    };
    const status = passes ? "[PASS]" : "[FAIL]";
    console.log(`${status} ${name.padEnd(30)}: expected=${expected.toFixed(6)}, actual=${actual.toFixed(6)}`);
  }

  return results;
}

function runAllTests(): void {
  console.log("\n");
  console.log("+" + "=".repeat(78) + "+");
  console.log("|" + " ".repeat(18) + "PHASE 1 TYPESCRIPT VALIDATION" + " ".repeat(31) + "|");
  console.log("|" + " ".repeat(15) + "Multiball TypeScript Implementation" + " ".repeat(28) + "|");
  console.log("+" + "=".repeat(78) + "+");
  console.log("\n");

  const allResults = {
    sigmoid: testSigmoid(),
    weighted_sigmoid: testWeightedSigmoid(),
    composite: testCompositeCalculation(),
    stamina: testStaminaDegradation(),
    random_seed: testRandomSeeding(),
    edge_cases: testEdgeCases(),
  };

  // Save to JSON for comparison
  const outputFile = path.join(__dirname, 'typescript_outputs.json');
  fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2));

  console.log("\n" + "=" + "=".repeat(79));
  console.log("VALIDATION COMPLETE");
  console.log("=" + "=".repeat(79));
  console.log(`TypeScript outputs saved to: ${outputFile}`);
  console.log("\nNext: Compare with Python reference outputs");

  // Load Python reference and compare
  const pythonFile = path.join(__dirname, 'python_reference_outputs.json');
  if (fs.existsSync(pythonFile)) {
    const pythonResults = JSON.parse(fs.readFileSync(pythonFile, 'utf-8'));
    compareResults(pythonResults, allResults);
  } else {
    console.log("\nPython reference outputs not found. Run python validation first.");
  }
}

function compareResults(pythonResults: TestResult, typescriptResults: TestResult): void {
  console.log("\n" + "=" + "=".repeat(79));
  console.log("COMPARISON: PYTHON vs TYPESCRIPT");
  console.log("=" + "=".repeat(79));

  let totalTests = 0;
  let exactMatches = 0;
  let closeMatches = 0; // Within 1e-6
  let failures = 0;

  // Compare weighted sigmoid (most critical)
  console.log("\nCRITICAL: Weighted Sigmoid Comparison");
  console.log("-" + "-".repeat(79));

  for (const testName of Object.keys(pythonResults.weighted_sigmoid)) {
    totalTests++;
    const pythonVal = pythonResults.weighted_sigmoid[testName].output;
    const tsVal = typescriptResults.weighted_sigmoid[testName].output;
    const diff = Math.abs(pythonVal - tsVal);

    if (diff === 0) {
      exactMatches++;
      console.log(`  [EXACT] ${testName.padEnd(30)}: ${tsVal.toFixed(6)}`);
    } else if (diff < 1e-6) {
      closeMatches++;
      console.log(`  [CLOSE] ${testName.padEnd(30)}: diff = ${diff.toExponential(2)}`);
    } else {
      failures++;
      console.log(`  [FAIL]  ${testName.padEnd(30)}: Python=${pythonVal.toFixed(6)}, TS=${tsVal.toFixed(6)}, diff=${diff.toExponential(2)}`);
    }
  }

  // Compare stamina degradation
  console.log("\nStamina Degradation Comparison");
  console.log("-" + "-".repeat(79));

  for (const testName of Object.keys(pythonResults.stamina)) {
    totalTests++;
    const pythonVal = pythonResults.stamina[testName].penalty;
    const tsVal = typescriptResults.stamina[testName].penalty;
    const diff = Math.abs(pythonVal - tsVal);

    if (diff === 0) {
      exactMatches++;
      console.log(`  [EXACT] ${testName.padEnd(25)}: ${tsVal.toFixed(6)}`);
    } else if (diff < 1e-6) {
      closeMatches++;
      console.log(`  [CLOSE] ${testName.padEnd(25)}: diff = ${diff.toExponential(2)}`);
    } else {
      failures++;
      console.log(`  [FAIL]  ${testName.padEnd(25)}: Python=${pythonVal.toFixed(6)}, TS=${tsVal.toFixed(6)}, diff=${diff.toExponential(2)}`);
    }
  }

  // Compare composite calculations
  console.log("\nComposite Calculation Comparison");
  console.log("-" + "-".repeat(79));

  for (const testName of Object.keys(pythonResults.composite)) {
    totalTests++;
    const pythonVal = pythonResults.composite[testName].composite;
    const tsVal = typescriptResults.composite[testName].composite;
    const diff = Math.abs(pythonVal - tsVal);

    if (diff === 0) {
      exactMatches++;
      console.log(`  [EXACT] ${testName.padEnd(20)}: ${tsVal.toFixed(6)}`);
    } else if (diff < 1e-6) {
      closeMatches++;
      console.log(`  [CLOSE] ${testName.padEnd(20)}: diff = ${diff.toExponential(2)}`);
    } else {
      failures++;
      console.log(`  [FAIL]  ${testName.padEnd(20)}: Python=${pythonVal.toFixed(6)}, TS=${tsVal.toFixed(6)}, diff=${diff.toExponential(2)}`);
    }
  }

  // Summary
  console.log("\n" + "=" + "=".repeat(79));
  console.log("VALIDATION SUMMARY");
  console.log("=" + "=".repeat(79));
  console.log(`Total tests:        ${totalTests}`);
  console.log(`Exact matches:      ${exactMatches} (${((exactMatches / totalTests) * 100).toFixed(1)}%)`);
  console.log(`Close matches:      ${closeMatches} (within 1e-6)`);
  console.log(`Failures:           ${failures}`);

  const passRate = ((exactMatches + closeMatches) / totalTests) * 100;
  console.log(`\nOverall pass rate:  ${passRate.toFixed(1)}%`);

  if (failures === 0) {
    console.log("\n✓✓✓ PHASE 1 VALIDATION: APPROVED ✓✓✓");
    console.log("TypeScript implementation produces IDENTICAL outputs to Python.");
  } else {
    console.log("\n✗✗✗ PHASE 1 VALIDATION: NEEDS WORK ✗✗✗");
    console.log(`${failures} test(s) failed. Review discrepancies above.`);
  }
}

// Run validation
runAllTests();
