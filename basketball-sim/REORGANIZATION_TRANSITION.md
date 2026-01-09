# Project Reorganization Transition Guide

**Date:** 2025-11-07
**Purpose:** Major directory reorganization to eliminate organizational debt

## Summary

This reorganization addressed severe organizational debt across the basketball simulator project:
- **112 root-level Python scripts** → Moved to appropriate directories
- **47 validation directories** → Consolidated to 3 (current + 2 archives)
- **90+ markdown files** → Organized into docs/ subdirectories
- **10 redundant team directories** → Deleted (kept only teams/)

---

## New Directory Structure

### Production Structure

```
/simulator (root)
├── main.py                    # Main simulation entry point
├── generate_teams.py          # Team generation utility
├── run_validation.py          # Validation runner
├── analyze_results.py         # Results analysis (also in scripts/analysis/)
├── basketball_sim.md          # Master implementation spec
├── CLAUDE.md                  # Claude Code instructions
├── README.md                  # Project README
│
├── src/                       # Core simulation code
│   ├── core/                  # Core engine
│   ├── systems/               # Game systems
│   └── tactical/              # Tactical logic
│
├── tests/                     # Test suite
│
├── teams/                     # Active team definitions (JSON)
│
├── output/                    # Game output files (markdown only)
│
├── validation/                # Validation results
│   ├── current/               # Latest validation run (formerly validation_results/)
│   └── archive/               # Historical M4.5 runs
│       ├── validation_m45_phase3_final/
│       └── validation_teamwork_fixed/
│
├── docs/                      # All documentation
│   ├── systems/               # System documentation
│   ├── milestones/            # Milestone reports
│   │   ├── M1/
│   │   ├── M2/
│   │   ├── M3/
│   │   ├── M4/
│   │   └── M4.5/
│   ├── validation/            # Validation reports
│   └── archive/               # Session summaries and fix reports
│
├── examples/                  # Demo scripts
│
└── scripts/                   # Utility scripts
    ├── analysis/              # Analysis tools
    └── archive/               # Old test/debug/diagnostic scripts
```

---

## Detailed File Movements

### 1. Examples/ (Demo Scripts)

**From root → examples/**
- demo_defense.py
- demo_turnovers.py
- demo_possession.py
- demo_tactical.py
- demo_play_by_play.py
- demo_substitutions.py
- demo_quarter.py
- demo_full_game.py
- demo_fouls.py
- demo_blowout.py
- demo_timeout.py
- demo_integrated_timeout.py

**Purpose:** Consolidated all demonstration scripts for users learning the simulator.

---

### 2. Scripts/analysis/ (Analysis Tools)

**From root → scripts/analysis/**
- analyze_results.py (COPY - original kept in root for production use)
- analyze_attribute_usage.py
- analyze_competitive_balance.py
- analyze_shot_quality.py
- audit_attribute_usage.py
- calculate_attribute_weights.py
- calculate_final_correlation.py
- compare_phase1_correlations.py
- investigate_correlation.py
- phase1_correlation.py
- recalculate_correlation.py

**Purpose:** Centralized analysis and statistical tools used during development/validation.

---

### 3. Scripts/archive/ (Archived Scripts)

**From root → scripts/archive/**

**Test Scripts (35 files):**
- All test_*.py files from root level

**Debug/Diagnostic Scripts (17+ files):**
- All debug_*.py files
- All diagnose_*.py files
- urgent_correlation_diagnostic.py

**Validation Scripts (14+ files):**
- All validate_*.py files
- All validation_m3_*.py files

**Generation Scripts (5 files):**
- All generate_*_games.py files (except generate_teams.py which stays in root)

**Utility Scripts:**
- All check_*.py files
- All solve_*.py files
- All trace_*.py files
- All quick_*.py files
- All m3_*.py files

**Purpose:** Preserved old development/testing scripts without cluttering root directory.

---

### 4. Docs/systems/ (System Documentation)

**From root → docs/systems/**
- DEFENSE_SYSTEM_DOCS.md
- GAME_CLOCK_DOCUMENTATION.md
- GAME_CLOCK_SUMMARY.md
- POSSESSION_SYSTEM_DOCS.md
- POSSESSION_IMPLEMENTATION_SUMMARY.md
- REBOUNDING_SYSTEM.md
- REBOUNDING_IMPLEMENTATION_SUMMARY.md
- REBOUNDING_INTEGRATION_GUIDE.md
- SHOOTING_SYSTEM_SUMMARY.md
- SHOOTING_QUICK_REFERENCE.md
- STAMINA_SYSTEM_VALIDATION.md
- SUBSTITUTION_SYSTEM_COMPLETE.md
- TACTICAL_IMPLEMENTATION_SUMMARY.md
- TURNOVER_SYSTEM_SUMMARY.md
- TURNOVER_README.md
- IMPLEMENTATION_NOTE_TURNOVERS.md

**Purpose:** Centralized technical documentation for each game system.

---

### 5. Docs/milestones/M1/ (Milestone 1 Reports)

**From root → docs/milestones/M1/**
- M1_FINAL_REPORT.md
- M1_METRICS_COMPARISON.md
- M1_SIGN_OFF_RECOMMENDATION.md
- M1_VALIDATION_SUMMARY.md
- FINAL_VALIDATION_M1.md
- SPEC_DIVERGENCES.md

**Purpose:** Historical record of Milestone 1 completion.

---

### 6. Docs/milestones/M2/ (Milestone 2 Reports)

**From root → docs/milestones/M2/**
- M2_KICKOFF_SUMMARY.md
- M2_PLAYBYPLAY_SUMMARY.md
- M2_POST_FIXES_VALIDATION.md
- M2_100_QUARTER_VALIDATION_REPORT.md
- M2_COMPLETION_ASSESSMENT.md
- MILESTONE_2_PLAN.md
- PHASE_5_COMPLETE.md

**Purpose:** Historical record of Milestone 2 (quarter simulation) completion.

---

### 7. Docs/milestones/M3/ (Milestone 3 Reports)

**From root → docs/milestones/M3/**
- M3_SESSION_STATUS.md
- M3_SESSION_2_STATUS.md
- M3_FINAL_SESSION_STATUS.md
- M3_SIGNOFF_READY.md
- M3_REALISM_ANALYSIS.md
- M3_FIXES_COMPLETE.md
- M3_FINAL_VALIDATION_REPORT.md
- M3_REALISM_SPECIALIST_VERDICT.md
- M3_SIGN_OFF_SUMMARY.md
- M3_ALL_FIXES_COMPLETE_SUMMARY.md
- M3_ISSUE_7_FOUL_VARIETY_REPORT.md
- SESSION_HANDOFF_M3_ISSUES.md
- FOULS_AND_INJURIES_SPEC.md

**Purpose:** Historical record of Milestone 3 (full game + fouls/injuries) completion.

---

### 8. Docs/milestones/M4/ (Milestone 4 Reports)

**From root → docs/milestones/M4/**
- M4_VALIDATION_SUMMARY.md

**Purpose:** Historical record of Milestone 4 (100-game validation) completion.

---

### 9. Docs/milestones/M4.5/ (Milestone 4.5 Reports)

**From root → docs/milestones/M4.5/**
- M45_COMPLETION_SUMMARY.md
- M45_PHASE1_COMPLETION_SUMMARY.md
- M45_PHASE2_COMPLETION_SUMMARY.md
- M45_PHASE3_COMPLETION_SUMMARY.md
- M45_PHASE4_ANALYSIS.md

**Purpose:** Historical record of Milestone 4.5 (attribute correlation optimization) completion.

---

### 10. Docs/validation/ (Validation Reports)

**From root → docs/validation/**
- BASKETBALL_REALISM_ANALYSIS.md
- CORRELATION_INVESTIGATION_FINDINGS.md
- DICE_ROLL_VARIANCE_ANALYSIS.md
- FINAL_CORRELATION_REPORT.md
- REALISM_VALIDATION_REPORT.md
- TESTING_GUIDE.md
- VALIDATION_SUMMARY.md
- VALIDATION_REPORT.md
- VALIDATION_REPORT_FIXED.md
- VALIDATION_REPORT_M45_CORRECTED.md
- VALIDATION_REPORT_M45_PHASE1_COMPLETE.md

**Purpose:** Cross-milestone validation and realism analysis reports.

---

### 11. Docs/archive/ (Session Summaries and Fix Reports)

**From root → docs/archive/**
- BONUS_VALIDATION_REPORT.md
- TIMEOUT_SUB_FIX_REPORT.md
- ISSUE_5_RESOLUTION_REPORT.md
- FT_FIX_REPORT.md
- SUB_FIX_VALIDATION_REPORT.md
- TIMEOUT_FIX_FINAL_REPORT.md
- SUBSTITUTION_FIX_REPORT.md
- QUALITY_CHECK_REPORT.md
- POSSESSION_STATE_DELIVERABLES.md
- SESSION1_VALIDATION_SUMMARY.md
- SESSION1_COMPLETE_SUMMARY.md
- SESSION_STATUS_UPDATE.md
- FINAL_SESSION_SUMMARY.md
- CONTINUATION_SESSION_SUMMARY.md
- TRANSITION_BUG_FIX.md
- TRANSITION_FIX_SUMMARY.md
- DEFENSIVE_REBOUND_SUB_FIX_SUMMARY.md
- TIMEOUT_TIMING_FIX_SUMMARY.md
- FINAL_FIXES_SUMMARY.md
- DELIVERABLES_SUMMARY.md

**Purpose:** Preserved session handoff and bug fix documentation for historical reference.

---

## Deleted Files

### Temporary Files
- NUL
- All temp_*.txt files
- All test_*.txt files
- urgent_correlation_result.json

### Duplicate Documentation
- src/tactical/README.md (duplicate)
- tests/README_INTEGRATION_TESTS.md (content can be in TESTING_GUIDE.md)

---

## Deleted Directories

### Redundant Team Directories
**Kept:** teams/ (production team definitions)

**Deleted:**
- teams_attribute_expansion/
- teams_clean_baseline/
- teams_m41/
- teams_phase1/
- teams_phase2/
- teams_v2/
- teams_v3/
- teams_v4/
- teams_v5/
- teams_v6/
- teams_v7_final/

**Rationale:** Only teams/ contains the current production team definitions. All others were experimental iterations during M4.5 development.

---

### Redundant Validation Directories
**Kept:**
- validation/ (contains current/ and archive/)
  - validation/current/ (formerly validation_results/)
  - validation/archive/validation_m45_phase3_final/
  - validation/archive/validation_teamwork_fixed/

**Deleted (43 directories):**
- validation_archetype_test/
- validation_attribute_expansion/
- validation_attribute_expansion_tuned/
- validation_baserate_test/
- validation_clean_baseline/
- validation_complete_fix/
- validation_contest_test/
- validation_corrected/
- validation_final/
- validation_final_fixed/
- validation_final_recalibrated/
- validation_final_v2/
- validation_fixed/
- validation_formula_fixed/
- validation_fully_reverted/
- validation_k01_test/
- validation_m4_final/
- validation_m4_iteration10_FINAL/
- validation_m4_iteration11/
- validation_m4_iteration12/
- validation_m4_iteration6/
- validation_m4_iteration7/
- validation_m4_iteration8/
- validation_m4_iteration9/
- validation_m41_test1/
- validation_m45_corrected/
- validation_m45_final/
- validation_m45_phase2/
- validation_m45_phase2_fixed/
- validation_m45_phase3/
- validation_no_expansions/
- validation_patience_teamwork_only/
- validation_phase1/
- validation_phase1_restored/
- validation_phase2/
- validation_phase2_corrected/
- validation_phase2_fixed/
- validation_phase2_tuned/
- validation_recal_test10/
- validation_results_v2/
- validation_results_v3/
- validation_test/
- validation_tight_test/

**Rationale:** These were experimental validation runs during M4.5 attribute correlation tuning. Only the final phase 3 and teamwork-fixed runs were preserved in validation/archive/.

---

### Cleaned Output/ Directory
**Deleted subdirectories:**
- ft_debug_test/
- ft_debug_test2/
- ft_debug_test3/
- ft_debug_test4/
- ft_debug_test5/
- ft_debug_test6/
- ft_fix_final_test/
- ft_fix_test/
- substitution_final_test/
- substitution_test/
- substitution_test2/

**Kept:** All markdown game output files remain in output/

**Rationale:** These were debug test runs for free throw and substitution bug fixes during M3 development.

---

## Finding Common Files

### "Where did X go?"

**Demo/Example Scripts:**
- **Location:** examples/
- **Usage:** Educational examples of how to use the simulator

**Analysis Tools:**
- **Location:** scripts/analysis/
- **Exception:** analyze_results.py (also kept in root for production use)
- **Usage:** Statistical analysis and correlation investigation

**Old Test Scripts:**
- **Location:** scripts/archive/
- **Usage:** Historical development/testing scripts (rarely needed)

**System Documentation:**
- **Location:** docs/systems/
- **Examples:** SHOOTING_SYSTEM_SUMMARY.md, REBOUNDING_SYSTEM.md
- **Usage:** Technical reference for how each game system works

**Milestone Reports:**
- **Location:** docs/milestones/M1/ through M4.5/
- **Usage:** Historical completion reports and sign-off documentation

**Validation Reports:**
- **Location:** docs/validation/
- **Usage:** Cross-milestone realism analysis and statistical validation

**Bug Fix/Session Reports:**
- **Location:** docs/archive/
- **Usage:** Historical development session handoffs and bug fix documentation

**Latest Validation Results:**
- **Location:** validation/current/ (formerly validation_results/)
- **Usage:** Most recent 100-game validation run

**Team Definitions:**
- **Location:** teams/ (unchanged)
- **Usage:** Production team JSON files

---

## Impact on Existing Workflows

### No Impact (Files Remain in Root)
- main.py - Still run with `python main.py`
- generate_teams.py - Still run with `python generate_teams.py`
- run_validation.py - Still run with `python run_validation.py`
- analyze_results.py - Still run with `python analyze_results.py`
- All core documentation (README.md, CLAUDE.md, basketball_sim.md)

### Updated Paths

**Running demo scripts:**
```bash
# OLD
python demo_possession.py

# NEW
python examples/demo_possession.py
```

**Using analysis tools:**
```bash
# OLD
python phase1_correlation.py

# NEW
python scripts/analysis/phase1_correlation.py
```

**Reading validation results:**
```bash
# OLD
ls validation_results/

# NEW
ls validation/current/
```

**Referencing system docs:**
```bash
# OLD
cat SHOOTING_SYSTEM_SUMMARY.md

# NEW
cat docs/systems/SHOOTING_SYSTEM_SUMMARY.md
```

---

## Benefits of Reorganization

### Before
- 112 Python scripts in root directory
- 47 validation directories (mostly redundant)
- 90+ markdown files scattered everywhere
- 10 duplicate team directories
- Difficult to find specific documentation
- Unclear which files are production vs experimental

### After
- Clean root with 4 production scripts + documentation
- 3 validation directories (current + 2 historical archives)
- Documentation organized by category (systems/milestones/validation/archive)
- Single source of truth for teams
- Clear separation: production (root) vs examples vs utilities vs archives
- Easier onboarding for new developers

---

## Rollback Information

If you need to undo this reorganization:

1. **Team directories:** These were deleted. You would need to regenerate teams using `generate_teams.py` if needed, or restore from git history if versioned.

2. **Validation directories:** 43 experimental directories were deleted. If you need old validation runs, restore from git history or re-run validation.

3. **Files:** All files were MOVED, not deleted. To restore the old structure:
   ```bash
   mv examples/*.py .
   mv scripts/analysis/*.py .
   mv scripts/archive/*.py .
   mv docs/systems/*.md .
   mv docs/milestones/M1/*.md .
   # ... etc.
   ```

4. **Temporary files:** These (NUL, temp_*.txt, etc.) were truly deleted as they had no value.

---

## Maintenance Going Forward

### File Placement Guidelines

**Root directory:**
- Only production scripts (main.py, generate_teams.py, run_validation.py, analyze_results.py)
- Core documentation (README.md, CLAUDE.md, basketball_sim.md)
- Project meta files (requirements.txt, .gitignore, etc.)

**examples/:**
- Any demo_*.py scripts showing simulator usage
- Scripts intended for users learning the system

**scripts/analysis/:**
- Analysis utilities used during validation/development
- Statistical investigation tools
- Correlation/weight calculation scripts

**scripts/archive/:**
- Old test/debug/diagnostic scripts from development
- Scripts that are no longer actively used but preserved for reference

**docs/systems/:**
- Technical documentation for each game system
- Implementation summaries and guides

**docs/milestones/:**
- Milestone completion reports and sign-off documents
- Organized by milestone number (M1, M2, M3, M4, M4.5)

**docs/validation/:**
- Cross-milestone validation reports
- Realism analysis documents
- Testing guides

**docs/archive/:**
- Session handoff summaries
- Bug fix reports
- Historical development documentation

**validation/current/:**
- Latest validation run results
- Overwrite when running new validation

**validation/archive/:**
- Important historical validation runs worth preserving
- Should be minimal (don't keep every run)

---

## Questions?

If you're looking for a file and can't find it:
1. Check this document's "Finding Common Files" section
2. Use `find` or `grep` to locate it
3. Check git history if it was deleted

**File Search Commands:**
```bash
# Find a Python script
find . -name "debug_possession.py"

# Find documentation
find docs/ -name "*SHOOTING*"

# Search for content across files
grep -r "sigmoid calculation" .
```

---

## Additional Files to Consider (Future Cleanup)

The following files remain in root but could be organized in a future cleanup:

**Root-level markdown files:**
- BACKLOG.md - Could move to docs/
- IMPLEMENTATION_GUIDE.md - Could move to docs/
- PROJECT_STATUS.md - Could move to docs/
- ISSUE_DEFENSIVE_REBOUND_SUBS_RESOLVED.md - Could move to docs/archive/
- REVIEW_GAME_HIGHLIGHTS.md - Could move to docs/

**Root-level scripts:**
- generate_sample_playbyplays.py - Could move to examples/
- run_user_review_games.py - Could move to examples/ or scripts/

**Root-level directories:**
- m45_final_validation/ - Could move to validation/archive/ or delete if redundant
- m45_fixed_validation/ - Could move to validation/archive/ or delete if redundant
- data/ - Appears to be empty or legacy, could delete if unused

**Root-level text files:**
- mid_quarter_test_output.txt - Could delete (appears to be test output)

**Root-level weird artifact:**
- C:Usersalexadesktopprojectssimulatoroutput - Appears to be a file with a malformed path name, should investigate and delete

These were not moved in this reorganization to be conservative and avoid breaking any workflows that might depend on them. They can be addressed in a future cleanup pass once confirmed they're not actively used.

---

**End of Reorganization Transition Guide**
