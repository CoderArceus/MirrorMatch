# 🎮 Seque

A quick tactical card game for two players. Get close to 21, don't go over, and outsmart your opponent!

## 🎯 The Goal

Win **2 out of 3 lanes** by having a higher total than your opponent (without going over 21).

## 🃏 How to Play

### The Basics
- You and your opponent both have **3 lanes** (A, B, C)
- Cards come from a **shared queue** - you both see the same cards
- Each turn, you both pick an action **at the same time**
- Get as close to **21** as possible in each lane - go over and you **bust!**

### Your Actions

| Action | What it does |
|--------|--------------|
| **Click a Lane** | Add the top card to that lane |
| **🔒 Stand** | Lock a lane - no more changes allowed |
| **🔥 Burn** | Destroy the top card (costs 1 ⚡ energy) |
| **🎲 Blind Hit** | Draw a random card to a shackled lane |

### Winning a Lane
- Higher total wins (without busting)
- If you bust (go over 21), you lose that lane
- Ties = no one wins that lane

## ⚡ Energy & Special Rules

**Energy** - You start with 2 ⚡
- Burning a card costs 1 ⚡
- Bidding in auctions costs ⚡
- Once spent, it's gone forever!

**Overheat** - After burning, you can't burn again for a few turns

## 🎯 Dark Auction (Turns 4 & 8)

A special bidding phase:
1. Both players secretly bid energy
2. Both choose a lane to risk
3. **Higher bid wins** - loser's chosen lane gets **shackled** ⛓️
4. Shackled lanes can only receive random cards via **Blind Hit**

## 🎮 Game Modes

- **👥 Local** - Play with a friend on the same device
- **🤖 vs AI** - Easy, Medium, or Hard difficulty
- **🔗 Online** - Share a link to play with anyone!

## 🏆 Tips for New Players

1. **Don't bust!** - A busted lane is an automatic loss
2. **Watch the queue** - Plan ahead based on upcoming cards
3. **Stand on strong totals** - 20 or 21 is usually worth locking
4. **Save energy** - You might need it for auctions
5. **Block your opponent** - Sometimes burning a card they need is worth it

---

**Play now at [seque.vercel.app](https://seque.vercel.app)**

Built with ❤️ using TypeScript & React
