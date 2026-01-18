/**
 * Hitbox Aggregator - Chain Client
 * Handles blockchain interaction using viem
 */
import "dotenv/config";
import {
    createPublicClient,
    createWalletClient,
    http,
    type PublicClient,
    type WalletClient,
    type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, foundry } from "viem/chains";
import type { GameState } from "@hitbox/core";

// ============ Configuration ============

const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
const PRIVATE_KEY = process.env.OPERATOR_PRIVATE_KEY as `0x${string}` | undefined;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS as `0x${string}` | undefined;

if (!CONTRACT_ADDRESS) {
    console.warn("⚠️  CONTRACT_ADDRESS not set, using placeholder");
}

// ============ Contract ABI (minimal) ============

const HITBOX_ABI = [
    {
        name: "getState",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [
            { name: "_currentTick", type: "uint256" },
            { name: "_tickEndTimestamp", type: "uint256" },
            { name: "_timeoutSeconds", type: "uint256" },
            { name: "_lastMoveTimestamp", type: "uint256" },
            { name: "_lastMover", type: "address" },
            { name: "_pot", type: "uint256" },
            { name: "_minFee", type: "uint256" },
        ],
    },
    {
        name: "getTickVotes",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tick", type: "uint256" }],
        outputs: [{ name: "", type: "uint256[4]" }],
    },
    {
        name: "finalizeTick",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "tick", type: "uint256" },
            { name: "winningDirection", type: "uint8" },
        ],
        outputs: [],
    },
    {
        name: "isTickFinalized",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tick", type: "uint256" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "VoteCast",
        type: "event",
        inputs: [
            { name: "voter", type: "address", indexed: true },
            { name: "tick", type: "uint256", indexed: true },
            { name: "direction", type: "uint8", indexed: false },
            { name: "amount", type: "uint256", indexed: false },
        ],
    },
    {
        name: "TickFinalized",
        type: "event",
        inputs: [
            { name: "tick", type: "uint256", indexed: true },
            { name: "winningDirection", type: "uint8", indexed: false },
            { name: "lastMover", type: "address", indexed: false },
            { name: "pot", type: "uint256", indexed: false },
        ],
    },
] as const;

// ============ Client Setup ============

// Use foundry chain for local Anvil, baseSepolia for testnet
const chain: Chain = RPC_URL.includes("127.0.0.1") || RPC_URL.includes("localhost")
    ? foundry
    : baseSepolia;

const publicClient: PublicClient = createPublicClient({
    chain,
    transport: http(RPC_URL),
});

let walletClient: WalletClient | null = null;
let operatorAccount: ReturnType<typeof privateKeyToAccount> | null = null;

if (PRIVATE_KEY) {
    operatorAccount = privateKeyToAccount(PRIVATE_KEY);
    walletClient = createWalletClient({
        account: operatorAccount,
        chain,
        transport: http(RPC_URL),
    });
    console.log(`🔑 Operator account: ${operatorAccount.address}`);
}

// ============ Chain Client Interface ============

export const chainClient = {
    chainId: chain.id,
    contractAddress: CONTRACT_ADDRESS || ("0x0" as `0x${string}`),

    /**
     * Get current game state from contract
     */
    async getGameState(): Promise<GameState> {
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: HITBOX_ABI,
            functionName: "getState",
        });

        return {
            currentTick: result[0],
            tickEndTimestamp: result[1],
            timeoutSeconds: result[2],
            lastMoveTimestamp: result[3],
            lastMover: result[4],
            pot: result[5],
            minFee: result[6],
        };
    },

    /**
     * Get vote counts for a specific tick
     */
    async getTickVotes(tick: bigint): Promise<readonly [bigint, bigint, bigint, bigint]> {
        const result = await publicClient.readContract({
            address: this.contractAddress,
            abi: HITBOX_ABI,
            functionName: "getTickVotes",
            args: [tick],
        });
        return result;
    },

    /**
     * Check if a tick has been finalized
     */
    async isTickFinalized(tick: bigint): Promise<boolean> {
        return await publicClient.readContract({
            address: this.contractAddress,
            abi: HITBOX_ABI,
            functionName: "isTickFinalized",
            args: [tick],
        });
    },

    /**
     * Submit finalizeTick transaction
     */
    async finalizeTick(tick: bigint, winningDirection: number): Promise<`0x${string}`> {
        if (!walletClient || !operatorAccount) {
            throw new Error("Wallet not configured - set OPERATOR_PRIVATE_KEY");
        }

        const hash = await walletClient.writeContract({
            address: this.contractAddress,
            abi: HITBOX_ABI,
            functionName: "finalizeTick",
            args: [tick, winningDirection],
            chain,
            account: operatorAccount,
        });

        console.log(`📝 FinalizeTick tx submitted: ${hash}`);

        // Wait for confirmation
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`✅ FinalizeTick confirmed in block ${receipt.blockNumber}`);

        return hash;
    },

    /**
     * Get the latest finalized tick transaction hash (for tie-break)
     */
    async getLatestFinalizedTxHash(): Promise<`0x${string}`> {
        // Query latest TickFinalized event
        const logs = await publicClient.getLogs({
            address: this.contractAddress,
            event: {
                type: "event",
                name: "TickFinalized",
                inputs: [
                    { name: "tick", type: "uint256", indexed: true },
                    { name: "winningDirection", type: "uint8", indexed: false },
                    { name: "lastMover", type: "address", indexed: false },
                    { name: "pot", type: "uint256", indexed: false },
                ],
            },
            fromBlock: "earliest",
            toBlock: "latest",
        });

        if (logs.length === 0) {
            // No prior finalization, use genesis tx hash (placeholder)
            return "0x0000000000000000000000000000000000000000000000000000000000000000";
        }

        return logs[logs.length - 1].transactionHash;
    },
};
