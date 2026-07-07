import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ethers } from 'ethers'
import { readProvider, TOKEN_ADDRESS, TOKEN_ABI, USDG_DECIMALS } from './constants'

export default function MyMintsPage() {
  const { address, isConnected } = useAccount()
  const [data, setData] = useState({ balance: '0', minted: '0', batches: 0, spent: '0', percent: '0' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    refresh()
  }, [address])

  async function refresh() {
    setLoading(true)
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const [bal, mintableAll] = await Promise.all([
        token.balanceOf(address),
        token.MINTABLE_SHARE(),
      ])
      const balanceNum = Number(ethers.formatUnits(bal, 6))
      const mintableNum = Number(ethers.formatUnits(mintableAll, 6))

      // Query Minted events from deploy block
      const filter = token.filters.Minted(address)
      const currentBlock = await readProvider.getBlockNumber()
      const deployBlock = 3491683
      const chunkSize = 5000
      let totalMinted = 0, totalSpent = 0
      for (let from = deployBlock; from < currentBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, currentBlock)
        try {
          const events = await token.queryFilter(filter, from, to)
          for (const ev of events) {
            // args: buyer(indexed), batches, tokens, costUSDC
            const tokensVal = ev.args.tokens || ev.args[2] || 0n
            const costVal   = ev.args.costUSDC || ev.args[3] || 0n
            totalMinted += Number(ethers.formatUnits(tokensVal, 6))
            totalSpent  += Number(ethers.formatUnits(costVal, USDG_DECIMALS))
          }
        } catch (e) { console.warn('Event chunk failed:', from, to, e.message) }
      }

      setData({
        balance: balanceNum.toLocaleString(),
        minted: totalMinted.toLocaleString(),
        batches: Math.floor(totalMinted / 10_000),
        spent: totalSpent.toFixed(2),
        percent: mintableNum > 0 ? (totalMinted / mintableNum * 100).toFixed(4) : '0',
      })
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  if (!isConnected) {
    return <div className="landing-card" style={{ textAlign: 'center' }}><p style={{ color: 'var(--text-dim)' }}>Connect wallet to view your mints.</p></div>
  }

  return (
    <div className="landing-card">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>YOUR BALANCE</p>
        <p style={{ fontSize: 36, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>{data.balance} TVT</p>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16,
        padding: '16px 0', borderTop: '1px solid rgba(230,168,23,0.1)', borderBottom: '1px solid rgba(230,168,23,0.1)',
        marginBottom: 16
      }}>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>YOU MINTED</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{data.minted} TVT</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>BATCHES</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{data.batches}</p>
        </div>
        <div>
          <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>SPENT</p>
          <p style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{data.spent} USDG</p>
        </div>
      </div>

      <div className="landing-progress-wrap">
        <div className="landing-progress-head">
          <span>Your Share of Mintable Supply</span>
          <span><b>{data.percent}%</b></span>
        </div>
        <div className="landing-progress-bar">
          <div className="landing-bar-fill" style={{ width: Math.min(100, parseFloat(data.percent)).toFixed(2) + '%' }} />
        </div>
      </div>

      <button className="action-btn" onClick={refresh} style={{ marginTop: 16, width: '100%', background: 'rgba(230,168,23,0.1)', border: '1px solid rgba(230,168,23,0.2)', color: 'var(--gold)' }}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  )
}
