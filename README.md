# Multiball

A multi-sport franchise management mobile game for iOS and Android.

## Overview

Multiball is a text-based simulation game where users manage a franchise competing in basketball, baseball, and soccer simultaneously. The unique hook: athletes can compete in multiple sports, allowing users to explore "what if" scenarios.

## Project Status

**Current Phase:** Phase 1 - Foundation
**Progress:** Setting up project structure

### Completed
- ✅ Project planning and agent design
- ✅ PROJECT_CONTEXT.md created
- ✅ React Native + TypeScript project initialized

### In Progress
- 🔄 Basketball simulation translation (Python → TypeScript)
- 🔄 Data model definition

### Upcoming
- Phase 2: Management Systems
- Phase 3: AI & Season Flow
- Phase 4: Mobile UI
- Phase 5: Polish & Launch

## Tech Stack

- **Framework:** React Native
- **Language:** TypeScript (strict mode)
- **Storage:** AsyncStorage (local), cloud-ready architecture
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

# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

## Documentation

- [MVP Gameplan](./MVP_GAMEPLAN.md) - Complete development roadmap
- [Project Context](./PROJECT_CONTEXT.md) - Living document with all decisions
- [Agent Recommendations](./AGENT_RECOMMENDATIONS.md) - Specialized agent roles
- [Agent Instructions](./agents/) - Detailed instructions for each agent

## Architecture

```
multiball/
├── src/
│   ├── simulation/     # Basketball sim (TypeScript)
│   ├── data/           # Data models & storage
│   ├── systems/        # Management systems
│   ├── ai/             # AI behavior
│   ├── ui/             # React Native components
│   └── utils/          # Shared utilities
├── __tests__/          # Test suite
├── assets/             # Images, fonts
└── basketball-sim/     # Original Python simulation
```

## License

Proprietary

## Credits

Developed with assistance from Claude Code agents.
