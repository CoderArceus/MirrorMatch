# 🎮 MirrorMatch: Strategic 21

**A deterministic, turn-based strategy game where players compete to build the best three lanes of cards closest to 21 without busting.**

MirrorMatch combines the tactical depth of simultaneous-action games with the strategic tension of Blackjack-style optimization. Every decision matters, and every game is perfectly replayable.

---

## 🎯 Game Overview

**Goal:** Win 2 out of 3 lanes by getting closer to 21 than your opponent without going over.

### Core Mechanics

- **3 Lanes per Player:** Each player builds three separate hands (lanes A, B, C)
- **Shared Card Queue:** Both players draw from the same visible queue of 3 cards
- **Simultaneous Actions:** Both players choose actions secretly, then reveal them at the same time
- **Strategic Resources:** 3 Energy points for burning unwanted cards
- **Perfect Information:** No hidden information - all cards and scores are visible

### Actions

1. **Take** - Add the front card from the queue to one of your lanes
2. **Burn** (costs 1 Energy) - Destroy the front card so neither player can use it
3. **Stand** - Permanently lock a lane (no more cards can be added)
4. **Pass** - Do nothing (automatically used when no other actions are available)

### Interaction Matrix

What happens depends on what BOTH players do:

| Player 1 ↓ | Player 2 → | Take | Burn | Stand/Pass |
|-----------|-----------|------|------|------------|
| **Take** | Both get the card | P1 gets Ash (value=1) | P1 gets card |
| **Burn** | P2 gets Ash (value=1) | Card destroyed | P2 stands, P1 burns |
| **Stand/Pass** | P2 gets card | P1 stands, P2 burns | Both execute independently |

---

## 🏗️ Architecture

MirrorMatch is built with a **deterministic, replay-safe engine** completely separate from the UI.

```
MirrorMatch/
├── engine/          # Pure TypeScript game engine (zero dependencies)
│   ├── src/         # Engine source code
│   │   ├── types.ts          # Type definitions
│   │   ├── actions.ts        # Action types (Take, Burn, Stand, Pass)
│   │   ├── validators.ts     # Action legality checks
│   │   ├── resolveTurn.ts    # Turn resolution logic
│   │   ├── state.ts          # State management & deck shuffling
│   │   ├── replay.ts         # Replay system
│   │   ├── analytics.ts      # Game analysis & statistics
│   │   └── index.ts          # Public API
│   └── tests/       # Comprehensive test suite (79 tests)
│       ├── pass.test.ts      # Pass action tests
│       ├── validators.test.ts
│       ├── resolveTurn.test.ts
│       ├── replay.test.ts
│       └── invariants.test.ts
│
└── ui/              # React + Vite frontend
    ├── src/
    │   ├── App.tsx           # Main game UI
    │   ├── ai.ts             # AI opponent (minimax-lite)
    │   └── utils/
    │       └── encodeMatch.ts  # Async PvP URL encoding
    ├── PLAYTEST_LOG.md       # Playtesting analysis
    └── PLAYTEST_NOTES.md     # Design observations
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/CoderArceus/MirrorMatch.git
cd MirrorMatch

# Install engine dependencies
cd engine
npm install

# Run engine tests
npm test

# Install UI dependencies
cd ../ui
npm install

# Start development server
npm run dev
```

The game will be available at `http://localhost:5173/`

---

## 🎮 Play Modes

### 1. **Local Hotseat** (Default)
Two players share one device, taking turns to submit actions.

### 2. **vs AI**
Play against an AI opponent with three difficulty levels:
- **Easy:** Makes occasional suboptimal moves (30% mistake rate)
- **Normal:** Balanced 1-ply lookahead with heuristic evaluation
- **Hard:** Aggressive strategy with preference for Burn actions

### 3. **Async PvP** (URL-based)
Play with friends without needing a server:
1. Click **"Create Async Challenge"** to generate a shareable link
2. Send the link to your opponent
3. Take turns by clicking through and sharing updated URLs
4. All game state is encoded in the URL - no backend required!

---

## 🔧 Engine Design

### Core Principles

✅ **Deterministic** - Same seed = same deck = same game  
✅ **Replay-Safe** - Every game can be perfectly reconstructed from seed + actions  
✅ **UI-Agnostic** - Engine has zero UI dependencies  
✅ **Type-Safe** - Full TypeScript with strict typing  
✅ **Immutable** - All state updates return new objects  
✅ **No Hidden State** - Perfect information, no RNG during gameplay  

### Critical Engine Fix: Pass Action

The engine includes a **first-class Pass action** that prevents soft-locks:

**Problem:** Players could reach states with no legal actions (all lanes locked, no energy, empty queue)

**Solution:** 
- If no other actions are available, Pass becomes the only legal action
- `getLegalActions(state, playerId)` **always returns at least one action**
- If both players pass, the game ends
- This prevents AI loops and UI deadlocks

```typescript
// Engine Contract: Always returns ≥1 action
const actions = getLegalActions(gameState, 'player1');
// actions.length is NEVER 0 (unless game is over)

// If forced to pass:
// actions = [{ type: 'pass' }]
```

### Key Engine Functions

```typescript
// Create a new game
const state = createInitialGameState(seed: number);

// Get all legal actions for a player
const actions = getLegalActions(state, playerId);

// Check if an action is legal
const isLegal = isActionLegal(state, playerId, action);

// Resolve a turn (both players' actions)
const newState = resolveTurn(state, turnActions);

// Replay a game from seed + action history
const finalState = runReplay({ initialState, turns });
```

---

## 🧪 Testing

The engine has **comprehensive test coverage** with 79 tests across 5 test suites:

```bash
cd engine
npm test
```

### Test Suites

- **pass.test.ts** (11 tests) - Pass action behavior and engine contract
- **validators.test.ts** - Action legality validation
- **resolveTurn.test.ts** - Turn resolution and interaction matrix
- **replay.test.ts** - Deterministic replay verification
- **invariants.test.ts** - Game state invariants

**Key guarantees verified by tests:**
- ✅ Every reachable state has ≥1 legal action
- ✅ resolveTurn() never returns the same state
- ✅ AI loops are impossible
- ✅ Replay determinism (same input = same output)
- ✅ Lane totals always match card values
- ✅ Energy and lock states are consistent

---

## 🤖 AI Implementation

The AI uses a **1-ply minimax-lite** strategy with heuristic evaluation:

### Evaluation Heuristic

```
Score = 
  + 100 × (lanes won)
  - 100 × (opponent lanes won)
  + lane values (weighted by proximity to 21)
  + 2 × energy
  - 50 × busted lanes
  + bonuses for perfect 21s and strategic locks
```

### Difficulty Levels

- **Easy:** 30% chance to pick suboptimal moves
- **Normal:** Always picks best evaluated move
- **Hard:** Prefers aggressive Burn actions when scores are close

The AI **always uses `getLegalActions()`** as the source of truth and correctly handles Pass actions when forced.

---

## 📊 Features

### Session Statistics
- Win/loss/draw tracking
- Average turns per game
- Draw rate analysis
- Draw type classification (7 types: perfect symmetry, energy exhaustion, etc.)

### Replay System
- Automatic saving of last 50 games
- Perfect deterministic reconstruction
- Seed-based game identification
- Shareable game states via URL

### Game Analysis
- Lane-by-lane outcome breakdown
- Draw classification with explanations
- Skill badge detection (Perfect 21, Energy Conservation, etc.)
- Turn-by-turn action history

### Quick Feedback System
One-click feedback after each game:
- 😄 Fun
- 🤔 Confusing
- 😡 Frustrating
- 🧠 Made me think

---

## 🎨 UI Features

- **Real-time lane visualization** with totals and lock status
- **Card queue display** showing next 3 available cards
- **Energy tracking** for both players
- **Action validation** with disabled buttons for illegal moves
- **Pending action indicators** showing submitted moves
- **Game over analysis** with detailed lane-by-lane breakdown
- **Responsive design** for desktop and mobile

---

## 🔮 Future Enhancements

Potential additions (not yet implemented):

- [ ] Online multiplayer with WebSocket backend
- [ ] Tournament mode
- [ ] Spectator mode
- [ ] Advanced AI with deeper search
- [ ] Card hand history visualization
- [ ] Undo/redo for local games
- [ ] Custom deck configurations
- [ ] Game variants (4 lanes, different scoring rules)

---

## 📝 Development Notes

### Playtesting

See `ui/PLAYTEST_LOG.md` and `ui/PLAYTEST_NOTES.md` for detailed playtesting analysis and design observations.

### Design Philosophy

MirrorMatch is designed as a **solved game prototype** - it has:
- No hidden information
- Deterministic mechanics
- Perfect replay capability
- Minimal dependencies
- Clean separation of concerns

This makes it ideal for:
- AI research and competitions
- Game theory analysis
- Strategic depth exploration
- Teaching game design principles

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`cd engine && npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Development Guidelines

- Keep engine pure (no dependencies beyond TypeScript)
- Maintain 100% test coverage for new engine features
- Follow existing code style and documentation patterns
- Add tests for any new actions or game mechanics
- Update README for significant changes

---

## 📜 License

This project is open source and available for educational and non-commercial use.

---

## 🙏 Acknowledgments

- Inspired by simultaneous-action games like **Yomi** and **RPS-25**
- Blackjack-style scoring mechanics
- Built with React, TypeScript, and Vite
- Tested with Vitest

---

## 📬 Contact

**Created by:** CoderArceus  
**Repository:** [github.com/CoderArceus/MirrorMatch](https://github.com/CoderArceus/MirrorMatch)

---

## 🎲 Try It Now!

[**Play MirrorMatch**](https://github.com/CoderArceus/MirrorMatch) - Clone and run locally, or deploy to your favorite hosting platform!

**Tip:** Start with vs AI mode on Easy to learn the mechanics, then challenge a friend in Async PvP mode!
