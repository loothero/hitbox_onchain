// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HitboxPot
 * @notice Core escrow and settlement contract for Hitbox Onchain
 * @dev Manages paid voting, tick finalization, and pot claims
 *
 * Players pay to vote on cursor movement directions during tick windows.
 * An aggregator finalizes each tick, selecting the winning direction.
 * If no move occurs before timeout, the last mover can claim the pot.
 */
contract HitboxPot {
    // ============ Reentrancy Guard ============

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;
    uint256 private _status = NOT_ENTERED;

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrantCall();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }
    // ============ Errors ============

    error InvalidDirection();
    error TickNotActive();
    error TickAlreadyFinalized();
    error InvalidTick();
    error InsufficientFee();
    error NotOperator();
    error TimeoutNotReached();
    error NotLastMover();
    error NoPotToClaim();
    error TransferFailed();
    error NoVotesInTick();
    error ReentrantCall();

    // ============ Events ============

    /// @notice Emitted when a vote is cast
    event VoteCast(
        address indexed voter,
        uint256 indexed tick,
        uint8 direction,
        uint256 amount
    );

    /// @notice Emitted when a tick is finalized
    event TickFinalized(
        uint256 indexed tick,
        uint8 winningDirection,
        address lastMover,
        uint256 pot
    );

    /// @notice Emitted when the pot is claimed
    event Claimed(address indexed winner, uint256 amount);

    // ============ Constants ============

    uint8 public constant DIRECTION_UP = 0;
    uint8 public constant DIRECTION_DOWN = 1;
    uint8 public constant DIRECTION_LEFT = 2;
    uint8 public constant DIRECTION_RIGHT = 3;
    uint8 public constant NUM_DIRECTIONS = 4;

    // ============ State Variables ============
    // Storage layout optimized for gas efficiency
    // Slot 0: pot (256 bits) - needs full range for ETH amounts
    // Slot 1: currentTick (256 bits) - needs full range for long-running games
    // Slot 2: lastMover (160) + lastMoveTimestamp (48) + tickEndTimestamp (48) = 256 bits
    // Slot 3: operator (160 bits) + 96 bits spare

    /// @notice Total pot accumulated from votes
    uint256 public pot;

    /// @notice Current active tick number
    uint256 public currentTick;

    /// @notice Address eligible to claim pot after timeout
    address public lastMover;
    /// @notice Timestamp of last finalized tick with votes (packed, uint48 good until year 8.9M)
    uint48 public lastMoveTimestamp;
    /// @notice Timestamp when current tick window ends (packed)
    uint48 public tickEndTimestamp;

    /// @notice Address allowed to finalize ticks
    address public operator;

    /// @notice Duration of each tick window in seconds
    uint256 public immutable tickDurationSeconds;

    /// @notice Seconds of inactivity before claim is allowed
    uint256 public immutable timeoutSeconds;

    /// @notice Minimum fee required per vote
    uint256 public immutable minFee;

    /// @notice Game start timestamp (genesis)
    uint256 public immutable genesisTimestamp;

    // ============ Vote Tracking ============

    /// @notice Vote counts per tick: tick => [up, down, left, right]
    mapping(uint256 => uint256[4]) public tickVotes;

    /// @notice Whether a tick has been finalized
    mapping(uint256 => bool) public tickFinalized;

    // ============ Constructor ============

    /**
     * @param _tickDurationSeconds Length of each tick window
     * @param _timeoutSeconds Inactivity threshold for claim
     * @param _minFee Minimum payment per vote
     * @param _operator Address allowed to finalize ticks
     */
    constructor(
        uint256 _tickDurationSeconds,
        uint256 _timeoutSeconds,
        uint256 _minFee,
        address _operator
    ) {
        tickDurationSeconds = _tickDurationSeconds;
        timeoutSeconds = _timeoutSeconds;
        minFee = _minFee;
        operator = _operator;

        genesisTimestamp = block.timestamp;
        tickEndTimestamp = uint48(block.timestamp + _tickDurationSeconds);
        lastMoveTimestamp = uint48(block.timestamp);
        currentTick = 0;
    }

    // ============ Core Functions ============

    /**
     * @notice Submit a paid vote for a direction
     * @param direction Movement direction (0=Up, 1=Down, 2=Left, 3=Right)
     */
    function vote(uint8 direction) external payable {
        // Validate direction
        if (direction >= NUM_DIRECTIONS) revert InvalidDirection();

        // Validate fee
        if (msg.value < minFee) revert InsufficientFee();

        // Advance tick if needed
        _advanceTickIfNeeded();

        // Validate tick is still active
        if (block.timestamp >= tickEndTimestamp) revert TickNotActive();

        // Record vote
        tickVotes[currentTick][direction] += 1;
        pot += msg.value;

        // Update last mover info in real-time (packed in same slot)
        lastMover = msg.sender;
        lastMoveTimestamp = uint48(block.timestamp);

        emit VoteCast(msg.sender, currentTick, direction, msg.value);
    }

    /**
     * @notice Finalize a tick with the winning direction
     * @dev Only callable by operator. Must be called after tick ends.
     * @param tick The tick number to finalize
     * @param winningDirection The direction that won the vote
     */
    function finalizeTick(uint256 tick, uint8 winningDirection) external {
        // Only operator can finalize
        if (msg.sender != operator) revert NotOperator();

        // Validate direction
        if (winningDirection >= NUM_DIRECTIONS) revert InvalidDirection();

        // Validate tick
        if (tick != currentTick) revert InvalidTick();

        // Ensure tick window has ended
        if (block.timestamp < tickEndTimestamp) revert TickNotActive();

        // Ensure not already finalized
        if (tickFinalized[tick]) revert TickAlreadyFinalized();

        // Get vote counts
        uint256[4] memory counts = tickVotes[tick];
        uint256 totalVotes = counts[0] + counts[1] + counts[2] + counts[3];

        // Require at least one vote
        if (totalVotes == 0) revert NoVotesInTick();

        // Mark as finalized
        tickFinalized[tick] = true;

        // Update last mover info
        lastMover = msg.sender; // In MVP, operator is credited; in production, track actual voter
        lastMoveTimestamp = uint48(block.timestamp);

        // Advance to next tick
        currentTick += 1;
        tickEndTimestamp = uint48(block.timestamp + tickDurationSeconds);

        emit TickFinalized(tick, winningDirection, lastMover, pot);
    }

    /**
     * @notice Claim the pot after timeout
     * @dev Only last mover can claim, only after timeout period
     */
    function claim() external nonReentrant {
        // Validate timeout has passed
        if (block.timestamp <= lastMoveTimestamp + timeoutSeconds) {
            revert TimeoutNotReached();
        }

        // Validate caller is last mover
        if (msg.sender != lastMover) revert NotLastMover();

        // Validate pot has funds
        uint256 payout = pot;
        if (payout == 0) revert NoPotToClaim();

        // Reset pot before transfer (checks-effects-interactions)
        pot = 0;

        // Transfer pot to winner
        (bool success, ) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, payout);

        // Reset lastMover so claim can't be called again
        lastMover = address(0);
    }

    // ============ View Functions ============

    /**
     * @notice Get current game state
     */
    function getState()
        external
        view
        returns (
            uint256 _currentTick,
            uint256 _tickEndTimestamp,
            uint256 _timeoutSeconds,
            uint256 _lastMoveTimestamp,
            address _lastMover,
            uint256 _pot,
            uint256 _minFee,
            uint256 _tickDurationSeconds
        )
    {
        return (
            currentTick,
            tickEndTimestamp,
            timeoutSeconds,
            lastMoveTimestamp,
            lastMover,
            pot,
            minFee,
            tickDurationSeconds
        );
    }

    /**
     * @notice Get vote counts for a specific tick
     * @param tick The tick number to query
     */
    function getTickVotes(uint256 tick) external view returns (uint256[4] memory) {
        return tickVotes[tick];
    }

    /**
     * @notice Check if a tick has been finalized
     * @param tick The tick number to query
     */
    function isTickFinalized(uint256 tick) external view returns (bool) {
        return tickFinalized[tick] || tick < currentTick;
    }

    /**
     * @notice Check if claim is currently available
     */
    function isClaimable() external view returns (bool) {
        return (
            lastMover != address(0) &&
            pot > 0 &&
            block.timestamp > lastMoveTimestamp + timeoutSeconds
        );
    }

    /**
     * @notice Get remaining time in current tick
     */
    function getTickTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= tickEndTimestamp) return 0;
        return tickEndTimestamp - block.timestamp;
    }

    /**
     * @notice Get remaining time until timeout
     */
    function getTimeoutRemaining() external view returns (uint256) {
        uint256 timeoutEnd = lastMoveTimestamp + timeoutSeconds;
        if (block.timestamp >= timeoutEnd) return 0;
        return timeoutEnd - block.timestamp;
    }

    // ============ Internal Functions ============

    /**
     * @dev Advance tick if the current tick window has passed
     */
    function _advanceTickIfNeeded() internal {
        if (block.timestamp >= tickEndTimestamp) {
            // Check if strict advancement is needed (finalize current tick)
            if (!tickFinalized[currentTick]) {
                tickFinalized[currentTick] = true;
            }
            
            // Calculate how many ticks to skip
            // We already confirmed timestamp >= end, so we are at least 1 tick ahead
            uint256 timeSinceEnd = block.timestamp - tickEndTimestamp;
            uint256 ticksToSkip = timeSinceEnd / tickDurationSeconds;
            
            // Steps = 1 (active tick ended) + skipped intervals
            uint256 steps = 1 + ticksToSkip;
            
            currentTick += steps;
            tickEndTimestamp = uint48(uint256(tickEndTimestamp) + steps * tickDurationSeconds);
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the operator address
     * @param newOperator New operator address
     */
    function setOperator(address newOperator) external {
        if (msg.sender != operator) revert NotOperator();
        operator = newOperator;
    }
}
