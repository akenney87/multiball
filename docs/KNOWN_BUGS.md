# Known Bugs

Tracking known issues for future resolution.

---

## High Priority

### BUG-001: Quick Sim Freezes Game After Match Result

**Status:** Backlogged
**Reported:** 2025-12-13
**Component:** Match Preview Modal / Quick Sim

**Description:**
When using the "Quick Sim" button in the Match Preview modal:
1. An error is thrown (details TBD)
2. The match simulates successfully
3. The match result is displayed
4. The game freezes and becomes unresponsive

**Reproduction Steps:**
1. Navigate to Schedule
2. Tap on an upcoming match to open Match Preview modal
3. Tap "Quick Sim" button
4. Observe error, result display, then freeze

**Expected Behavior:**
Quick Sim should complete without errors and allow user to dismiss the result and continue playing.

**Possible Causes:**
- State update race condition in `onQuickSimComplete` handler
- Modal stacking issue after match completes
- Unhandled promise rejection in simulation code
- Re-render loop caused by state timing

**Files to Investigate:**
- `src/ui/navigation/TabNavigator.tsx` - `onQuickSimComplete` handler
- `src/ui/screens/ConnectedMatchPreviewScreen.tsx` - Quick Sim button logic
- `src/ui/screens/ConnectedMatchResultScreen.tsx` - Result display
- Match simulation code in `src/simulation/`

---

## Medium Priority

(None currently)

---

## Low Priority

(None currently)

---

## Resolved

(None currently)
