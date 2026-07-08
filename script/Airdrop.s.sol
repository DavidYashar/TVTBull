// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RobinhoodChainToken} from "../contracts/RobinhoodChainToken.sol";

/// @title Airdrop tokens to previous minters (4x their minted amount)
/// @notice Before running, set OLD_TOKEN_ADDRESS in .env and
///         generate airdrop.json using the helper script.
contract Airdrop is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address tokenAddr = vm.envAddress("TOKEN_ADDRESS");

        // Read airdrop data from a JSON file
        string memory json = vm.readFile("airdrop.json");
        address[] memory recipients = vm.parseJsonAddressArray(json, ".recipients");
        uint256[] memory amounts = vm.parseJsonUintArray(json, ".amounts");

        console.log("Airdropping to", recipients.length, "recipients");
        console.log("Total tokens:", _sum(amounts));

        vm.startBroadcast(deployerKey);
        RobinhoodChainToken(tokenAddr).airdrop(recipients, amounts);
        vm.stopBroadcast();

        console.log("Airdrop complete.");
    }

    function _sum(uint256[] memory arr) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < arr.length; i++) {
            total += arr[i];
        }
    }
}
