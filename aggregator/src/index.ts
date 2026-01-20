/**
 * Hitbox Aggregator - Entry Point
 * Starts the tick loop and API server
 */
import express from "express";
import cors from "cors";
import { chainClient } from "./chainClient.js";
import { startTickLoop } from "./tickLoop.js";

const PORT = process.env.PORT || 3001;

const app = express();

// Enable CORS for client requests
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
}));

app.use(express.json());

// ============ API Endpoints ============

/**
 * Health check endpoint
 */
app.get("/health", async (req, res) => {
    try {
        const state = await chainClient.getGameState();
        res.json({
            status: "ok",
            chainId: chainClient.chainId,
            contractAddress: chainClient.contractAddress,
            currentTick: state.currentTick.toString(),
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        res.status(500).json({
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

/**
 * Current game state endpoint
 */
app.get("/state", async (req, res) => {
    try {
        const state = await chainClient.getGameState();
        const now = BigInt(Math.floor(Date.now() / 1000));

        // Compute time remaining
        const tickTimeRemaining =
            state.tickEndTimestamp > now ? state.tickEndTimestamp - now : 0n;
        const timeoutEnd = state.lastMoveTimestamp + state.timeoutSeconds;
        const timeoutRemaining = timeoutEnd > now ? timeoutEnd - now : 0n;

        res.json({
            currentTick: state.currentTick.toString(),
            tickEndTimestamp: state.tickEndTimestamp.toString(),
            tickTimeRemaining: tickTimeRemaining.toString(),
            timeoutSeconds: state.timeoutSeconds.toString(),
            timeoutRemaining: timeoutRemaining.toString(),
            lastMoveTimestamp: state.lastMoveTimestamp.toString(),
            lastMover: state.lastMover,
            pot: state.pot.toString(),
            minFee: state.minFee.toString(),
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

/**
 * Get vote counts for current tick
 */
app.get("/votes/current", async (req, res) => {
    try {
        const state = await chainClient.getGameState();
        const votes = await chainClient.getTickVotes(state.currentTick);
        res.json({
            tick: state.currentTick.toString(),
            votes: {
                up: votes[0].toString(),
                down: votes[1].toString(),
                left: votes[2].toString(),
                right: votes[3].toString(),
            },
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
});

// ============ Startup ============

async function main() {
    console.log("🎮 Hitbox Aggregator starting...");
    console.log(`   Chain: ${chainClient.chainId}`);
    console.log(`   Contract: ${chainClient.contractAddress}`);

    // Start API server
    app.listen(PORT, () => {
        console.log(`📡 API server listening on port ${PORT}`);
    });

    // Start tick loop
    console.log("⏱️  Starting tick loop...");
    startTickLoop();
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
