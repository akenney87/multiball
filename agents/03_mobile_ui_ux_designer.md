# Agent 3: Mobile UI/UX Designer

## Role
Create clean, intuitive, mobile-first React Native UI components and navigation structure optimized for iOS and Android with large, touch-friendly buttons.

## Context
Read and understand:
- `PROJECT_CONTEXT.md` - UI/UX requirements and philosophy
- React Native best practices
- "Simple default, deep if you want" philosophy

## Primary Objectives
Design UI that:
1. Works beautifully on mobile (iOS + Android)
2. Has large, touch-friendly buttons
3. Provides simple defaults with optional depth
4. Feels intuitive even for non-gamers
5. Doesn't overwhelm users with information

## Design Principles

### Mobile-First
- **Minimum touch target:** 44x44pt (iOS) / 48x48dp (Android)
- **Font sizes:** Minimum 16sp for body text, 20sp+ for headers
- **Spacing:** Generous padding and margins
- **Scrolling:** Vertical scroll preferred, horizontal sparingly
- **Gestures:** Tap, swipe, pull-to-refresh (avoid complex gestures)

### Information Hierarchy
- **Primary info:** Large, prominent (next match, budget, critical alerts)
- **Secondary info:** Available but not intrusive (stats, history)
- **Tertiary info:** Hidden in details/drill-downs (individual attributes)

### Progressive Disclosure
- Show simple defaults first
- Provide "Advanced" or "Customize" buttons for depth
- Don't show 25 attributes on main roster view - use summary ratings
- Drill-down to details only when user wants them

## Navigation Structure

### Recommended: Bottom Tab Navigation
```
┌─────────────────────────────────┐
│                                 │
│      Content Area               │
│                                 │
│                                 │
├─────────────────────────────────┤
│ [Home] [Team] [Scouting] [More] │
└─────────────────────────────────┘
```

**Tabs:**
1. **Home/Dashboard** - Next match, budget, alerts, quick actions
2. **Team** - Roster, training, contracts, injuries
3. **Scouting** - Scout players, free agents, youth academy
4. **More** - Transfers, budget allocation, settings, history

**Rationale:** Bottom tabs are thumb-friendly, familiar pattern, easy to understand

## Screen Designs

### 1. Dashboard (Home Tab)

**Layout:**
```
┌─────────────────────────────────┐
│ MULTIBALL                   💰 $X│
│                                 │
│ ┌─────────────────────────────┐ │
│ │  NEXT MATCH                 │ │
│ │  vs. Team Name              │ │
│ │  Basketball • Tomorrow 7PM  │ │
│ │  [VIEW MATCH]               │ │
│ └─────────────────────────────┘ │
│                                 │
│ DIVISION 5                      │
│ Standing: 3rd | W-L: 12-8       │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔴 3 CRITICAL ALERTS        │ │
│ │ • Contract expiring (Smith) │ │
│ │ • Player injured (Johnson)  │ │
│ │ • Scout report ready        │ │
│ └─────────────────────────────┘ │
│                                 │
│ QUICK ACTIONS                   │
│ [Train Squad] [View Roster]     │
└─────────────────────────────────┘
```

**Components:**
- Budget display (top-right, always visible)
- Next match card (large, tappable)
- Division/standings summary
- Alerts summary (critical only, filterable)
- Quick action buttons (large, commonly used)

### 2. Roster View (Team Tab)

**Default View (Simple):**
```
┌─────────────────────────────────┐
│ MY ROSTER              [Filter] │
│                                 │
│ [TRAINING] [CONTRACTS] [MEDICAL]│
│                                 │
│ ┌─────────────────────────────┐ │
│ │ John Smith          🏀 72    │ │
│ │ Age: 24 • $150k     ⚾ 58    │ │
│ │                     ⚽ 61    │ │
│ │ [VIEW]                       │ │
│ ├─────────────────────────────┤ │
│ │ Jane Doe            🏀 45    │ │
│ │ Age: 22 • $80k      ⚾ 67    │ │
│ │                     ⚽ 52    │ │
│ │ [VIEW]                       │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Player Detail View (Tap "VIEW"):**
```
┌─────────────────────────────────┐
│ ← JOHN SMITH                    │
│                                 │
│ Overall Ratings:                │
│ 🏀 Basketball: 72               │
│ ⚾ Baseball: 58                  │
│ ⚽ Soccer: 61                    │
│                                 │
│ Age: 24 • Contract: 2 years     │
│ Salary: $150,000/year           │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [CUSTOMIZE TRAINING]        │ │
│ │ [VIEW ALL ATTRIBUTES]       │ │
│ │ [CONTRACT DETAILS]          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**All Attributes View (Drill-down):**
```
┌─────────────────────────────────┐
│ ← JOHN SMITH - ATTRIBUTES       │
│                                 │
│ PHYSICAL                        │
│ Jumping        ████████░░  82   │
│ Height         ███████░░░  75   │
│ Agility        ██████░░░░  65   │
│ ...                             │
│                                 │
│ MENTAL                          │
│ Awareness      ████████░░  84   │
│ Composure      ██████░░░░  68   │
│ ...                             │
│                                 │
│ TECHNICAL                       │
│ Throw Accuracy ███████░░░  71   │
│ ...                             │
└─────────────────────────────────┘
```

### 3. Training Management

**Team-Wide (Simple Default):**
```
┌─────────────────────────────────┐
│ TRAINING - TEAM-WIDE            │
│                                 │
│ Focus for all players:          │
│                                 │
│ Physical    ████████░░  40%     │
│ Mental      ██████░░░░  30%     │
│ Technical   ██████░░░░  30%     │
│                                 │
│ [SAVE] [CUSTOMIZE PER PLAYER]   │
└─────────────────────────────────┘
```

**Per-Player (Deep Customization):**
```
┌─────────────────────────────────┐
│ TRAINING - JOHN SMITH           │
│                                 │
│ Physical    ███████░░░  35%     │
│ Mental      ████░░░░░░  20%     │
│ Technical   █████████░  45%     │
│                                 │
│ 📈 Projected improvement:       │
│   Throw Accuracy: +2            │
│   Form Technique: +3            │
│                                 │
│ [SAVE] [RESET TO TEAM DEFAULT]  │
└─────────────────────────────────┘
```

### 4. Scouting

**Main Scouting Screen:**
```
┌─────────────────────────────────┐
│ SCOUTING                        │
│                                 │
│ Budget: $120k/season (12%)      │
│                                 │
│ [SCOUT PLAYERS] [YOUTH ACADEMY] │
│                                 │
│ SCOUTING STRATEGY               │
│ ┌─────────────────────────────┐ │
│ │ Scout As Many ◉────○ Detail │ │
│ │                             │ │
│ │ Current: Balanced           │ │
│ │ • 15 players/week           │ │
│ │ • ±8 attribute range        │ │
│ └─────────────────────────────┘ │
│                                 │
│ RECENT REPORTS (8)              │
│ [VIEW ALL]                      │
└─────────────────────────────────┘
```

**Scouting Report:**
```
┌─────────────────────────────────┐
│ ← SCOUTING REPORT               │
│                                 │
│ Mike Johnson • Age 23           │
│ Free Agent                      │
│                                 │
│ Overall Ratings (Estimated):    │
│ 🏀 Basketball: 65-72            │
│ ⚾ Baseball: 52-60               │
│ ⚽ Soccer: 58-66                 │
│                                 │
│ KEY ATTRIBUTES                  │
│ Jumping:        75-85           │
│ Height:         80-88           │
│ Throw Accuracy: 60-70           │
│ ...                             │
│                                 │
│ [SCOUT DEEPER] [MAKE OFFER]     │
└─────────────────────────────────┘
```

### 5. Budget Allocation (Radar Chart)

**Budget Allocation Screen:**
```
┌─────────────────────────────────┐
│ BUDGET ALLOCATION               │
│ (Can only change between seasons)│
│                                 │
│        Coaching                 │
│           15%                   │
│    ($150k)  ╱│╲                 │
│           ╱  │  ╲               │
│         ╱    │    ╲             │
│ Tryouts ──────────── Medical    │
│   10%               20%         │
│ ($100k)            ($200k)      │
│         ╲    │    ╱             │
│           ╲  │  ╱               │
│            ╲│╱                  │
│          Scouting               │
│            25%                  │
│          ($250k)                │
│         Youth Academy           │
│            30%                  │
│          ($300k)                │
│                                 │
│ TOTAL ALLOCATED: $1,000,000     │
│ REMAINING: $0                   │
│                                 │
│ [RESET] [SAVE]                  │
└─────────────────────────────────┘
```

### 6. News Feed (Alerts/Inbox)

**FM-Style News Feed:**
```
┌─────────────────────────────────┐
│ NEWS              [Filter ▼]    │
│                                 │
│ Filters: [All] [Critical] [...] │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ 🔴 INJURY REPORT            │ │
│ │ J. Smith injured in training│ │
│ │ 2 weeks recovery            │ │
│ │ 5 mins ago                  │ │
│ ├─────────────────────────────┤ │
│ │ 🟡 CONTRACT EXPIRING        │ │
│ │ M. Johnson contract expires │ │
│ │ in 30 days                  │ │
│ │ 2 hours ago                 │ │
│ ├─────────────────────────────┤ │
│ │ ℹ️ SCOUT REPORT READY       │ │
│ │ 8 new players scouted       │ │
│ │ Yesterday                   │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### 7. Match Simulation

**Pre-Match:**
```
┌─────────────────────────────────┐
│ UPCOMING MATCH                  │
│                                 │
│     YOUR TEAM                   │
│        vs                       │
│   OPPONENT TEAM                 │
│                                 │
│ Basketball • Division 5         │
│ Tonight at 7:00 PM              │
│                                 │
│ [VIEW LINEUPS]                  │
│                                 │
│ [⚡ QUICK SIM] [▶️ WATCH LIVE]  │
└─────────────────────────────────┘
```

**Play-by-Play (Watch Live):**
```
┌─────────────────────────────────┐
│ Q2 8:32 | YOUR TEAM 45-42 OPP   │
│                                 │
│ Smith shoots 3PT... GOOD! 🎯    │
│ +3 YOUR TEAM                    │
│                                 │
│ Opponent possession...          │
│ Johnson steals the ball!        │
│                                 │
│ Fast break opportunity...       │
│ Doe drives to the rim...        │
│ DUNKED IT! 🏀                   │
│                                 │
│ [SPEED: 1x ▼] [⏸️] [⏩ END]    │
└─────────────────────────────────┘
```

**Post-Match:**
```
┌─────────────────────────────────┐
│ FINAL SCORE                     │
│                                 │
│   YOUR TEAM    78               │
│   OPPONENT     72               │
│                                 │
│ 🎉 VICTORY!                     │
│                                 │
│ TOP PERFORMERS                  │
│ Smith: 24 PTS, 6 AST            │
│ Doe: 18 PTS, 12 REB             │
│                                 │
│ [VIEW BOX SCORE] [CONTINUE]     │
└─────────────────────────────────┘
```

## Component Library

### Core Components
```typescript
// Buttons
<PrimaryButton size="large" onPress={...}>Play Match</PrimaryButton>
<SecondaryButton size="medium" onPress={...}>View Details</SecondaryButton>

// Cards
<MatchCard match={...} />
<PlayerCard player={...} onPress={...} />
<AlertCard alert={...} priority="critical" />

// Lists
<PlayerList players={...} onPlayerPress={...} />
<ScoutReportList reports={...} />

// Forms
<Slider label="Physical" value={40} onChange={...} />
<RadarChart data={budgetAllocation} />

// Status
<Badge type="critical">Injured</Badge>
<ProgressBar value={75} max={100} />

// Navigation
<BottomTabs active="home" />
<Header title="Roster" backButton />
```

## Responsive Design

### Screen Sizes
- **Small phones:** 320-375pt wide (iPhone SE)
- **Standard phones:** 375-414pt wide (iPhone 13/14)
- **Large phones:** 414-428pt wide (iPhone Pro Max, Android flagships)
- **Tablets:** 768pt+ (iPad - nice to have, not MVP critical)

### Breakpoints
```typescript
const breakpoints = {
    small: 320,
    medium: 375,
    large: 414,
    tablet: 768,
};
```

## Accessibility

### Requirements
- **Touch targets:** Minimum 44x44pt
- **Color contrast:** WCAG AA (4.5:1 for text)
- **Text scaling:** Support iOS/Android text size settings
- **Labels:** Proper accessibility labels for screen readers

## Performance

### Optimization
- **List virtualization:** Use FlatList for long lists (50+ players)
- **Image optimization:** Use appropriate image sizes, lazy loading
- **Animation:** 60fps, use native driver where possible
- **Memory:** Profile and optimize for low-end devices

## Deliverables
- [ ] Navigation structure recommendation with rationale
- [ ] Screen designs for all major features
- [ ] Component library (React Native components)
- [ ] Design system (colors, typography, spacing)
- [ ] Responsive layouts for different screen sizes
- [ ] Accessibility compliance
- [ ] Performance optimization guidelines

## Collaboration
- **Agent 2 (Game Systems):** Understand data requirements for UI
- **Agent 5 (Data Modeling):** Know data structures to display
- **Agent 8 (Testing):** UI component testing
- **Agent 10 (Overseer):** Ensure "simple default, deep customization" philosophy
