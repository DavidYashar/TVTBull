// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {RobinhoodChainToken} from "../contracts/RobinhoodChainToken.sol";

/// @title Deploy RobinhoodChainToken to Robinhood Chain Testnet
/// @notice Usage:
///   forge script script/Deploy.s.sol:DeployTestnet \
///     --rpc-url $RH_RPC_URL \
///     --broadcast \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --verify \
///     --verifier blockscout \
///     --verifier-url https://explorer.testnet.chain.robinhood.com/api/
contract DeployTestnet is Script {
    function run() external {
        // ─── Load from env ───────────────────────────────
        address treasury     = vm.envAddress("TREASURY_ADDRESS");
        address usdc         = vm.envAddress("USDC_ADDRESS");
        string memory name   = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");
        uint256 deployerKey  = vm.envUint("DEPLOYER_PRIVATE_KEY");

        console.log("=== Deploying RobinhoodChainToken to Testnet ===");
        console.log("Chain ID:       46630");
        console.log("Treasury:      ", treasury);
        console.log("USDC:          ", usdc);
        console.log("Token Name:    ", name);
        console.log("Token Symbol:  ", symbol);
        console.log("Deployer:      ", vm.addr(deployerKey));
        console.log("");

        vm.startBroadcast(deployerKey);

        RobinhoodChainToken token = new RobinhoodChainToken(
            treasury,
            usdc,
            name,
            symbol
        );

        vm.stopBroadcast();

        console.log("=== Deployed ===");
        console.log("Token Address:", address(token));
        console.log("");

        // ─── Verification checks ─────────────────────────
        console.log("Total Supply:  ", token.TOTAL_SUPPLY());
        console.log("Deployer Share:", token.DEPLOYER_SHARE());
        console.log("Mintable Share:", token.MINTABLE_SHARE());
        console.log("Batch Size:    ", token.BATCH_SIZE());
        console.log("Batch Price:   ", token.BATCH_PRICE());
        console.log("Deployer Bal:  ", token.balanceOf(vm.addr(deployerKey)));
        console.log("Treasury:      ", token.TREASURY());
        console.log("Deployer Role: ", token.DEPLOYER());
    }
}

/// @title Deploy to Robinhood Chain Mainnet
contract DeployMainnet is Script {
    function run() external {
        address treasury     = vm.envAddress("TREASURY_ADDRESS");
        address usdc         = vm.envAddress("USDC_ADDRESS");
        string memory name   = vm.envString("TOKEN_NAME");
        string memory symbol = vm.envString("TOKEN_SYMBOL");
        uint256 deployerKey  = vm.envUint("DEPLOYER_PRIVATE_KEY");

        console.log("=== Deploying RobinhoodChainToken to MAINNET ===");
        console.log("Chain ID:       4663");
        console.log("Treasury:      ", treasury);
        console.log("USDC:          ", usdc);

        vm.startBroadcast(deployerKey);

        RobinhoodChainToken token = new RobinhoodChainToken(
            treasury,
            usdc,
            name,
            symbol
        );

        vm.stopBroadcast();

        console.log("Token Address:", address(token));
    }
}
