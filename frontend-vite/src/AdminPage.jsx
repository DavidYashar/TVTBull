import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { readProvider, TOKEN_ADDRESS, OLD_TOKEN_ADDRESS, USDG_ADDRESS, USDG_DECIMALS, UNISWAP_V2_ROUTER, TOKEN_ABI, ERC20_ABI, UNISWAP_V2_ROUTER_ABI } from './constants'

export default function AdminPage() {
  const { address } = useAccount()
  const { data: walletClient } = useWalletClient()
  const [isDeployer, setIsDeployer] = useState(false)
  const [isTreasury, setIsTreasury] = useState(false)
  const [data, setData] = useState({ paused: false, closed: false, remaining: '0', contractUSDG: '0', oldContractUSDG: '0', treasuryToken: '0', treasuryUSDG: '0', deployerTVT: '0', totalRaised: '0', airdropComplete: false })
  const [lp, setLp] = useState({ tokenAmt: '70000000', usdcAmt: '30000', slippage: '5' })
  const [transferAmt, setTransferAmt] = useState('70000000')
  const [status, setStatus] = useState({ type: '', message: '' })

  // Airdrop state
  const [airdropLoading, setAirdropLoading] = useState(false)
  const [airdropMinters, setAirdropMinters] = useState([])  // { address, oldAmount, newAmount }
  const [airdropTotal, setAirdropTotal] = useState('0')

  useEffect(() => { if (address) load() }, [address])

  async function load() {
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const usdg = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, readProvider)
      const [deployer, treasury, paused, closed, remaining, contractBal] = await Promise.all([
        token.DEPLOYER(), token.TREASURY(), token.mintPaused(), token.mintingClosed(),
        token.remainingMintable(), token.contractUSDCBalance(),
      ])
      // airdropComplete() only exists on V2 contract — fail gracefully on V1
      let airdropDone = false
      try { airdropDone = await token.airdropComplete() } catch {}
      // Old contract USDG balance
      let oldUSDG = '0'
      try {
        const oldToken = new ethers.Contract(OLD_TOKEN_ADDRESS, TOKEN_ABI, readProvider)
        oldUSDG = ethers.formatUnits(await oldToken.contractUSDCBalance(), USDG_DECIMALS)
      } catch {}
      const a = address.toLowerCase()
      setIsDeployer(a === deployer.toLowerCase())
      setIsTreasury(a === treasury.toLowerCase())
      const [tTok, tUSDG, dTVT, totalMinted] = await Promise.all([token.balanceOf(treasury), usdg.balanceOf(treasury), token.balanceOf(deployer), token.totalMinted()])
      const batches = Number(ethers.formatUnits(totalMinted, 6)) / 20_000
      setData({
        paused, closed, airdropComplete: airdropDone,
        remaining: ethers.formatUnits(remaining, 6),
        contractUSDG: ethers.formatUnits(contractBal, USDG_DECIMALS),
        oldContractUSDG: oldUSDG,
        treasuryToken: ethers.formatUnits(tTok, 6),
        treasuryUSDG: ethers.formatUnits(tUSDG, USDG_DECIMALS),
        deployerTVT: ethers.formatUnits(dTVT, 6),
        totalRaised: (batches * 1).toFixed(2),
      })
    } catch (err) { console.error(err) }
  }

  async function doAction(action) {
    if (!walletClient) return
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      setStatus({ type: 'pending', message: 'Confirm in wallet...' })
      let tx
      if (action === 'pause') tx = await token.setMintPaused(true)
      else if (action === 'unpause') tx = await token.setMintPaused(false)
      else if (action === 'burn') {
        if (!confirm('PERMANENTLY close minting? IRREVERSIBLE.')) return
        tx = await token.burnUnminted()
      } else if (action === 'withdraw') {
        tx = await token.withdraw(await token.contractUSDCBalance())
      }
      if (tx) { await tx.wait(); setStatus({ type: 'success', message: 'Done.' }); await load() }
    } catch (err) { setStatus({ type: 'error', message: err.reason || err.message }) }
  }
  // ═══════════════ AIRDROP ═════════════════════════════

  async function loadOldMinters() {
    if (!isDeployer) return
    setAirdropLoading(true)
    setStatus({ type: '', message: '' })
    try {
      const oldToken = new ethers.Contract(OLD_TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const filter = oldToken.filters.Minted()
      const deployBlock = 3491683
      const currentBlock = await readProvider.getBlockNumber()
      const chunkSize = 5000
      const addrMap = {}
      for (let from = deployBlock; from < currentBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, currentBlock)
        try {
          const events = await oldToken.queryFilter(filter, from, to)
          for (const ev of events) {
            const minter = ev.args.buyer || ev.args[0]
            const tokensVal = ev.args.tokens || ev.args[2] || 0n
            const bal = Number(ethers.formatUnits(tokensVal, 6))
            addrMap[minter] = (addrMap[minter] || 0) + bal
          }
        } catch (e) { console.warn('Query chunk failed:', e.message) }
      }
      const list = Object.entries(addrMap)
        .filter(([, v]) => v > 0)
        .map(([addr, v]) => ({ address: addr, oldAmount: v, newAmount: v * 4 }))
        .sort((a, b) => b.oldAmount - a.oldAmount)
      setAirdropMinters(list)
      setAirdropTotal(list.reduce((s, m) => s + m.newAmount, 0).toLocaleString())
      setStatus({ type: 'success', message: `Loaded ${list.length} minters.` })
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
    setAirdropLoading(false)
  }

  async function doAirdrop() {
    if (!walletClient || airdropMinters.length === 0) return
    setStatus({ type: 'pending', message: 'Confirm airdrop in wallet...' })
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      const addresses = airdropMinters.map(m => m.address)
      const oldAmounts = airdropMinters.map(m => ethers.parseUnits(String(m.oldAmount), 6))
      const tx = await token.airdrop(addresses, oldAmounts)
      await tx.wait()
      setStatus({ type: 'success', message: 'Airdrop complete!' })
      await load()
      setAirdropMinters([])
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
  }

  async function withdrawOldContract() {
    if (!walletClient) return
    setStatus({ type: 'pending', message: 'Confirm withdraw from OLD contract...' })
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const oldToken = new ethers.Contract(OLD_TOKEN_ADDRESS, TOKEN_ABI, signer)
      const bal = await oldToken.contractUSDCBalance()
      const tx = await oldToken.withdraw(bal)
      await tx.wait()
      setStatus({ type: 'success', message: 'Old contract USDG withdrawn to treasury.' })
      await load()
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
  }
  async function sendToTreasury() {
    if (!walletClient || !transferAmt) return
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer)
      const treasury = await new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider).TREASURY()
      const amt = ethers.parseUnits(transferAmt, 6)
      setStatus({ type: 'pending', message: 'Sending TVT to treasury...' })
      await (await token.transfer(treasury, amt)).wait()
      setStatus({ type: 'success', message: `Sent ${Number(transferAmt).toLocaleString()} TVT to treasury` })
      await load()
    } catch (err) { setStatus({ type: 'error', message: err.reason || err.message }) }
  }

  async function createLP() {
    if (!walletClient) return
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const router = new ethers.Contract(UNISWAP_V2_ROUTER, UNISWAP_V2_ROUTER_ABI, signer)
      const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer)
      const usdg = new ethers.Contract(USDG_ADDRESS, ERC20_ABI, signer)
      const tokenAmt = ethers.parseUnits(lp.tokenAmt, 6)
      const usdgAmt = ethers.parseUnits(lp.usdcAmt, USDG_DECIMALS)
      const slip = parseFloat(lp.slippage) || 5
      const deadline = Math.floor(Date.now() / 1000) + 1200
      const tokenMin = tokenAmt * BigInt(Math.floor((100 - slip) * 10)) / 1000n
      const usdgMin = usdgAmt * BigInt(Math.floor((100 - slip) * 10)) / 1000n

      setStatus({ type: 'pending', message: 'Approving tokens...' })
      if ((await token.allowance(address, UNISWAP_V2_ROUTER)) < tokenAmt) await (await token.approve(UNISWAP_V2_ROUTER, tokenAmt)).wait()
      setStatus({ type: 'pending', message: 'Approving USDG...' })
      if ((await usdg.allowance(address, UNISWAP_V2_ROUTER)) < usdgAmt) await (await usdg.approve(UNISWAP_V2_ROUTER, usdgAmt)).wait()
      setStatus({ type: 'pending', message: 'Creating LP...' })
      await (await router.addLiquidity(TOKEN_ADDRESS, USDG_ADDRESS, tokenAmt, usdgAmt, tokenMin, usdgMin, address, deadline)).wait()
      setStatus({ type: 'success', message: 'LP created.' })
    } catch (err) { setStatus({ type: 'error', message: err.reason || err.message }) }
  }

  if (!isDeployer && !isTreasury) return <div className="landing-card" style={{ textAlign: 'center', borderColor: 'rgba(255,142,155,.3)', background: 'rgba(255,142,155,.06)' }}><p style={{ color: 'var(--danger)' }}>Access denied.</p></div>

  return (
    <>
      <div className="landing-card" style={{ marginBottom: 16, textAlign: 'center' }}>
        <p style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>TOTAL RAISED</p>
        <p style={{ fontSize: 28, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>{data.totalRaised} USDG</p>
      </div>

      <div className="landing-card" style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Treasury Balances</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>USDG</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>{Number(data.treasuryUSDG).toLocaleString()} USDG</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 2 }}>TVT</p>
            <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>{Number(data.treasuryToken).toLocaleString()} TVT</p>
          </div>
        </div>
      </div>

      {isDeployer && (
        <div className="landing-card" style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Deployer Controls</p>
          <div className="admin-group">
            <p style={{ fontSize: 13, marginBottom: 8 }}>Status: <b style={{ color: data.closed ? 'var(--danger)' : data.paused ? 'var(--warning)' : 'var(--green)' }}>{data.closed ? 'CLOSED' : data.paused ? 'PAUSED' : 'ACTIVE'}</b></p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="action-btn" style={{ background: 'rgba(210,153,34,.1)', borderColor: 'rgba(210,153,34,.3)', color: 'var(--warning)' }} disabled={data.paused || data.closed} onClick={() => doAction('pause')}>Pause</button>
              <button className="action-btn" style={{ background: 'rgba(63,185,80,.1)', borderColor: 'rgba(63,185,80,.3)', color: 'var(--green)' }} disabled={!data.paused || data.closed} onClick={() => doAction('unpause')}>Unpause</button>
            </div>
          </div>
          <div className="admin-group" style={{ borderColor: 'rgba(248,81,73,.3)' }}>
            <p style={{ fontSize: 13, marginBottom: 4 }}>Burn Unminted: <b>{Number(data.remaining).toLocaleString()} TVT</b></p>
            <p style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 8 }}>IRREVERSIBLE</p>
            <button className="action-btn" style={{ background: 'rgba(248,81,73,.1)', borderColor: 'rgba(248,81,73,.3)', color: 'var(--danger)' }} disabled={data.closed} onClick={() => doAction('burn')}>Burn Unminted</button>
          </div>
          <div className="admin-group">
            <p style={{ fontSize: 13, marginBottom: 4 }}>Send TVT to Treasury</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>Your balance: <b>{Number(data.deployerTVT).toLocaleString()} TVT</b> | Treasury: {Number(data.treasuryToken).toLocaleString()} TVT</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="admin-input" type="number" value={transferAmt} onChange={e => setTransferAmt(e.target.value)} placeholder="Amount" style={{ flex: 1 }} />
              <button className="action-btn" style={{ width: 'auto', padding: '10px 20px' }} onClick={sendToTreasury}>Send</button>
            </div>
          </div>
          <div className="admin-group" style={{ borderColor: 'rgba(204,255,0,.3)', background: 'rgba(204,255,0,.03)' }}>
            <p style={{ fontSize: 13, marginBottom: 4 }}>Airdrop to Previous Minters</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 8 }}>
              {data.airdropComplete ? 'Airdrop already executed.' : 'Load old minters, then execute airdrop (4x old amount from mintable supply).'}
            </p>
            {data.airdropComplete ? (
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)' }}>✓ Airdrop Complete</span>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button className="action-btn" disabled={airdropLoading} onClick={loadOldMinters}>
                    {airdropLoading ? 'Loading...' : 'Load Old Minters'}
                  </button>
                  <button className="action-btn" style={{ background: 'rgba(204,255,0,.15)' }}
                    disabled={airdropMinters.length === 0 || airdropLoading}
                    onClick={doAirdrop}>
                    Execute Airdrop
                  </button>
                </div>
                {airdropMinters.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--gold)', marginBottom: 6 }}>
                      {airdropMinters.length} minters · {airdropTotal} TVT total airdrop
                    </p>
                    <div style={{ maxHeight: 200, overflowY: 'auto', fontSize: 11 }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ color: 'rgba(204,255,0,.6)', textAlign: 'left' }}>
                            <th style={{ padding: '4px 8px' }}>Address</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right' }}>Old</th>
                            <th style={{ padding: '4px 8px', textAlign: 'right' }}>New (4x)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {airdropMinters.map(m => (
                            <tr key={m.address} style={{ borderTop: '1px solid rgba(204,255,0,.1)' }}>
                              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{m.address.slice(0, 6)}...{m.address.slice(-4)}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right' }}>{m.oldAmount.toLocaleString()}</td>
                              <td style={{ padding: '4px 8px', textAlign: 'right', color: '#ccff00' }}>{m.newAmount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {isTreasury && (
        <div className="landing-card">
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Treasury Controls</p>
          <div className="admin-group">
            <p style={{ fontSize: 13, marginBottom: 4 }}>Contract USDG</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', margin: '0 0 8px' }}>{Number(data.contractUSDG).toLocaleString()} USDG</p>
            <button className="action-btn" onClick={() => doAction('withdraw')}>Withdraw All USDG</button>
          </div>
          <div className="admin-group" style={{ borderColor: 'rgba(210,153,34,.3)', background: 'rgba(210,153,34,.04)' }}>
            <p style={{ fontSize: 13, marginBottom: 4 }}>Old Contract USDG (0xdE7A...fAf)</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--warning)', margin: '0 0 8px' }}>{Number(data.oldContractUSDG).toLocaleString()} USDG</p>
            <button className="action-btn" style={{ background: 'rgba(210,153,34,.1)', borderColor: 'rgba(210,153,34,.3)', color: 'var(--warning)' }} disabled={Number(data.oldContractUSDG) <= 0} onClick={withdrawOldContract}>Withdraw from Old Contract</button>
          </div>
          <div className="admin-group" style={{ borderColor: 'rgba(210,153,34,.3)', background: 'rgba(210,153,34,.04)' }}>
            <p style={{ fontSize: 13, marginBottom: 8, color: 'var(--warning)' }}>Provide Liquidity (MAINNET ONLY)</p>
            <p style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 12 }}>LP creation works on Robinhood Chain mainnet (chain 4663).</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
              <input className="admin-input" type="number" value={lp.tokenAmt} onChange={e => setLp({ ...lp, tokenAmt: e.target.value })} placeholder="Token amount" disabled />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -6 }}>Treasury: {Number(data.treasuryToken).toLocaleString()} TVT</span>
              <input className="admin-input" type="number" value={lp.usdcAmt} onChange={e => setLp({ ...lp, usdcAmt: e.target.value })} placeholder="USDG amount" disabled />
              <span style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: -6 }}>Treasury: {Number(data.treasuryUSDG).toLocaleString()} USDG</span>
              <input className="admin-input" type="number" value={lp.slippage} onChange={e => setLp({ ...lp, slippage: e.target.value })} placeholder="Slippage %" disabled />
            </div>
            <button className="action-btn" onClick={createLP} disabled style={{ opacity: 0.3 }}>Create LP (Mainnet Only)</button>
          </div>
        </div>
      )}

      {status.message && <div className={`status-msg ${status.type}`} style={{ marginTop: 12 }}>{status.message}</div>}
    </>
  )
}
