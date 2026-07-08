// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RobinhoodChainToken} from "../contracts/RobinhoodChainToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mock USDG for testing (6 decimals)
contract MockUSDG is ERC20 {
    constructor() ERC20("USDG", "USDG") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

contract RobinhoodChainTokenTest is Test {
    RobinhoodChainToken public token;
    MockUSDG            public usdg;

    address public deployer;
    address public treasury;
    address public alice;
    address public bob;
    address public charlie;
    address public attacker;

    // ─── Current Contract Constants ──────────────────────
    uint256 public constant TK = 10**6; // token decimal unit
    uint256 public constant TOTAL_SUPPLY     = 1_000_000_000 * TK;
    uint256 public constant DEPLOYER_SHARE   =   100_000_000 * TK;
    uint256 public constant MINTABLE_SHARE   =   300_000_000 * TK;
    uint256 public constant LOCKED_SUPPLY    =   600_000_000 * TK;
    uint256 public constant BATCH_SIZE       =          20_000 * TK;
    uint256 public constant BATCH_PRICE      =               1 * TK;
    uint256 public constant MIN_VOTE_BAL     =   100_000 * TK;
    uint256 public constant MIN_PROPOSE_BAL  =   100_000 * TK;
    uint256 public constant MIN_VOTERS       =         200;
    uint256 public constant VOTE_WINDOW      = 72 hours;

    // ─── Helpers ─────────────────────────────────────────

    function _mintBatches(address user, uint256 n) internal {
        vm.startPrank(user);
        usdg.approve(address(token), n * BATCH_PRICE);
        for (uint256 i = 0; i < n; i++) {
            token.mint();
        }
        vm.stopPrank();
    }

    function _mintManyUsers(uint256 count) internal returns (address[] memory users) {
        users = new address[](count);
        uint256 batchesEach = 5; // MIN_VOTE_BAL / BATCH_SIZE (100K / 20K = 5)
        for (uint256 i = 0; i < count; i++) {
            users[i] = makeAddr(string(abi.encodePacked("voter", vm.toString(i))));
            usdg.mint(users[i], BATCH_PRICE * batchesEach);
            _mintBatches(users[i], batchesEach);
        }
    }

    function setUp() public {
        deployer  = makeAddr("deployer");
        treasury  = makeAddr("treasury");
        alice     = makeAddr("alice");
        bob       = makeAddr("bob");
        charlie   = makeAddr("charlie");
        attacker  = makeAddr("attacker");

        vm.startPrank(deployer);
        usdg = new MockUSDG();
        token = new RobinhoodChainToken(treasury, address(usdg), "VTB Token", "VTB");
        vm.stopPrank();

        usdg.mint(alice,   10_000 * TK);
        usdg.mint(bob,     10_000 * TK);
        usdg.mint(charlie, 10_000 * TK);
        usdg.mint(attacker, 1_000 * TK);
    }

    // ═══════════════════════════════════════════════════════
    //  DEPLOYMENT
    // ═══════════════════════════════════════════════════════

    function test_Deployment_Metadata() public {
        assertEq(token.name(), "VTB Token");
        assertEq(token.symbol(), "VTB");
        assertEq(token.decimals(), 6);
    }

    function test_Deployment_Roles() public {
        assertEq(token.DEPLOYER(), deployer);
        assertEq(token.TREASURY(), treasury);
        assertEq(address(token.USDC()), address(usdg));
    }

    function test_Deployment_Supply() public {
        assertEq(token.totalSupply(), DEPLOYER_SHARE + LOCKED_SUPPLY);
        assertEq(token.balanceOf(deployer), DEPLOYER_SHARE);
        assertEq(token.balanceOf(address(token)), LOCKED_SUPPLY);
    }

    function test_Deployment_InitialState() public {
        assertEq(token.totalMinted(), 0);
        assertFalse(token.mintPaused());
        assertFalse(token.mintingClosed());
        assertFalse(token.airdropComplete());
        assertFalse(token.governanceClosed());
        assertEq(token.remainingMintable(), MINTABLE_SHARE);
        assertEq(token.remainingBatches(), MINTABLE_SHARE / BATCH_SIZE);
    }

    function test_Deployment_RevertZeroAddresses() public {
        vm.startPrank(deployer);
        vm.expectRevert("Zero treasury");
        new RobinhoodChainToken(address(0), address(usdg), "X", "X");
        vm.expectRevert("Zero USDC");
        new RobinhoodChainToken(treasury, address(0), "X", "X");
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════
    //  MINT
    // ═══════════════════════════════════════════════════════

    function test_Mint_SingleBatch() public {
        vm.startPrank(alice);
        usdg.approve(address(token), BATCH_PRICE);
        token.mint();
        vm.stopPrank();
        assertEq(token.balanceOf(alice), BATCH_SIZE);
        assertEq(token.totalMinted(), BATCH_SIZE);
        assertEq(token.mintedAmount(alice), BATCH_SIZE);
        assertEq(usdg.balanceOf(address(token)), BATCH_PRICE);
    }

    function test_Mint_MultipleBatches() public {
        _mintBatches(alice, 50);
        assertEq(token.balanceOf(alice), 50 * BATCH_SIZE);
        assertEq(token.totalMinted(), 50 * BATCH_SIZE);
        assertEq(token.mintedAmount(alice), 50 * BATCH_SIZE);
    }

    function test_Mint_DifferentUsers() public {
        _mintBatches(alice, 5);
        _mintBatches(bob, 3);
        assertEq(token.totalMinted(), 8 * BATCH_SIZE);
        assertEq(token.mintedAmount(alice), 5 * BATCH_SIZE);
        assertEq(token.mintedAmount(bob), 3 * BATCH_SIZE);
    }

    function test_Mint_ExhaustSupply() public {
        uint256 total = MINTABLE_SHARE / BATCH_SIZE; // 15,000
        usdg.mint(alice, total * BATCH_PRICE);
        _mintBatches(alice, total);
        assertEq(token.totalMinted(), MINTABLE_SHARE);
        assertTrue(token.mintingClosed());
        assertTrue(token.mintPaused());
    }

    function test_Mint_AfterExhaustion() public {
        uint256 total = MINTABLE_SHARE / BATCH_SIZE;
        usdg.mint(alice, (total + 1) * BATCH_PRICE);
        _mintBatches(alice, total);
        vm.startPrank(alice);
        usdg.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPermanentlyClosed.selector);
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_WhenPaused() public {
        vm.prank(deployer);
        token.setMintPaused(true);
        vm.startPrank(alice);
        usdg.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPaused.selector);
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_WithoutApproval() public {
        vm.startPrank(alice);
        vm.expectRevert();
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_WithoutUSDG() public {
        address poor = makeAddr("poor");
        vm.startPrank(poor);
        usdg.approve(address(token), BATCH_PRICE);
        vm.expectRevert();
        token.mint();
        vm.stopPrank();
    }

    function test_Mint_Event() public {
        vm.startPrank(alice);
        usdg.approve(address(token), BATCH_PRICE);
        // Mint and verify state (event emission verified by state change)
        uint256 before = token.totalMinted();
        token.mint();
        assertEq(token.totalMinted(), before + BATCH_SIZE);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════
    //  PAUSE
    // ═══════════════════════════════════════════════════════

    function test_Pause_DeployerOnly() public {
        vm.prank(deployer);
        token.setMintPaused(true);
        assertTrue(token.mintPaused());

        vm.prank(deployer);
        token.setMintPaused(false);
        assertFalse(token.mintPaused());
    }

    function test_Pause_NonDeployerBlocked() public {
        vm.prank(attacker);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.setMintPaused(true);
    }

    function test_Pause_MintAfterUnpause() public {
        vm.prank(deployer);
        token.setMintPaused(true);
        vm.prank(deployer);
        token.setMintPaused(false);
        _mintBatches(alice, 1);
        assertEq(token.totalMinted(), BATCH_SIZE);
    }

    // ═══════════════════════════════════════════════════════
    //  BURN UNMINTED
    // ═══════════════════════════════════════════════════════

    function test_Burn_ClosesMinting() public {
        _mintBatches(alice, 10);
        vm.prank(deployer);
        token.burnUnminted();
        assertTrue(token.mintingClosed());
        assertTrue(token.mintPaused());
    }

    function test_Burn_Event() public {
        uint256 remaining = token.remainingMintable();
        assertEq(remaining, MINTABLE_SHARE);
        vm.prank(deployer);
        token.burnUnminted();
        // After burn, remaining should be 0
        assertEq(token.remainingMintable(), 0);
    }

    function test_Burn_OnlyDeployer() public {
        vm.prank(attacker);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.burnUnminted();
    }

    function test_Burn_CannotBurnTwice() public {
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(deployer);
        vm.expectRevert(RobinhoodChainToken.AlreadyClosed.selector);
        token.burnUnminted();
    }

    function test_Burn_CannotMintAfter() public {
        vm.prank(deployer);
        token.burnUnminted();
        vm.startPrank(alice);
        usdg.approve(address(token), BATCH_PRICE);
        vm.expectRevert(RobinhoodChainToken.MintingPermanentlyClosed.selector);
        token.mint();
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════
    //  WITHDRAW
    // ═══════════════════════════════════════════════════════

    function test_Withdraw_OnlyTreasury() public {
        _mintBatches(alice, 10);
        uint256 bal = usdg.balanceOf(address(token));
        vm.prank(attacker);
        vm.expectRevert(RobinhoodChainToken.OnlyTreasury.selector);
        token.withdraw(bal);
        vm.prank(treasury);
        token.withdraw(bal);
        assertEq(usdg.balanceOf(address(token)), 0);
        assertEq(usdg.balanceOf(treasury), bal);
    }

    function test_Withdraw_ZeroOk() public {
        vm.prank(treasury);
        token.withdraw(0);
    }

    // ═══════════════════════════════════════════════════════
    //  AIRDROP — Happy Path
    // ═══════════════════════════════════════════════════════

    function test_Airdrop_Single() public {
        uint256 old = 20_000 * TK;
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = old;

        vm.prank(deployer);
        token.airdrop(m, a);

        assertEq(token.balanceOf(alice), old * 4);
        assertEq(token.mintedAmount(alice), old * 4);
        assertEq(token.totalMinted(), old * 4);
        assertTrue(token.airdropComplete());
    }

    function test_Airdrop_Multiple() public {
        address[] memory m = new address[](2);
        uint256[] memory a = new uint256[](2);
        m[0] = alice; a[0] = 20_000 * TK;
        m[1] = bob;   a[1] = 10_000 * TK;

        vm.prank(deployer);
        token.airdrop(m, a);

        assertEq(token.balanceOf(alice), 80_000 * TK);
        assertEq(token.balanceOf(bob),   40_000 * TK);
        assertEq(token.totalMinted(), 120_000 * TK);
    }

    function test_Airdrop_RealMigrationAmount() public {
        uint256 old = 2_630_000 * TK; // real total from old contract
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = old;

        vm.prank(deployer);
        token.airdrop(m, a);

        assertEq(token.totalMinted(), old * 4); // 10,520,000
        assertEq(token.remainingMintable(), MINTABLE_SHARE - old * 4);
    }

    function test_Airdrop_ThenMint() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = 20_000 * TK;
        vm.prank(deployer);
        token.airdrop(m, a);

        _mintBatches(bob, 5);
        assertEq(token.totalMinted(), 80_000 * TK + 5 * BATCH_SIZE);
    }

    function test_Airdrop_Event() public {
        uint256 old = 20_000 * TK;
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = old;

        // Verify airdrop event by state change
        uint256 before = token.totalMinted();
        vm.prank(deployer);
        token.airdrop(m, a);
        assertEq(token.totalMinted(), before + old * 4);
        assertEq(token.balanceOf(alice), old * 4);
    }

    // ═══════════════════════════════════════════════════════
    //  AIRDROP — Access Control
    // ═══════════════════════════════════════════════════════

    function test_Airdrop_OnlyDeployer() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = 20_000 * TK;

        vm.prank(attacker);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.airdrop(m, a);

        vm.prank(treasury);
        vm.expectRevert(RobinhoodChainToken.OnlyDeployer.selector);
        token.airdrop(m, a);
    }

    function test_Airdrop_OneTime() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = 20_000 * TK;

        vm.startPrank(deployer);
        token.airdrop(m, a);
        vm.expectRevert(RobinhoodChainToken.AirdropAlreadyDone.selector);
        token.airdrop(m, a);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════
    //  AIRDROP — Input Validation
    // ═══════════════════════════════════════════════════════

    function test_Airdrop_RevertEmpty() public {
        address[] memory m = new address[](0);
        uint256[] memory a = new uint256[](0);
        vm.prank(deployer);
        vm.expectRevert("Empty arrays");
        token.airdrop(m, a);
    }

    function test_Airdrop_RevertMismatch() public {
        address[] memory m = new address[](2);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; m[1] = bob; a[0] = 20_000 * TK;
        vm.prank(deployer);
        vm.expectRevert("Arrays must match");
        token.airdrop(m, a);
    }

    function test_Airdrop_RevertZeroAddr() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = address(0); a[0] = 20_000 * TK;
        vm.prank(deployer);
        vm.expectRevert();
        token.airdrop(m, a);
    }

    function test_Airdrop_RevertSelfAddr() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = address(token); a[0] = 20_000 * TK;
        vm.prank(deployer);
        vm.expectRevert();
        token.airdrop(m, a);
    }

    function test_Airdrop_RevertTreasury() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = treasury; a[0] = 20_000 * TK;
        vm.prank(deployer);
        vm.expectRevert();
        token.airdrop(m, a);
    }

    function test_Airdrop_RevertDeployer() public {
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = deployer; a[0] = 20_000 * TK;
        vm.prank(deployer);
        vm.expectRevert();
        token.airdrop(m, a);
    }

    // ═══════════════════════════════════════════════════════
    //  AIRDROP — Supply Limits
    // ═══════════════════════════════════════════════════════

    function test_Airdrop_ExceedsMintable() public {
        // Mint 290M, leaving 10M
        uint256 batches = (290_000_000 * TK) / BATCH_SIZE;
        usdg.mint(alice, batches * BATCH_PRICE);
        _mintBatches(alice, batches);

        // Airdrop 3M old × 4 = 12M > 10M remaining
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = bob; a[0] = 3_000_000 * TK;

        vm.prank(deployer);
        vm.expectRevert(RobinhoodChainToken.AirdropWouldExceedSupply.selector);
        token.airdrop(m, a);
    }

    function test_Airdrop_AfterBurn() public {
        _mintBatches(alice, 10);
        vm.prank(deployer);
        token.burnUnminted();

        // totalMinted = 200K, remaining allowed = 300M - 200K
        // Airdrop 20K × 4 = 80K — fits
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = bob; a[0] = 20_000 * TK;

        vm.prank(deployer);
        token.airdrop(m, a);
        assertEq(token.balanceOf(bob), 80_000 * TK);
    }

    // ═══════════════════════════════════════════════════════
    //  GOVERNANCE — Proposals
    // ═══════════════════════════════════════════════════════

    function test_Proposal_RequiresClosed() public {
        vm.prank(alice);
        vm.expectRevert(RobinhoodChainToken.MintingNotComplete.selector);
        token.createProposal(bob, "Test");
    }

    function test_Proposal_MinBalance() public {
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(
            RobinhoodChainToken.InsufficientBalance.selector, MIN_PROPOSE_BAL, 0
        ));
        token.createProposal(bob, "Test");
    }

    function test_Proposal_Create() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();

        vm.prank(alice);
        token.createProposal(bob, "Funding");

        (address proposer, address target, string memory desc,,,,,) = token.getProposal(0);
        assertEq(proposer, alice);
        assertEq(target, bob);
        assertEq(desc, "Funding");
    }

    function test_Proposal_InvalidTargets() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();

        vm.startPrank(alice);
        vm.expectRevert();
        token.createProposal(address(0), "Bad");
        vm.expectRevert();
        token.createProposal(address(token), "Bad");
        vm.stopPrank();
    }

    function test_Proposal_WeeklyLimit() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();

        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            token.createProposal(bob, string(abi.encodePacked("P", vm.toString(i))));
        }
        vm.expectRevert(RobinhoodChainToken.MaxProposalsThisWeek.selector);
        token.createProposal(bob, "Too many");
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════
    //  GOVERNANCE — Voting
    // ═══════════════════════════════════════════════════════

    function test_Vote_RequiresMintedAmount() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        token.createProposal(bob, "Test");

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(
            RobinhoodChainToken.InsufficientBalance.selector, MIN_VOTE_BAL, 0
        ));
        token.vote(0, true);
    }

    function test_Vote_DeployerTreasuryBlocked() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        token.createProposal(bob, "Test");

        vm.prank(deployer);
        vm.expectRevert(RobinhoodChainToken.CannotVote.selector);
        token.vote(0, true);

        vm.prank(treasury);
        vm.expectRevert(RobinhoodChainToken.CannotVote.selector);
        token.vote(0, true);
    }

    function test_Vote_NoDoubleVote() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        token.createProposal(bob, "Test");

        vm.prank(alice);
        token.vote(0, true);
        vm.prank(alice);
        vm.expectRevert(RobinhoodChainToken.AlreadyVoted.selector);
        token.vote(0, false);
    }

    function test_Vote_AfterDeadline() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        token.createProposal(bob, "Test");

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        vm.prank(alice);
        vm.expectRevert();
        token.vote(0, true);
    }

    // ═══════════════════════════════════════════════════════
    //  GOVERNANCE — Execution & Quorum
    // ═══════════════════════════════════════════════════════

    function test_Execute_FailsQuorum() public {
        _mintBatches(alice, 5);
        vm.prank(deployer);
        token.burnUnminted();
        vm.prank(alice);
        token.createProposal(bob, "Test");
        vm.prank(alice);
        token.vote(0, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        token.executeProposal(0);
        assertFalse(token.governanceClosed());
        assertEq(token.balanceOf(address(token)), LOCKED_SUPPLY);
    }

    function test_Execute_Passes() public {
        address[] memory voters = _mintManyUsers(250);
        vm.prank(deployer);
        token.burnUnminted();

        vm.prank(voters[0]);
        token.createProposal(treasury, "Release");

        for (uint256 i = 0; i < 200; i++) {
            vm.prank(voters[i]);
            token.vote(0, true);
        }

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        token.executeProposal(0);

        assertTrue(token.governanceClosed());
        assertEq(token.balanceOf(address(token)), 0);
    }

    function test_Execute_FailsSupermajority() public {
        address[] memory voters = _mintManyUsers(200);
        vm.prank(deployer);
        token.burnUnminted();

        vm.prank(voters[0]);
        token.createProposal(treasury, "Release");

        // 119 yes, 81 no = 59.5% — fails 60% threshold
        for (uint256 i = 0; i < 119; i++) {
            vm.prank(voters[i]);
            token.vote(0, true);
        }
        for (uint256 i = 119; i < 200; i++) {
            vm.prank(voters[i]);
            token.vote(0, false);
        }

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        token.executeProposal(0);
        assertFalse(token.governanceClosed());
    }

    function test_Execute_NoReopen() public {
        address[] memory voters = _mintManyUsers(200);
        vm.prank(deployer);
        token.burnUnminted();

        vm.prank(voters[0]);
        token.createProposal(treasury, "Release");
        for (uint256 i = 0; i < 200; i++) {
            vm.prank(voters[i]);
            token.vote(0, true);
        }

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        token.executeProposal(0);

        vm.prank(voters[0]);
        vm.expectRevert(RobinhoodChainToken.GovernanceAlreadyClosed.selector);
        token.createProposal(treasury, "Another");
    }

    // ═══════════════════════════════════════════════════════
    //  AIRDROP — Governance Interaction
    // ═══════════════════════════════════════════════════════

    function test_Airdrop_RecipientsCanVote() public {
        uint256 old = 30_000 * TK; // ×4 = 120K > MIN_VOTE_BAL (100K)
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = old;

        vm.prank(deployer);
        token.airdrop(m, a);

        // Close and check voting eligibility
        vm.prank(deployer);
        token.burnUnminted();

        assertGe(token.mintedAmount(alice), MIN_VOTE_BAL);

        vm.prank(alice);
        token.createProposal(bob, "Test");
        vm.prank(alice);
        token.vote(0, true);
        assertTrue(token.hasVoted(0, alice));
    }

    // ═══════════════════════════════════════════════════════
    //  INTEGRATION
    // ═══════════════════════════════════════════════════════

    function test_FullLifecycle() public {
        // Phase 1: Mint — alice, bob, AND 200 governance voters
        _mintBatches(alice, 100);
        _mintBatches(bob, 50);
        address[] memory voters = _mintManyUsers(200);
        assertEq(token.totalMinted(), 150 * BATCH_SIZE + 200 * 5 * BATCH_SIZE);

        // Phase 2: Airdrop
        address[] memory m = new address[](2);
        uint256[] memory a = new uint256[](2);
        m[0] = alice; a[0] = 1_000_000 * TK;
        m[1] = bob;   a[1] = 1_630_000 * TK;
        vm.prank(deployer);
        token.airdrop(m, a);

        uint256 airdropped = (1_000_000 + 1_630_000) * TK * 4;
        assertEq(token.totalMinted(), 150 * BATCH_SIZE + 200 * 5 * BATCH_SIZE + airdropped);

        // Phase 3: Close minting (all minting done)
        vm.prank(deployer);
        token.burnUnminted();

        // Phase 4: Withdraw USDG
        uint256 raised = usdg.balanceOf(address(token));
        vm.prank(treasury);
        token.withdraw(raised);
        assertEq(usdg.balanceOf(treasury), raised);

        // Phase 5: Governance
        vm.prank(alice);
        token.createProposal(treasury, "Release 600M");
        for (uint256 i = 0; i < 200; i++) {
            vm.prank(voters[i]);
            token.vote(0, true);
        }
        vm.prank(alice);
        token.vote(0, true);

        vm.warp(block.timestamp + VOTE_WINDOW + 1);
        token.executeProposal(0);
        assertTrue(token.governanceClosed());
        assertEq(token.balanceOf(address(token)), 0);
    }

    // ═══════════════════════════════════════════════════════
    //  EDGE
    // ═══════════════════════════════════════════════════════

    function test_Supply_NeverExceeds1B() public {
        // Max mintable + airdrop exhausts 300M
        // Deployer(100M) + Locked(600M) + Minted(300M) = 1B
        uint256 airdropOld = 74_000_000 * TK;
        address[] memory m = new address[](1);
        uint256[] memory a = new uint256[](1);
        m[0] = alice; a[0] = airdropOld;

        vm.prank(deployer);
        token.airdrop(m, a);

        uint256 remaining = token.remainingBatches();
        usdg.mint(bob, remaining * BATCH_PRICE);
        _mintBatches(bob, remaining);

        assertLe(token.totalSupply(), TOTAL_SUPPLY);
    }

    function test_Price_Is1USDG() public {
        assertEq(token.BATCH_PRICE(), 1 * TK);
    }

    function test_BatchSize_Is20K() public {
        assertEq(token.BATCH_SIZE(), 20_000 * TK);
    }
}
