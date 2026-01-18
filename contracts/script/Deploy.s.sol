// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {HitboxPot} from "../src/HitboxPot.sol";

contract DeployHitboxPot is Script {
    function setUp() public {}

    function run() public {
        // Load deployment config from environment
        uint256 tickDuration = vm.envOr("TICK_DURATION", uint256(60));
        uint256 timeout = vm.envOr("TIMEOUT_SECONDS", uint256(3600));
        uint256 minFee = vm.envOr("MIN_FEE", uint256(0.0001 ether));
        address operator = vm.envOr("OPERATOR", msg.sender);

        console.log("Deploying HitboxPot with:");
        console.log("  Tick Duration:", tickDuration);
        console.log("  Timeout:", timeout);
        console.log("  Min Fee:", minFee);
        console.log("  Operator:", operator);

        vm.startBroadcast();

        HitboxPot hitbox = new HitboxPot(
            tickDuration,
            timeout,
            minFee,
            operator
        );

        console.log("HitboxPot deployed at:", address(hitbox));

        vm.stopBroadcast();
    }
}
