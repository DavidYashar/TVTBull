import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { metaMaskWallet, okxWallet, phantomWallet, walletConnectWallet } from '@rainbow-me/rainbowkit/wallets'
import { http } from 'viem'
import { defineChain } from 'viem'

// Define Robinhood Chain Mainnet
import { EXPLORER_URL } from './constants'

const robinhoodMainnet = defineChain({
  id: 4663,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: EXPLORER_URL },
  },
})

export const config = getDefaultConfig({
  appName: 'TVT Token Launch',
  projectId: 'tvt-token-launch',
  chains: [robinhoodMainnet],
  transports: {
    [robinhoodMainnet.id]: http('https://rpc.mainnet.chain.robinhood.com'),
  },
  wallets: [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet, okxWallet, phantomWallet, walletConnectWallet],
    },
  ],
})
