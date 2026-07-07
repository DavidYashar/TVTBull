import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton, useAccountModal } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import MintPage from './MintPage'
import MyMintsPage from './MyMintsPage'
import AdminPage from './AdminPage'
import GovernancePage from './GovernancePage'
import HomePage from './HomePage'
import { readProvider, TOKEN_ADDRESS, TOKEN_ABI, USDG_ADDRESS, USDG_DECIMALS, ERC20_ABI, EXPLORER_URL } from './constants'

export default function App() {
  const { address } = useAccount()
  const { openAccountModal } = useAccountModal()
  const [tab, setTab] = useState('home')
  const [isAdmin, setIsAdmin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [balances, setBalances] = useState({ eth: '0', tvt: '0', usdg: '0' })

  useEffect(() => {
    if (!address) { setIsAdmin(false); setBalances({ eth: '0', tvt: '0', usdg: '0' }); return }
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const usdg = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, readProvider)
      Promise.all([token.DEPLOYER(), token.TREASURY(), readProvider.getBalance(address), token.balanceOf(address), usdg.balanceOf(address)]).then(([deployer, treasury, ethBal, tvtBal, usdgBal]) => {
        setIsAdmin(address.toLowerCase() === deployer.toLowerCase() || address.toLowerCase() === treasury.toLowerCase())
        setBalances({
          eth: Number(ethers.formatEther(ethBal)).toFixed(4),
          tvt: Number(ethers.formatUnits(tvtBal, 6)).toLocaleString(),
          usdg: Number(ethers.formatUnits(usdgBal, USDG_DECIMALS)).toLocaleString(),
        })
      })
    } catch { setIsAdmin(false) }
  }, [address])

  return (
    <div className="app-page">
      <header className="app-header">
        <div className="header-left">
          <span className="logo-text">TVT</span>
          <img src="/token-logo.jpg" alt="TVT" className="header-logo" />

        </div>
        <nav className="header-nav">
          <button className={`tab-btn ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>Home</button>
          <button className={`tab-btn ${tab === 'mint' ? 'active' : ''}`} onClick={() => setTab('mint')}>Mint</button>
          <button className={`tab-btn ${tab === 'mymints' ? 'active' : ''}`} onClick={() => setTab('mymints')}>My Mints</button>
          <button className={`tab-btn ${tab === 'swap' ? 'active' : ''}`} onClick={() => setTab('swap')}>Swap</button>
          <button className={`tab-btn ${tab === 'governance' ? 'active' : ''}`} onClick={() => setTab('governance')}>Governance</button>
          {isAdmin && (
            <button className={`tab-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>Admin</button>
          )}
        </nav>
        <div className="header-right">
          <button className="hamburger-btn" onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
          {address && (
            <span className="header-balances">
              <span className="bal-item">{balances.tvt} TVT</span>
              <span className="bal-item">{balances.usdg} USDG</span>
            </span>
          )}
          <ConnectButton />
        </div>

        {/* Mobile Menu Overlay */}
        {menuOpen && (
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
            <div className="mobile-menu" onClick={e => e.stopPropagation()}>
              <button className="mobile-close" onClick={() => setMenuOpen(false)}>✕</button>
              <button className={`tab-btn ${tab === 'home' ? 'active' : ''}`} onClick={() => { setTab('home'); setMenuOpen(false) }}>Home</button>
              <button className={`tab-btn ${tab === 'mint' ? 'active' : ''}`} onClick={() => { setTab('mint'); setMenuOpen(false) }}>Mint</button>
              <button className={`tab-btn ${tab === 'mymints' ? 'active' : ''}`} onClick={() => { setTab('mymints'); setMenuOpen(false) }}>My Mints</button>
              <button className={`tab-btn ${tab === 'swap' ? 'active' : ''}`} onClick={() => { setTab('swap'); setMenuOpen(false) }}>Swap</button>
              <button className={`tab-btn ${tab === 'governance' ? 'active' : ''}`} onClick={() => { setTab('governance'); setMenuOpen(false) }}>Governance</button>
              {isAdmin && (
                <button className={`tab-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); setMenuOpen(false) }}>Admin</button>
              )}
              {address && (
                <div className="mobile-wallet-info">
                  <div className="mobile-bal-item connected-label" onClick={openAccountModal} style={{ cursor: 'pointer' }}>
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </div>
                  <div className="mobile-bal-item">{balances.eth} ETH</div>
                  <div className="mobile-bal-item">{balances.usdg} USDG</div>
                  <div className="mobile-bal-item">{balances.tvt} TVT</div>
                </div>
              )}
              {!address && (
                <div style={{ marginTop: 12 }}>
                  <ConnectButton />
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <div className="landing-container">
        {tab === 'home' && <HomePage onStartMint={() => setTab('mint')} />}
        {tab === 'mint' && <MintPage />}
        {tab === 'mymints' && <MyMintsPage />}
        {tab === 'swap' && (
          <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Coming Soon</p>
            <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Swap will be available after minting is complete and liquidity is provided.</p>
          </div>
        )}
        {tab === 'governance' && <GovernancePage />}
        {tab === 'admin' && isAdmin && <AdminPage />}
      </div>

      <footer className="app-footer">
        <span>Robinhood Chain</span>
        <span className="footer-sep">|</span>
        <a href={`${EXPLORER_URL}/address/${TOKEN_ADDRESS}`} target="_blank" rel="noreferrer">Explorer</a>
        <span className="footer-sep">|</span>
        <a href="https://x.com/TVTBull" target="_blank" rel="noreferrer" className="footer-x">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 4 }}>
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
          
        </a>
      </footer>
    </div>
  )
}
