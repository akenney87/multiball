# Multiball MVP - Agent Recommendations

## Overview
This document outlines the specialized agents recommended for building the Multiball MVP. Each agent has specific expertise and responsibilities to ensure efficient, high-quality development.

---

## Agent 1: Python-to-TypeScript Translation Specialist

### Purpose
Accurately translate the basketball-sim Python codebase to TypeScript for React Native integration while maintaining 100% identical simulation logic and outputs.

### Responsibilities
- Translate Python modules to TypeScript module-by-module
- Maintain exact probability calculations (weighted sigmoid formula)
- Preserve all 25 attribute weights and constants
- Ensure data structures map correctly (Player, PossessionContext, etc.)
- Create parallel test suites using same seeds to verify identical outputs
- Document any TypeScript-specific adaptations required

### Key Deliverables
- Complete TypeScript simulation engine matching Python behavior
- Comprehensive test coverage comparing Python vs TypeScript outputs
- Migration validation report confirming accuracy

### Why This Agent?
The basketball-sim is extremely sophisticated with weighted probability calculations across 25 attributes. A specialized translation agent ensures we don't introduce bugs during the language switch, which would require "days on end debugging" (as you noted). This agent treats the Python code as the specification and validates every translation step.

---

## Agent 2: Game Systems Architect

### Purpose
Design and implement the franchise management systems (training, contracts, transfers, scouting, youth academy, injuries, budget allocation, etc.)

### Responsibilities
- Design data models for all management systems
- Implement training system (weekly sessions, team-wide + per-athlete customization, playing time bonuses)
- Build contract system (FM-lite: wage demands, contract length, bonuses, release clauses, counter-offers)
- Create transfer system (bid + counter, AI-initiated offers, AI-to-AI transfers, transfer window)
- Develop scouting system (attribute ranges, overall sport ratings, depth vs breadth slider, weekly results)
- Implement youth academy (default training + optional customization, budget-based capacity, promotion at 19)
- Build injury system (durability-based probability, doctor reports, recovery windows)
- Create budget allocation system (percentage-based with radar chart, coaching/medical/youth/scouting)
- Design player progression (category potentials, soft caps, age-based regression, XP from matches)
- Implement revenue system (performance-based formula)
- Build free agent pool system

### Key Deliverables
- Complete franchise management system implementation
- Data models and business logic for all systems
- Integration points with simulation engine
- System interaction documentation

### Why This Agent?
These systems are the heart of the franchise management game. They're complex and interconnected (e.g., budget affects scouting quality, contracts affect budget, training affects attributes, attributes affect simulation). A dedicated architect ensures these systems work together coherently.

---

## Agent 3: Mobile UI/UX Designer

### Purpose
Create clean, intuitive, mobile-first React Native UI components and navigation structure optimized for iOS and Android.

### Responsibilities
- Design navigation structure (determine between bottom nav, tabs, hamburger menu based on feature hierarchy)
- Create dashboard layout (next game, budget, injuries, pending decisions)
- Design FM-style news feed with priority filters (critical/important/info) and categories
- Build roster management UI (view athletes, filter/sort, detailed athlete profiles showing all 25 attributes)
- Design budget allocation radar chart interface
- Create scouting UI (search/filter, depth vs breadth slider, attribute ranges display, overall sport ratings)
- Build contract negotiation screens (offer/counter interface)
- Design transfer system UI (make offers, view incoming bids, AI-to-AI activity)
- Create training management UI (team-wide defaults, per-athlete customization, weekly schedule)
- Design schedule/calendar view (upcoming matches, simulate options)
- Build match simulation UI (play-by-play viewer, quick sim option)
- Design youth academy interface
- Ensure large, touch-friendly buttons for mobile
- Create team customization screen (name + colors)

### Key Deliverables
- Complete React Native component library
- Navigation structure and screen flow
- Mobile-optimized layouts for all features
- Design system documentation

### Why This Agent?
Mobile UI/UX is fundamentally different from desktop. This agent specializes in creating touch-friendly, intuitive interfaces that don't overwhelm users while providing access to deep features. The "simple default, deep if you want" philosophy requires careful UI design.

---

## Agent 4: Simulation Validator

### Purpose
Ensure the TypeScript simulation produces identical results to the Python version and validates statistical realism against real-world basketball metrics.

### Responsibilities
- Create comprehensive test suites using identical seeds for Python and TypeScript
- Run thousands of simulations to verify statistical equivalence
- Validate probability distributions match expected outcomes
- Check edge cases (overtime, blowouts, end-game scenarios, stamina effects)
- Verify attribute weights produce realistic player performance differentials
- Ensure tactical settings (pace, defense type, scoring options) affect outcomes correctly
- Generate validation reports comparing outputs
- Flag any discrepancies for Python-to-TypeScript Translation Specialist

### Key Deliverables
- Automated test suite for simulation validation
- Statistical validation reports
- Regression test suite for ongoing development
- Realism benchmarks

### Why This Agent?
The simulation is the foundation of the entire game. If it's not accurate, nothing else matters. This agent acts as quality control, ensuring the translation is perfect and the simulation produces realistic, engaging basketball gameplay.

---

## Agent 5: Data Modeling Specialist

### Purpose
Design efficient, scalable data structures and local storage architecture for all game entities.

### Responsibilities
- Design athlete data model (25 attributes, hidden category potentials, age, contract, injury status, training progress, XP)
- Create team/franchise data model (roster, budget, budget allocation percentages, division, records, revenue)
- Design contract data structures (salary, length, bonuses, release clauses, expiry dates)
- Build injury tracking model (injury type, recovery window, occurrence date)
- Create scouting data structures (scouted players, attribute ranges, overall ratings, scouting focus)
- Design youth academy model (prospects, capacity, budget, training settings)
- Build schedule/calendar data structures (fixture list, results, standings)
- Create AI team models (personality traits, tactical preferences, budget allocation)
- Design transaction history (transfers, signings, releases)
- Implement local storage strategy (React Native AsyncStorage or similar)
- Plan for future cloud save compatibility
- Optimize data structures for mobile performance

### Key Deliverables
- Complete data model documentation
- TypeScript interfaces/types for all entities
- Local storage implementation
- Data migration strategy for updates

### Why This Agent?
Clean data models are critical for app performance, especially on mobile. This agent ensures efficient storage, fast reads/writes, and a structure that supports future features (cloud saves, multiplayer). Poor data modeling early on creates technical debt that's hard to fix later.

---

## Agent 6: AI Team Behavior Designer

### Purpose
Create realistic, diverse AI team behaviors with distinct personalities that make the league feel alive and competitive.

### Responsibilities
- Design AI team personality system (e.g., "Develops Youth," "Splashes Cash," "Defensive Minded," "Multi-Sport Specialists")
- Implement AI transfer logic (player valuation, offer generation, counter-offer behavior, selling/buying decisions)
- Create AI contract negotiation behavior (wage demands, contract preferences)
- Design AI budget allocation strategies (different teams prioritize different areas)
- Build AI tactical decision-making (pace preferences, defensive schemes, scoring options, rebounding strategy)
- Implement AI roster management (lineup selection, substitution patterns, playing time distribution)
- Create AI training strategies (attribute focus based on team philosophy)
- Design AI scouting behavior (what types of players different teams target)
- Implement AI promotion/relegation response (teams in relegation zone might panic-buy, promoted teams might sell)
- Generate 20 distinct AI teams per division with varied personalities

### Key Deliverables
- AI personality system implementation
- AI decision-making algorithms for all management systems
- Diverse AI team generator
- AI behavior documentation

### Why This Agent?
AI teams are your opponents and trading partners. If they all behave identically, the league feels dead. This agent creates a living ecosystem where teams have different philosophies, make realistic decisions, and provide varied competition. Good AI makes single-player engaging long-term.

---

## Agent 7: Season & Schedule Manager

### Purpose
Generate balanced multi-sport schedules and manage season flow, progression, and division structure.

### Responsibilities
- Create schedule generation algorithm (57 matches: 19 opponents × 3 sports, balanced distribution throughout season)
- Implement calendar/date system (matches occur on specific dates, rest days between matches)
- Design season progression flow (pre-season setup → regular season → end-of-season resolution → promotion/relegation → off-season)
- Build combined league table calculator (all 3 sports' results combined into standings)
- Implement promotion/relegation system (top 3 promote, bottom 3 relegate across 5 divisions)
- Create off-season phase (contract renewals, free agency, transfers, budget allocation changes, youth promotions)
- Design simulation speed controls (play next match, simulate to end of week, simulate to end of season)
- Build historical records tracking (season-by-season results, all-time records, championships)
- Implement revenue distribution at season end (prize money based on league finish)

### Key Deliverables
- Schedule generation system
- Season flow state machine
- Combined league table and standings system
- Promotion/relegation logic
- Historical records database

### Why This Agent?
The season structure is the backbone of the game loop. With 3 sports running simultaneously, schedule generation needs to be balanced and engaging. This agent ensures the calendar feels realistic, progression is satisfying, and the promotion/relegation system creates meaningful stakes.

---

## Agent 8: Testing & Quality Assurance Specialist

### Purpose
Create comprehensive test coverage across all systems to ensure stability, catch bugs early, and maintain code quality.

### Responsibilities
- Write unit tests for all business logic (training progression, contract calculations, budget allocation, player generation, etc.)
- Create integration tests for system interactions (e.g., training affects attributes affects simulation performance)
- Build end-to-end tests for critical user flows (start new game, play season, make transfer, negotiate contract)
- Test edge cases (negative budget, roster with all injured players, contract expiry during season, etc.)
- Validate data persistence (save/load game state correctly)
- Test mobile-specific scenarios (app backgrounding, storage limits, different screen sizes)
- Perform regression testing after changes
- Create test data generators for consistent testing
- Document test coverage and identify gaps

### Key Deliverables
- Comprehensive test suite (unit, integration, E2E)
- Test coverage reports
- Continuous integration setup recommendations
- Bug tracking and resolution documentation

### Why This Agent?
A game with this many interconnected systems is prone to bugs. Automated testing catches issues before they reach you, ensures new features don't break existing ones, and makes the codebase maintainable long-term. This is especially critical during the Python-to-TypeScript translation.

---

## Agent 9: Multi-Sport Attribute Mapper

### Purpose
Design action-specific attribute weight tables for baseball and soccer (future sessions), ensuring attributes translate meaningfully across all sports.

### Responsibilities
- Analyze baseball actions (pitching, hitting, fielding positions, base running, catching) and map to 25 attributes
- Analyze soccer actions (shooting, passing, dribbling, tackling, heading, goalkeeping, positioning) and map to 25 attributes
- Create attribute weight tables for each action (like basketball's WEIGHTS_3PT_SHOOTING, WEIGHTS_DUNKING, etc.)
- Ensure realistic attribute importance (e.g., jumping matters for outfield catches, height matters for goalkeeping)
- Design overall sport rating calculations (how to combine attributes into Basketball: 35-52, Baseball: 34-48, Soccer: 45-60)
- Validate that the same athlete can realistically have different effectiveness across sports
- Document rationale for each weight choice

### Key Deliverables
- Complete attribute weight tables for baseball actions
- Complete attribute weight tables for soccer actions
- Overall sport rating calculation formulas
- Cross-sport attribute effectiveness documentation

### Why This Agent?
The multi-sport concept is the unique hook of Multiball. This agent ensures the 25-attribute system translates meaningfully across sports while maintaining realism. A player with 95 jumping should excel at basketball dunking AND baseball outfield catches AND soccer headers, but maybe struggle with baseball pitching.

---

## Agent 10: Project Overseer (Jack-of-All-Trades)

### Purpose
Maintain project context, ensure logical coherence across all systems, and act as quality control to verify that all work aligns with project vision and scope.

### Responsibilities
- **Context Management:**
  - Maintain and update PROJECT_CONTEXT.md after every major decision or implementation
  - Track all design decisions, system specifications, and scope boundaries
  - Ensure context file remains current and accurate
- **Cross-System Validation:**
  - Review work from all other agents to ensure logical consistency
  - Verify that systems integrate properly (e.g., training affects attributes, attributes affect simulation, budget constrains decisions)
  - Flag contradictions or misalignments between different systems
- **Scope Management:**
  - Ensure features stay within MVP boundaries
  - Identify and prevent scope creep
  - Validate that implementations match original requirements
- **Quality Assurance:**
  - Sanity-check design decisions before implementation
  - Review technical architecture for scalability and maintainability
  - Ensure "simple default, deep if you want" philosophy is maintained across all features
- **Agent Coordination:**
  - Identify dependencies between agents' work
  - Flag potential conflicts or overlaps in responsibilities
  - Ensure agents have necessary context from other agents' work
- **Decision Documentation:**
  - Track why decisions were made (rationale, trade-offs considered)
  - Document open questions and TBD items
  - Maintain design principle adherence

### Key Deliverables
- Up-to-date PROJECT_CONTEXT.md file (living document)
- Cross-system validation reports
- Scope adherence checkpoints
- Design review feedback
- Integration issue identification

### Why This Agent?
With 9 specialized agents working on different systems, there's risk of:
- Agents working in silos creating incompatible systems
- Losing track of earlier decisions and context
- Feature creep or scope drift
- Systems that don't align with the overall vision
- Missing integration points between systems

The Project Overseer acts as the "connective tissue" ensuring everything fits together logically, stays true to the vision, and maintains scope discipline. This agent has the bird's-eye view that prevents costly rework from misaligned implementations.

---

## Agent Coordination & Workflow

### Phase 1: Foundation (Session 1 - Current)
**Active Agents:**
1. Python-to-TypeScript Translation Specialist
4. Simulation Validator
5. Data Modeling Specialist
10. **Project Overseer (ALL PHASES)**

**Goal:** Get basketball simulation working perfectly in TypeScript with solid data foundations.

### Phase 2: Management Systems (Session 2)
**Active Agents:**
2. Game Systems Architect
5. Data Modeling Specialist (continued)
8. Testing & QA Specialist
10. **Project Overseer (ALL PHASES)**

**Goal:** Build all franchise management systems (training, contracts, transfers, scouting, etc.).

### Phase 3: AI & Season Flow (Session 3)
**Active Agents:**
6. AI Team Behavior Designer
7. Season & Schedule Manager
8. Testing & QA Specialist
10. **Project Overseer (ALL PHASES)**

**Goal:** Create living AI ecosystem and complete season loop.

### Phase 4: Mobile UI (Session 4)
**Active Agents:**
3. Mobile UI/UX Designer
8. Testing & QA Specialist
10. **Project Overseer (ALL PHASES)**

**Goal:** Build React Native UI for all features, ensure mobile-optimized experience.

### Phase 5: Multi-Sport Expansion (Future Sessions)
**Active Agents:**
9. Multi-Sport Attribute Mapper
1. Python-to-TypeScript Translation Specialist (for new simulators)
4. Simulation Validator (for new simulators)
10. **Project Overseer (ALL PHASES)**

**Goal:** Add baseball and soccer simulators with proper attribute mapping.

---

## Summary

These 10 specialized agents cover all aspects of the Multiball MVP:
- **Translation & Validation** (Agents 1, 4) - Ensure basketball-sim works perfectly in TypeScript
- **Core Systems** (Agents 2, 5, 7) - Build franchise management mechanics and season flow
- **AI & Competition** (Agent 6) - Create engaging AI opponents
- **User Experience** (Agent 3) - Design clean mobile UI
- **Quality Assurance** (Agent 8) - Comprehensive testing
- **Future Expansion** (Agent 9) - Multi-sport attribute system
- **Project Oversight** (Agent 10) - Context management, cross-system validation, scope discipline

**Agent 10 (Project Overseer) is active across ALL phases**, maintaining the PROJECT_CONTEXT.md file and ensuring all work remains aligned with project vision and scope.

Each agent has clear responsibilities, deliverables, and rationale. This structure ensures efficient parallel work while maintaining quality and avoiding scope creep.
