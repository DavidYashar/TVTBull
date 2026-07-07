// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RobinhoodChainToken} from "../contracts/RobinhoodChainToken.sol";

contract DeployToken is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        string memory name = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");

        console.log("Deployer:", vm.addr(deployerKey));
        console.log("Treasury:", treasury);
        console.log("USDG:", usdc);
        console.log("Name:", name);
        console.log("Symbol:", symbol);

        vm.startBroadcast(deployerKey);
        RobinhoodChainToken token = new RobinhoodChainToken(treasury, usdc, name, symbol);
        vm.stopBroadcast();

        console.log("Deployed to:", address(token));
    }
}
