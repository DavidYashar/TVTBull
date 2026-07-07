# Robinhood Chain — Full Documentation Report

> **Source**: https://docs.robinhood.com/chain/  
> **Date Retrieved**: 2026-07-05

---

## Overview

**Robinhood Chain** is a **permissionless, EVM-compatible Layer-2 blockchain** built on **Arbitrum Dedicated Blockchains** (Arbitrum Nitro). It's designed to bring traditional financial markets, crypto, and real-world assets (RWAs) together on a single fast, efficient, and open network. It's part of Robinhood's broader mission to democratize access to global financial markets.

---

## Architecture & Core Properties

| Property | Detail |
|---|---|
| **Base Framework** | Arbitrum Nitro (ArbOS 61, Nitro v3.11) |
| **Data Availability** | Ethereum blobs |
| **Native Gas Token** | ETH |
| **Sequencing** | First-come, first-served (no priority fee MEV) |
| **EVM Compatibility** | Full — Solidity, Vyper, Hardhat, Foundry, ethers.js, viem, Wagmi |
| **Account Abstraction** | First-class ERC-4337 support (gas sponsorship, batched txs, session keys, programmable wallets) |
| **Consensus/Security** | Inherits Ethereum security via Arbitrum's fraud proof system |
| **Dispute Resolution** | BoLD protocol with a permissioned validator set |

---

## Network Configuration

| | Mainnet | Testnet |
|---|---|---|
| **Chain ID** | `4663` | `46630` |
| **Currency** | ETH | ETH |
| **Public RPC** | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| **Sequencer Feed (WSS)** | `wss://feed.mainnet.chain.robinhood.com` | `wss://feed.testnet.chain.robinhood.com` |
| **Sequencer** | `https://sequencer.mainnet.chain.robinhood.com` | `https://sequencer.testnet.chain.robinhood.com` |
| **Block Explorer** | `robinhoodchain.blockscout.com` | `explorer.testnet.chain.robinhood.com` |

### Developer Endpoints

**Alchemy (recommended for production):**
- RPC: `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`
- WebSocket: `wss://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}`
- Testnet: `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}`

**Other supported providers**: QuickNode, Blockdaemon, dRPC, Validation Cloud.

**Public endpoints are rate-limited** — not recommended for production use.

### Alchemy Services

| Service | Description |
|---|---|
| **Node API** | Standard JSON-RPC and WebSocket endpoints |
| **Data API** | Indexed blockchain data (token balances, tx history, NFTs, portfolio activity) |
| **Gasless Transaction Infrastructure** | Programmable wallets with gas sponsorship, batched transactions, flexible policies, spending controls |

---

## Key Design Features

### Predictable Transaction Ordering
Robinhood Chain uses **first-come, first-served (FCFS) sequencing**. Transaction order is determined strictly by arrival time at the sequencer. No transaction can bypass others by paying higher fees — this creates a transparent, MEV-resistant environment at the sequencer level.

### Built for Real-World Assets (RWAs)
Optimized for tokenized RWAs including equities, ETFs, private assets, and other financial instruments. Supports programmatic trading, self-custody, and 24/7 access.

### Open and Permissionless
Anyone can interact with the network, build applications, and deploy smart contracts. No gatekeeping.

### Account Abstraction (ERC-4337)
First-class support for:
- Gas sponsorship (pay gas for users)
- Batched transactions
- Session keys
- Programmable wallets

---

## Bridging

### Canonical Bridge (Arbitrum — Trustless)

| Direction | Speed | Notes |
|---|---|---|
| **Deposit (L1→L2)** | ~10 minutes | Uses Arbitrum's retryable ticket system. Failed deposits can be manually redeemed within 7 days. |
| **Withdrawal (L2→L1)** | ~7 days | 3-step: initiate on L2 → wait challenge period → claim on L1 (incurs L1 gas) |

**ERC-20 note**: Bridged token addresses differ between L1 and L2. Use `calculateL2TokenAddress` on the L2 Gateway Router to resolve the corresponding address.

**Programmatic bridging**: Interact with the Delayed Inbox contract on Ethereum L1. Contract addresses are on the [Protocol Contracts](https://docs.robinhood.com/chain/protocol-contracts) page.

### Third-Party Bridges

| Provider | Type | Speed | Notes |
|---|---|---|---|
| **LayerZero / Stargate** | Omnichain messaging + OFT | Minutes | Fast token movement; WBTC, USDG, and other OFTs |
| **Chainlink CCIP** | Programmable token transfers + actions | Minutes | Bridge and trigger an action together (e.g., bridge USDG + deposit into lending) |
| **Relay** | Intents-based | Seconds | Bridge-and-execute in one step |
| **Across** | Intents-based | Seconds | Fast, capital-efficient |
| **LiFi / 0x** | Cross-chain swap aggregators | Seconds–minutes | Swap-and-bridge in one step |

---

## Ecosystem Partners

| Category | Partners |
|---|---|
| **RPC & AA Infrastructure** | Alchemy (recommended) |
| **Cross-chain Bridge** | LayerZero |
| **Oracles** | Chainlink |
| **Institutional Custody** | Fireblocks, BitGo |
| **Blockchain Analytics** | Allium |
| **Token Tracking** | CoinGecko |
| **Public DEX** | Uniswap |
| **Proprietary AMM** | Rialto |
| **Lending** | Morpho |
| **Perpetuals** | Lighter, Arcus |
| **Stablecoin** | Paxos (USDG) |
| **Wallet Data** | Zerion |

---

## Smart Contract Deployment

Fully standard EVM deployment — contracts written in Solidity or Vyper deploy without modification.

### Foundry

```bash
# Set environment variables
export PRIVATE_KEY=0x<your_private_key>
export RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com

# Deploy
forge create HelloRobinhood \
  --rpc-url $RH_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast

# Verify on Blockscout
forge verify-contract <contract_address> \
  src/HelloRobinhood.sol:HelloRobinhood \
  --chain-id 4663 \
  --rpc-url $RH_RPC_URL \
  --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api/
```

### Hardhat

```js
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
module.exports = {
  solidity: "0.8.13",
  networks: {
    robinhood: {
      url: process.env.RH_RPC_URL,
      chainId: 4663,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: { robinhood: "empty" },
    customChains: [
      {
        network: "robinhood",
        chainId: 4663,
        urls: {
          apiURL: "https://robinhoodchain.blockscout.com/api",
          browserURL: "https://robinhoodchain.blockscout.com/",
        },
      },
    ],
  },
};
```

```bash
export PRIVATE_KEY=0x<your_private_key>
export RH_RPC_URL=https://rpc.mainnet.chain.robinhood.com

npx hardhat compile
npx hardhat run scripts/deploy.js --network robinhood

# Verify
npx hardhat verify --network robinhood <contract_address>
```

---

## Running a Full Node

### Hardware Requirements

| Resource | Minimum | Recommended |
|---|---|---|
| **CPU** | Modern multi-core (8+) with strong single-core | — |
| **RAM** | 64 GB | 128 GB |
| **Storage** | Locally attached NVMe SSD | Several TBs (2× chain size + 20% buffer) |
| **Type** | Full node | Archive nodes need substantially more disk |

### Prerequisites

- **L1 execution RPC endpoint** (your own or a provider)
- **L1 beacon (consensus) endpoint** — required for reading blob data
- **Docker** installed and running
- If running your own L1 node: must be **fully synced** before L2 can finish syncing

### Starting the Node

```bash
docker run --rm -it \
  -v /path/to/data:/home/user/.arbitrum \
  -p 8547:8547 -p 8548:8548 \
  offchainlabs/nitro-node:v3.11 \
  --parent-chain.connection.url=<L1_EXECUTION_RPC> \
  --parent-chain.blob-client.beacon-url=<L1_BEACON_URL> \
  --chain.id=4663 \
  --init.genesis-json-file=/path/to/robinhood-genesis.json \
  --http.addr=0.0.0.0 --http.port=8547 \
  --http.api=net,web3,eth
```

**Low-latency updates**: Add `--node.feed.input.url=wss://feed.mainnet.chain.robinhood.com`

**Fast sync**: Add `--init.url=<SNAPSHOT_URL>` on first start to skip syncing from genesis.

**Genesis config downloads:**
- Mainnet: https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json
- Testnet: https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-testnet-config.json

### Checking Sync Progress

```bash
curl -d '{"id":0,"jsonrpc":"2.0","method":"eth_syncing","params":[]}' \
  -H "Content-Type: application/json" http://localhost:8547
```
A fully synced node returns `false`.

### Validators

- **Permissioned set** — must be allowlisted by Robinhood
- Requires **1 WETH bond** (defensive validators strongly encouraged)
- Uses **BoLD** for dispute resolution
- Contact Robinhood to join the validator set

### Troubleshooting

| Issue | Check |
|---|---|
| **Syncing stalled** | L1 beacon URL reachable; server clock accuracy (ntp/chrony) |
| **Slow sync** | Disk I/O — networked storage throttles sync significantly |
| **"nonce already used"** | Node not fully synced yet — wait for sync to complete |
| **Connectivity** | Ports 8547 (HTTP) and 8548 (WS) mapped and open; `--http.addr=0.0.0.0` set |

---

## Protocol Contracts

### Core L1 Contracts

| Contract | Mainnet Address | Testnet Address |
|---|---|---|
| **Rollup** | `0x23A19d23e89166adedbDcB432518AB01e4272D94` | `0xdc5F8E399DBd8a9F5F87AeC4C23Beb12431b386D` |
| **Sequencer Inbox** | `0xBd0D173EEb87D57A09521c24388a12789F33ba96` | `0xA0D9dB3DC9791D54b5183C1C1866eFe1eCA7D414` |
| **CoreProxyAdmin** | `0x1232813BDd40aa9d53066A880dE78a4Be70B90FD` | `0x20d5d542c1bF0a3c295524Eaef336fC07e890622` |

### Cross-Chain Messaging (L1)

| Contract | Mainnet Address | Testnet Address |
|---|---|---|
| **Delayed Inbox** | `0x1A07cc4BD17E0118BdB54D70990D2158AbAD7a2D` | `0xF2939afA86F6f933A3CE17fCAB007907B6b0B7a4` |
| **Bridge** | `0xDf8755334ce7A73cCF6b581C02eA649AE3E864b3` | `0x96295BDad104eaD97cC08797b3dC68efF59CcF30` |
| **Outbox** | `0xf0ce991ea4A0d2400A4AB49b20ae333f6Dce3DE9` | `0x8D180Caf588f3Da027BEf1F42a106Da93F90b166` |

### Token Bridge (L1)

| Contract | Mainnet Address | Testnet Address |
|---|---|---|
| **L1 Gateway Router** | `0x6a2E3a1e16FC29f27Ce61429746D558d656975bB` | `0xF6F11aAEE80875776C264d93B37B34cE437382D1` |
| **L1 ERC20 Gateway** | `0x85001CC4867C5e1C22dA4B79BB8852B9e2a06da0` | `0x52C2976cbDEf48BcC51d07d3c523769F76ECBd09` |
| **L1 Arb-Custom Gateway** | `0x9368EAEbFe6E063C69dcF8126711A6997E0eCeE1` | `0xFB4aa8024F70B00121723A9C923BaD0Dd2dFaf8F` |
| **L1 Weth Gateway** | `0xF7e12b9614b509C747ab4423bC4ACF923759Cf1B` | `0x8f8A6799F2b1978c6586318543c73D8Fb12f218f` |
| **L1 WETH** | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | `0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9` |
| **L1 Proxy Admin** | `0x1232813BDd40aa9d53066A880dE78a4Be70B90FD` | `0x20d5d542c1bF0a3c295524Eaef336fC07e890622` |
| **L1 Multicall** | `0x7cdCB0Cc61f47B8Dd8f47C5A29edaDd84a1BDf5e` | — |

### Token Bridge (L2)

| Contract | Mainnet Address | Testnet Address |
|---|---|---|
| **L2 Gateway Router** | `0x1E324B9316138CA9a73F960213621AD1aaf01B89` | `0x77bF00A6A90c600f214b34BAFBB7918c0cF113A8` |
| **L2 ERC20 Gateway** | `0xfd9b17206278C16DdaacF6AC8f05dBf97EdCb31e` | `0x8689aFB9086734e12beA6b5DF541a1da252Ea32a` |
| **L2 Arb-Custom Gateway** | `0x912285144fC0f6e89d3Ed16F5Ab72f87A1878959` | `0xE4EE9C15e2cA44136796342e31b67d953E67a70b` |
| **L2 Weth Gateway** | `0x1D187C3E2dA52D72BC9C41e3AbA0fdFa6a7bF055` | `0x5A8F55202A625D12FFCb76F857FE4563bC8Ce413` |
| **L2 WETH** | `0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73` | `0x7943e237c7F95DA44E0301572D358911207852Fa` |
| **L2 Proxy Admin** | `0xa3Acd31AFb851B4eB9DAD00F5204c01D924267dF` | `0xE743e696B00789Ef489cF617477771764E9283a0` |

### Arbitrum Precompiles (same address on all L2s)

| Precompile | Address |
|---|---|
| **ArbAddressTable** | `0x0000000000000000000000000000000000000066` |
| **ArbAggregator** | `0x000000000000000000000000000000000000006D` |
| **ArbFunctionTable** | `0x0000000000000000000000000000000000000068` |
| **ArbGasInfo** | `0x000000000000000000000000000000000000006C` |
| **ArbInfo** | `0x0000000000000000000000000000000000000065` |
| **ArbOwner** | `0x0000000000000000000000000000000000000070` |
| **ArbOwnerPublic** | `0x000000000000000000000000000000000000006b` |
| **ArbRetryableTx** | `0x000000000000000000000000000000000000006E` |
| **ArbStatistics** | `0x000000000000000000000000000000000000006F` |
| **ArbSys** | `0x0000000000000000000000000000000000000064` |
| **ArbWasm** | `0x0000000000000000000000000000000000000071` |
| **ArbWasmCache** | `0x0000000000000000000000000000000000000072` |
| **NodeInterface** | `0x00000000000000000000000000000000000000C8` |

### Misc L2 Contracts

| Contract | Mainnet Address | Testnet Address |
|---|---|---|
| **L2 Multicall** | `0x2cAC2D899eCC914d704FeaAE33ac1bF36277DaD1` | `0xa432504b6F04Cafe775b09D8AA92e8dbe41Ec7a8` |
| **Permit2** | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` |

---

## Wallet Setup

### Robinhood Wallet
Native support via the [Robinhood Wallet](https://robinhood.com/web3-wallet/) mobile app (iOS/Android).

### Browser Wallets (MetaMask, Phantom, etc.)

Add manually in MetaMask:

| Field | Mainnet | Testnet |
|---|---|---|
| **Chain ID** | `4663` | `46630` |
| **Default RPC URL** | `https://rpc.mainnet.chain.robinhood.com/` | `https://rpc.testnet.chain.robinhood.com` |
| **Currency Symbol** | `ETH` | `ETH` |
| **Block Explorer** | `robinhoodchain.blockscout.com` | `explorer.testnet.chain.robinhood.com` |

---

## Key Takeaways for Builders

1. **Standard Arbitrum Nitro** — If you've built on Arbitrum, you already know how to build here. Same tooling, same precompiles, same bridge mechanics.
2. **RWA-focused but fully permissionless** — Anyone can deploy any smart contract. The RWA angle is about Robinhood's product direction, not a restriction on builders.
3. **No MEV via priority fees** — The FCFS sequencer means transaction ordering is purely time-based, changing MEV dynamics vs. chains with priority fee auctions.
4. **Permissioned validators** — Unlike Arbitrum One/Nova, validators must be allowlisted, making this closer to an Arbitrum L3 or dedicated chain model.
5. **7-day withdrawal period** — Standard for Arbitrum fraud proofs. Use third-party bridges (Across, Relay) for fast exits.
6. **Alchemy is the primary infrastructure partner** — Gasless tx infrastructure (AA), Data API, and RPC all go through them.
7. **Blockscout as explorer** (not Etherscan) — Verification uses the Blockscout API, not Etherscan's.
8. **Account abstraction is first-class** — ERC-4337 gas sponsorship, batched transactions, and session keys are core design features.
9. **ETH is the native gas token** — Standard for Arbitrum L2s. No custom gas token.

---

## Links

| Resource | URL |
|---|---|
| **Docs Home** | https://docs.robinhood.com/chain/ |
| **Network Status** | http://status.robinhoodchain.offchain.io/ |
| **Mainnet Explorer** | https://robinhoodchain.blockscout.com |
| **Testnet Explorer** | https://explorer.testnet.chain.robinhood.com |
| **Canonical Bridge** | https://portal.arbitrum.io/bridge?destinationChain=robinhood-chain&sourceChain=ethereum |
| **Genesis Config (Mainnet)** | https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-genesis.json |
| **Testnet Config** | https://cdn.robinhood.com/assets/generated_assets/hoodchain_docsite/chain-node-configs/robinhood-chain-testnet-config.json |
| **Developer Support** | chain-developers-group@robinhood.com |
