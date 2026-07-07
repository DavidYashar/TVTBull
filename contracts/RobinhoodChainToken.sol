// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title VTB Token with Governance
/// @notice ERC-20 on Robinhood Chain — mint + governance voting for locked supply
contract RobinhoodChainToken is ERC20, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY    = 1_000_000_000 * 10**6;
    uint256 public constant DEPLOYER_SHARE  =   100_000_000 * 10**6; // 10% — to treasury for LP
    uint256 public constant MINTABLE_SHARE  =   300_000_000 * 10**6; // 30%
    uint256 public constant LOCKED_SUPPLY   =   600_000_000 * 10**6; // 60% — governance-locked
    uint256 public constant BATCH_SIZE      =          10_000 * 10**6;
    uint256 public constant BATCH_PRICE     =               2 * 10**6;  // USDG = 6 decimals

    uint256 public constant MIN_PROPOSE_BAL =   100_000 * 10**6;
    uint256 public constant MIN_VOTE_BAL    =   100_000 * 10**6;
    uint256 public constant MIN_VOTERS       =         200;  // minimum voters for quorum
    uint256 public constant MAX_PROPOSALS   =         5;
    uint256 public constant VOTE_WINDOW     = 72 hours;

    // ─── Immutable Roles ─────────────────────────────────
    address public immutable TREASURY;
    address public immutable DEPLOYER;
    IERC20   public immutable USDC;

    // ─── Mint State ──────────────────────────────────────
    uint256 public totalMinted;
    bool    public mintPaused;
    bool    public mintingClosed;
    mapping(address => uint256) public mintedAmount;

    // ─── Governance ──────────────────────────────────────
    struct Proposal {
        address proposer;
        address targetWallet;
        string  description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 deadline;
        bool    executed;
        uint256 totalVoters;
    }

    Proposal[] public proposals;
    uint256 public proposalWeek;
    uint256 public proposalsThisWeek;
    bool    public governanceClosed;
    // Per-proposal per-voter tracking (proposalId => voter => voted)
    mapping(uint256 => mapping(address => bool)) private _voters;

    // ─── Events ──────────────────────────────────────────
    event Minted(address indexed buyer, uint256 batches, uint256 tokens, uint256 costUSDC);
    event UnmintedBurned(uint256 amount);
    event Withdrawn(address indexed token, address indexed to, uint256 amount);
    event MintPauseToggled(bool paused);
    event ProposalCreated(uint256 indexed pid, address proposer, address target, uint256 deadline);
    event Voted(uint256 indexed pid, address voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed pid, address target, uint256 amount);
    event ProposalRejected(uint256 indexed pid, uint256 votesFor, uint256 votesAgainst);

    // ─── Errors ──────────────────────────────────────────
    error MintingPaused();
    error MintingPermanentlyClosed();
    error MintingNotComplete();
    error ExceedsMintableSupply();
    error OnlyDeployer();
    error OnlyTreasury();
    error AlreadyClosed();
    error InsufficientBalance(uint256 required, uint256 actual);
    error MaxProposalsThisWeek();
    error ProposalNotFound();
    error AlreadyVoted();
    error DeadlineNotReached();
    error GovernanceAlreadyClosed();
    error CannotVote();

    // ─── Constructor ─────────────────────────────────────
    constructor(
        address treasury_,
        address usdc_,
        string memory name_,
        string memory symbol_
    ) ERC20(name_, symbol_) {
        require(treasury_ != address(0), "Zero treasury");
        require(usdc_ != address(0), "Zero USDC");
        TREASURY = treasury_;
        DEPLOYER = msg.sender;
        USDC     = IERC20(usdc_);
        _mint(msg.sender, DEPLOYER_SHARE);       // 10% → deployer (for LP)
        _mint(address(this), LOCKED_SUPPLY);     // 60% → contract (governance-locked)
    }

    function decimals() public pure override returns (uint8) { return 6; }

    // ═══════════════ MINT ═════════════════════════════════

    function mint() external nonReentrant {
        if (mintingClosed) revert MintingPermanentlyClosed();
        if (mintPaused)    revert MintingPaused();
        if (totalMinted + BATCH_SIZE > MINTABLE_SHARE) revert ExceedsMintableSupply();
        totalMinted += BATCH_SIZE;
        USDC.safeTransferFrom(msg.sender, address(this), BATCH_PRICE);
        _mint(msg.sender, BATCH_SIZE);
        mintedAmount[msg.sender] += BATCH_SIZE;
        emit Minted(msg.sender, 1, BATCH_SIZE, BATCH_PRICE);
        if (totalMinted == MINTABLE_SHARE) {
            mintingClosed = true;
            mintPaused = true;
        }
    }

    // ═══════════════ DEPLOYER ═════════════════════════════

    function setMintPaused(bool paused) external {
        if (msg.sender != DEPLOYER) revert OnlyDeployer();
        mintPaused = paused;
        emit MintPauseToggled(paused);
    }

    function burnUnminted() external {
        if (msg.sender != DEPLOYER) revert OnlyDeployer();
        if (mintingClosed) revert AlreadyClosed();
        uint256 remaining = MINTABLE_SHARE - totalMinted;
        mintingClosed = true;
        mintPaused    = true;
        emit UnmintedBurned(remaining);
    }

    // ═══════════════ TREASURY ═════════════════════════════

    function withdraw(uint256 amount) external {
        // Treasury can ONLY withdraw USDG mint proceeds — never the locked TVT
        if (msg.sender != TREASURY) revert OnlyTreasury();
        USDC.safeTransfer(TREASURY, amount);
        emit Withdrawn(address(USDC), TREASURY, amount);
    }

    // ═══════════════ GOVERNANCE ═══════════════════════════

    function createProposal(address targetWallet, string calldata description) external {
        if (!mintingClosed) revert MintingNotComplete();
        if (governanceClosed) revert GovernanceAlreadyClosed();
        if (targetWallet == address(0) || targetWallet == address(this)) revert();
        if (balanceOf(msg.sender) < MIN_PROPOSE_BAL)
            revert InsufficientBalance(MIN_PROPOSE_BAL, balanceOf(msg.sender));

        uint256 week_ = block.timestamp / 1 weeks;
        if (week_ != proposalWeek) { proposalWeek = week_; proposalsThisWeek = 0; }
        if (proposalsThisWeek >= MAX_PROPOSALS) revert MaxProposalsThisWeek();
        proposalsThisWeek++;

        uint256 pid = proposals.length;
        proposals.push(Proposal({
            proposer: msg.sender,
            targetWallet: targetWallet,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            deadline: block.timestamp + VOTE_WINDOW,
            executed: false,
            totalVoters: 0
        }));

        emit ProposalCreated(pid, msg.sender, targetWallet, proposals[pid].deadline);
    }

    function vote(uint256 pid, bool support) external {
        if (!mintingClosed) revert MintingNotComplete();
        if (msg.sender == DEPLOYER || msg.sender == TREASURY) revert CannotVote();
        if (mintedAmount[msg.sender] < MIN_VOTE_BAL)
            revert InsufficientBalance(MIN_VOTE_BAL, mintedAmount[msg.sender]);
        if (pid >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[pid];
        if (p.executed) revert();
        if (block.timestamp > p.deadline) revert();
        if (_voters[pid][msg.sender]) revert AlreadyVoted();

        _voters[pid][msg.sender] = true;
        p.totalVoters++;
        if (support) p.votesFor += 1;
        else         p.votesAgainst += 1;
        emit Voted(pid, msg.sender, support, 1);
    }

    function executeProposal(uint256 pid) external {
        if (pid >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[pid];
        if (p.executed) revert();
        if (block.timestamp < p.deadline) revert DeadlineNotReached();
        if (governanceClosed) revert GovernanceAlreadyClosed();

        uint256 total = p.votesFor + p.votesAgainst;
        if (p.totalVoters < MIN_VOTERS) {
            p.executed = true;
            emit ProposalRejected(pid, p.votesFor, p.votesAgainst);
            return;
        }

        if (p.votesFor * 100 >= total * 60) {
            p.executed = true;
            governanceClosed = true;
            _transfer(address(this), p.targetWallet, LOCKED_SUPPLY);
            emit ProposalExecuted(pid, p.targetWallet, LOCKED_SUPPLY);
        } else {
            p.executed = true;
            emit ProposalRejected(pid, p.votesFor, p.votesAgainst);
        }
    }

    // ═══════════════ VIEWS ════════════════════════════════

    function hasVoted(uint256 pid, address voter) external view returns (bool) {
        return pid < proposals.length && _voters[pid][voter];
    }

    function getProposal(uint256 pid) external view returns (
        address proposer, address targetWallet, string memory description,
        uint256 votesFor, uint256 votesAgainst, uint256 deadline,
        bool executed, uint256 totalVoters
    ) {
        if (pid >= proposals.length) revert ProposalNotFound();
        Proposal storage p = proposals[pid];
        return (p.proposer, p.targetWallet, p.description, p.votesFor, p.votesAgainst, p.deadline, p.executed, p.totalVoters);
    }

    function proposalCount() external view returns (uint256) { return proposals.length; }

    function remainingMintable() external view returns (uint256) {
        return mintingClosed ? 0 : MINTABLE_SHARE - totalMinted;
    }

    function remainingBatches() external view returns (uint256) {
        return mintingClosed ? 0 : (MINTABLE_SHARE - totalMinted) / BATCH_SIZE;
    }

    function contractUSDCBalance() external view returns (uint256) {
        return USDC.balanceOf(address(this));
    }
}
