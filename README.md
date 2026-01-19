# Multiball

A multi-sport franchise management mobile game for iOS and Android.

## Overview

Multiball is a text-based simulation game where you manage a franchise competing in **basketball**, **baseball**, and **soccer** simultaneously. The unique hook: athletes can compete in multiple sports, allowing you to explore "what if" scenarios like "How would Victor Wembanyama perform as a goalkeeper?"

## Project Status

**Current Status:** Feature Complete - Polish & Testing Phase

### Core Features Complete

- **Three Full Sport Simulations**
  - Basketball: Quarter-by-quarter with substitutions, fatigue, tactical settings
  - Baseball: Full 9+ inning simulation with pitching fatigue, stolen bases, double plays
  - Soccer: Minute-by-minute event-driven with formations, set pieces, GK saves

- **Universal Attribute System**
  - 26 attributes (Physical/Mental/Technical) shared across all sports
  - Sport-specific weight tables determine effectiveness
  - Players have distinct strengths/weaknesses via variance system

- **Complete Management Systems**
  - Training with weekly XP, age multipliers, playing time bonus
  - Scouting with depth/breadth tradeoff slider
  - Youth Academy with prospect development
  - Contract negotiations (FM-style counter-offers)
  - Transfer market with AI bidding
  - Match fitness and injury system
  - Morale system affecting performance

- **AI System**
  - Personality-driven AI teams (19 opponents per division)
  - Sport-based player evaluation for transfers
  - Tactical decision-making based on personality
  - Budget allocation and roster management

- **Season Flow**
  - 57 matches per season (19 opponents × 3 sports)
  - Combined standings across all sports
  - Promotion/relegation (5 divisions, 20 teams each)
  - Off-season contract expiry and free agency

- **UI (NEON PITCH Theme)**
  - Dark theme with cyan/magenta accents
  - Two-tab navigation (Play / Manage)
  - Multi-sport stats with sport-specific columns
  - Live match simulation with play-by-play

## Tech Stack

- **Framework:** React Native (Expo)
- **Language:** TypeScript (strict mode)
- **Storage:** AsyncStorage (local-first, cloud-ready architecture)
- **Testing:** Jest
- **Platforms:** iOS + Android

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Type check
npm run type-check

# Start Expo
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Architecture

```
multiball/
├── src/
│   ├── simulation/        # Sport simulations
│   │   ├── core/          # Shared probability engine
│   │   ├── game/          # Basketball simulation
│   │   ├── baseball/      # Baseball simulation
│   │   └── soccer/        # Soccer simulation
│   ├── data/              # Types, factories, storage
│   ├── systems/           # Management systems
│   │   ├── trainingSystem.ts
│   │   ├── scoutingSystem.ts
│   │   ├── contractSystem.ts
│   │   ├── transferSystem.ts
│   │   ├── youthAcademySystem.ts
│   │   ├── injurySystem.ts
│   │   └── matchFitnessSystem.ts
│   ├── ai/                # AI decision-making
│   │   ├── aiManager.ts   # Transfer bidding, evaluation
│   │   └── personality.ts # AI team personalities
│   ├── season/            # Season flow, scheduling
│   ├── ui/                # React Native components
│   │   ├── screens/       # Screen components
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # Game state management
│   │   └── navigation/    # Tab navigation
│   └── utils/             # Shared utilities
├── __tests__/             # Test suite (400+ tests)
└── docs/                  # Documentation
```

## Documentation

- [Project Context](./project_context.md) - Comprehensive living document with all decisions, formulas, and history
- [Formulas](./FORMULAS.md) - All game balance formulas
- [Data Structure](./src/data/DATA_STRUCTURE_DIAGRAM.md) - Entity relationships

## Key Design Principles

1. **Simple defaults, optional depth** - New players can jump in; experienced players can customize everything
2. **Multi-sport first** - Every system designed around players competing in 3 sports
3. **Offline-first** - Complete gameplay without internet after purchase
4. **Mobile-native** - Touch-friendly UI, session-based gameplay

## License

Proprietary

## Credits

Developed with assistance from Claude Code.
