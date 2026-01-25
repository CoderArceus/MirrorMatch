
import { createInitialGameState } from './src/state';
import { resolveTurn } from './src/resolveTurn';
import { chooseAction } from './src/ai';
import { analyzeDrawDiagnostics, aggregateDrawStatistics, DrawDiagnostics } from './src/analytics';
import { TurnActions } from './src/actions';

const NUM_GAMES = 1000;

console.log(`Running ${NUM_GAMES} games (Hard AI vs Hard AI) to analyze draw distribution...`);

const drawDiagnostics: DrawDiagnostics[] = [];
let p1Wins = 0;
let p2Wins = 0;
let draws = 0;

for (let i = 0; i < NUM_GAMES; i++) {
    // Deterministic but varying seed
    let state = createInitialGameState(1000 + i);
    const actionLog: { playerId: string; action: any }[] = [];

    while (!state.gameOver) {
        const p1Action = chooseAction(state, 'player1', 'hard');
        const p2Action = chooseAction(state, 'player2', 'hard');

        actionLog.push({ playerId: 'player1', action: p1Action });
        actionLog.push({ playerId: 'player2', action: p2Action });

        const turnActions: TurnActions = {
            playerActions: [
                { playerId: 'player1', action: p1Action },
                { playerId: 'player2', action: p2Action },
            ],
        };

        state = resolveTurn(state, turnActions);
    }

    if (state.winner) {
        if (state.winner === 'player1') p1Wins++;
        else p2Wins++;
    } else {
        draws++;
        const diag = analyzeDrawDiagnostics(
            state,
            'player1',
            'player2',
            actionLog
        );
        drawDiagnostics.push(diag);
    }
}

const stats = aggregateDrawStatistics(drawDiagnostics);

console.log('\n=== SIMULATION RESULTS ===');
console.log(`Total Games: ${NUM_GAMES}`);
console.log(`P1 Wins: ${p1Wins} (${((p1Wins / NUM_GAMES) * 100).toFixed(1)}%)`);
console.log(`P2 Wins: ${p2Wins} (${((p2Wins / NUM_GAMES) * 100).toFixed(1)}%)`);
console.log(`Draws:   ${draws} (${((draws / NUM_GAMES) * 100).toFixed(1)}%)`);

console.log('\n=== DRAW STATISTICS ===');
if (stats.totalDraws > 0) {
    const sortedReasons = Object.entries(stats.byReason)
        .sort(([, a], [, b]) => b - a);

    console.log('Top Draw Reasons:');
    sortedReasons.forEach(([reason, count]) => {
        const pct = ((count / stats.totalDraws) * 100).toFixed(1);
        if (count > 0) console.log(`  ${reason.padEnd(20)}: ${count} (${pct}%)`);
    });

    console.log('\nMetrics (Avg):');
    console.log(`  Contestable Lanes: ${stats.avgContestableLanes.toFixed(2)}`);
    console.log(`  Energy Remaining:  ${stats.avgEnergyRemaining.toFixed(2)}`);
    console.log(`  Forced Passes:     ${stats.avgForcedPasses.toFixed(2)}`);
    console.log(`  Win Threats:       ${stats.avgWinThreats.toFixed(2)}`);
}
