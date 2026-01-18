/**
 * Integration Test: Timeout + Claim Flow
 * Tests the complete game loop including pot claim after timeout
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

const operatorAccount = privateKeyToAccount(OPERATOR_KEY);
const player1Account = privateKeyToAccount(PLAYER1_KEY);

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
        name: "claim",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [],
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
        name: "isClaimable",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "getTimeoutRemaining",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "Claimed",
        type: "event",
        inputs: [
            { name: "winner", type: "address", indexed: true },
            { name: "amount", type: "uint256", indexed: false },
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

async function isClaimable(): Promise<boolean> {
    return await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "isClaimable",
    });
}

async function getTimeoutRemaining(): Promise<bigint> {
    return await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "getTimeoutRemaining",
    });
}

async function main() {
    console.log("🧪 Integration Test: Timeout + Claim Flow\n");
    console.log("⚠️  Note: This test uses Anvil's time manipulation\n");

    // Get initial state
    let state = await getState();
    console.log("📊 Initial State:");
    console.log(`   Current Tick: ${state.currentTick}`);
    console.log(`   Pot: ${formatEther(state.pot)} ETH`);
    console.log(`   Timeout: ${state.timeoutSeconds} seconds\n`);

    // Step 1: Cast a vote
    console.log("🗳️  Player 1 voting UP...");
    const voteHash = await player1Wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "vote",
        args: [0], // Up
        value: parseEther("0.005"),
        chain: foundry,
        account: player1Account,
    });
    await publicClient.waitForTransactionReceipt({ hash: voteHash });
    console.log(`   ✓ Vote confirmed (0.005 ETH)\n`);

    // Step 2: Wait for tick and finalize
    console.log("⏳ Waiting for tick to end...");
    await new Promise((resolve) => setTimeout(resolve, 4000));

    state = await getState();
    console.log("🏁 Operator finalizing tick...");
    const finalizeHash = await operatorWallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "finalizeTick",
        args: [state.currentTick, 0], // Up wins
        chain: foundry,
        account: operatorAccount,
    });
    await publicClient.waitForTransactionReceipt({ hash: finalizeHash });
    console.log(`   ✓ Tick finalized\n`);

    // Step 3: Check timeout state before warp
    state = await getState();
    let remaining = await getTimeoutRemaining();
    let claimable = await isClaimable();
    console.log("📊 After Finalization:");
    console.log(`   Pot: ${formatEther(state.pot)} ETH`);
    console.log(`   Last Mover: ${state.lastMover}`);
    console.log(`   Timeout Remaining: ${remaining} seconds`);
    console.log(`   Is Claimable: ${claimable}\n`);

    // Step 4: Use Anvil's evm_increaseTime to skip the timeout
    console.log("⏩ Fast-forwarding time past timeout (using Anvil RPC)...");

    // Increase time by timeout + 1 second
    const timeToSkip = Number(state.timeoutSeconds) + 10;
    await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "evm_increaseTime",
            params: [timeToSkip],
            id: 1,
        }),
    });

    // Mine a block to apply the time change
    await fetch(RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "evm_mine",
            params: [],
            id: 2,
        }),
    });
    console.log(`   ✓ Time advanced by ${timeToSkip} seconds\n`);

    // Step 5: Check claimability
    claimable = await isClaimable();
    remaining = await getTimeoutRemaining();
    console.log("📊 After Time Warp:");
    console.log(`   Timeout Remaining: ${remaining} seconds`);
    console.log(`   Is Claimable: ${claimable}\n`);

    if (!claimable) {
        console.log("❌ Claim not available - test failed");
        process.exit(1);
    }

    // Step 6: Operator claims the pot
    console.log("💰 Operator (last mover) claiming pot...");

    const balanceBefore = await publicClient.getBalance({
        address: operatorAccount.address
    });

    const claimHash = await operatorWallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: "claim",
        chain: foundry,
        account: operatorAccount,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
    console.log(`   ✓ Claim tx confirmed: ${claimHash.slice(0, 18)}...`);

    // Check final state
    const balanceAfter = await publicClient.getBalance({
        address: operatorAccount.address
    });
    state = await getState();

    // Calculate net gain (accounting for gas)
    const gasUsed = receipt.gasUsed * receipt.effectiveGasPrice;
    const netGain = balanceAfter - balanceBefore + gasUsed;

    console.log(`\n📊 Final State:`);
    console.log(`   Pot: ${formatEther(state.pot)} ETH (should be 0)`);
    console.log(`   Last Mover: ${state.lastMover} (should be 0x0...)`);
    console.log(`   Operator received: ~${formatEther(netGain)} ETH`);

    if (state.pot === 0n) {
        console.log("\n✅ Timeout + Claim test passed!");
        console.log("   - Vote accumulated in pot");
        console.log("   - Tick finalized successfully");
        console.log("   - Claim executed after timeout");
        console.log("   - Pot emptied correctly");
    } else {
        console.log("\n❌ Test failed - pot not emptied");
        process.exit(1);
    }
}

main().catch((error) => {
    console.error("❌ Test failed:", error);
    process.exit(1);
});
