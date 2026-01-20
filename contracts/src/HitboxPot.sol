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
 *
 * Storage Optimization:
 * - All hot-path state packed into single 256-bit GameState struct (Slot 0)
 * - vote() requires only 1 SSTORE
 * - finalizeTick() requires only 2 SSTOREs
 * - claim() requires only 2 SSTOREs
 * - Mappings eliminated; historical data available via events
 */
contract HitboxPot {
    // ============ Types ============

    /// @notice Packed game state - fits in single storage slot (256 bits)
    /// @dev Layout: pot(64) + votesUp(32) + votesDown(32) + votesLeft(32) + votesRight(32) + currentTick(32) + lastMoveTimestamp(32) = 256 bits
    struct GameState {
        uint64 pot; // Max ~18.4 ETH (sufficient for this use case)
        uint32 votesUp; // Max ~4B votes per direction
        uint32 votesDown;
        uint32 votesLeft;
        uint32 votesRight;
        uint32 currentTick; // Max ~4B ticks (~400 years at 3s/tick)
        uint32 lastMoveTimestamp; // Unix timestamp, works until year 2106
    }

    // ============ Reentrancy Guard ============

    uint8 private constant NOT_ENTERED = 1;
    uint8 private constant ENTERED = 2;

    // ============ Storage Layout ============
    // Slot 0: GameState (256 bits) - all hot-path data
    // Slot 1: lastMover (160 bits) + _status (8 bits) = 168 bits used
    // Slot 2: operator (160 bits)

    /// @notice Packed game state - single SLOAD/SSTORE for vote()
    GameState private _state;

    /// @notice Address eligible to claim pot after timeout
    address public lastMover;

    /// @notice Reentrancy guard status (packed with lastMover in Slot 1)
    uint8 private _status;

    /// @notice Address allowed to finalize ticks
    address public operator;

    // ============ Immutables ============

    /// @notice Duration of each tick window in seconds
    uint256 public immutable tickDurationSeconds;

    /// @notice Seconds of inactivity before claim is allowed
    uint256 public immutable timeoutSeconds;

    /// @notice Minimum fee required per vote
    uint256 public immutable minFee;

    /// @notice Game start timestamp (genesis) - used to derive tickEndTimestamp
    uint256 public immutable genesisTimestamp;

    // ============ Errors ============

    error InvalidDirection();
    error TickNotActive();
    error InvalidTick();
    error InsufficientFee();
    error NotOperator();
    error TimeoutNotReached();
    error NotLastMover();
    error NoPotToClaim();
    error TransferFailed();
    error NoVotesInTick();
    error ReentrantCall();
    error PotOverflow();

    // ============ Events ============

    /// @notice Emitted when a vote is cast
    event VoteCast(address indexed voter, uint256 indexed tick, uint8 direction, uint256 amount);

    /// @notice Emitted when a tick is finalized
    event TickFinalized(uint256 indexed tick, uint8 winningDirection, address lastMover, uint256 pot);

    /// @notice Emitted when the pot is claimed
    event Claimed(address indexed winner, uint256 amount);

    // ============ Constants ============

    uint8 public constant DIRECTION_UP = 0;
    uint8 public constant DIRECTION_DOWN = 1;
    uint8 public constant DIRECTION_LEFT = 2;
    uint8 public constant DIRECTION_RIGHT = 3;
    uint8 public constant NUM_DIRECTIONS = 4;

    // ============ Modifiers ============

    modifier nonReentrant() {
        if (_status == ENTERED) revert ReentrantCall();
        _status = ENTERED;
        _;
        _status = NOT_ENTERED;
    }

    // ============ Constructor ============

    /**
     * @param _tickDurationSeconds Length of each tick window
     * @param _timeoutSeconds Inactivity threshold for claim
     * @param _minFee Minimum payment per vote
     * @param _operator Address allowed to finalize ticks
     */
    constructor(uint256 _tickDurationSeconds, uint256 _timeoutSeconds, uint256 _minFee, address _operator) {
        tickDurationSeconds = _tickDurationSeconds;
        timeoutSeconds = _timeoutSeconds;
        minFee = _minFee;
        operator = _operator;
        genesisTimestamp = block.timestamp;

        // Initialize state
        _state = GameState({
            pot: 0,
            votesUp: 0,
            votesDown: 0,
            votesLeft: 0,
            votesRight: 0,
            currentTick: 0,
            lastMoveTimestamp: uint32(block.timestamp)
        });

        _status = NOT_ENTERED;
    }

    // ============ Core Functions ============

    /**
     * @notice Submit a paid vote for a direction
     * @dev Optimized: single SSTORE for all state changes
     * @param direction Movement direction (0=Up, 1=Down, 2=Left, 3=Right)
     */
    function vote(uint8 direction) external payable {
        // Validate inputs
        if (direction >= NUM_DIRECTIONS) revert InvalidDirection();
        if (msg.value < minFee) revert InsufficientFee();

        // Single SLOAD for all game state
        GameState memory state = _state;

        // Derive current tick end timestamp
        uint256 tickEnd = genesisTimestamp + (uint256(state.currentTick) + 1) * tickDurationSeconds;

        // Check if tick has advanced - reset votes if so
        if (block.timestamp >= tickEnd) {
            // Reset votes for new tick
            state.votesUp = 0;
            state.votesDown = 0;
            state.votesLeft = 0;
            state.votesRight = 0;

            // Calculate how many ticks to advance
            uint256 elapsed = block.timestamp - tickEnd;
            uint256 skipped = elapsed / tickDurationSeconds;
            state.currentTick += uint32(1 + skipped);

            // Recalculate tick end for new tick
            tickEnd = genesisTimestamp + (uint256(state.currentTick) + 1) * tickDurationSeconds;
        }

        // Validate tick is still active
        if (block.timestamp >= tickEnd) revert TickNotActive();

        // Check for pot overflow (uint64 max ~18.4 ETH)
        uint256 newPot = uint256(state.pot) + msg.value;
        if (newPot > type(uint64).max) revert PotOverflow();

        // Update pot
        state.pot = uint64(newPot);

        // Increment vote count for direction
        if (direction == 0) {
            state.votesUp++;
        } else if (direction == 1) {
            state.votesDown++;
        } else if (direction == 2) {
            state.votesLeft++;
        } else {
            state.votesRight++;
        }

        // Single SSTORE for all state changes
        _state = state;

        emit VoteCast(msg.sender, state.currentTick, direction, msg.value);
    }

    /**
     * @notice Finalize a tick with the winning direction
     * @dev Optimized: 2 SSTOREs (state + lastMover)
     * @param tick The tick number to finalize
     * @param winningDirection The direction that won the vote
     */
    function finalizeTick(uint256 tick, uint8 winningDirection) external {
        // Validate caller
        if (msg.sender != operator) revert NotOperator();
        if (winningDirection >= NUM_DIRECTIONS) revert InvalidDirection();

        // Single SLOAD
        GameState memory state = _state;

        // Validate tick number matches current tick
        if (tick != state.currentTick) revert InvalidTick();

        // Calculate tick end and validate timing
        uint256 tickEnd = genesisTimestamp + (uint256(state.currentTick) + 1) * tickDurationSeconds;
        if (block.timestamp < tickEnd) revert TickNotActive();

        // Validate votes exist
        uint256 totalVotes = uint256(state.votesUp) + state.votesDown + state.votesLeft + state.votesRight;
        if (totalVotes == 0) revert NoVotesInTick();

        // Cache pot for event
        uint64 currentPot = state.pot;

        // Reset votes and advance tick
        state.votesUp = 0;
        state.votesDown = 0;
        state.votesLeft = 0;
        state.votesRight = 0;
        state.currentTick += 1;
        state.lastMoveTimestamp = uint32(block.timestamp);

        // SSTORE #1: Update game state
        _state = state;

        // SSTORE #2: Update last mover
        lastMover = msg.sender;

        emit TickFinalized(tick, winningDirection, msg.sender, currentPot);
    }

    /**
     * @notice Claim the pot after timeout
     * @dev Optimized: 2 SSTOREs (state + lastMover)
     */
    function claim() external nonReentrant {
        // Single SLOAD
        GameState memory state = _state;

        // Validate timeout has passed
        if (block.timestamp <= uint256(state.lastMoveTimestamp) + timeoutSeconds) {
            revert TimeoutNotReached();
        }

        // Validate caller is last mover
        if (msg.sender != lastMover) revert NotLastMover();

        // Validate pot has funds
        if (state.pot == 0) revert NoPotToClaim();

        // Cache payout and reset pot
        uint256 payout = state.pot;
        state.pot = 0;

        // SSTORE #1: Update game state (pot = 0)
        _state = state;

        // SSTORE #2: Reset last mover
        lastMover = address(0);

        // Transfer pot to winner (interactions last)
        (bool success,) = msg.sender.call{value: payout}("");
        if (!success) revert TransferFailed();

        emit Claimed(msg.sender, payout);
    }

    // ============ View Functions ============

    /// @notice Get current pot value
    function pot() external view returns (uint256) {
        return _state.pot;
    }

    /// @notice Get current tick number
    function currentTick() external view returns (uint256) {
        return _state.currentTick;
    }

    /// @notice Get timestamp of last finalized tick
    function lastMoveTimestamp() external view returns (uint256) {
        return _state.lastMoveTimestamp;
    }

    /// @notice Get timestamp when current tick window ends (derived, not stored)
    function tickEndTimestamp() external view returns (uint256) {
        return genesisTimestamp + (uint256(_state.currentTick) + 1) * tickDurationSeconds;
    }

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
        GameState memory state = _state;
        return (
            state.currentTick,
            genesisTimestamp + (uint256(state.currentTick) + 1) * tickDurationSeconds,
            timeoutSeconds,
            state.lastMoveTimestamp,
            lastMover,
            state.pot,
            minFee,
            tickDurationSeconds
        );
    }

    /**
     * @notice Get vote counts for a specific tick
     * @dev Returns current tick votes only; historical data via events
     * @param tick The tick number to query
     */
    function getTickVotes(uint256 tick) external view returns (uint256[4] memory) {
        GameState memory state = _state;
        if (tick != state.currentTick) {
            return [uint256(0), uint256(0), uint256(0), uint256(0)];
        }
        return [uint256(state.votesUp), uint256(state.votesDown), uint256(state.votesLeft), uint256(state.votesRight)];
    }

    /**
     * @notice Check if a tick has been finalized
     * @dev Tick is finalized if it's less than currentTick
     * @param tick The tick number to query
     */
    function isTickFinalized(uint256 tick) external view returns (bool) {
        return tick < _state.currentTick;
    }

    /**
     * @notice Check if claim is currently available
     */
    function isClaimable() external view returns (bool) {
        GameState memory state = _state;
        return (lastMover != address(0) && state.pot > 0
                && block.timestamp > uint256(state.lastMoveTimestamp) + timeoutSeconds);
    }

    /**
     * @notice Get remaining time in current tick
     */
    function getTickTimeRemaining() external view returns (uint256) {
        uint256 tickEnd = genesisTimestamp + (uint256(_state.currentTick) + 1) * tickDurationSeconds;
        if (block.timestamp >= tickEnd) return 0;
        return tickEnd - block.timestamp;
    }

    /**
     * @notice Get remaining time until timeout
     */
    function getTimeoutRemaining() external view returns (uint256) {
        uint256 timeoutEnd = uint256(_state.lastMoveTimestamp) + timeoutSeconds;
        if (block.timestamp >= timeoutEnd) return 0;
        return timeoutEnd - block.timestamp;
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
