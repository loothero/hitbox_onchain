import { useState, useEffect } from 'react'
import { usePublicClient } from 'wagmi'
import { HITBOX_POT_ABI, HITBOX_POT_ADDRESS } from '../onchain/contracts'
import { formatEther } from 'viem'

export interface GameEvent {
    id: string
    type: 'vote' | 'finalized' | 'claimed'
    timestamp: number
    message: string
    data: any
}

/**
 * Hook to aggregate and track all game events from the contract
 * Listens to VoteCast, TickFinalized, and Claimed events
 */
export function useGameEvents(maxEvents: number = 50) {
    const [events, setEvents] = useState<GameEvent[]>([])
    const publicClient = usePublicClient({ chainId: 31337 })

    const getDirectionName = (dir: number) => {
        const names = ['Up', 'Down', 'Left', 'Right']
        return names[dir] || 'Unknown'
    }

    // Watch VoteCast events using viem directly
    useEffect(() => {
        if (!publicClient) return

        const unwatch = publicClient.watchContractEvent({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            eventName: 'VoteCast',
            onLogs(logs) {
                const newEvents = logs.map((log: any) => {
                    const voter = log.args.voter as string
                    const direction = Number(log.args.direction)
                    const amount = log.args.amount

                    return {
                        id: `${log.blockNumber}-${log.transactionHash}-${log.logIndex}`,
                        type: 'vote' as const,
                        timestamp: Date.now(),
                        message: `${voter.slice(0, 6)}...${voter.slice(-4)} voted ${getDirectionName(direction)} (${formatEther(amount)} ETH)`,
                        data: { voter, direction, amount },
                    }
                })

                setEvents(prev => [...newEvents, ...prev].slice(0, maxEvents))
            },
        })

        return () => unwatch()
    }, [publicClient, maxEvents])

    // Watch TickFinalized events using viem directly
    useEffect(() => {
        if (!publicClient) return

        const unwatch = publicClient.watchContractEvent({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            eventName: 'TickFinalized',
            onLogs(logs) {
                const newEvents = logs.map((log: any) => {
                    const tick = log.args.tick?.toString() || '0'
                    const direction = Number(log.args.winningDirection)
                    const pot = log.args.pot

                    return {
                        id: `${log.blockNumber}-${log.transactionHash}-${log.logIndex}`,
                        type: 'finalized' as const,
                        timestamp: Date.now(),
                        message: `Tick ${tick} finalized → ${getDirectionName(direction)} wins! (Pot: ${formatEther(pot)} ETH)`,
                        data: { tick, direction, pot },
                    }
                })

                setEvents(prev => [...newEvents, ...prev].slice(0, maxEvents))
            },
        })

        return () => unwatch()
    }, [publicClient, maxEvents])

    // Watch Claimed events using viem directly
    useEffect(() => {
        if (!publicClient) return

        const unwatch = publicClient.watchContractEvent({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            eventName: 'Claimed',
            onLogs(logs) {
                const newEvents = logs.map((log: any) => {
                    const winner = log.args.winner as string
                    const amount = log.args.amount

                    return {
                        id: `${log.blockNumber}-${log.transactionHash}-${log.logIndex}`,
                        type: 'claimed' as const,
                        timestamp: Date.now(),
                        message: `${winner.slice(0, 6)}...${winner.slice(-4)} claimed ${formatEther(amount)} ETH pot!`,
                        data: { winner, amount },
                    }
                })

                setEvents(prev => [...newEvents, ...prev].slice(0, maxEvents))
            },
        })

        return () => unwatch()
    }, [publicClient, maxEvents])

    return { events }
}
