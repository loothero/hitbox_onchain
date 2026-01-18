#!/usr/bin/env tsx
/**
 * Test script to verify voting works directly onchain
 */
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const CONTRACT_ADDRESS = '0x610178da211fef7d417bc0e6fed39f05609ad788' as const;
const RPC_URL = 'http://127.0.0.1:8545';

// Test account (Anvil default account #1)
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

const ABI = [
    {
        name: 'vote',
        type: 'function',
        stateMutability: 'payable',
        inputs: [{ name: 'direction', type: 'uint8' }],
        outputs: [],
    },
    {
        name: 'getTickVotes',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'tick', type: 'uint256' }],
        outputs: [{ name: '', type: 'uint256[4]' }],
    },
    {
        name: 'currentTick',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }],
    },
] as const;

async function main() {
    console.log('🧪 Testing vote submission to contract...\n');

    const account = privateKeyToAccount(PRIVATE_KEY);
    console.log(`Using account: ${account.address}`);

    const publicClient = createPublicClient({
        chain: foundry,
        transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
        account,
        chain: foundry,
        transport: http(RPC_URL),
    });

    // Get current tick
    const currentTick = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'currentTick',
    });
    console.log(`Current tick: ${currentTick}\n`);

    // Check vote counts before
    const votesBefore = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'getTickVotes',
        args: [currentTick],
    });
    console.log(`Votes before: [${votesBefore.join(', ')}]`);

    // Submit a vote for direction 0 (Up)
    console.log('\n📝 Submitting vote for Up (direction 0)...');
    try {
        const hash = await walletClient.writeContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'vote',
            args: [0],
            value: parseEther('0.0001'),
        });

        console.log(`Transaction hash: ${hash}`);
        console.log('⏳ Waiting for confirmation...');

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        console.log(`✅ Confirmed in block ${receipt.blockNumber}`);
        console.log(`   Status: ${receipt.status === 'success' ? 'SUCCESS' : 'FAILED'}`);

        if (receipt.status === 'reverted') {
            console.log('❌ Transaction reverted!');
        }
    } catch (error: any) {
        console.error('❌ Vote submission failed:', error.message);
        if (error.cause) {
            console.error('   Cause:', error.cause);
        }
        process.exit(1);
    }

    // Check vote counts after
    const votesAfter = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: ABI,
        functionName: 'getTickVotes',
        args: [currentTick],
    });
    console.log(`\nVotes after:  [${votesAfter.join(', ')}]`);

    if (votesAfter[0] > votesBefore[0]) {
        console.log('\n✅ Vote successfully recorded onchain!');
    } else {
        console.log('\n❌ Vote was NOT recorded onchain!');
    }
}

main().catch(console.error);
