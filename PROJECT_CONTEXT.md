# Multiball - Living Project Context

**Last Updated:** 2025-11-17
**Status:** Phase 1 - Step 1.2 Complete (Data Models Defined) | Step 1.3 Ready (Simulation Translation)

---

## Project Vision

**Multiball** is a mobile (iOS/Android) text-based franchise management simulation game where users manage a multi-sport franchise competing in basketball, baseball, and soccer simultaneously. The unique hook: athletes can compete in multiple sports, allowing users to explore "what if" scenarios (e.g., "How would Victor Wembanyama do as a goalkeeper?").

**Core Philosophy:** Keep things extremely simple so users aren't overwhelmed, but allow deep customization for users who want it. Simple defaults with optional depth.

---

## Technical Stack

### Platform & Framework
- **Mobile:** iOS and Android
- **Framework:** React Native (TypeScript)
- **Data Persistence:** Local storage for MVP (AsyncStorage or similar), architecture must support future cloud saves
- **Offline:** Game must work completely offline after purchase
- **Cross-Platform Saves:** Not required for MVP, but architecture must support future implementation

### Simulation Engine
- **Current State:** Basketball simulation exists in Python (basketball-sim directory)
- **MVP Requirement:** Translate basketball-sim from Python to TypeScript
- **Translation Strategy:** Module-by-module translation with parallel testing (Python vs TypeScript outputs must match exactly using same seeds)
- **Future:** Baseball and soccer simulators (separate sessions)

### Critical Translation Requirements
- Must maintain 100% identical simulation logic and outputs
- Preserve weighted sigmoid probability formula
- Maintain all 25 attribute weights and constants
- Comprehensive test coverage to avoid "days of debugging"

---

## Game Structure

### Monetization
- **Free Version:** 1 season playable
- **Paid Version:** Infinite seasons unlocked

### Division System
- **Total Divisions:** 5 (Division 5 → Division 1)
- **Starting Division:** Division 5 (lowest tier)
- **Teams Per Division:** 20 teams
- **Promotion/Relegation:** Top 3 teams promote, bottom 3 teams relegate
- **Standings:** Combined league table (all 3 sports' results combined)

### Season Structure
- **Total Matches Per Season:** 57 (19 opponents × 3 sports)
- **Schedule Type:** Fixed auto-generated schedule at season start
- **Multi-Sport Timing:** All sports run simultaneously (Week 1 could have basketball Monday, baseball Wednesday, soccer Friday)
- **Season Flow:** Pre-season setup → Regular season → End-of-season resolution → Promotion/relegation → Off-season (contracts, transfers, budget allocation)

### Victory Conditions
- **End State:** Game continues indefinitely
- **Success Metrics:** Championships won, division level, revenue (future: combination score, leaderboard)

---

## Player/Athlete System

### Starting Roster
- **Initial Athletes:** 50 athletes
- **Starting Attributes:** All attributes between 1-25 (they're bad athletes)
- **Roster Limits:** No hard cap - only limited by salary budget

### Attributes (25 Total)
All attributes rated 1-100 scale.

**Physical (12):**
- grip_strength
- arm_strength
- core_strength
- agility
- acceleration
- top_speed
- jumping
- reactions
- stamina
- balance
- height (normalized)
- durability

**Mental (7):**
- awareness
- creativity
- determination
- bravery
- consistency
- composure
- patience

**Technical (6):**
- hand_eye_coordination
- throw_accuracy
- form_technique
- finesse
- deception
- teamwork

**Visibility:** All 25 attributes visible to user EXCEPT potential (hidden)

### Attribute Weights Across Sports
- **Action-Specific Weights:** Different actions in each sport use different attribute weight tables
- **Example:** Jumping matters for basketball dunking, baseball outfield catches, soccer headers, but not for baseball pitching
- **Basketball:** Already defined in basketball-sim (WEIGHTS_3PT_SHOOTING, WEIGHTS_DUNKING, etc.)
- **Baseball/Soccer:** To be defined in future sessions by Multi-Sport Attribute Mapper agent

### Player Generation
- **System:** Archetype-based generation
- **Correlations:** Realistic (taller → usually lower agility, but outliers like Wembanyama possible)
- **Initial 50:** All attributes 1-25, realistic correlations applied
- **Youth Academy:** Generated based on academy budget quality
- **Free Agents:** Generated when players are cut or contracts expire

### Potential System
- **Structure:** Category-based hidden potentials (Physical, Mental, Technical)
- **Caps:** Soft caps with diminishing returns (training becomes exponentially harder as players approach potential ceiling)
- **Age-Based Regression:** After peak ages, attributes decline
  - Physical peak: 22-30 (highest probability at 26)
  - Technical peak: 24-32 (highest probability at 28)
  - Mental peak: 26-34 (highest probability at 30)
- **Career Arc:** Player at 27 must be objectively better than same player at 35

---

## Budget & Economy

### Starting Budget
- **Amount:** $1,000,000 minus current costs (contracts, coaching, medical, youth academy, scouting)

### Budget Allocation
- **Categories:** Coaching, Medical/Injury Prevention, Youth Academy, Scouting
- **Type:** Percentage-based (with dollar amounts shown)
- **UI:** Radar chart slider interface
- **Change Frequency:** Only adjustable between seasons
- **Constraint:** Total expenses (salaries + all allocations) cannot exceed available budget
- **No Salary Cap:** Budget is the only limiting factor

### Revenue Streams
- **Type:** Performance-based formula only (automatic calculation)
- **Formula:** Better record + higher division = more revenue
- **Sources:** Ticket sales, merchandise, sponsorships (all calculated automatically)
- **Division Prize Money:** Payment based on league finish position
- **Transfer Income:** Revenue from player sales added directly to budget (or "available funds" if mid-season)

### Budget Impact on Systems
- **Coaching Allocation:** Higher % = better attribute improvement from training
- **Medical Allocation:** Higher % = decreased injury impact/faster recovery
- **Youth Academy Allocation:**
  - Base: $100,000 (bare minimum program, minimum players)
  - Each +$50,000: Increases prospect quality, quantity, and progression rate
  - Determines academy capacity (max number of youth players)
- **Scouting Allocation:**
  - Affects number of players that can be scouted simultaneously
  - Affects depth vs breadth of scouting reports (see Scouting System)

---

## Core Management Systems

### Training System
- **Timing:** Weekly training sessions
- **Attribute Updates:** End of each week
- **Allocation Options:**
  - Team-wide default (simple): Set training focus for entire squad
  - Per-athlete customization (deep): Individual training plans for each player
- **Categories:** Technical, Mental, Physical
- **Playing Time Bonus:** Athletes who play in matches earn bonus XP toward their training goals
- **Youth Academy:** Default academy training (quality based on budget) + optional per-prospect customization

### Contract System
- **Style:** Football Manager-lite (streamlined for mobile)
- **Features:** Wage demands, contract length (1-5 years), signing bonuses, performance bonuses, release clauses, salary increases
- **Negotiation:** Offer/counter-offer system (2-3 rounds max)
- **Expiry:** When contracts expire, player enters free agent pool
- **Injured Players:** Still paid full salary while injured, cannot be forced to play

### Transfer System
- **Window:** July 1 - January 1 (transfer window open)
- **Mechanics:** Bid + counter-offer (2-3 rounds)
- **User → AI:** User makes offers for AI team players
- **AI → User:** AI teams can make unsolicited offers for user's players
- **AI ↔ AI:** AI teams trade with each other
- **Revenue:** Transfer fees go directly to budget (or "available funds" bucket if mid-season)

### Scouting System
- **Results Frequency:** Weekly
- **Target Types:**
  - Free agents
  - Players on specific teams
- **Filters Available:** Attributes, height, weight, age, position archetypes
- **Information Revealed:**
  - Default: Attribute ranges (e.g., "Jumping: 75-85")
  - Overall sport ratings with ranges (e.g., "Basketball: 35-52, Baseball: 34-48, Soccer: 45-60")
- **Depth vs Breadth Control:** User slider
  - "Scout Every Detail" end: Narrow ranges, more accurate, fewer players scouted
  - "Scout As Many Players As Possible" end: Wide ranges, less accurate, more players discovered
- **Budget Impact:** Higher scouting budget = more simultaneous scouts, better depth/breadth options

### Injury System
- **Occurrence:** Can happen during matches or training
- **Probability:** Based on durability attribute only (keep it simple)
- **Process:**
  1. Injury occurs
  2. User receives doctor report (injury type, recovery window)
  3. Player misses games during recovery
  4. Player still paid full salary
  5. Cannot be forced to play while injured

### Youth Academy System
- **Starting State:** User starts with youth academy from day 1
- **Capacity:** Based on budget allocation ($100k base, +$50k increments)
- **Graduation:** Youth prospects must be promoted to main squad before age 19
- **Early Promotion:** User can promote prospects before age 19
- **Rejection:** User can reject/release prospects at any time
- **Training:** Default academy training (quality based on budget) + optional per-prospect customization
- **Progression:** Better budget = higher quality prospects, more prospects, better coaching/facilities (faster progression)

### Free Agent System
- **Pool:** Global pool of free agents
- **Refresh:** Any time a player is cut or contract expires, pool updates
- **Access:** Available to user and all AI teams
- **Tryouts:** User can allocate budget portion to holding tryouts

---

## AI System

### AI Teams
- **Teams Per Division:** 20 teams
- **Total AI Teams:** 19 opponents per division (user is 20th team)
- **AI Capabilities:** Trade players, sign free agents, develop players, make transfer offers, negotiate contracts
- **Personality System:** Each AI team has distinct personality traits affecting behavior
  - Examples: "Develops Youth," "Splashes Cash," "Defensive Minded," "Multi-Sport Specialists"
- **Behavior Variation:** Different teams prioritize different strategies (budget allocation, tactical preferences, transfer targets)

### AI Decision-Making
- **Transfers:** AI evaluates player value, makes offers, counters user offers, trades with other AI teams
- **Contracts:** AI has wage demands, contract preferences based on team personality
- **Tactics:** AI chooses pace, defensive schemes, scoring options based on personality
- **Roster Management:** AI manages lineups, substitutions, playing time
- **Budget:** AI allocates budget differently based on personality
- **Promotion/Relegation Response:** Teams in relegation zone might panic-buy, promoted teams might sell to balance budget

---

## User Interface & Experience

### Platform Considerations
- **Target:** Mobile (iOS/Android)
- **Buttons:** Large, touch-friendly
- **Navigation:** Clean, intuitive (specific structure TBD - needs design proposals from Mobile UI/UX Designer agent)

### Dashboard
- **Key Information:** Next game, current budget, injuries, pending decisions
- **Not Included (for now):** Team morale

### Notifications/Alerts
- **System:** Football Manager-style news feed
- **Format:** Stream of notifications with priority levels
  - Critical (red)
  - Important (yellow)
  - Info (blue/gray)
- **Categories:** Injuries, Contracts, Scouting, Youth Academy, Transfers, Match Results
- **Filtering:** User can filter by category
- **Events:** Contract expiring, injury occurred, youth prospect ready, scout found target athlete, transfer offer received, match result, etc.

### Simulation Controls
- **User Choice:**
  - Watch play-by-play (detailed simulation viewing)
  - Quick simulate (instant results)
- **Time Skipping:**
  - Play next match
  - Simulate to end of week
  - Simulate to end of season

### Franchise Customization
- **Options:** Team name + team colors
- **When:** At new game start

### Complexity Philosophy
- **Simple Defaults:** Everything has sensible defaults that work without user input
- **Optional Depth:** Users can dive deep into customization if desired
- **Examples:**
  - Training: Team-wide allocation (simple) OR per-athlete plans (deep)
  - Scouting: General population scouted (simple) OR specific player searches with filters (deep)
  - Budget: Auto-balanced allocation (simple) OR manual radar chart adjustment (deep)

---

## Historical Records & Progression

### Tracking
- **Season-by-Season Results:** Win/loss records, division finish, championships
- **All-Time Records:** Leading scorers, best season, franchise milestones
- **Career Stats:** Individual player statistics across their career with the franchise

---

## Multi-Sport Integration

### Current Status
- **MVP Requirement:** All 3 sports fully simulated
- **Current Implementation:** Basketball only
- **Future Sessions:** Baseball and soccer simulators

### Season Integration
- **All Sports Simultaneously:** Basketball, baseball, and soccer matches occur throughout the same season
- **Stamina Implications:** Athletes playing multiple sports experience higher stamina drain
- **Injury Risk:** Multi-sport athletes face more injury opportunities
- **Strategy:** User can specialize athletes per sport (expensive) or use multi-sport athletes (budget-friendly, higher stamina/injury risk)

### Attribute Mapping
- **Same 25 Attributes:** All sports use the same attribute system
- **Action-Specific Weights:** Each action in each sport has different attribute weight tables
- **Overall Sport Ratings:** Calculated per sport (e.g., Basketball: 72, Baseball: 48, Soccer: 65)
- **Realistic Specialization:** A player with high jumping excels at basketball dunks, baseball outfield catches, and soccer headers, but might struggle with baseball pitching

---

## Development Phases

### Phase 1: Foundation (Current Session)
- **Goal:** Translate basketball-sim to TypeScript, establish data models
- **Active Agents:** Python-to-TypeScript Translation Specialist, Simulation Validator, Data Modeling Specialist
- **Status:**
  - Step 1.1: Project Setup - COMPLETE
  - Step 1.2: Data Model Definition - COMPLETE (Agent 5)
  - Step 1.3: Basketball Simulation Translation - READY TO BEGIN (Agent 1 + Agent 4)

### Phase 2: Management Systems (Session 2)
- **Goal:** Build all franchise management systems
- **Active Agents:** Game Systems Architect, Data Modeling Specialist, Testing & QA Specialist

### Phase 3: AI & Season Flow (Session 3)
- **Goal:** Create AI ecosystem and complete season loop
- **Active Agents:** AI Team Behavior Designer, Season & Schedule Manager, Testing & QA Specialist

### Phase 4: Mobile UI (Session 4)
- **Goal:** Build React Native UI
- **Active Agents:** Mobile UI/UX Designer, Testing & QA Specialist

### Phase 5: Multi-Sport Expansion (Future Sessions)
- **Goal:** Add baseball and soccer simulators
- **Active Agents:** Multi-Sport Attribute Mapper, Translation Specialist, Simulation Validator

---

## Project Status

**Current Phase:** Phase 1 - Foundation (Week 1-2)
**Active Agents:** 1 (Translation), 4 (Validation), 5 (Data Modeling - COMPLETE), 10 (Overseer)
**Overall Completion:** ~18% (Phase 1: ~40% complete)

### Recent Milestones

**2025-11-17:**
- Step 1.1: Project Setup COMPLETE
  - React Native + TypeScript project initialized
  - Strict TypeScript mode configured (zero `any` tolerance)
  - Jest testing framework configured (80% coverage threshold)
  - Project structure created (src/, __tests__/, assets/)
  - Git repository initialized with initial commit
  - 898 npm packages installed

- Step 1.2: Data Model Definition COMPLETE (Agent 5)
  - 10 TypeScript files created in src/data/
  - 4,046 lines of production code
  - All 45+ interfaces defined with strict typing
  - Complete data models for: Player (25 attributes), Franchise, Contract, Season, Match, Injury, Scouting, Youth Academy, Transfers, News
  - AsyncStorage wrapper implemented with error handling
  - Data validation system with runtime type checking
  - Data migration system for future version updates
  - Test data factories for all entities
  - Comprehensive documentation (README.md, DATA_STRUCTURE_DIAGRAM.md)
  - 100% alignment with basketball-sim Python structure

### Current Tasks

- Step 1.3: Basketball Simulation Translation (Agent 1 + Agent 4)
  - READY TO BEGIN
  - Translate 26+ Python modules from basketball-sim to TypeScript
  - Module-by-module with parallel validation
  - Target: 100% Python parity (exact output match with same seeds)

### Blockers

**None** - All prerequisites for Step 1.3 are in place

### Next Up

1. Begin basketball simulation translation (Step 1.3)
2. Translate core probability engine (weighted_sigmoid)
3. Translate shooting systems (3PT, midrange, layups, dunks)
4. Validate each module against Python outputs
5. Complete full game simulation in TypeScript

---

## Open Questions & Future Decisions

### TBD Items
1. **Navigation Structure:** Specific navigation pattern (bottom nav, tabs, hamburger) - needs design proposals
2. **Exact Revenue Formula:** How record + division translates to dollars
3. **Exact Injury Probability Formula:** Durability → injury chance calculation
4. **Youth Academy Capacity Formula:** Budget → number of prospects calculation
5. **Scouting Range Formulas:** How depth/breadth slider affects attribute range widths
6. **AI Personality Traits:** Specific list of personality types and their behavioral impacts
7. **Baseball Action-Specific Weights:** Attribute weights for pitching, hitting, fielding, etc.
8. **Soccer Action-Specific Weights:** Attribute weights for shooting, passing, dribbling, tackling, goalkeeping, etc.

---

## Scope Boundaries

### MVP Includes
- Basketball simulation (fully functional)
- All franchise management systems (training, contracts, transfers, scouting, youth academy, injuries, budget)
- AI teams with personalities
- 5-division structure with promotion/relegation
- Local storage
- React Native mobile UI (iOS + Android)
- Single-player only
- Offline functionality

### MVP Excludes
- Baseball simulator (future session)
- Soccer simulator (future session)
- Cloud saves (architecture supports, but not implemented)
- Cross-platform saves (architecture supports, but not implemented)
- Multiplayer (future consideration)
- Team morale system (mentioned but deprioritized)
- Physical facilities/upgrades (budget allocation only)
- Detailed business management (ticket prices, sponsorship negotiations, etc.)

---

## Key Design Principles

1. **Attribute-Driven:** Everything is driven by the 25 attributes
2. **Realistic Simulation:** Weighted sigmoid probabilities, no arbitrary randomness
3. **Simple Defaults, Optional Depth:** Users can play casually or dive deep
4. **Mobile-First:** Large buttons, intuitive navigation, touch-friendly
5. **Offline-First:** Must work completely offline after purchase
6. **Living Ecosystem:** AI teams behave realistically and create dynamic competition
7. **Multi-Sport Strategy:** Managing athletes across sports is core to the gameplay
8. **Career Arcs:** Players improve, peak, and decline realistically
9. **Budget Constraints:** Financial management is central to strategic decisions
10. **Progression System:** Division climbing provides long-term goals

---

## Context File Maintenance

**Update Triggers:**
- Major design decisions made
- System specifications finalized
- Technical architecture changes
- Scope adjustments
- Questions answered
- Implementation details confirmed

**Responsible Agents:**
- **Primary:** Project Overseer Agent (Agent 10)
- **Secondary:** All agents should flag when context needs updating

**Version Control:**
- Update "Last Updated" date at top of file
- Document status changes
- Track decision evolution in relevant sections
