// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {HitboxPot} from "../src/HitboxPot.sol";

contract HitboxPotTest is Test {
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
    }

    // ============ Vote Tests ============

    function test_VoteSucceeds() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0); // Up

        assertEq(hitbox.pot(), MIN_FEE);
        assertEq(hitbox.getTickVotes(0)[0], 1);
    }

    function test_VoteEmitsEvent() public {
        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit HitboxPot.VoteCast(player1, 0, 0, MIN_FEE);
        hitbox.vote{value: MIN_FEE}(0);
    }

    function test_VoteRevertsInvalidDirection() public {
        vm.prank(player1);
        vm.expectRevert(HitboxPot.InvalidDirection.selector);
        hitbox.vote{value: MIN_FEE}(4);
    }

    function test_VoteRevertsInsufficientFee() public {
        vm.prank(player1);
        vm.expectRevert(HitboxPot.InsufficientFee.selector);
        hitbox.vote{value: MIN_FEE - 1}(0);
    }

    function test_MultipleVotesSameTick() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0); // Up

        vm.prank(player2);
        hitbox.vote{value: MIN_FEE}(1); // Down

        assertEq(hitbox.pot(), MIN_FEE * 2);
        assertEq(hitbox.getTickVotes(0)[0], 1);
        assertEq(hitbox.getTickVotes(0)[1], 1);
    }

    // ============ Gas Tests ============

    function test_VoteGasUsage() public {
        vm.prank(player1);
        uint256 gasBefore = gasleft();
        hitbox.vote{value: MIN_FEE}(0);
        uint256 gasUsed = gasBefore - gasleft();
        
        console.log("Gas used for vote:", gasUsed);
        assertTrue(gasUsed < 200000, "Gas used should be less than 200k");
    }

    function test_AdvanceTickGasUsage_LargeSkip() public {
        // Warp forward 100 ticks (300 seconds)
        vm.warp(block.timestamp + 300);

        vm.prank(player1);
        uint256 gasBefore = gasleft();
        hitbox.vote{value: MIN_FEE}(0);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Gas used for vote after 100 skipped ticks:", gasUsed);
        // Should still be O(1) ~ similar cost to normal vote
        assertTrue(gasUsed < 200000, "Gas used after skipping ticks should be less than 200k");
    }

    // ============ Finalize Tests ============

    function test_FinalizeTickSucceeds() public {
        // Cast vote
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        // Advance time past tick end
        vm.warp(block.timestamp + TICK_DURATION + 1);

        // Finalize
        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        assertTrue(hitbox.isTickFinalized(0));
        assertEq(hitbox.currentTick(), 1);
    }

    function test_FinalizeEmitsEvent() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit HitboxPot.TickFinalized(0, 0, operator, MIN_FEE);
        hitbox.finalizeTick(0, 0);
    }

    function test_FinalizeRevertsNotOperator() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(player1);
        vm.expectRevert(HitboxPot.NotOperator.selector);
        hitbox.finalizeTick(0, 0);
    }

    function test_FinalizeRevertsNoVotes() public {
        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        vm.expectRevert(HitboxPot.NoVotesInTick.selector);
        hitbox.finalizeTick(0, 0);
    }

    function test_FinalizeRevertsAlreadyFinalized() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        vm.prank(operator);
        vm.expectRevert(HitboxPot.InvalidTick.selector);
        hitbox.finalizeTick(0, 0);
    }

    // ============ Claim Tests ============

    function test_ClaimSucceeds() public {
        // Cast vote and finalize
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        // Wait for timeout
        vm.warp(block.timestamp + TIMEOUT + 1);

        // Claim (operator is lastMover in MVP)
        uint256 balanceBefore = operator.balance;
        vm.prank(operator);
        hitbox.claim();

        assertEq(hitbox.pot(), 0);
        assertEq(operator.balance, balanceBefore + MIN_FEE);
    }

    function test_ClaimEmitsEvent() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        vm.warp(block.timestamp + TIMEOUT + 1);

        vm.prank(operator);
        vm.expectEmit(true, false, false, true);
        emit HitboxPot.Claimed(operator, MIN_FEE);
        hitbox.claim();
    }

    function test_ClaimRevertsTimeoutNotReached() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        // Try claim before timeout
        vm.prank(operator);
        vm.expectRevert(HitboxPot.TimeoutNotReached.selector);
        hitbox.claim();
    }

    function test_ClaimRevertsNotLastMover() public {
        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        vm.warp(block.timestamp + TIMEOUT + 1);

        vm.prank(player1);
        vm.expectRevert(HitboxPot.NotLastMover.selector);
        hitbox.claim();
    }

    // ============ View Function Tests ============

    function test_GetState() public view {
        (
            uint256 _currentTick,
            uint256 _tickEndTimestamp,
            uint256 _timeoutSeconds,
            uint256 _lastMoveTimestamp,
            address _lastMover,
            uint256 _pot,
            uint256 _minFee,
            uint256 _tickDurationSeconds
        ) = hitbox.getState();

        assertEq(_currentTick, 0);
        assertEq(_timeoutSeconds, TIMEOUT);
        assertEq(_pot, 0);
        assertEq(_minFee, MIN_FEE);
        assertEq(_tickDurationSeconds, TICK_DURATION);
    }

    function test_IsClaimable() public {
        assertFalse(hitbox.isClaimable());

        vm.prank(player1);
        hitbox.vote{value: MIN_FEE}(0);

        vm.warp(block.timestamp + TICK_DURATION + 1);

        vm.prank(operator);
        hitbox.finalizeTick(0, 0);

        assertFalse(hitbox.isClaimable());

        vm.warp(block.timestamp + TIMEOUT + 1);

        assertTrue(hitbox.isClaimable());
    }

    // ============ Invariant: Pot Accounting ============

    function testFuzz_PotAccounting(uint8 numVotes) public {
        vm.assume(numVotes > 0 && numVotes <= 50);

        uint256 totalPaid = 0;
        for (uint8 i = 0; i < numVotes; i++) {
            address voter = address(uint160(100 + i));
            vm.deal(voter, 1 ether);
            vm.prank(voter);
            hitbox.vote{value: MIN_FEE}(i % 4);
            totalPaid += MIN_FEE;
        }

        assertEq(hitbox.pot(), totalPaid);
        assertEq(address(hitbox).balance, totalPaid);
    }
}
