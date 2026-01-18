#!/usr/bin/env tsx
/**
 * Test rapid voting to catch an active tick
 */
import { createWalletClient, createPublicClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';

const CONTRACT_ADDRESS = '0x610178da211fef7d417bc0e6fed39f05609ad788' as const;
const RPC_URL = 'http://127.0.0.1:8545';
const PRIVATE_KEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as const;

const ABI = [
    { name: 'vote', type: 'function', stateMutability: 'payable', inputs: [{ name: 'direction', type: 'uint8' }], outputs: [] },
    { name: 'getTickVotes', type: 'function', stateMutability: 'view', inputs: [{ name: 'tick', type: 'uint256' }], outputs: [{ name: '', type: 'uint256[4]' }] },
    { name: 'currentTick', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    { name: 'tickEndTimestamp', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
] as const;

async function main() {
    console.log('🚀 Rapid vote test - voting multiple times quickly\n');

    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: foundry, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: foundry, transport: http(RPC_URL) });

    // Vote 3 times rapidly for different directions
    const directions = [0, 1, 2]; // Up, Down, Left

    for (let i = 0; i < directions.length; i++) {
        const dir = directions[i];
        const dirName = ['Up', 'Down', 'Left'][dir];

        console.log(`\n📝 Vote ${i + 1}: ${dirName} (direction ${dir})`);

        const tickBefore = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: ABI,
            functionName: 'currentTick',
        });

        console.log(`   Current tick: ${tickBefore}`);

        try {
            const hash = await walletClient.writeContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'vote',
                args: [dir],
                value: parseEther('0.0001'),
            });

            await publicClient.waitForTransactionReceipt({ hash });
            console.log(`   ✅ Confirmed`);

            const tickAfter = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'currentTick',
            });

            const votes = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: ABI,
                functionName: 'getTickVotes',
                args: [tickAfter],
            });

            console.log(`   Tick after: ${tickAfter}`);
            console.log(`   Votes on tick ${tickAfter}: [${votes.join(', ')}]`);
        } catch (error: any) {
            console.error(`   ❌ Failed:`, error.message);
        }

        // Small delay between votes
        await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n✅ Done! Check if aggregator finalizes the tick...');
}

main().catch(console.error);
