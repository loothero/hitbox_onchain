/**
 * Hitbox Onchain - Core Types
 * Shared types across aggregator, client, and indexers
 */

/** Valid movement directions */
export enum Direction {
    Up = 0,
    Down = 1,
    Left = 2,
    Right = 3,
}

/** Direction names for display */
export const DirectionNames: Record<Direction, string> = {
    [Direction.Up]: "Up",
    [Direction.Down]: "Down",
    [Direction.Left]: "Left",
    [Direction.Right]: "Right",
};

/** Current game state from contract */
export interface GameState {
    currentTick: bigint;
    tickEndTimestamp: bigint;
    timeoutSeconds: bigint;
    lastMoveTimestamp: bigint;
    lastMover: `0x${string}`;
    pot: bigint;
    minFee: bigint;
}

/** Vote event data */
export interface Vote {
    voter: `0x${string}`;
    tick: bigint;
    direction: Direction;
    amount: bigint;
    txHash: `0x${string}`;
    blockNumber: bigint;
    timestamp: bigint;
}

/** Tick finalization data */
export interface TickOutcome {
    tick: bigint;
    winningDirection: Direction;
    lastMover: `0x${string}`;
    pot: bigint;
    txHash: `0x${string}`;
    blockNumber: bigint;
}

/** Vote counts per direction for a tick */
export type VoteCounts = [bigint, bigint, bigint, bigint];

/** Protocol constants */
export const PROTOCOL = {
    /** Default tick duration in seconds */
    TICK_DURATION_SECONDS: 3n,
    /** Default timeout in seconds */
    TIMEOUT_SECONDS: 3600n, // 60 minutes
    /** Default minimum fee in wei */
    MIN_FEE_WEI: 1000000000000000n, // 0.001 ETH
    /** Number of valid directions */
    NUM_DIRECTIONS: 4,
} as const;
