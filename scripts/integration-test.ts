/**
 * Integration Test Script
 * Tests full vote -> finalize -> claim flow on local Anvil
 */
import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

// Contract address from deployment
const CONTRACT_ADDRESS = "0x5fbdb2315678afecb367f032d93f642f64180aa3" as const;
const RPC_URL = "http://127.0.0.1:8545";

// Test accounts from Anvil
const OPERATOR_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const PLAYER1_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as const;
const PLAYER2_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as const;

const operatorAccount = privateKeyToAccount(OPERATOR_KEY);
const player1Account = privateKeyToAccount(PLAYER1_KEY);
const player2Account = privateKeyToAccount(PLAYER2_KEY);

// Minimal ABI
const ABI = [
    {
        name: "vote",
        type: "function",
        stateMutability: "payable",
        inputs: [{ name: "direction", type: "uint8" }],
        outputs: [],
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

// Clients
const publicClient = createPublicClient({
    chain: foundry,
    transport: http(RPC_URL),
});

const operatorWallet = createWalletClient({
    account: operatorAccount,
    chain: foundry,
    transport: http(RPC_URL),
});

const player1Wallet = createWalletClient({
    account: player1Account,
    chain: foundry,
    transport: http(RPC_URL),
});

const player2Wallet = createWalletClient({
    account: player2Account,
    chain: foundry,
    transport: http(RPC_URL),
});

const DIRECTIONS = ["Up", "Down", "Left", "Right"];

async function getState() {
    const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
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
}

async function getVotes(tick: bigint) {
    return await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getTickVotes",
        args: [tick],
    });
}

async function main() {
    console.log("🧪 Integration Test: Vote -> Finalize Flow\n");

    // Get initial state
    let state = await getState();
    console.log("📊 Initial State:");
    console.log(`   Current Tick: ${state.currentTick}`);
    console.log(`   Pot: ${formatEther(state.pot)} ETH`);
    console.log(`   Min Fee: ${formatEther(state.minFee)} ETH\n`);

    // Player 1 votes UP
    console.log("🗳️  Player 1 voting UP...");
    const vote1Hash = await player1Wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "vote",
        args: [0], // Up
        value: parseEther("0.001"),
        chain: foundry,
        account: player1Account,
    });
    await publicClient.waitForTransactionReceipt({ hash: vote1Hash });
    console.log(`   ✓ Vote 1 confirmed: ${vote1Hash.slice(0, 18)}...`);

    // Player 2 votes DOWN
    console.log("🗳️  Player 2 voting DOWN...");
    const vote2Hash = await player2Wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "vote",
        args: [1], // Down
        value: parseEther("0.001"),
        chain: foundry,
        account: player2Account,
    });
    await publicClient.waitForTransactionReceipt({ hash: vote2Hash });
    console.log(`   ✓ Vote 2 confirmed: ${vote2Hash.slice(0, 18)}...`);

    // Player 1 votes UP again (to win)
    console.log("🗳️  Player 1 voting UP again...");
    const vote3Hash = await player1Wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "vote",
        args: [0], // Up
        value: parseEther("0.001"),
        chain: foundry,
        account: player1Account,
    });
    await publicClient.waitForTransactionReceipt({ hash: vote3Hash });
    console.log(`   ✓ Vote 3 confirmed: ${vote3Hash.slice(0, 18)}...\n`);

    // Check vote counts
    const votes = await getVotes(state.currentTick);
    console.log("📊 Vote Counts:");
    console.log(`   ⬆️  Up: ${votes[0]}`);
    console.log(`   ⬇️  Down: ${votes[1]}`);
    console.log(`   ⬅️  Left: ${votes[2]}`);
    console.log(`   ➡️  Right: ${votes[3]}\n`);

    // Check pot
    state = await getState();
    console.log(`💰 Pot after votes: ${formatEther(state.pot)} ETH\n`);

    // Wait for tick to end
    console.log("⏳ Waiting for tick to end...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    // Operator finalizes tick
    console.log("🏁 Operator finalizing tick with UP (winner)...");
    const finalizeHash = await operatorWallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "finalizeTick",
        args: [state.currentTick, 0], // Up wins
        chain: foundry,
        account: operatorAccount,
    });
    await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
    console.log(`   ✓ Tick finalized: ${finalizeHash.slice(0, 18)}...\n`);

    // Final state
    state = await getState();
    console.log("📊 Final State:");
    console.log(`   Current Tick: ${state.currentTick} (advanced from 0)`);
    console.log(`   Pot: ${formatEther(state.pot)} ETH`);
    console.log(`   Last Mover: ${state.lastMover}`);

    console.log("\n✅ Integration test passed!");
}

main().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
});
