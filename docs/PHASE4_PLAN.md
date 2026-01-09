# Phase 4: Mobile UI - Implementation Plan

**Created:** 2025-11-21
**Status:** COMPLETE
**Final Grade:** A-
**Final Authorization:** MULTIBALL-P4-UI-2024-APPROVED
**Authorization Code:** MB-P4-2025-OVERSEER-7X9K
**Goal:** Build React Native mobile UI for Multiball

## Progress Tracking

| Week | Status | Grade | Authorization |
|------|--------|-------|---------------|
| Pre-Week | Complete | - | Integration verified |
| Week 1 | Complete | A- | P4W1-APPROVED-20251121-OVERSEER |
| Week 2 | Complete | A- | P4W2-OVERSEER-MATCHUI-20251121 |
| Week 3 | Complete | A- | MB-P4-W3-2025-ROSTER-APPROVED-Q4K7 |
| Week 4 | Complete | A | OVERSEER-W4-ALPHA-7842-APPROVED |
| Week 5 | Complete | B+ | MB-P4-W5-2025-MARKET-CONDITIONAL-8K2M |
| Week 6 | Complete | A- | MULTIBALL-P4-UI-2024-APPROVED |

---

## Overview

Phase 4 transforms the backend systems built in Phases 1-3 into a playable mobile game. The UI must be:
- **Touch-friendly**: Large buttons, intuitive gestures
- **Offline-first**: Works completely without internet
- **Simple defaults, optional depth**: Casual players can play easily, power users can customize

---

## Prerequisites

### Phase 3 APIs Available:
- AI Decision Engine (`src/ai/`)
- Season Management (`src/season/`)
- Game Simulation (`src/simulation/`)
- Management Systems (`src/systems/`)
- Event System with 16 event types
- Hooks System for lifecycle events

### React Native Setup:
- Project already initialized with React Native + TypeScript
- Jest configured for testing
- AsyncStorage available for persistence

---

## Agent 10 Required Revisions (Incorporated)

1. **Move basic persistence to Week 4** - Done
2. **Add error handling UI components** - Added to Week 1-2
3. **Define game engine integration approach** - Added Pre-Week section
4. **Add confirmation dialogs** - Added to Week 2-3
5. **Include settings screen** - Added to Week 5

---

## Pre-Week: Game Engine Integration Verification

**Goal:** Verify Phase 1-3 APIs work seamlessly with React Native UI

**Tasks:**
1. **API Surface Audit**
   - Verify all exports from src/ai/index.ts
   - Verify all exports from src/season/index.ts
   - Verify GameSimulator exports

2. **Integration Test**
   - Create simple test component that:
     - Creates a season
     - Simulates a match
     - Updates standings
   - Verify no threading/async issues

3. **Type Compatibility**
   - Ensure all types are importable in React components
   - No circular dependencies

**Deliverable:** Integration verification document

---

## Timeline: 6 Weeks

### Week 1: Core Navigation & App Shell
**Goal:** Establish navigation structure and basic app shell

**Tasks:**
1. **Navigation Setup**
   - Install @react-navigation/native
   - Bottom tab navigator (4-5 tabs)
   - Stack navigators for each tab

2. **Tab Structure:**
   - Home (Dashboard)
   - Roster (Team Management)
   - Season (Schedule/Standings)
   - Market (Transfers/Free Agents)
   - Settings

3. **App Shell:**
   - Header component with team name/budget
   - Loading states
   - Error boundaries

4. **Theme System:**
   - Color palette (team colors customizable)
   - Typography scale
   - Spacing system
   - Dark mode support (optional)

5. **Error Handling (Revision #2):**
   - ErrorBoundary component
   - Global error handler
   - Error display component
   - Fallback UI for crashes

**Deliverables:**
- Working navigation between all tabs
- Placeholder screens for each section
- Theme provider with consistent styling
- Error boundary wrapping app
- ~25 tests for navigation + error handling

---

### Week 2: Dashboard & Match UI
**Goal:** Main dashboard and match simulation screens

**Tasks:**
1. **Dashboard Screen:**
   - Next match preview card
   - Budget summary widget
   - Injury alerts widget
   - Quick actions (Sim Next Match, Advance Week)
   - News feed (recent events)

2. **Match Simulation Screen:**
   - Pre-match lineup selection
   - Match progress view (quarter-by-quarter)
   - Live score display
   - Play-by-play feed (scrollable)
   - Post-match summary

3. **Match Result Screen:**
   - Final score
   - Box score stats
   - Player performance highlights
   - Continue/Return to Dashboard

4. **Quick Sim Mode:**
   - Instant result generation
   - Batch simulation (week/season)
   - Progress indicator

5. **Confirmation Dialogs (Revision #4):**
   - ConfirmationModal component
   - "Sim entire week?" confirmation
   - "Sim entire season?" confirmation

**Deliverables:**
- Functional dashboard with real data
- Complete match flow (pre/during/post)
- Quick sim functionality
- Confirmation dialogs for batch operations
- ~35 tests for dashboard/match components

---

### Week 3: Roster & Player Management
**Goal:** Team roster and individual player screens

**Tasks:**
1. **Roster List Screen:**
   - Player cards with key stats
   - Position filters (PG/SG/SF/PF/C)
   - Sort options (rating, age, salary)
   - Starting lineup indicator

2. **Player Detail Screen:**
   - Attribute display (25 attributes)
   - Contract info
   - Career stats
   - Training focus selector
   - Release player action

3. **Lineup Management:**
   - Drag-and-drop lineup builder
   - Position validation
   - Save lineup

4. **Training Screen:**
   - Team training focus (Physical/Mental/Technical)
   - Per-player customization (optional depth)
   - Training progress indicators

5. **Destructive Action Confirmations (Revision #4):**
   - "Release Player?" confirmation
   - "Change training focus?" confirmation

**Deliverables:**
- Complete roster management UI
- Player detail views
- Training system integration
- Confirmation dialogs for destructive actions
- ~30 tests for roster components

---

### Week 4: Season & Standings UI
**Goal:** Season schedule, standings, and progression

**Tasks:**
1. **Schedule Screen:**
   - Week-by-week match list
   - Match cards (opponent, sport, venue)
   - Past results display
   - Filter by sport (Basketball/Baseball/Soccer)

2. **Standings Screen:**
   - League table with rank/W/L/Pts
   - Highlight user team
   - Promotion/relegation zone indicators
   - Division selector (future: multiple divisions)

3. **Season Progress:**
   - Current week indicator
   - Season phase display
   - End-of-season summary
   - Promotion/relegation notification

4. **Calendar View (Optional):**
   - Month view with match markers
   - Quick navigation to dates

5. **Basic Persistence (Revision #1 - Moved from Week 6):**
   - AsyncStorage integration
   - Save game state function
   - Load game state function
   - Auto-save on key actions (match complete, week advance)
   - Save indicator UI

**Deliverables:**
- Complete season UI
- Standings with live updates
- Season flow (start to end)
- Working save/load system
- ~30 tests for season + persistence

---

### Week 5: Market & Budget UI
**Goal:** Transfer market, free agents, and budget management

**Tasks:**
1. **Transfer Market Screen:**
   - Available players list
   - Filter by position/age/rating
   - Make offer flow
   - Incoming offers list
   - Offer negotiation UI

2. **Free Agent Market:**
   - Free agent pool display
   - Sign player flow
   - Contract offer screen

3. **Budget Screen:**
   - Budget breakdown chart
   - Allocation sliders (radar chart)
   - Impact preview
   - Save allocation

4. **Scouting Screen:**
   - Scout assignment
   - Depth vs breadth slider
   - Scout reports display
   - Target search filters

5. **Settings Screen (Revision #5):**
   - Simulation speed toggle
   - Sound on/off (placeholder)
   - Reset game option (with confirmation)
   - About/credits

**Deliverables:**
- Complete market system UI
- Budget management interface
- Scouting integration
- Settings screen
- ~30 tests for market + settings

---

### Week 6: Polish & Integration
**Goal:** Final polish, optimization, and integration testing

**Tasks:**
1. **Performance Optimization:**
   - List virtualization (FlatList optimization)
   - Memoization where needed
   - Component rendering optimization
   - Test on low-end device simulator

2. **UI Polish:**
   - Animations (screen transitions)
   - Loading state refinements
   - Empty states for all lists
   - Visual consistency pass

3. **Onboarding:**
   - New game flow
   - Team name/colors selection
   - Initial roster generation
   - First season setup

4. **Integration Testing:**
   - Full season playthrough test
   - Save/load cycle verification
   - Edge case handling
   - Feature freeze at Week 5.5

**Deliverables:**
- Production-ready app
- Optimized performance
- Complete onboarding flow
- ~25 integration/E2E tests

---

## Technical Architecture

### State Management
**Option A: React Context + useReducer** (Recommended for MVP)
- Simple, built-in to React
- Good for moderate complexity
- Easy to understand

**Option B: Zustand** (If needed)
- Minimal boilerplate
- Good performance
- Easy async actions

### Data Flow
```
AsyncStorage → GameState Context → Screens → Components
                    ↓
              Phase 3 APIs (AI, Season, Simulation)
```

### Component Structure
```
src/
  components/
    common/           # Button, Card, Modal, etc.
    dashboard/        # Dashboard-specific
    roster/           # Roster-specific
    match/            # Match-specific
    season/           # Season-specific
    market/           # Market-specific
  screens/
    DashboardScreen.tsx
    RosterScreen.tsx
    PlayerDetailScreen.tsx
    MatchScreen.tsx
    SeasonScreen.tsx
    StandingsScreen.tsx
    TransferMarketScreen.tsx
    FreeAgentScreen.tsx
    BudgetScreen.tsx
    SettingsScreen.tsx
  navigation/
    AppNavigator.tsx
    TabNavigator.tsx
  context/
    GameContext.tsx
  hooks/
    useGame.ts
    usePlayer.ts
    useSeason.ts
  theme/
    colors.ts
    typography.ts
    spacing.ts
```

---

## Screen Wireframes

### Dashboard (Home Tab)
```
┌─────────────────────────────┐
│ [Team Logo] TeamName  $XXX  │
├─────────────────────────────┤
│ NEXT MATCH                  │
│ ┌─────────────────────────┐ │
│ │ vs Opponent    Week 5   │ │
│ │ Basketball    [Preview] │ │
│ └─────────────────────────┘ │
│                             │
│ QUICK ACTIONS               │
│ [Sim Match] [Advance Week]  │
│                             │
│ ALERTS                      │
│ • Player X injured (2 weeks)│
│ • Contract expiring: Y      │
│                             │
│ RECENT NEWS                 │
│ • Won vs Team A 105-98      │
│ • Signed Player Z           │
└─────────────────────────────┘
│ 🏠 │ 👥 │ 📅 │ 💰 │ ⚙️ │
└─────────────────────────────┘
```

### Roster List
```
┌─────────────────────────────┐
│ ROSTER                 [+]  │
├─────────────────────────────┤
│ Filter: [All] PG SG SF PF C │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ ★ Player Name      PG   │ │
│ │ OVR: 78  Age: 25  $1.2M │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │   Player Name      SG   │ │
│ │ OVR: 72  Age: 28  $900K │ │
│ └─────────────────────────┘ │
│ ...                         │
└─────────────────────────────┘
```

---

## Testing Strategy

### Unit Tests (70%)
- Individual component rendering
- Hook logic
- Utility functions

### Integration Tests (20%)
- Screen flows (e.g., match simulation flow)
- Navigation behavior
- Context state updates

### E2E Tests (10%) - Optional
- Full user journeys
- Detox or similar

### Test Targets
- Week 1: 20 tests
- Week 2: 30 tests
- Week 3: 30 tests
- Week 4: 25 tests
- Week 5: 30 tests
- Week 6: 20 tests
- **Total: ~155 tests**

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| React Native performance issues | Medium | High | Early profiling, FlatList virtualization |
| Complex state management | Medium | Medium | Start simple with Context, upgrade if needed |
| Offline sync complexity | Low | Medium | Keep it simple - no cloud sync for MVP |
| UI responsiveness on old devices | Medium | Medium | Test on low-end simulators |
| Match simulation UI performance | Medium | High | Throttle play-by-play updates |

---

## Success Criteria

1. **Functional:** All screens work and connect to Phase 1-3 systems
2. **Playable:** Can complete a full season from start to finish
3. **Performant:** No jank, smooth scrolling, fast screen transitions
4. **Testable:** 80%+ test coverage on UI components
5. **Offline:** Works completely without internet after install

---

## Dependencies

### npm Packages Needed:
```json
{
  "@react-navigation/native": "^6.x",
  "@react-navigation/bottom-tabs": "^6.x",
  "@react-navigation/native-stack": "^6.x",
  "react-native-screens": "^3.x",
  "react-native-safe-area-context": "^4.x",
  "react-native-gesture-handler": "^2.x",
  "react-native-reanimated": "^3.x"
}
```

---

## Questions for User

1. **Color scheme preference?** (Light/Dark/Both?)
2. **Any specific UI style reference?** (Football Manager, etc.)
3. **Animation priority?** (Minimal for performance vs Rich for polish)

---

**Next Step:** Get Agent 10 approval, then begin Week 1 implementation.
