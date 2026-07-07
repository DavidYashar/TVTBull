import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { readProvider, TOKEN_ADDRESS, USDG_ADDRESS, USDG_DECIMALS, TOKEN_ABI, ERC20_ABI, EXPLORER_API_KEY, EXPLORER_API_URL, EXPLORER_URL } from './constants'

export default function MintPage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [status, setStatus] = useState({ type: '', message: '' })
  const [stats, setStats] = useState({ totalMinted: 0, remaining: 0, percent: 0, paused: false, closed: false, mintableTotal: 0 })
  const [balances, setBalances] = useState({ eth: '0', usdg: '0', tvt: '0' })
  const [minting, setMinting] = useState(false)
  const [holders, setHolders] = useState([])
  const [excluded, setExcluded] = useState([])
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 10_000)
    return () => clearInterval(interval)
  }, [isConnected, address])

  async function refresh() {
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const usdg = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, readProvider)
      const [totalMinted, remaining, mintableAll, paused, closed] = await Promise.all([
        token.totalMinted(), token.remainingMintable(), token.MINTABLE_SHARE(),
        token.mintPaused(), token.mintingClosed(),
      ])
      const mintableNum = Number(ethers.formatUnits(mintableAll, 6))
      setStats({
        totalMinted: Number(ethers.formatUnits(totalMinted, 6)),
        remaining: Number(ethers.formatUnits(remaining, 6)),
        percent: mintableNum > 0 ? (Number(ethers.formatUnits(totalMinted, 6)) / mintableNum * 100) : 0,
        paused, closed,
        mintableTotal: mintableNum
      })
      if (address) {
        const [ethBal, usdgBal, tvtBal] = await Promise.all([
          readProvider.getBalance(address), usdg.balanceOf(address), token.balanceOf(address),
        ])
        setBalances({
          eth: Number(ethers.formatEther(ethBal)).toFixed(4),
          usdg: Number(ethers.formatUnits(usdgBal, USDG_DECIMALS)).toLocaleString(),
          tvt: Number(ethers.formatUnits(tvtBal, 6)).toLocaleString(),
        })
      }
    } catch (err) { console.error(err) }
    // Fetch holders leaderboard (no need to block UI)
    fetchHolders()
  }

  async function fetchHolders() {
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const [deployer, treasury] = await Promise.all([token.DEPLOYER(), token.TREASURY()])
      const excludedList = [deployer.toLowerCase(), treasury.toLowerCase(), TOKEN_ADDRESS.toLowerCase()]
      setExcluded(excludedList)

      // Fetch holders from Blockscout
      const res = await fetch(`${EXPLORER_API_URL}/tokens/${TOKEN_ADDRESS}/holders?apikey=${EXPLORER_API_KEY}`)
      const json = await res.json()
      const items = (json.items || []).map(h => {
        const addr = typeof h.address === 'string' ? h.address : h.address?.hash || ''
        const bal = h.value || '0'
        return { address: addr, balance: Number(ethers.formatUnits(bal, 6)) }
      }).filter(h => h.address && !excludedList.includes(h.address.toLowerCase()) && h.balance > 0)
       .sort((a, b) => b.balance - a.balance)

      // Query ALL Minted events to get latest tx per address
      const currentBlock = await readProvider.getBlockNumber()
      const deployBlock = 3491683
      const chunkSize = 5000
      const txMap = {}
      for (let from = deployBlock; from < currentBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, currentBlock)
        try {
          const events = await token.queryFilter('Minted', from, to)
          for (const ev of events) {
            const buyer = (ev.args.buyer || ev.args[0] || '').toLowerCase()
            txMap[buyer] = ev.transactionHash
          }
        } catch (e) {}
      }

      // Attach tx hash to each holder
      for (const h of items) {
        h.txHash = txMap[h.address.toLowerCase()] || ''
      }

      setHolders(items)
    } catch (err) { console.error('Holders fetch error:', err) }
  }

  async function mint() {
    if (!walletClient) return
    setMinting(true)
    setStatus({ type: 'pending', message: 'Preparing...' })
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const usdg = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, signer)
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      const cost = ethers.parseUnits('2', USDG_DECIMALS)
      const allowance = await usdg.allowance(address, TOKEN_ADDRESS)
      if (allowance < cost) {
        setStatus({ type: 'pending', message: 'Approve USDG...' })
        await (await usdg.approve(TOKEN_ADDRESS, cost)).wait()
      }
      setStatus({ type: 'pending', message: 'Confirm mint...' })
      await (await token.mint()).wait()
      setStatus({ type: 'success', message: 'Minted 10,000 TVT' })
      await refresh()
    } catch (err) { setStatus({ type: 'error', message: err.reason || err.message }) }
    setMinting(false)
  }

  const canMint = isConnected && !stats.closed && !stats.paused && stats.remaining > 0

  return (
    <div className="landing-card">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div className="stat-box"><span className="stat-box-label">Price / Batch</span><span className="stat-box-value">2 USDG</span></div>
        <div className="stat-box"><span className="stat-box-label">Tokens / Batch</span><span className="stat-box-value">10,000 TVT</span></div>
        <div className="stat-box"><span className="stat-box-label">Global Minted</span><span className="stat-box-value">{stats.totalMinted.toLocaleString()} TVT</span></div>
        <div className="stat-box"><span className="stat-box-label">Total Batches</span><span className="stat-box-value">{Math.floor(stats.totalMinted / 10_000).toLocaleString()}</span></div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 8 }}>1 BATCH PER TRANSACTION</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          <span style={{ textAlign: 'center', fontSize: 24, fontWeight: 700, fontFamily: 'SF Mono, monospace', color: 'var(--gold)' }}>10,000 TVT</span>
        </div>
      </div>

      <div className="summary-box">
        <div className="summary-row"><span>Receive</span><span>10,000 TVT</span></div>
        <div className="summary-row"><span>Cost</span><span>2.00 USDG</span></div>
      </div>

      <button className="action-btn mint-btn" disabled={!canMint || minting} onClick={mint}>
        {!isConnected ? 'Connect Wallet' : stats.closed ? 'Closed' : stats.paused ? 'Paused' : stats.remaining === 0 ? 'Sold Out' : minting ? 'Processing...' : 'Mint'}
      </button>

      <div className="landing-progress-wrap" style={{ marginTop: 20 }}>
        <div className="landing-progress-head"><span>Progress</span><span><b>{stats.totalMinted.toLocaleString()}</b> / {stats.mintableTotal.toLocaleString()}</span></div>
        <div className="landing-progress-bar"><div className="landing-bar-fill" style={{ width: stats.percent.toFixed(1) + '%' }} /></div>
      </div>

      {status.message && <div className={`status-msg ${status.type}`} style={{ marginTop: 12 }}>{status.message}</div>}

      {/* Leaderboard */}
      {holders.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Minters</p>
          <div style={{ overflowX: 'auto' }}>
            <table className="holders-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Address</th>
                  <th>TVT</th>
                  <th>Batches</th>
                  <th>Share</th>
                  <th>TX</th>
                </tr>
              </thead>
              <tbody>
                {holders.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((h, i) => (
                    <tr key={h.address}>
                      <td className="rank">{(page - 1) * PER_PAGE + i + 1}</td>
                      <td className="addr">{h.address.slice(0, 6)}...{h.address.slice(-4)}</td>
                      <td>{h.balance.toLocaleString()}</td>
                      <td>{Math.floor(h.balance / 10_000)}</td>
                      <td>{stats.mintableTotal > 0 ? (h.balance / stats.mintableTotal * 100).toFixed(3) : '0.000'}%</td>
                      <td>{h.txHash ? <a href={`${EXPLORER_URL}/tx/${h.txHash}`} target="_blank" rel="noreferrer" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 12 }}>View</a> : '-'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {holders.length > PER_PAGE && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
              <button className="batch-btn" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>-</button>
              <span style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-dim)' }}>
                {page} / {Math.ceil(holders.length / PER_PAGE)}
              </span>
              <button className="batch-btn" onClick={() => setPage(Math.min(Math.ceil(holders.length / PER_PAGE), page + 1))} disabled={page >= Math.ceil(holders.length / PER_PAGE)}>+</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
