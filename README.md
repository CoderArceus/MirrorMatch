# 🎮 Seque: Strategic 21

A tactical card battler where you and your opponent share the same deck. Manage energy, control lanes, and outsmart your mirror image.

![Seque](https://img.shields.io/badge/Version-2.5-purple)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-19-61DAFB)
![Vite](https://img.shields.io/badge/Vite-7-646CFF)

## 💡 How Seque Works

- **The link IS the game** — No accounts, no servers, no databases
- **Fully deterministic** — Same seed + actions = identical game state
- **Replay-first architecture** — States reconstructed by replaying actions
- **Async PvP via URLs** — Create match → Share link → Opponent plays → Repeat

## 🎯 Game Overview

Seque is a simultaneous-turn card game where two players compete to win 2 out of 3 lanes. Each lane works like Blackjack - get as close to 21 as possible without going over. The twist? Both players draw from the **same shared queue** of cards.

### Core Mechanics

- **Shared Queue**: Both players see and compete for the same cards
- **Simultaneous Turns**: Players choose actions at the same time, then actions resolve together
- **Three Lanes**: Win by controlling 2 out of 3 lanes
- **Energy System**: Limited resource for powerful Burn actions
- **Lane Locking**: Lock lanes at 21 or by Standing

## 🎴 Actions

### 📥 Take
Add the front card from the queue to any of your unlocked lanes.

### 🔥 Burn
Spend 1 energy to destroy the front card entirely. Removes it from the game.
- Costs 1 ⚡ Energy
- Subject to Overheat cooldown (v2.5)

### 🔒 Stand
Lock a lane to prevent any further changes. Use strategically to secure a winning total.

### 🎲 Blind Hit (v2.5)
Available only for shackled lanes. Draw directly from the deck (not queue) to a shackled lane.

### ⏭️ Pass
Automatically triggered when no other actions are available.

## 🎯 Dark Auction (v2.5)

On **turns 4 and 8**, a special Dark Auction phase occurs:

1. Both players secretly bid energy (0 to max)
2. Both players select a "void lane" (which lane gets shackled if they lose)
3. **Higher bid wins** - winner pays their bid, loser pays nothing
4. **Loser's selected lane becomes shackled** (⛓️)
5. Ties favor Player 1

### Shackled Lanes
- Cannot use Take or Stand on shackled lanes
- Can only use **Blind Hit** to add cards
- Lane cannot be shackled twice

## 🌡️ Overheat System (v2.5)

After using Burn, you enter an "overheat" state:
- Cannot Burn again for a number of turns
- Overheat counter decrements each turn
- Forces strategic timing of Burn actions

## ⚡ Energy System

- **Starting Energy**: 2 per player
- **Usage**: Burn costs 1 energy, Auction bids cost energy
- **No Regeneration**: Energy is a finite resource - use wisely!

## 🏆 Winning Conditions

### Lane Victory
A lane is won by the player with:
1. Higher total without busting (going over 21)
2. If opponent busted and you didn't
3. Ties go to neither player

### Game Victory
- Win **2 out of 3 lanes** to win the match
- If both players win 1 lane each and tie the third: **Draw**

## 🎮 Game Modes

### 👥 Local PvP
Play against a friend on the same device. Players take turns entering actions with a unified control panel.

### 🤖 vs AI
Challenge the AI at three difficulty levels:
- **Easy** 😊 - Random-ish decisions
- **Medium** 🧠 - Basic strategy
- **Hard** 🔥 - Optimized play with lookahead

### 🔗 Async PvP
Create a shareable link to play remotely:
1. Start an Async game
2. Share the generated URL with opponent
3. Each player takes turns via URL exchange

## 📊 Analytics & Badges

After each game, detailed analytics are provided:

### Skill Badges
- **🎰 Perfect Blackjack** - Hit exactly 21
- **🔥 Efficient Burn** - Strategic burn usage
- **🧹 Lane Sweep** - Win all 3 lanes
- **💪 Comeback** - Win after being behind
- **⚡ Blitz** - Quick decisive victory
- **🛡️ Defensive Master** - Strong defensive play
- **🎲 Risk Taker** - High-risk high-reward plays
- **🐢 Conservative** - Safe, steady strategy

### Match Statistics
- Turn count
- Remaining energy
- Decisiveness score
- Action breakdown (takes/burns/stands per player)

### Draw Analysis
When games end in a draw, detailed analysis explains:
- Draw type classification
- Contributing factors
- Turns until decisive (if applicable)

## 🛠️ Technical Architecture

### Engine (`/engine`)
Pure TypeScript game logic with:
- **Deterministic replay system** - Seed-based RNG for reproducible games
- **Immutable state** - All game states are readonly
- **Action validation** - `isActionLegal()` and `getLegalActions()`
- **Turn resolution** - Simultaneous action handling
- **AI system** - Multiple difficulty levels
- **Analytics** - Comprehensive game analysis

### UI (`/ui`)
Modern React frontend with:
- **Vite** - Fast development and builds
- **Glass-morphism design** - Translucent panels with backdrop blur
- **Responsive layout** - Works on desktop and mobile
- **Smooth animations** - CSS transitions and keyframes
- **No external UI libraries** - Pure CSS styling

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Installation

```bash
# Clone the repository
git clone https://github.com/CoderArceus/Seque.git
cd Seque

# Install engine dependencies
cd engine
npm install

# Install UI dependencies
cd ../ui
npm install
```

### Development

```bash
# Run engine tests
cd engine
npm test

# Start UI development server
cd ui
npm run dev
```

### Production Build

```bash
cd ui
npm run build
```

## 📁 Project Structure

```
Seque/
├── engine/                 # Game engine (pure TypeScript)
│   ├── src/
│   │   ├── actions.ts      # Action type definitions
│   │   ├── ai.ts           # AI player logic
│   │   ├── analytics.ts    # Game analysis & badges
│   │   ├── async.ts        # Async PvP support
│   │   ├── index.ts        # Public API exports
│   │   ├── replay.ts       # Replay system
│   │   ├── resolveTurn.ts  # Turn resolution logic
│   │   ├── state.ts        # State management
│   │   ├── types.ts        # Type definitions
│   │   └── validators.ts   # Action validation
│   └── tests/              # Comprehensive test suite
│
└── ui/                     # React frontend
    ├── src/
    │   ├── views/          # Main view components
    │   │   ├── WelcomeView.tsx
    │   │   ├── GameView.tsx
    │   │   └── ResultsView.tsx
    │   ├── components/     # Reusable components
    │   ├── utils/          # Utilities (encoding, storage)
    │   ├── App.tsx         # Main app component
    │   └── App.css         # Global styles
    └── index.html
```

## 🎨 Design System

### Color Palette
- **Primary**: Blue (#4a9eff)
- **Success**: Green (#4caf50)
- **Danger**: Red (#f44336)
- **Warning**: Orange (#ff9800)
- **Accent**: Purple (#9c27b0)

### UI Elements
- **Dock-style panels** - Floating glass containers
- **Glow effects** - Active states with colored shadows
- **Background orbs** - Animated gradient blurs
- **Pill buttons** - Rounded full-radius buttons

## 📜 Version History

### v2.5 (Current)
- Dark Auction system (turns 4 & 8)
- Shackled lanes & Blind Hit action
- Overheat cooldown for Burn
- Starting energy reduced to 2

### v2.0
- Three-lane gameplay
- Stand action
- Energy system
- AI opponents

### v1.0
- Basic Blackjack-style gameplay
- Take and Burn actions
- Two-player local mode

## 🧪 Testing

The engine includes comprehensive tests:

```bash
cd engine
npm test
```

- **260+ test cases**
- Action validation
- Turn resolution
- AI behavior
- Replay determinism
- Analytics accuracy
- Edge cases & invariants

## 🚀 Deployment

Seque is deployed as a **static frontend** with no backend required.

### How It Works

- **Fully Deterministic**: All game states are reproducible from a seed + action history
- **No Server Storage**: Game data exists only in shareable URLs
- **Links ARE the State**: Each URL contains the complete match state encoded in base64
- **Replay-First Architecture**: States are reconstructed by replaying actions, ensuring consistency

### Hosting

The app is configured for **Vercel** deployment.

**Option 1: Vercel Dashboard (Recommended)**
1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import the `CoderArceus/Seque` repository
4. Set **Root Directory** to `ui`
5. Framework will auto-detect as Vite
6. Click Deploy

**Option 2: Vercel CLI**
```bash
npm i -g vercel
cd ui
vercel login
vercel --prod
```

The `vercel.json` config handles:
- SPA routing (all paths → index.html)
- Security headers
- Static asset optimization

### Deep Link Support

All async match URLs work correctly:
- Direct link access ✓
- Page refresh ✓
- Browser back/forward ✓

### Production Guarantees

- ✅ No infinite loops on malformed URLs
- ✅ Replay turn count capped at 100
- ✅ Clear error messages for invalid links
- ✅ Clipboard fallback for older browsers
- ✅ Version stamp in footer

## 📄 License

MIT License - feel free to use, modify, and distribute.

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Submit a pull request

---

Built with ❤️ using TypeScript, React, and Vite
