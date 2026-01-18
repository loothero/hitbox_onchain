import { useReadContract, useWriteContract, useWatchContractEvent } from 'wagmi'
import { HITBOX_POT_ABI, HITBOX_POT_ADDRESS } from './contracts'
import { parseEther } from 'viem'

export function useGameState() {
    const { data, isLoading, refetch } = useReadContract({
        address: HITBOX_POT_ADDRESS,
        abi: HITBOX_POT_ABI,
        functionName: 'getState',
        query: {
            refetchInterval: 1000,
        }
    })

    // Watch for tick finalization to refresh state
    useWatchContractEvent({
        address: HITBOX_POT_ADDRESS,
        abi: HITBOX_POT_ABI,
        eventName: 'TickFinalized',
        onLogs() {
            refetch()
        },
    })

    if (!data) return { isLoading, state: null }

    return {
        isLoading,
        state: {
            currentTick: data[0],
            tickEndTimestamp: Number(data[1]),
            timeoutSeconds: Number(data[2]),
            lastMoveTimestamp: Number(data[3]),
            lastMover: data[4],
            pot: data[5],
            minFee: data[6],
            tickDurationSeconds: Number(data[7]),
        },
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
