# 📜 Seque — Server Contract (v1.0)

**Purpose:**
This document defines the **non-negotiable contract** between clients and the game server for **Proper PvP (Friendly first)**.
If a behavior is not explicitly allowed here, it is **forbidden**.

The server is the **single source of truth**.

---

## 0. Core Principles (Read First)

1. **Server is authoritative**

   * Server owns game state, timers, legality, resolution.
   * Clients never resolve turns or decide outcomes.

2. **Determinism over forgiveness**

   * No randomness in resolution, timeouts, or fallbacks.
   * Same inputs → same outputs, always.

3. **Deadlines beat intent**

   * Arrival time at server matters.
   * "I clicked in time" is irrelevant.

4. **Clients render, servers decide**

   * Clients may simulate locally for UX.
   * Server state always overrides client state.

---

## 1. Canonical Concepts

### Roles

* `player1`, `player2` are **server-assigned and immutable** for a match.
* All ordered structures MUST use this canonical order.

### Time

* All authoritative time uses **server timestamps**.
* Clients display **estimated time remaining** only.

---

## 2. Server-Owned State

### Room (Pre-Game)

```ts
Room {
  roomCode: string
  createdAt: timestamp
  expiresAt: timestamp
  status: "waiting" | "ready" | "playing" | "finished"

  player1: {
    id: string
    displayName: string
    connected: boolean
    ready: boolean
  }

  player2?: {
    id: string
    displayName: string
    connected: boolean
    ready: boolean
  }

  turnTimerSeconds: number // 15–60, default 30
}
```

### Match (In-Game)

```ts
Match {
  roomCode: string
  seed: number

  gameState: GameState // authoritative engine state
  turnNumber: number

  turnStartedAt: timestamp
  turnDeadline: timestamp

  pendingActions: {
    player1?: Action
    player2?: Action
  }

  history: TurnActions[] // resolved turns only

  status: "active" | "finished"
  winner: "player1" | "player2" | null
}
```

---

## 3. Canonical Ordering (Critical)

### Turn Resolution Input

When resolving a turn, the server MUST construct actions as:

```ts
TurnActions = [
  { playerId: player1.id, action: pendingActions.player1 },
  { playerId: player2.id, action: pendingActions.player2 }
]
```

**Arrival order is NEVER used.**

Failure to enforce this breaks determinism.

---

## 4. Message Protocol

### Client → Server

| Message       | Payload                          | Rules                         |
| ------------- | -------------------------------- | ----------------------------- |
| `CREATE_ROOM` | `{ displayName, timerSeconds? }` | timerSeconds clamped to 15–60 |
| `JOIN_ROOM`   | `{ roomCode, displayName }`      | Atomic join                   |
| `READY`       | `{}`                             | Only once                     |
| `ACTION`      | `{ turn, action }`               | One per turn max              |
| `LEAVE`       | `{}`                             | Immediate forfeit             |
| `RECONNECT`   | `{ roomCode, playerId }`         | Triggers STATE_SYNC           |

---

### Server → Client

| Message          | Payload                                         | Guarantees         |
| ---------------- | ----------------------------------------------- | ------------------ |
| `ROOM_CREATED`   | `{ roomCode, playerId }`                        | Unique             |
| `ROOM_JOINED`    | `{ playerId, opponent, timerSeconds }`          |                    |
| `PLAYER_JOINED`  | `{ opponent }`                                  |                    |
| `PLAYER_READY`   | `{ playerId }`                                  |                    |
| `GAME_START`     | `{ seed, yourRole, turnDeadline, initialState }`| Seed authoritative |
| `ACTION_ACK`     | `{ turn }`                                      | Confirms receipt   |
| `OPPONENT_READY` | `{ turn }`                                      | No reveal          |
| `TURN_RESOLVED`  | `{ turn, actions, newState, nextTurnDeadline }` | Full truth         |
| `GAME_OVER`      | `{ winner, finalState, replayId }`              | Final              |
| `STATE_SYNC`     | `{ gameState, turn, pending, turnDeadline }`    | Reconnect          |
| `ERROR`          | `{ code, message }`                             | Deterministic      |

---

## 5. Turn & Timer Rules (Strict)

### Turn Start

* Server sets:

  * `turnStartedAt`
  * `turnDeadline = turnStartedAt + turnTimerSeconds`

### Action Submission

* Valid if:

  * `match.status === "active"`
  * `turn === match.turnNumber`
  * `now < turnDeadline`
  * Player has not already submitted

### Double Submit

* Second submit → `ERROR: ALREADY_SUBMITTED`
* Ignored safely.

### Timeout

At `now >= turnDeadline`:

1. Turn is **locked**
2. Missing actions are auto-filled using **deterministic fallback**
3. Late actions are rejected with `ERROR: TURN_EXPIRED`

---

## 6. Deterministic Timeout Fallback

If a player does not submit in time:

**Fallback Action = first legal action in canonical order**

Canonical order:

```
take[0], take[1], take[2],
burn,
stand[0], stand[1], stand[2],
blind_hit[0], blind_hit[1], blind_hit[2],
pass
```

* Uses `getLegalActions()`
* No randomness
* Fully predictable

---

## 7. Auction Rules (Turn 4, 8)

### Submission

* Only `BidAction` accepted
* One per player

### Timeout in Auction

* Auto-bid = `0`
* Auto-lane = first valid non-shackled lane (canonical order)

### Resolution

Server resolves auction and includes result in TURN_RESOLVED.

---

## 8. Disconnect Handling

### Detection

* Server heartbeat / socket close

### Grace Period

* Timer pauses
* Grace = **15 seconds exactly**

### Limits

* Max cumulative disconnect time per match = **60 seconds**
* Exceed → **forfeit**

### Reconnect

* Client sends `RECONNECT`
* Server responds with `STATE_SYNC`
* Server state always wins

---

## 9. Anti-Abuse Guarantees

### Rate Limits

* Max 1 action per turn
* Excessive spam → connection dropped

### Slow Play

* Legal but logged
* Full-timer turns tracked

### Leave

* `LEAVE` = instant forfeit
* No ambiguity

---

## 10. Logging (Mandatory from Day 1)

Log every event:

* `room_created`
* `room_joined`
* `room_expired`
* `player_ready`
* `game_started`
* `action_received`
* `action_rejected`
* `turn_timeout`
* `turn_resolved`
* `disconnect`
* `reconnect`
* `game_ended`

Logs are **not optional**.

---

## 11. Non-Goals (Explicit)

The server does NOT:

* Predict actions
* Trust client state
* Store UI preferences
* Animate anything
* Guess intent

---

## 12. Final Contract Statement

If a client and server disagree:

> **The server is correct.
> The client must resync.**

No exceptions.

---

**Status:** ✅ Implemented for Friendly PvP
