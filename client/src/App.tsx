import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useChainId, usePublicClient } from 'wagmi'
import { useGameState, useVote, useClaim, useCurrentTickVotes } from './onchain/hooks'
import { HITBOX_POT_ABI, HITBOX_POT_ADDRESS } from './onchain/contracts'
import { formatEther } from 'viem'
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Wallet, Coins, Timer, Trophy } from 'lucide-react'
import { EventLog } from './components/EventLog'
import { P5Canvas } from './components/P5Canvas'

function App() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { connect, connectors } = useConnect()
    const { disconnect } = useDisconnect()
    const { state, isLoading } = useGameState()
    
    // Debug: Log chain connection
    useEffect(() => {
        if (isConnected) {
            console.log('Wallet connected to chain:', chainId, 'Expected: 31337 (Anvil)')
            if (chainId !== 31337) {
                console.warn('⚠️ Wallet is not connected to Anvil (31337). Events may not work correctly.')
            }
        }
    }, [isConnected, chainId])
    const { vote, isPending: isVotePending, isSuccess: isVoteSuccess } = useVote()
    const { claim, isPending: isClaimPending } = useClaim()
    const { votes: currentVotes } = useCurrentTickVotes()

    const [timeLeft, setTimeLeft] = useState<number>(0)
    const [timeoutLeft, setTimeoutLeft] = useState<number>(0)
    const [lastWinningDir, setLastWinningDir] = useState<number | null>(null)
    const [coords, setCoords] = useState<{ x: number, y: number }>({ x: 0, y: 0 })
    const [exploredTiles, setExploredTiles] = useState<Set<string>>(new Set())
    const [votedDirection, setVotedDirection] = useState<number | null>(null)
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
    const [isReconstructing, setIsReconstructing] = useState(true)

    const getDirectionName = (dir: number) => {
        switch (dir) {
            case 0: return 'Up'
            case 1: return 'Down'
            case 2: return 'Left'
            case 3: return 'Right'
            default: return 'None'
        }
    }

    const handleVote = (direction: number) => {
        setVotedDirection(direction)
        vote(direction, state ? formatEther(state.minFee) : '0.0001')
    }

    // Show toast on successful vote
    useEffect(() => {
        if (isVoteSuccess && votedDirection !== null) {
            setToast({
                message: `Vote cast for ${getDirectionName(votedDirection)}!`,
                type: 'success'
            })
            setTimeout(() => setToast(null), 3000)
        }
    }, [isVoteSuccess, votedDirection])

    // Clear voted direction on new tick
    useEffect(() => {
        setVotedDirection(null)
    }, [state?.currentTick])

    // Watch for tick finalization to show previous move using viem directly
    const publicClient = usePublicClient({ chainId: 31337 })

    // Reconstruct cursor position from event history on initial load
    useEffect(() => {
        if (!publicClient || !isReconstructing) return

        const reconstructPosition = async () => {
            try {
                console.log('Reconstructing cursor position from event history...')
                const logs = await publicClient.getContractEvents({
                    address: HITBOX_POT_ADDRESS,
                    abi: HITBOX_POT_ABI,
                    eventName: 'TickFinalized',
                    fromBlock: 'earliest',
                    toBlock: 'latest',
                })

                console.log(`Found ${logs.length} TickFinalized events`)

                let x = 0, y = 0
                const explored = new Set<string>()

                logs.forEach((log: any) => {
                    const dir = Number(log.args.winningDirection)
                    if (dir === 0) y -= 1 // Up
                    if (dir === 1) y += 1 // Down
                    if (dir === 2) x -= 1 // Left
                    if (dir === 3) x += 1 // Right

                    // Add tiles to explored set (FOG_RADIUS = 1, so 3x3 around position)
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            explored.add(`${x + dx},${y + dy}`)
                        }
                    }
                })

                // Also explore tiles around starting position (0,0)
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        explored.add(`${dx},${dy}`)
                    }
                }

                console.log(`Reconstructed cursor position: (${x}, ${y}), explored ${explored.size} tiles`)
                setCoords({ x, y })
                setExploredTiles(explored)
                setIsReconstructing(false)
            } catch (error) {
                console.error('Failed to reconstruct position:', error)
                setIsReconstructing(false)
            }
        }

        reconstructPosition()
    }, [publicClient, isReconstructing])

    useEffect(() => {
        if (!publicClient) {
            console.warn('Public client not available for chain 31337')
            return
        }

        console.log('Setting up TickFinalized event watcher in App...')
        const unwatch = publicClient.watchContractEvent({
            address: HITBOX_POT_ADDRESS,
            abi: HITBOX_POT_ABI,
            eventName: 'TickFinalized',
            onLogs(logs) {
                console.log('TickFinalized event received in App:', logs)
                if (logs && logs.length > 0) {
                    const log = logs[0] as any
                    if (log && log.args) {
                        const dir = Number(log.args.winningDirection)
                        console.log('Updating cursor position with direction:', dir)
                        setLastWinningDir(dir)

                        // Update coordinates and explored tiles
                        setCoords(prev => {
                            const next = { ...prev }
                            if (dir === 0) next.y -= 1 // Up
                            if (dir === 1) next.y += 1 // Down
                            if (dir === 2) next.x -= 1 // Left
                            if (dir === 3) next.x += 1 // Right
                            console.log('New coordinates:', next)
                            
                            // Mark new tile as explored
                            const tileKey = `${next.x},${next.y}`
                            setExploredTiles(prevTiles => {
                                const newTiles = new Set(prevTiles)
                                newTiles.add(tileKey)
                                // Also mark surrounding tiles as explored (FOG_RADIUS = 1)
                                for (let dx = -1; dx <= 1; dx++) {
                                    for (let dy = -1; dy <= 1; dy++) {
                                        newTiles.add(`${next.x + dx},${next.y + dy}`)
                                    }
                                }
                                return newTiles
                            })
                            
                            return next
                        })
                    }
                }
            },
            onError(error) {
                console.error('Error watching TickFinalized events in App:', error)
            },
        })

        return () => {
            console.log('Cleaning up TickFinalized event watcher in App')
            unwatch()
        }
    }, [publicClient])

    // Countdown timers - update every second
    useEffect(() => {
        if (!state) {
            setTimeLeft(0)
            setTimeoutLeft(0)
            return
        }

        const updateTimers = () => {
            const now = Math.floor(Date.now() / 1000)
            const tRemaining = Math.max(0, Number(state.tickEndTimestamp) - now)
            const oRemaining = Math.max(0, (Number(state.lastMoveTimestamp) + Number(state.timeoutSeconds)) - now)

            setTimeLeft(tRemaining)
            setTimeoutLeft(oRemaining)
        }

        // Update immediately
        updateTimers()

        // Then update every second
        const interval = setInterval(updateTimers, 1000)

        return () => clearInterval(interval)
    }, [state])

    if (!isConnected) {
        return (
            <div className="landing-page">
                <h1 className="logo-text">Hitbox Onchain</h1>
                <p className="tagline">Collaborative, explorable artwork with onchain coordinate consensus. Connect your wallet to steer the collective cursor.</p>

                <div className="connect-card">
                    {connectors.map((connector) => (
                        <button
                            key={connector.uid}
                            onClick={() => connect({ connector })}
                            className="btn btn-primary"
                        >
                            <Wallet size={20} />
                            Connect with {connector.name}
                        </button>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <div className="header-content">
                    <div className="brand">
                        <div className="brand-logo"></div>
                        <div className="brand-info">
                            <span className="brand-name">Hitbox</span>
                            <span className="cursor-coords">({coords.x}, {coords.y})</span>
                        </div>
                    </div>

                    <div className="user-info">
                        <div className="wallet-meta">
                            <span className="meta-label">Wallet Connected</span>
                            <span className="meta-value">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                        </div>
                        <button
                            onClick={() => disconnect()}
                            className="btn-icon"
                            title="Disconnect"
                        >
                            <Wallet size={20} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Toast Notification */}
            {toast && (
                <div className={`toast toast-${toast.type}`}>
                    {toast.message}
                </div>
            )}

            <main className="app-main">
                {/* Game World Canvas */}
                <section className="game-world-section" style={{ 
                    gridColumn: '1 / -1', 
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'center'
                }}>
                    <div style={{ 
                        background: '#1a1a2e',
                        padding: '20px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
                    }}>
                        <h3 style={{ 
                            color: '#fff', 
                            marginBottom: '10px',
                            textAlign: 'center',
                            fontSize: '18px'
                        }}>
                            Explore the World
                        </h3>
                        <P5Canvas
                            cursorX={coords.x}
                            cursorY={coords.y}
                            exploredTiles={exploredTiles}
                            currentTick={state?.currentTick ? Number(state.currentTick) : 0}
                            pot={state?.pot || 0n}
                            genesisTimestamp={state?.genesisTimestamp}
                            theme="Vaporwave"
                            width={1024}
                            height={1024}
                        />
                    </div>
                </section>

                {/* Pot & Status Column */}
                <section className="status-column">
                    {/* Pot Card */}
                    <div className="pot-card">
                        <div className="pot-bg-icon">
                            <Coins size={120} />
                        </div>
                        <div className="pot-content">
                            <h2 className="label">Current Pot</h2>
                            <div className="amount-display">
                                {state ? formatEther(state.pot) : '0.00'}
                                <span className="unit">ETH</span>
                            </div>
                            <div className="min-fee">
                                <Coins size={14} />
                                Min Vote: {state ? formatEther(state.minFee) : '0.0001'} ETH
                            </div>
                        </div>
                    </div>

                    {/* Timing Card */}
                    <div className="timing-card">
                        <div className="timing-row">
                            <div className="timing-info">
                                <div className="icon-wrapper">
                                    <Timer size={20} />
                                </div>
                                <div>
                                    <h3>Next Move</h3>
                                    <p className="subtext">Tick {state?.currentTick.toString() || '0'}</p>
                                </div>
                            </div>
                            <div className="countdown">{timeLeft}s</div>
                        </div>

                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${state && state.tickDurationSeconds > 0 ? (timeLeft / state.tickDurationSeconds) * 100 : 0}%` }}
                            ></div>
                        </div>

                        {lastWinningDir !== null && (
                            <div className="previous-move-section">
                                <div className="label">Previous Move</div>
                                <div className="value">{getDirectionName(lastWinningDir)}</div>
                            </div>
                        )}

                        <div className="timeout-section">
                            <div className="timeout-row">
                                <span className="label">Timeout Payout</span>
                                <span className={`value ${timeoutLeft === 0 ? 'claimable-badge' : ''}`}>
                                    {timeoutLeft > 0
                                        ? `⏳ ${Math.floor(timeoutLeft / 60)}m ${timeoutLeft % 60}s`
                                        : '🔓 Claimable!'}
                                </span>
                            </div>

                            {/* Timeout Progress Bar */}
                            {state && (
                                <div className="progress-bar timeout-progress">
                                    <div
                                        className="progress-fill timeout-fill"
                                        style={{
                                            width: `${(timeoutLeft / state.timeoutSeconds) * 100}%`
                                        }}
                                    ></div>
                                </div>
                            )}

                            {/* Eligibility Status */}
                            {state && state.lastMover !== '0x0000000000000000000000000000000000000000' ? (
                                <div className="eligibility-status">
                                    <div className="last-mover">
                                        Eligible: <span className="mono">{state.lastMover.slice(0, 8)}...{state.lastMover.slice(-6)}</span>
                                    </div>
                                    {state.lastMover.toLowerCase() === address?.toLowerCase() ? (
                                        <span className="status-badge status-eligible">✅ Last Mover</span>
                                    ) : (
                                        <span className="status-badge status-not-eligible">❌ Not Eligible</span>
                                    )}
                                </div>
                            ) : (
                                <div className="last-mover">
                                    Eligible: <span className="text-secondary italic">No moves yet</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Win Prompt */}
                    {timeoutLeft === 0 && state && state.pot > 0n && state.lastMover.toLowerCase() === address?.toLowerCase() && (
                        <button
                            onClick={() => claim()}
                            disabled={isClaimPending}
                            className="btn-claim pulse"
                        >
                            <Trophy size={20} />
                            CLAIM THE POT
                        </button>
                    )}
                </section>

                {/* Voting Panel */}
                <section className="voting-panel">
                    <div className="panel-card">
                        <div className="panel-header">
                            <h2 className="title">Steer the Cursor</h2>
                            <p className="description">Winning direction moves the shared cursor at the end of each tick.</p>
                        </div>

                        <div className="controls-wrapper">
                            <div className="directional-grid">
                                <div></div>
                                <button
                                    onClick={() => handleVote(0)}
                                    disabled={isVotePending || !state}
                                    className={`dir-btn ${votedDirection === 0 ? 'voted' : ''}`}
                                >
                                    <ArrowUp size={32} />
                                    <span className="vote-count">{currentVotes[0]}</span>
                                </button>
                                <div></div>

                                <button
                                    onClick={() => handleVote(2)}
                                    disabled={isVotePending || !state}
                                    className={`dir-btn ${votedDirection === 2 ? 'voted' : ''}`}
                                >
                                    <ArrowLeft size={32} />
                                    <span className="vote-count">{currentVotes[2]}</span>
                                </button>
                                <div className="cursor-indicator">
                                    <div className="ping"></div>
                                    <div className="coord-overlay">({coords.x}, {coords.y})</div>
                                </div>
                                <button
                                    onClick={() => handleVote(3)}
                                    disabled={isVotePending || !state}
                                    className={`dir-btn ${votedDirection === 3 ? 'voted' : ''}`}
                                >
                                    <ArrowRight size={32} />
                                    <span className="vote-count">{currentVotes[3]}</span>
                                </button>

                                <div></div>
                                <button
                                    onClick={() => handleVote(1)}
                                    disabled={isVotePending || !state}
                                    className={`dir-btn ${votedDirection === 1 ? 'voted' : ''}`}
                                >
                                    <ArrowDown size={32} />
                                    <span className="vote-count">{currentVotes[1]}</span>
                                </button>
                                <div></div>
                            </div>
                        </div>

                        <div className="pro-tip">
                            <span className="highlight">Pro Tip:</span> Each vote costs {state ? formatEther(state.minFee) : '0.0001'} ETH. Higher vote counts for a single direction guarantee the move. Be the last one moving to claim the pot!
                        </div>
                    </div>
                </section>

                {/* Event Log Sidebar */}
                <aside className="event-log-sidebar">
                    <EventLog />
                </aside>

            </main>

            {/* Footer */}
            <footer className="app-footer">
                &copy; 2026 Hitbox Onchain &bull; Powered by Base &bull; Always Decentralized
            </footer>
        </div>
    )
}

export default App
