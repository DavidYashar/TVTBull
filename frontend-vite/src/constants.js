import { ethers } from 'ethers'

// All config values come from Vite env vars (frontend-vite/.env)
// These are bundled at build time — NOT for secrets like private keys

// Alchemy read provider
export const readProvider = new ethers.JsonRpcProvider(
  import.meta.env.VITE_ALCHEMY_RPC_URL
)

// Explorer API key (Blockscout Pro)
export const EXPLORER_API_KEY = import.meta.env.VITE_EXPLORER_API_KEY

// Blockscout hosted API base (chain 4663 = Robinhood mainnet)
export const EXPLORER_API_URL = 'https://api.blockscout.com/4663/api/v2'

// Explorer frontend for tx links
export const EXPLORER_URL = 'https://robinhoodchain.blockscout.com'

// Deployed addresses (mainnet)
export const TOKEN_ADDRESS = import.meta.env.VITE_TOKEN_ADDRESS
export const USDG_ADDRESS  = import.meta.env.VITE_USDG_ADDRESS
export const USDG_DECIMALS = Number(import.meta.env.VITE_USDG_DECIMALS || 6)

// Uniswap V2 Router on Robinhood Chain MAINNET
export const UNISWAP_V2_ROUTER = import.meta.env.VITE_UNISWAP_V2_ROUTER

// ABIs
export const TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function TOTAL_SUPPLY() view returns (uint256)',
  'function DEPLOYER_SHARE() view returns (uint256)',
  'function MINTABLE_SHARE() view returns (uint256)',
  'function BATCH_SIZE() view returns (uint256)',
  'function BATCH_PRICE() view returns (uint256)',
  'function TREASURY() view returns (address)',
  'function DEPLOYER() view returns (address)',
  'function USDC() view returns (address)',
  'function totalMinted() view returns (uint256)',
  'function mintPaused() view returns (bool)',
  'function mintingClosed() view returns (bool)',
  'function remainingMintable() view returns (uint256)',
  'function remainingBatches() view returns (uint256)',
  'function contractUSDCBalance() view returns (uint256)',
  'function mint()',
  'function setMintPaused(bool paused)',
  'function burnUnminted()',
  'function withdraw(uint256 amount)',
  // Governance
  'function createProposal(address targetWallet, string description)',
  'function vote(uint256 pid, bool support)',
  'function executeProposal(uint256 pid)',
  'function hasVoted(uint256 pid, address voter) view returns (bool)',
  'function getProposal(uint256 pid) view returns (address proposer, address targetWallet, string description, uint256 votesFor, uint256 votesAgainst, uint256 deadline, bool executed, uint256 totalVoters)',
  'function proposalCount() view returns (uint256)',
  'function governanceClosed() view returns (bool)',
  'function LOCKED_SUPPLY() view returns (uint256)',
  'function MIN_PROPOSE_BAL() view returns (uint256)',
  'function MIN_VOTE_BAL() view returns (uint256)',
  'function VOTE_WINDOW() view returns (uint256)',
  // Events
  'event Minted(address indexed buyer, uint256 batches, uint256 tokens, uint256 costUSDC)',
  'event UnmintedBurned(uint256 amount)',
  'event Withdrawn(address indexed token, address indexed to, uint256 amount)',
  'event MintPauseToggled(bool paused)',
  'event ProposalCreated(uint256 indexed pid, address proposer, address target, uint256 deadline)',
  'event Voted(uint256 indexed pid, address voter, bool support, uint256 weight)',
  'event ProposalExecuted(uint256 indexed pid, address target, uint256 amount)',
  'event ProposalRejected(uint256 indexed pid, uint256 votesFor, uint256 votesAgainst)',
]

export const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
]

export const UNISWAP_V2_ROUTER_ABI = [
  'function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)',
  'function factory() view returns (address)',
]
