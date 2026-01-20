// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {HitboxPot} from "../../src/HitboxPot.sol";

/// @title Gas Measurement Tests
/// @notice Dedicated tests for gas profiling. No assertions - measurement only.
/// @dev Run with: forge test --gas-report --match-path test/gas/Gas.t.sol
contract GasTest is Test {
    HitboxPot public hitbox;
    address public operator = address(1);
    address public player1 = address(2);
    address public player2 = address(3);

    uint256 constant TICK_DURATION = 3;
    uint256 constant TIMEOUT = 60;
    uint256 constant MIN_FEE = 0.0001 ether;

    function setUp() public {
        hitbox = new HitboxPot(TICK_DURATION, TIMEOUT, MIN_FEE, operator);
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
        vm.deal(operator, 10 ether);
    }

    /// @notice Measure gas for first vote in a fresh tick (cold storage)
    function test_gas_vote_cold() public {
        vm.prank(player1);
        uint256 gasBefore = gasleft();
        hitbox.vote{value: MIN_FEE}(0);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("gas_vote_cold:", gasUsed);
    }

    /// @notice Measure gas for subsequent vote in same tick (warm storage)
    function test_gas_vote_warm() public {
        // First vote to warm storage
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        // Measure second vote
        vm.prank(player2);
        uint256 gasBefore = gasleft();
        hitbox.vote{value: MIN_FEE}(1);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("gas_vote_warm:", gasUsed);
    }

    /// @notice Measure gas for vote after skipping 100 ticks
    function test_gas_vote_after_skip() public {
        // Warp forward 100 ticks
        vm.warp(block.timestamp + TICK_DURATION * 100);

        vm.prank(player1);
        uint256 gasBefore = gasleft();
        hitbox.vote{value: MIN_FEE}(0);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("gas_vote_after_skip_100:", gasUsed);
    }

    /// @notice Measure gas for tick finalization
    function test_gas_finalizeTick() public {
        // Setup: cast votes
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);
        vm.prank(player2);
        hitbox.vote{value: MIN_FEE}(1);

        // Advance past tick end
        vm.warp(block.timestamp + TICK_DURATION + 1);

        // Measure finalization
        vm.prank(operator);
        uint256 gasBefore = gasleft();
        hitbox.finalizeTick(0, 0);
        uint256 gasUsed = gasBefore - gasleft();
        console.log("gas_finalizeTick:", gasUsed);
    }

    /// @notice Measure gas for pot claim
    function test_gas_claim() public {
        // Setup: vote and finalize
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        // Wait for timeout
        vm.warp(block.timestamp + TIMEOUT + 1);

        // Measure claim
        vm.prank(operator);
        uint256 gasBefore = gasleft();
        hitbox.claim();
        uint256 gasUsed = gasBefore - gasleft();
        console.log("gas_claim:", gasUsed);
    }

    /// @notice Measure gas for vote with different directions (all 4)
    function test_gas_vote_all_directions() public {
        address[4] memory players;
        for (uint256 i = 0; i < 4; i++) {
            players[i] = address(uint160(100 + i));
            vm.deal(players[i], 1 ether);
        }

        uint256[4] memory gasUsed;

        for (uint8 dir = 0; dir < 4; dir++) {
            vm.prank(players[dir]);
            uint256 gasBefore = gasleft();
            hitbox.vote{value: MIN_FEE}(dir);
            gasUsed[dir] = gasBefore - gasleft();
        }

        console.log("gas_vote_dir_0 (Up):", gasUsed[0]);
        console.log("gas_vote_dir_1 (Down):", gasUsed[1]);
        console.log("gas_vote_dir_2 (Left):", gasUsed[2]);
        console.log("gas_vote_dir_3 (Right):", gasUsed[3]);
    }
}
