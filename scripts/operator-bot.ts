import { createWalletClient, createPublicClient, http, parseEther, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { foundry } from 'viem/chains'
import { HITBOX_POT_ABI, HITBOX_POT_ADDRESS } from '../client/src/onchain/contracts'

// Anvil default account #0 (Operator)
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')

const client = createPublicClient({
    chain: foundry,
    transport: http('http://127.0.0.1:8545')
})

const wallet = createWalletClient({
    account,
    chain: foundry,
    transport: http('http://127.0.0.1:8545')
})

async function main() {
    console.log("🤖 Hitbox Operator Bot Starting...")
    console.log(`Operator: ${account.address}`)
    console.log(`Contract: ${HITBOX_POT_ADDRESS}`)

    while (true) {
        try {
            // Read state
            const [
                currentTick,
                tickEndTimestamp,
                timeoutSeconds,
                lastMoveTimestamp,
                lastMover,
                pot,
                minFee,
            ] = await client.readContract({
                address: HITBOX_POT_ADDRESS,
                abi: HITBOX_POT_ABI,
                functionName: 'getState',
            })

            const now = Math.floor(Date.now() / 1000)
            const timeLeft = Number(tickEndTimestamp) - now

            if (timeLeft <= 0) {
                console.log(`Tick ${currentTick} ended. Finalizing...`)

                // Get votes to determine winner (naive check)
                const votes = await client.readContract({
                    address: HITBOX_POT_ADDRESS,
                    abi: HITBOX_POT_ABI,
                    functionName: 'getTickVotes',
                    args: [currentTick]
                })

                // Determine winning direction (simple max)
                let winningDir = 0
                let maxVotes = -1
                // Tie-break: Up(0) > Down(1) > Left(2) > Right(3)
                // Just picking strict > logic
                for (let i = 0; i < 4; i++) {
                    const count = Number(votes[i])
                    if (count > maxVotes) {
                        maxVotes = count
                        winningDir = i
                    }
                }

                if (maxVotes === 0) {
                    console.log(`No votes for tick ${currentTick}, skipping finalization (contract will auto-advance on next vote)`)
                    // Optionally we could force a 0-vote finalize, but let's just wait
                } else {
                    console.log(`Finalizing Tick ${currentTick} with Winner: ${winningDir} (Votes: ${maxVotes})`)
                    const hash = await wallet.writeContract({
                        address: HITBOX_POT_ADDRESS,
                        abi: HITBOX_POT_ABI,
                        functionName: 'finalizeTick',
                        args: [currentTick, winningDir]
                    })
                    console.log(`Finalized: ${hash}`)
                }
            } else {
                // console.log(`Tick ${currentTick} active. Time left: ${timeLeft}s`)
            }

        } catch (e) {
            console.error("Loop error:", e)
        }

        // Sleep 1s
        await new Promise(r => setTimeout(r, 1000))
    }
}

main()
