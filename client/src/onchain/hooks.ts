import { useReadContract, useWriteContract, usePublicClient } from 'wagmi'
import { HITBOX_POT_ABI, HITBOX_POT_ADDRESS } from './contracts'
import { parseEther } from 'viem'
import { useState, useEffect } from 'react'

export function useGameState() {
    const publicClient = usePublicClient({ chainId: 31337 })
    const { data, isLoading, refetch } = useReadContract({
        address: HITBOX_POT_ADDRESS,
        abi: HITBOX_POT_ABI,
        functionName: 'getState',
        chainId: 31337, // Anvil chain ID
        query: {
            refetchInterval: 1000,
        }
    })

    // Get genesis timestamp (public state variable getter)
    const { data: genesisTimestamp } = useReadContract({
        address: HITBOX_POT_ADDRESS,
        abi: HITBOX_POT_ABI,
        functionName: 'genesisTimestamp',
        chainId: 31337,
    })

    // Watch for tick finalization to refresh state using viem directly
    useEffect(() => {
        if (!publicClient) {
            console.warn('Public client not available for chain 31337')
            return
        }

        console.log('Setting up TickFinalized event watcher...')
        const unwatch = publicClient.watchContractEvent({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            eventName: 'TickFinalized',
            onLogs(logs) {
                console.log('TickFinalized event detected via viem, refreshing state', logs)
                refetch()
            },
            onError(error) {
                console.error('Error watching TickFinalized events:', error)
            },
        })

        return () => {
            console.log('Cleaning up TickFinalized event watcher')
            unwatch()
        }
    }, [publicClient, refetch])

    if (!data) return { isLoading, state: null }

    return {
        isLoading,
        state: data ? {
            currentTick: data[0],
            tickEndTimestamp: Number(data[1]),
            timeoutSeconds: Number(data[2]),
            lastMoveTimestamp: Number(data[3]),
            lastMover: data[4],
            pot: data[5],
            minFee: data[6],
            tickDurationSeconds: Number(data[7]),
            genesisTimestamp: genesisTimestamp ? Number(genesisTimestamp) : undefined,
        } : null,
        refetch
    }
}

export function useVote() {
    const { writeContract, isPending, isSuccess, error } = useWriteContract()

    const vote = (direction: number, amount: string = '0.0001') => {
        writeContract({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            functionName: 'vote',
            args: [direction],
            value: parseEther(amount),
        })
    }

    return { vote, isPending, isSuccess, error }
}

export function useClaim() {
    const { writeContract, isPending, isSuccess, error } = useWriteContract()

    const claim = () => {
        writeContract({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            functionName: 'claim',
        })
    }

    return { claim, isPending, isSuccess, error }
}

/**
 * Hook to poll current tick vote counts from aggregator API
 */
export function useCurrentTickVotes() {
    const [votes, setVotes] = useState<[number, number, number, number]>([0, 0, 0, 0])
    const [isLoading, setIsLoading] = useState(true)
    const AGGREGATOR_URL = 'http://localhost:3001'

    useEffect(() => {
        const fetchVotes = async () => {
            try {
                const response = await fetch(`${AGGREGATOR_URL}/votes/current`)
                const data = await response.json()
                setVotes([
                    Number(data.votes.up),
                    Number(data.votes.down),
                    Number(data.votes.left),
                    Number(data.votes.right),
                ])
                setIsLoading(false)
            } catch (error) {
                console.error('Failed to fetch vote counts:', error)
                setIsLoading(false)
            }
        }

        // Initial fetch
        fetchVotes()

        // Poll every 500ms
        const interval = setInterval(fetchVotes, 500)
        return () => clearInterval(interval)
    }, [])

    return { votes, isLoading }
}
