/**
 * Hitbox Onchain - Deterministic Tie-Break
 * Per PROTOCOL.md Section 5.3
 */
import { keccak256, encodePacked } from "viem";
import { Direction } from "./types.js";

/**
 * Deterministically select a winner from tied directions.
 * Uses keccak256(abi.encodePacked(tickNumber, previousFinalizedTxHash))
 *
 * @param tickNumber - Current tick being finalized
 * @param previousTxHash - Transaction hash of last finalized tick
 * @param tiedDirections - Array of directions that tied for max votes
 * @returns The winning direction
 */
export function resolveTieBreak(
    tickNumber: bigint,
    previousTxHash: `0x${string}`,
    tiedDirections: Direction[]
): Direction {
    if (tiedDirections.length === 0) {
        throw new Error("No tied directions provided");
    }

    if (tiedDirections.length === 1) {
        return tiedDirections[0];
    }

    // Compute deterministic entropy
    const entropy = keccak256(
        encodePacked(["uint256", "bytes32"], [tickNumber, previousTxHash])
    );

    // Convert to bigint and mod by number of tied directions
    const entropyBigInt = BigInt(entropy);
    const winnerIndex = Number(entropyBigInt % BigInt(tiedDirections.length));

    return tiedDirections[winnerIndex];
}

/**
 * Given vote counts, determine the winning direction(s).
 * Returns all directions with the maximum vote count.
 *
 * @param counts - Array of vote counts [Up, Down, Left, Right]
 * @returns Array of directions with max votes (may be tie)
 */
export function getMaxVoteDirections(
    counts: [bigint, bigint, bigint, bigint]
): Direction[] {
    const max = counts.reduce((a, b) => (a > b ? a : b), 0n);

    if (max === 0n) {
        return []; // No votes
    }

    const tiedDirections: Direction[] = [];
    for (let i = 0; i < 4; i++) {
        if (counts[i] === max) {
            tiedDirections.push(i as Direction);
        }
    }

    return tiedDirections;
}

/**
 * Resolve the winning direction for a tick.
 * Handles no-vote case, single winner, and tie-break.
 *
 * @param counts - Vote counts per direction
 * @param tickNumber - Current tick number
 * @param previousTxHash - Previous tick's finalization tx hash
 * @returns Winning direction, or null if no votes
 */
export function resolveTickWinner(
    counts: [bigint, bigint, bigint, bigint],
    tickNumber: bigint,
    previousTxHash: `0x${string}`
): Direction | null {
    const maxDirections = getMaxVoteDirections(counts);

    if (maxDirections.length === 0) {
        return null; // No votes this tick
    }

    if (maxDirections.length === 1) {
        return maxDirections[0];
    }

    return resolveTieBreak(tickNumber, previousTxHash, maxDirections);
}
