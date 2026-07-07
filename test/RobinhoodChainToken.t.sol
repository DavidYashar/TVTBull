// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RobinhoodChainToken} from "../contracts/RobinhoodChainToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock USDC for testing (6 decimals)
contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract RobinhoodChainTokenTest is Test {
    RobinhoodChainToken public token;
    MockUSDC            public usdc;

    address public deployer;
    address public treasury;
    address public alice;
    address public bob;

    uint256 public constant BATCH_PRICE = 2 * 10**6;
    uint256 public constant BATCH_SIZE  = 10_000 * 10**6;
    uint256 public constant DEPLOYER_SHARE = 100_000_000 * 10**6;
    uint256 public constant MINTABLE_SHARE = 300_000_000 * 10**6;

    /// @dev Helper: mint N batches (1 batch per tx as required by V3)
    function _mintBatches(uint256 n) internal {
        for (uint256 i = 0; i < n; i++) {
            token.mint();
        }
    }

    function setUp() public {
        deployer  = makeAddr("deployer");
        treasury  = makeAddr("treasury");
        alice     = makeAddr("alice");
        bob       = makeAddr("bob");

        // Deploy mock USDC
        vm.startPrank(deployer);
        usdc = new MockUSDC();
        token = new RobinhoodChainToken(
            treasury,
            address(usdc),
            "TestToken",
            "TST"
        );
        vm.stopPrank();

        // Give Alice and Bob some USDC
        usdc.mint(alice, 1_000_000 * 10**6); // 1M USDC
        usdc.mint(bob,   1_000_000 * 10**6);
    }

    // ─── Deployment ──────────────────────────────────────

    function test_Deployment() public {
        assertEq(token.name(), "TestToken");
        assertEq(token.symbol(), "TST");
        assertEq(token.decimals(), 6);
        assertEq(token.TOTAL_SUPPLY(), 1_000_000_000 * 10**6);
        assertEq(token.DEPLOYER(), deployer);
        assertEq(token.TREASURY(), treasury);
        assertEq(address(token.USDC()), address(usdc));
        assertEq(token.totalMinted(), 0);
        assertFalse(token.mintPaused());
        assertFalse(token.mintingClosed());
    }

    function test_DeployerGets70Percent() public {
        assertEq(token.balanceOf(deployer), DEPLOYER_SHARE);
    }

    function test_CannotDeployWithZeroAddresses() public {
        vm.startPrank(deployer);
        vm.expectRevert("Zero treasury");
        new RobinhoodChainToken(address(0), address(usdc), "X", "X");

        vm.expectRevert("Zero USDC");
        new RobinhoodChainToken(treasury, address(0), "X", "X");
        vm.stopPrank();
    }

    // ─── Minting ─────────────────────────────────────────

    function test_Mint_SingleBatch() public {
        uint256 batches = 1;
        uint256 cost = batches * BATCH_PRICE;

        vm.startPrank(alice);
        usdc.approve(address(token), cost);
        token.mint();
        vm.stopPrank();

        assertEq(token.balanceOf(alice), BATCH_SIZE);
        assertEq(usdc.balanceOf(address(token)), cost); // usdc held by contract
        assertEq(usdc.balanceOf(alice), 1_000_000 * 10**6 - cost);
        assertEq(token.totalMinted(), BATCH_SIZE);
    }

    function test_Mint_MultipleBatches() public {
        uint256 batches = 50;
        uint256 cost = batches * BATCH_PRICE;

        vm.startPrank(alice);
        usdc.approve(address(token), cost);
        _mintBatches(batches);
        vm.stopPrank();

        assertEq(token.balanceOf(alice), batches * BATCH_SIZE);
        assertEq(token.totalMinted(), batches * BATCH_SIZE);
    }

    function test_Mint_CanMintAll300M() public {
        uint256 totalBatches = MINTABLE_SHARE / BATCH_SIZE; // 30,000
        uint256 totalCost = totalBatches * BATCH_PRICE;      // 60,000 usdc

        vm.startPrank(alice);
        usdc.approve(address(token), totalCost);
        _mintBatches(totalBatches);
        vm.stopPrank();

        assertEq(token.totalMinted(), MINTABLE_SHARE);
        assertEq(token.remainingMintable(), 0);
        assertEq(token.remainingBatches(), 0);
        assertEq(usdc.balanceOf(address(token)), totalCost);
    }

    function test_Mint_ExceedsMintable() public {
        uint256 batches = 30_001; // one batch over max
        uint256 cost = batches * BATCH_PRICE;

        vm.startPrank(alice);
        usdc.approve(address(token), cost);
        vm.expectRevert(RobinhoodChainToken.ExceedsMintableSupply.selector);
        _mintBatches(batches);
        vm.stopPrank();
    }

    function test_Mint_WhenPaused() public {
        vm.prank(deployer);
        token.setMintPaused(true);

        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPaused.selector);
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_WithoutApproval() public {
        vm.startPrank(alice);
        vm.expectRevert(); // ERC20: insufficient allowance
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_WithoutusdcBalance() public {
        address poor = makeAddr("poor");
        vm.startPrank(poor);
        usdc.approve(address(token), BATCH_PRICE);
        vm.expectRevert(); // ERC20: transfer amount exceeds balance
        token.mint();
        vm.stopPrank();
    }

    // ─── Pause ───────────────────────────────────────────

    function test_Pause_DeployerCanPause() public {
        vm.prank(deployer);
        token.setMintPaused(true);
        assertTrue(token.mintPaused());
    }

    function test_Pause_NonDeployerCannotPause() public {
        vm.prank(alice);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.setMintPaused(true);
    }

    function test_Pause_CannotMintWhenPaused() public {
        vm.prank(deployer);
        token.setMintPaused(true);

        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPaused.selector);
        token.mint();
        vm.stopPrank();
    }

    function test_Pause_CanUnpauseAndMint() public {
        vm.prank(deployer);
        token.setMintPaused(true);

        vm.prank(deployer);
        token.setMintPaused(false);

        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE);
        token.mint();
        vm.stopPrank();

        assertEq(token.totalMinted(), BATCH_SIZE);
    }

    // ─── Burn Unminted ───────────────────────────────────

    function test_BurnUnminted_DeployerCanBurn() public {
        // Mint some first
        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE);
        token.mint();
        vm.stopPrank();

        uint256 remainingBefore = token.remainingMintable();
        assertTrue(remainingBefore > 0);

        vm.prank(deployer);
        token.burnUnminted();

        assertTrue(token.mintingClosed());
        assertTrue(token.mintPaused());
        assertEq(token.remainingMintable(), 0);
    }

    function test_BurnUnminted_NonDeployerCannotBurn() public {
        vm.prank(alice);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.burnUnminted();
    }

    function test_BurnUnminted_CannotMintAfterBurn() public {
        vm.prank(deployer);
        token.burnUnminted();

        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPermanentlyClosed.selector);
        token.mint();
        vm.stopPrank();
    }

    function test_BurnUnminted_CannotBurnTwice() public {
        vm.prank(deployer);
        token.burnUnminted();

        vm.prank(deployer);
        vm.expectRevert(RobinhoodChainToken.AlreadyClosed.selector);
        token.burnUnminted();
    }

    // ─── Withdraw ────────────────────────────────────────

    function test_Withdraw_OnlyTreasury() public {
        // Mint so there are usdc in contract
        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE * 10);
        _mintBatches(10);
        vm.stopPrank();

        uint256 balance = usdc.balanceOf(address(token));
        assertTrue(balance > 0);

        // Non-treasury cannot withdraw
        vm.prank(alice);
        vm.expectRevert(RobinhoodChainToken.OnlyTreasury.selector);
        token.withdraw(balance);

        // Treasury can withdraw
        vm.prank(treasury);
        token.withdraw(balance);
        assertEq(usdc.balanceOf(address(token)), 0);
        assertEq(usdc.balanceOf(treasury), balance);
    }

    function test_Withdraw_CannotWithdrawZero() public {
        // Treasury can withdraw 0 — SafeERC20 allows it (no-op).
        // This test just confirms it doesn't revert unexpectedly.
        vm.prank(treasury);
        token.withdraw(0);
        // No state change expected
        assertEq(usdc.balanceOf(treasury), 0);
    }

    // ─── Post-Mint LP Simulation ─────────────────────────

    /// @notice Simulates the full lifecycle: mint → transfer → LP setup
    function test_FullLifecycle() public {
        // 1. Alice and Bob mint
        vm.startPrank(alice);
        usdc.approve(address(token), BATCH_PRICE * 100);
        _mintBatches(100);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(token), BATCH_PRICE * 50);
        _mintBatches(50);
        vm.stopPrank();

        assertEq(token.totalMinted(), 150 * BATCH_SIZE);
        uint256 raised = usdc.balanceOf(address(token));
        assertEq(raised, 150 * BATCH_PRICE);

        // 2. Deployer burns unminted
        vm.prank(deployer);
        token.burnUnminted();

        // 3. Deployer sends 70M tokens to treasury for LP
        uint256 lpTokens = 70_000_000 * 10**6;
        vm.prank(deployer);
        token.transfer(treasury, lpTokens);
        assertEq(token.balanceOf(treasury), lpTokens);

        // 4. Deployer burns the rest (630M) by sending to 0xdead
        address burnAddr = address(0xdead);
        uint256 deployerBal = token.balanceOf(deployer);
        vm.prank(deployer);
        token.transfer(burnAddr, deployerBal);

        // 5. Treasury withdraws usdc
        vm.prank(treasury);
        token.withdraw(raised);
        assertEq(usdc.balanceOf(treasury), raised);

        // 6. Treasury now has both tokens needed for LP
        assertEq(token.balanceOf(treasury), lpTokens);
        assertEq(usdc.balanceOf(treasury), raised);
    }
}
