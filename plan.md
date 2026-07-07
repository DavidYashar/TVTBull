# Robinhood Chain Token Launch — Project Plan

> **Date**: 2026-07-05  
> **Phase**: Testnet Complete — Mainnet Ready  
> **Chain**: Robinhood Chain Testnet (46630) → Mainnet (4663)

---

## Overview

Launch an ERC-20 token on Robinhood Chain with a mint-to-trade lifecycle:
1. **Mint Phase**: Users mint tokens at fixed price ($2 per 10k batch) using USDG
2. **Post-Mint**: Treasury creates Uniswap V2 LP; deployer burns remaining allocation
3. **Trade Phase**: Users swap on Uniswap

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Token Contract (ERC-20, 6 decimals, 1B total supply)   │
├─────────────────────────────────────────────────────────┤
│  70% (700M) → deployer at construction                  │
│  30% (300M) → mintable by users in 10k batches          │
│  Batch price: 2 USDG                                    │
├─────────────────────────────────────────────────────────┤
│  Roles:                                                 │
│  • Deployer: pause/unpause mint, burn unminted tokens   │
│  • Treasury: withdraw() any token from contract         │
│  • Public:   mint() with USDG                           │
└─────────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌──────────────┐    ┌──────────────────────────┐
│  Mint Page   │    │      Admin Page           │
│  (public)    │    │  (wallet-gated)           │
│              │    │                           │
│  • Connect   │    │  Deployer section:        │
│  • Mint N    │    │    • Pause/Unpause mint   │
│    batches   │    │    • Burn unminted tokens │
│  • See stats │    │                           │
│              │    │  Treasury section:        │
│              │    │    • Withdraw USDG        │
│              │    │    • Provide LP (V2)      │
└──────────────┘    └──────────────────────────┘
```

---

## Token Economics (V2 — with Governance)

| Parameter | Value |
|---|---|
| **Total Supply** | 1,000,000 tokens |
| **Decimals** | 6 |
| **Deployer Allocation** | 100,000 (10%) — sent to treasury for LP |
| **Mintable Allocation** | 300,000 (30%) |
| **Governance-Locked** | 600,000 (60%) — released by vote |
| **Batch Size** | 10,000 tokens |
| **Batch Price** | $2 USDG |
| **Max Batches** | 30 |
| **Max Raise** | $60 |

### Post-Mint Actions

| Action | Amount | Executor |
|---|---|---|
| Send 100K VTB to treasury | 100,000 | Deployer |
| Withdraw USDG from contract | Variable | Treasury |
| Create Uniswap V2 pool | 100K VTB + X USDG | Treasury |
| Governance vote opens | 600K VTB at stake | Token holders |

---

## Governance Parameters

### Mainnet Values (Production)

| Parameter | Value | Description |
|---|---|---|
| **VOTE_WINDOW** | 72 hours | Voting period per proposal |
| **MAX_PROPOSALS** | 5 per week | Proposal rate limit |
| **MIN_PROPOSE_BAL** | 100,000 VTB | Tokens needed to create a proposal |
| **MIN_VOTE_BAL** | 100,000 VTB | Tokens needed to vote |
| **THRESHOLD** | 60% of votes cast | Must be YES to pass |

### Testnet Values (for quick testing)

| Parameter | Value | Description |
|---|---|---|
| **VOTE_WINDOW** | 15 minutes | Short window for testing |
| **MAX_PROPOSALS** | 2 per hour | Can test proposals quickly |
| **MIN_PROPOSE_BAL** | 10,000 VTB | Lower threshold for testing |
| **MIN_VOTE_BAL** | 10,000 VTB | Lower threshold for testing |
| **THRESHOLD** | 60% of votes cast | Same as mainnet |

---

## Contracts

### MyToken.sol
- OpenZeppelin ERC-20 (v5.x)
- ReentrancyGuard on mint
- Immutable treasury + deployer addresses
- SafeERC20 for USDG transfers
- Events: `Minted`, `UnmintedBurned`, `Withdrawn`

### External Dependencies
- **USDG**: Paxos stablecoin on Robinhood Chain (need address)
- **Uniswap V2 Router**: For LP creation
- **Uniswap V2 Factory**: Pool creation

---

## Network Configuration (Testnet)

| Field | Value |
|---|---|
| **Chain ID** | 46630 |
| **RPC (Alchemy)** | `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` |
| **Block Explorer** | `https://explorer.testnet.chain.robinhood.com` |
| **Currency** | ETH |

---

## Frontend

### Stack
- Vanilla HTML/CSS/JS + ethers.js v6
- No framework — single page, two modes

### Mint Page (public, default view)
- Wallet connect button (MetaMask / any EIP-1193 wallet)
- Shows: connected address, USDG balance, token balance
- Batch selector: +/- buttons, 1–100 range
- "Mint" button with total cost display
- Stats: total minted / 300M, remaining batches
- Transaction status (pending → confirmed)

### Admin Page (gated)
- Appears only when deployer or treasury wallet connected
- **Deployer Tab**:
  - Pause/Unpause mint toggle
  - Burn unminted button (irreversible)
  - Shows remaining mintable supply
- **Treasury Tab**:
  - Withdraw USDG: amount input + button
  - LP Provision: reads token + USDG balance, amount inputs, slippage %, "Create LP" button

---

## Deployment Steps (Testnet)

1. Deploy MyToken with treasury address + USDG address
2. Verify contract on Blockscout
3. Deploy frontend (Vercel / static hosting)
4. Fund test wallets with testnet ETH + testnet USDG
5. Test mint flow
6. Test pause/unpause
7. Test burn unminted
8. Test withdraw to treasury
9. Test LP creation on Uniswap
10. Test swap on Uniswap

---

## Security Checklist

- [ ] Only treasury can withdraw
- [ ] Only deployer can pause/burn
- [ ] ReentrancyGuard on mint
- [ ] Cannot mint beyond 300M
- [ ] Cannot mint when paused
- [ ] Cannot mint after burnUnminted called
- [ ] USDG transferFrom uses SafeERC20
- [ ] No ownership transfer possible (immutable roles)
- [ ] LP creation uses Uniswap Router (battle-tested)

---

## Uniswap LP Creation — Mainnet (Chain 4663)

Uniswap V2 is deployed on Robinhood Chain **mainnet only** (not on testnet 46630).
All addresses verified from `@uniswap/sdk-core` source code.

### Mainnet Contract Addresses

| Contract | Address |
|---|---|
| **V2 Factory** | `0x89e5db8b5aa49aa85ac63f691524311aeb649eba` |
| **V2 Router** | `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` |
| **V3 Factory** | `0x1f7d7550b1b028f7571e69a784071f0205fd2efa` |
| **SwapRouter02** | `0xcaf681a66d020601342297493863e78c959e5cb2` |
| **NFT Position Manager** | `0x73991a25c818bf1f1128deaab1492d45638de0d3` |
| **WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |
| **Multicall** | `0x282a3c4d320cc7f0d5eaf56b8029e4b88338f0a3` |

### LP Creation Flow (Treasury executes after mint-out)

```
Step 1: Deployer sends 70M VTB tokens → treasury wallet
Step 2: Deployer burns 630M VTB → 0xdead (manual transfer)
Step 3: Treasury calls withdraw() on token contract → pulls USDG to treasury
Step 4: Treasury calls createPair(VTB, USDG) on V2 Factory
Step 5: Treasury approves V2 Router for VTB + USDG
Step 6: Treasury calls addLiquidity() on V2 Router:
        addLiquidity(
            VTB,           // tokenA
            USDG,          // tokenB
            70_000_000e6,  // VTB amount
            X_USDG,        // USDG from raised funds
            minVTB,        // slippage: 95% of desired
            minUSDG,       // slippage: 95% of desired
            treasury,      // LP tokens → treasury
            deadline       // block.timestamp + 20 min
        )
```

### Initial LP Price Determination

| USDG in LP | VTB in LP | Initial Price/VTB |
|---|---|---|
| $10,000 | 70M | ~$0.00014 |
| $30,000 | 70M | ~$0.00043 |
| $60,000 | 70M | ~$0.00086 |

User mint price: $0.0002/VTB ($2 per 10k batch).
To ensure minters are in profit at launch, LP ratio should set price > $0.0002.

### Testnet LP Testing
- Uniswap V2 is NOT deployed on testnet (46630)
- Options: (a) deploy V2 Factory + Router on testnet ourselves, (b) test mint only on testnet, LP on mainnet

### Relevant ABI Snippets

**V2 Factory:**
```solidity
function createPair(address tokenA, address tokenB) external returns (address pair);
function getPair(address tokenA, address tokenB) external view returns (address pair);
function allPairsLength() external view returns (uint256);
```

**V2 Router:**
```solidity
function addLiquidity(
    address tokenA, address tokenB,
    uint amountADesired, uint amountBDesired,
    uint amountAMin, uint amountBMin,
    address to, uint deadline
) external returns (uint amountA, uint amountB, uint liquidity);
```

---

## Token Logo & Metadata

- ERC-20 does not store logos on-chain
- Blockscout pulls token logos from **CoinGecko's CDN** (e.g. `assets.coingecko.com/coins/images/...`)
- Token must be listed on CoinGecko for the logo to appear on the Blockscout explorer
- CoinGecko listing requirements: token on mainnet, website, trading volume/liquidity
- Also add to Uniswap token list for logo in the Uniswap UI and wallets

---

## Mainnet Launch Checklist

### Phase 1 — Contract: Swap Test Values → Mainnet Values

Edit `contracts/RobinhoodChainToken.sol` — change these constants:

| Constant | Testnet | Mainnet |
|---|---|---|
| `TOTAL_SUPPLY` | `1_000_000 * 10**6` | `1_000_000_000 * 10**6` |
| `DEPLOYER_SHARE` | `100_000 * 10**6` | `100_000_000 * 10**6` |
| `MINTABLE_SHARE` | `300_000 * 10**6` | `300_000_000 * 10**6` |
| `LOCKED_SUPPLY` | `600_000 * 10**6` | `600_000_000 * 10**6` |
| `BATCH_PRICE` | `2 * 10**18` | `2 * 10**6` (real USDG = 6 decimals) |
| `VOTE_WINDOW` | `15 minutes` | `72 hours` |
| `MAX_PROPOSALS` | `2` | `5` |
| `MIN_PROPOSE_BAL` | `10_000 * 10**6` | `100_000 * 10**6` |
| `MIN_VOTE_BAL` | `10_000 * 10**6` | `100_000 * 10**6` |
| Rate limit unit | `block.timestamp / 1 hours` | `block.timestamp / 1 weeks` |
| Rate limit var name | `proposalHour` / `proposalsThisHour` | `proposalWeek` / `proposalsThisWeek` |
| Rate limit error | `MaxProposalsThisHour` | `MaxProposalsThisWeek` |

**Also update the test suite** with matching mainnet constants in `test/RobinhoodChainToken.t.sol`.

Run `forge test` to confirm everything passes before proceeding.

---

### Phase 2 — Deploy to Mainnet (Chain 4663)

1. **Update `.env`:**
   ```
   RH_RPC_URL=https://robinhood-mainnet.g.alchemy.com/v2/{YOUR_KEY}
   USDG_ADDRESS=<real USDG on Robinhood mainnet>
   TREASURY_ADDRESS=<your multisig Safe wallet>
   TOKEN_NAME="Vlad Tenev bull"
   TOKEN_SYMBOL=VTB
   ```

2. **Deploy with forge script:**
   ```bash
   forge script script/DeployToken.s.sol:DeployToken \
     --rpc-url $RH_RPC_URL \
     --broadcast
   ```

3. **Verify on Blockscout mainnet:**
   ```bash
   forge verify-contract <ADDRESS> contracts/RobinhoodChainToken.sol:RobinhoodChainToken \
     --verifier-url https://explorer.chain.robinhood.com/api/ \
     --constructor-args $(cast abi-encode "constructor(address,address,string,string)" ...)
   ```

4. **Verify on-chain state:**
   - Deployer balance = 100M VTB
   - Contract balance = 600M VTB (locked)
   - `TREASURY()` = correct multisig
   - `USDG()` = real USDG address

---

### Phase 3 — Prepare Frontend for Mainnet

Edit these files in `frontend-vite/src/`:

**`constants.js`:**
- `TOKEN_ADDRESS` → mainnet deployed address
- `USDG_ADDRESS` → real USDG on mainnet
- `USDG_DECIMALS` → `6` (real USDG)
- `readProvider` RPC URL → Alchemy mainnet
- Blockscout API URL → `https://explorer.chain.robinhood.com/api/`

**`wagmi.js`:**
- Add mainnet chain definition (chain ID `4663`)
- RPC: `https://rpc.chain.robinhood.com`
- Explorer: `https://explorer.chain.robinhood.com`
- Include both testnet + mainnet chains (or mainnet only for production)

**`MintPage.jsx`:**
- Blockscout holder API URL → mainnet
- `deployBlock` → block number of mainnet deployment

**`AdminPage.jsx`:**
- Remove LP "disabled on testnet" warning — LP works on mainnet
- UNISWAP_V2_ROUTER → `0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f` (already correct)

---

### Phase 4 — Deploy Frontend to Render

**Option A: Static Site (recommended)**

1. In `frontend-vite/`, run:
   ```bash
   pnpm build
   ```
   This outputs to `dist/`.

2. On [Render.com](https://render.com):
   - New → **Static Site**
   - Connect your Git repo (or upload `dist/` folder)
   - **Build Command:** `cd frontend-vite && pnpm install && pnpm build`
   - **Publish Directory:** `frontend-vite/dist`
   - **Environment Variables:** none needed (all config is in source)

3. **Custom domain** (optional): add in Render dashboard → Settings → Custom Domain

**Option B: Web Service (if you need SSR later)**

1. On Render: New → **Web Service**
2. Connect repo
3. **Build Command:** `cd frontend-vite && pnpm install && pnpm build`
4. **Start Command:** `cd frontend-vite && npx serve -s dist -l 3000`
5. Set `PORT` env var to `3000`

**Post-deploy:** open the Render `.onrender.com` URL, confirm wallet connects, mint page loads, and the explorer links work.

---

### Phase 5 — Post-Launch Operations

| # | Action | Who | When |
|---|---|---|---|
| 1 | Confirm mint page is live, users can mint | Deployer | Day 0 |
| 2 | Monitor `totalMinted()` daily | Deployer | Ongoing |
| 3 | When all 300M minted (or you choose to close): | | |
| 3a | Pause mint: `setMintPaused(true)` | Deployer | |
| 3b | Burn remaining: `burnUnminted()` | Deployer | |
| 3c | Send 100M VTB to treasury | Deployer | |
| 4 | Withdraw USDG from contract | Treasury | After mint-out |
| 5 | Create Uniswap V2 pool: `addLiquidity(VTB, USDG, 100M, X, ...)` | Treasury | After step 4 |
| 6 | Governance opens automatically | Token holders | After mint-out |
| 7 | List on CoinGecko (for Blockscout logo + market data) | Team | Post-launch |
| 8 | Add to Uniswap token list (for swap UI logo) | Team | After LP |

---

### Phase 6 — Mainnet-Only Security

| # | Item | Status |
|---|---|---|
| 1 | Treasury = **multisig** (Safe wallet), not single EOA | ☐ |
| 2 | Deployer key on hardware wallet | ☐ |
| 3 | Test all admin functions with 1 batch before full send | ☐ |
| 4 | LP creation: use private mempool to avoid sandwich bots | ☐ |
| 5 | Verify contract on Blockscout (users need it for trust) | ☐ |
| 6 | `withdraw()` blocked for VTB address (defense-in-depth) | ✅ Already in code |

---

## Files

```
robinhood-token-launch/
├── plan.md                        ← This file
├── .env                           ← Environment variables
├── .env.example                   ← Template
├── contracts/
│   ├── RobinhoodChainToken.sol    ← ERC-20 token contract
│   └── MockUSDG.sol               ← Test USDG (testnet only)
├── script/
│   └── Deploy.s.sol               ← Foundry deploy script (testnet + mainnet)
├── test/
│   └── RobinhoodChainToken.t.sol  ← 21 passing Foundry tests
├── foundry.toml                   ← Foundry config (cancun EVM)
├── frontend-vite/                 ← React + RainbowKit frontend
│   ├── src/
│   │   ├── main.jsx               ← Entry point
│   │   ├── App.jsx                ← Tab navigation
│   │   ├── wagmi.js               ← RainbowKit + chain config
│   │   ├── constants.js           ← Addresses, ABIs, RPC URLs
│   │   ├── MintPage.jsx           ← Public mint page
│   │   ├── MyMintsPage.jsx        ← User's mint history
│   │   ├── AdminPage.jsx          ← Deployer + treasury controls
│   │   └── styles.css             ← Black & green theme
│   └── package.json
└── frontend/                      ← Old vanilla JS frontend (deprecated)
```
