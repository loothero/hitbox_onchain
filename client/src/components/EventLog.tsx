import { useGameEvents, GameEvent } from '../hooks/useGameEvents'
import { Vote, CheckCircle, Trophy } from 'lucide-react'

/**
 * EventLog component - Displays a scrollable history of game events
 * Shows VoteCast, TickFinalized, and Claimed events in real-time
 */
export function EventLog() {
    const { events } = useGameEvents(50)

    const getRelativeTime = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000)

        if (seconds < 5) return 'just now'
        if (seconds < 60) return `${seconds}s ago`

        const minutes = Math.floor(seconds / 60)
        if (minutes < 60) return `${minutes}m ago`

        const hours = Math.floor(minutes / 60)
        return `${hours}h ago`
    }

    const getEventIcon = (type: GameEvent['type']) => {
        switch (type) {
            case 'vote':
                return <Vote size={16} />
            case 'finalized':
                return <CheckCircle size={16} />
            case 'claimed':
                return <Trophy size={16} />
        }
    }

    const getEventClass = (type: GameEvent['type']) => {
        switch (type) {
            case 'vote':
                return 'event-vote'
            case 'finalized':
                return 'event-finalized'
            case 'claimed':
                return 'event-claimed'
        }
    }

    return (
        <div className="event-log">
            <div className="event-log-header">
                <h3>Session History</h3>
                <span className="event-count">{events.length} events</span>
            </div>

            <div className="event-list">
                {events.length === 0 ? (
                    <div className="event-empty">
                        <p>No events yet</p>
                        <span>Cast a vote to get started!</span>
                    </div>
                ) : (
                    events.map((event) => (
                        <div key={event.id} className={`event-item ${getEventClass(event.type)}`}>
                            <div className="event-icon">
                                {getEventIcon(event.type)}
                            </div>
                            <div className="event-content">
                                <div className="event-message">{event.message}</div>
                                <div className="event-time">{getRelativeTime(event.timestamp)}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
