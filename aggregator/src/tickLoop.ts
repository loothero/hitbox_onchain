/**
 * Hitbox Aggregator - Tick Loop
 * Watches for tick endings and finalizes with winner
 */
import { resolveTickWinner } from "@hitbox/core";
import { chainClient } from "./chainClient.js";

// Polling interval in milliseconds
const POLL_INTERVAL_MS = 500;

// Track the last processed tick to avoid double-finalization
let lastProcessedTick: bigint = -1n;

/**
 * Start the tick resolution loop
 */
export function startTickLoop() {
    setInterval(checkAndFinalizeTick, POLL_INTERVAL_MS);
    console.log(`⏱️  Tick loop started (polling every ${POLL_INTERVAL_MS}ms)`);
}

/**
 * Check if current tick has ended and finalize if needed
 */
async function checkAndFinalizeTick() {
    try {
        const state = await chainClient.getGameState();
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Check if tick has ended
        if (now < state.tickEndTimestamp) {
            return; // Tick still active
        }

        // Check if already processed
        if (state.currentTick <= lastProcessedTick) {
            return; // Already handled
        }

        // Check if already finalized onchain
        const isFinalized = await chainClient.isTickFinalized(state.currentTick);
        if (isFinalized) {
            lastProcessedTick = state.currentTick;
            return;
        }

        // Get vote counts
        const votes = await chainClient.getTickVotes(state.currentTick);
        const totalVotes = votes[0] + votes[1] + votes[2] + votes[3];

        if (totalVotes === 0n) {
            // No votes this tick - skip finalization
            console.log(`⏭️  Tick ${state.currentTick}: No votes, skipping finalization`);
            lastProcessedTick = state.currentTick;
            return;
        }

        // Determine winner
        const previousTxHash = await chainClient.getLatestFinalizedTxHash();
        const voteCounts: [bigint, bigint, bigint, bigint] = [
            votes[0],
            votes[1],
            votes[2],
            votes[3],
        ];

        const winner = resolveTickWinner(voteCounts, state.currentTick, previousTxHash);

        if (winner === null) {
            console.log(`⏭️  Tick ${state.currentTick}: No winner (unexpected)`);
            lastProcessedTick = state.currentTick;
            return;
        }

        // Submit finalization
        console.log(
            `🎯 Tick ${state.currentTick}: Finalizing with direction ${winner} ` +
            `(votes: ⬆${votes[0]} ⬇${votes[1]} ⬅${votes[2]} ➡${votes[3]})`
        );

        await chainClient.finalizeTick(state.currentTick, winner);
        lastProcessedTick = state.currentTick;

        console.log(`✅ Tick ${state.currentTick} finalized successfully`);
    } catch (error) {
        console.error("Tick loop error:", error);
        // Continue loop - don't crash on transient errors
    }
}
