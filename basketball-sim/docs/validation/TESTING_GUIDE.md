# Basketball Simulator - Testing Guide

Quick reference for running validation tests and interpreting results.

---

## Quick Start

### Run All Integration Tests
```bash
# From project root
pytest tests/test_integration_realism.py -v
```

### Run Standalone Validation
```bash
# From project root
python validate_nba_realism.py
```

### Run Specific Test Categories
```bash
# Shot success rates only
pytest tests/test_integration_realism.py::TestShotSuccessRates -v

# Shot distribution only
pytest tests/test_integration_realism.py::TestShotDistribution -v

# Turnover rates only
pytest tests/test_integration_realism.py::TestTurnoverRates -v

# Rebounding rates only
pytest tests/test_integration_realism.py::TestReboundingRates -v

# Tactical impact only
pytest tests/test_integration_realism.py::TestTacticalImpact -v

# Edge cases only
pytest tests/test_integration_realism.py::TestEdgeCaseRealism -v
```

---

## Understanding Test Output

### Passing Test
```
tests/test_integration_realism.py::TestReboundingRates::test_baseline_offensive_rebound_rate PASSED
Baseline OREB rate: 31.9%
```
- Green checkmark or PASSED status
- Metric within expected range
- No action needed

### Failing Test
```
tests/test_integration_realism.py::TestShotSuccessRates::test_average_matchup_realistic_percentages FAILED
AssertionError: 3PT% should be 28-44%, got 60.1%
assert 0.6005089058524173 <= 0.44
```
- Red X or FAILED status
- Shows expected range and actual value
- Indicates which constant needs adjustment

---

## Test Categories

### 1. Shot Success Rates (4 tests)
**Purpose:** Validate shooting percentages match NBA reality

**Tests:**
- Elite shooter vs poor defender (should hit 70-85% wide open)
- Poor shooter vs elite defender (should hit 10-25% contested)
- Average vs average (should produce NBA-average percentages)
- Contest impact (heavy contest should reduce success by 20-25%)

**Common Failures:**
- "3PT% should be 28-44%, got 60%"
  - **Fix:** Reduce `BASE_RATE_3PT` in constants.py
- "Elite vs poor FG% unrealistically high"
  - **Fix:** Reduce all shooting BaseRates

### 2. Shot Distribution (4 tests)
**Purpose:** Validate shot selection matches modern NBA

**Tests:**
- Baseline distribution (40% 3PT, 20% mid, 40% rim)
- Elite shooters take more threes
- Zone defense increases 3PT attempts
- Transition increases rim attempts

**Common Failures:**
- "Transition rim% should exceed halfcourt"
  - **Fix:** Check transition bonus in shot selection logic

### 3. Turnover Rates (3 tests)
**Purpose:** Validate turnover frequency matches NBA

**Tests:**
- Baseline turnover rate (8-15%)
- Zone defense increases turnovers
- Fast pace increases turnovers

**Common Failures:**
- "Turnover rate should be 5-20%, got 9%"
  - **Fix:** Increase `BASE_TURNOVER_RATE` in constants.py

### 4. Rebounding Rates (3 tests)
**Purpose:** Validate rebounding percentages

**Tests:**
- Baseline OREB rate (22-30%)
- Crash glass increases OREB
- 3PT shots lower OREB rate

**Common Failures:**
- "OREB rate should be 15-35%, got 9%"
  - **Fix:** Check OREB calculation for 3PT-heavy teams

### 5. Tactical Impact (2 tests)
**Purpose:** Validate tactical settings have observable effects

**Tests:**
- Scoring options produce correct usage (30%/20%/15%)
- All tactical settings affect outcomes (>5% effect size)

**Common Failures:**
- Usually pass - tactical systems are working well

### 6. Edge Cases (2 tests)
**Purpose:** Validate extreme scenarios don't break

**Tests:**
- All-99 vs all-1 produces realistic blowout (not 100% vs 0%)
- No crashes or NaN values

**Common Failures:**
- "All-99 FG% unrealistically high: 96%"
  - **Fix:** Add probability ceiling or adjust sigmoid

---

## Validation Script Options

### Basic Usage
```bash
python validate_nba_realism.py
```

### Custom Configuration
```bash
# Run 2000 possessions per test
python validate_nba_realism.py --num-possessions 2000

# Use specific random seed
python validate_nba_realism.py --seed 123

# Custom output file
python validate_nba_realism.py --output my_report.md

# Combine options
python validate_nba_realism.py --num-possessions 2000 --seed 42 --output report.md
```

### Understanding Exit Codes
- **Exit 0:** All validations passed
- **Exit 1:** One or more validations failed

### CI/CD Integration
```bash
# In GitHub Actions or similar
python validate_nba_realism.py
if [ $? -eq 0 ]; then
  echo "Validation passed!"
else
  echo "Validation failed, check report"
  exit 1
fi
```

---

## Interpreting Validation Reports

### Report Location
- Default: `REALISM_VALIDATION_REPORT.md`
- Custom: Specified with `--output`

### Report Structure
1. **Executive Summary:** Overall pass/fail status
2. **Baseline Statistics:** Comparison to NBA averages
3. **Elite vs Poor Matchups:** Extreme disparity validation
4. **Tactical Impact:** Tactical system effectiveness
5. **Edge Cases:** Extreme scenario handling
6. **Recommendations:** Suggested BaseRate adjustments

### Key Metrics to Watch

#### Critical (Must Pass)
- 3PT%: 30-45% range
- Overall FG%: 42-52% range
- Points per possession: 0.95-1.25 range

#### Important (Should Pass)
- Turnover rate: 10-18% range
- OREB%: 20-32% range
- Shot distribution: 3PT 35-48%, Rim 35-50%

#### Minor (Nice to Pass)
- Assist rate: 55-70% range
- Specific tactical effects (>3% difference)

---

## Common Issues and Fixes

### Issue: 3PT% Too High (60%+)
**Symptoms:**
- Test failures in `test_average_matchup_realistic_percentages`
- Validation report shows 3PT% > 50%

**Fix:**
```python
# File: src/constants.py
BASE_RATE_3PT = 0.20  # Reduce from 0.30
```

### Issue: Overall FG% Too High (65%+)
**Symptoms:**
- Multiple shooting test failures
- Points per possession > 1.30

**Fix:**
```python
# File: src/constants.py
BASE_RATE_3PT = 0.20              # Reduce from 0.30
BASE_RATE_MIDRANGE_SHORT = 0.35   # Reduce from 0.45
BASE_RATE_MIDRANGE_LONG = 0.28    # Reduce from 0.37
BASE_RATE_DUNK = 0.70             # Reduce from 0.80
BASE_RATE_LAYUP = 0.52            # Reduce from 0.62
```

### Issue: Turnover Rate Too Low (<10%)
**Symptoms:**
- Test failure in `test_baseline_turnover_rate`
- Validation report shows turnover rate < 10%

**Fix:**
```python
# File: src/constants.py
BASE_TURNOVER_RATE = 0.12  # Increase from 0.08
```

### Issue: Transition Not Increasing Rim Attempts
**Symptoms:**
- Test failure in `test_transition_increases_rim_attempts`
- Halfcourt and transition rim% are equal

**Fix:**
- Check `select_shot_type()` in `src/systems/shooting.py`
- Verify `possession_context.is_transition` check
- Confirm +20% rim distribution adjustment applies

---

## Re-Running After Fixes

### Step 1: Make Changes
Edit `src/constants.py` with recommended values

### Step 2: Run Integration Tests
```bash
pytest tests/test_integration_realism.py -v
```

**Expected Result:** 19/19 tests pass

### Step 3: Run Validation Script
```bash
python validate_nba_realism.py
```

**Expected Result:** Exit code 0, report shows all metrics in range

### Step 4: Review Report
Open `REALISM_VALIDATION_REPORT.md` and confirm:
- 3PT% in 30-45% range
- Overall FG% in 42-52% range
- Turnover rate in 10-18% range
- Points per possession in 0.95-1.25 range

---

## Statistical Validation Workflow

```
┌─────────────────────────────────────────┐
│ 1. Make Code/Constant Changes           │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 2. Run Integration Tests                │
│    pytest tests/test_integration_       │
│    realism.py -v                        │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 3. Check Results                        │
│    - All 19 tests pass?                 │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌────────┐          ┌────────┐
    │  PASS  │          │  FAIL  │
    └────┬───┘          └───┬────┘
         │                  │
         │                  ▼
         │         ┌─────────────────────┐
         │         │ Review Failed Tests │
         │         │ Adjust Constants    │
         │         └──────────┬──────────┘
         │                    │
         │                    │
         └────────┬───────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ 4. Run Validation Script                │
│    python validate_nba_realism.py       │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ 5. Review Validation Report             │
│    - All metrics in NBA range?          │
│    - Exit code 0?                       │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    ┌────────┐          ┌────────┐
    │  PASS  │          │  FAIL  │
    └────┬───┘          └───┬────┘
         │                  │
         │                  ▼
         │         ┌─────────────────────┐
         │         │ Review Recommenda-  │
         │         │ tions in Report     │
         │         └──────────┬──────────┘
         │                    │
         │                    │
         └────────┬───────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ 6. APPROVED - Proceed to Next Milestone│
└─────────────────────────────────────────┘
```

---

## Performance Notes

### Test Execution Times
- Single integration test: ~0.1 seconds
- Full integration suite (19 tests): ~1.5 seconds
- Validation script (1000 possessions): ~5 seconds
- Validation script (2000 possessions): ~10 seconds

### Recommended Settings
- **Development:** 500-1000 possessions (fast iteration)
- **CI/CD:** 1000 possessions (balance speed and accuracy)
- **Final validation:** 2000+ possessions (high confidence)

---

## Continuous Integration Example

### GitHub Actions Workflow
```yaml
name: NBA Realism Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.10'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run integration tests
        run: pytest tests/test_integration_realism.py -v

      - name: Run validation script
        run: python validate_nba_realism.py --num-possessions 1000

      - name: Upload validation report
        uses: actions/upload-artifact@v2
        with:
          name: validation-report
          path: REALISM_VALIDATION_REPORT.md
```

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'src'"
**Solution:** Run tests from project root directory
```bash
cd C:\Users\alexa\desktop\projects\simulator
pytest tests/test_integration_realism.py -v
```

### "FileNotFoundError: sample_teams.json"
**Solution:** Ensure data directory exists with sample teams
```bash
ls data/sample_teams.json  # Should exist
```

### Tests hang or timeout
**Solution:** Reduce number of possessions in test
```python
# In test file, reduce num_possessions
stats = run_possessions_and_aggregate(
    offensive_team,
    defensive_team,
    num_possessions=100,  # Reduce from 1000
    seed=42
)
```

### Inconsistent results between runs
**Solution:** Use fixed seed for reproducibility
```bash
# In validate_nba_realism.py
python validate_nba_realism.py --seed 42
```

---

## Advanced Usage

### Profile Test Performance
```bash
pytest tests/test_integration_realism.py --durations=10
```

### Run Tests in Parallel
```bash
pytest tests/test_integration_realism.py -n auto
# Requires: pip install pytest-xdist
```

### Generate Coverage Report
```bash
pytest tests/test_integration_realism.py --cov=src --cov-report=html
```

### Run with Verbose Debug Output
```bash
pytest tests/test_integration_realism.py -vv -s
```

---

## Files Reference

### Test Files
- `tests/test_integration_realism.py` - Main integration test suite
- `validate_nba_realism.py` - Standalone validation script

### Report Files
- `REALISM_VALIDATION_REPORT.md` - Generated validation report
- `BASKETBALL_REALISM_ANALYSIS.md` - Expert analysis
- `VALIDATION_SUMMARY.md` - Summary of findings
- `TESTING_GUIDE.md` - This file

### Data Files
- `data/sample_teams.json` - Sample teams for testing

### Source Files
- `src/constants.py` - BaseRates and constants (adjust here)
- `src/systems/shooting.py` - Shooting mechanics
- `src/systems/possession.py` - Possession flow
- `src/simulation.py` - Main simulation engine

---

## Contact & Support

For validation questions:
1. Review `BASKETBALL_REALISM_ANALYSIS.md` for detailed analysis
2. Review `VALIDATION_SUMMARY.md` for summary of issues
3. Check test output for specific failed assertions
4. Consult NBA statistical references in analysis documents

**Remember:** The validator has veto power. If tests don't pass the basketball "eye test", implementation needs adjustment.

---

**Last Updated:** 2025-11-04
**Version:** 1.0 (Milestone 1)
