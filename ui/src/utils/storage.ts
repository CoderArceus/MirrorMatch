import { classifyDraw } from '../../../engine/src';
import type { GameState, TurnActions, DrawReason } from '../../../engine/src';

// Types
export type SessionStats = {
    games: number;
    p1Wins: number;
    p2Wins: number;
    draws: number;
    totalTurns: number;
    drawReasons: Record<DrawReason, number>;
};

export type Replay = {
    id: string;
    seed: number;
    actions: TurnActions[];
    finalState: GameState;
    timestamp: number;
};

export type FeedbackType = 'fun' | 'confusing' | 'frustrating' | 'thinking';

export type Feedback = {
    type: FeedbackType;
    gameId: string;
    timestamp: number;
};

// Constants
const STATS_KEY = 'mirrormatch-session-stats';
const REPLAYS_KEY = 'mirrormatch-replays';
const MAX_REPLAYS = 50;
const FEEDBACK_KEY = 'mirrormatch-feedback';

// Stats Logic
export function loadStats(): SessionStats {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) {
        try {
            const parsed = JSON.parse(stored);
            if (!parsed.drawReasons) {
                parsed.drawReasons = {
                    perfect_symmetry: 0,
                    energy_exhaustion: 0,
                    mutual_perfection: 0,
                    stall_lock: 0,
                    equal_lanes: 0,
                    tiebreaker_equal: 0,
                    deck_exhausted: 0,
                    mutual_pass: 0,
                    lane_split: 0,
                    stall_equilibrium: 0,
                };
            }
            return parsed;
        } catch {
            // Invalid data
        }
    }
    return {
        games: 0,
        p1Wins: 0,
        p2Wins: 0,
        draws: 0,
        totalTurns: 0,
        drawReasons: {
            perfect_symmetry: 0,
            energy_exhaustion: 0,
            mutual_perfection: 0,
            stall_lock: 0,
            equal_lanes: 0,
            tiebreaker_equal: 0,
            deck_exhausted: 0,
            mutual_pass: 0,
            lane_split: 0,
            stall_equilibrium: 0,
        }
    };
}

export function saveStats(stats: SessionStats): void {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function recordGame(state: GameState): void {
    const stats = loadStats();
    stats.games += 1;
    stats.totalTurns += state.turnNumber;

    if (state.winner === 'player1') {
        stats.p1Wins += 1;
    } else if (state.winner === 'player2') {
        stats.p2Wins += 1;
    } else {
        stats.draws += 1;
        const drawInfo = classifyDraw(state);
        stats.drawReasons[drawInfo.type] = (stats.drawReasons[drawInfo.type] || 0) + 1;
    }

    saveStats(stats);
}

export function resetStats(): void {
    localStorage.removeItem(STATS_KEY);
}

// Replay Logic
export function loadReplays(): Replay[] {
    const stored = localStorage.getItem(REPLAYS_KEY);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch {
            return [];
        }
    }
    return [];
}

export function saveReplay(replay: Replay): void {
    const replays = loadReplays();
    replays.unshift(replay);

    if (replays.length > MAX_REPLAYS) {
        replays.splice(MAX_REPLAYS);
    }

    localStorage.setItem(REPLAYS_KEY, JSON.stringify(replays));
}

// Feedback Logic
export function saveFeedback(feedback: Feedback): void {
    const stored = localStorage.getItem(FEEDBACK_KEY);
    const feedbacks: Feedback[] = stored ? JSON.parse(stored) : [];
    feedbacks.push(feedback);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedbacks));
}
