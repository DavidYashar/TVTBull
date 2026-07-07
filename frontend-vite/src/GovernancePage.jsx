import { useState, useEffect } from 'react'
import { useAccount, useWalletClient } from 'wagmi'
import { ethers } from 'ethers'
import { readProvider, TOKEN_ADDRESS, TOKEN_ABI } from './constants'

export default function GovernancePage() {
  const { address, isConnected } = useAccount()
  const { data: walletClient } = useWalletClient()

  const [proposals, setProposals] = useState([])
  const [vtbBalance, setVtbBalance] = useState(0)
  const [mintingClosed, setMintingClosed] = useState(false)
  const [governanceClosed, setGovernanceClosed] = useState(false)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  // Create form
  const [showCreate, setShowCreate] = useState(false)
  const [targetAddr, setTargetAddr] = useState('')
  const [desc, setDesc] = useState('')
  const [creating, setCreating] = useState(false)

  // Vote / Execute state
  const [voting, setVoting] = useState({})
  const [executing, setExecuting] = useState({})

  // Detail modal
  const [detail, setDetail] = useState(null)

  // Status
  const [status, setStatus] = useState({ type: '', message: '' })

  useEffect(() => {
    refresh()
    const t = setInterval(() => { setNow(Math.floor(Date.now() / 1000)); refresh() }, 15_000)
    return () => clearInterval(t)
  }, [isConnected, address])

  async function refresh() {
    try {
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
      const [closed, govClosed, count] = await Promise.all([
        token.mintingClosed(), token.governanceClosed(), token.proposalCount()
      ])
      setMintingClosed(closed)
      setGovernanceClosed(govClosed)

      if (address) {
        const bal = await token.balanceOf(address)
        setVtbBalance(Number(ethers.formatUnits(bal, 6)))
      }

      // Fetch all proposals
      const list = []
      for (let i = 0; i < Number(count); i++) {
        try {
          const p = await token.getProposal(i)
          const hasV = address ? await token.hasVoted(i, address) : false
          list.push({
            id: i,
            proposer: p.proposer,
            targetWallet: p.targetWallet,
            description: p.description,
            votesFor: Number(p.votesFor),
            votesAgainst: Number(p.votesAgainst),
            deadline: Number(p.deadline),
            executed: p.executed,
            totalVoters: Number(p.totalVoters),
            hasVoted: hasV,
          })
        } catch (e) { /* skip */ }
      }
      setProposals(list)
    } catch (err) { console.error(err) }
  }

  async function createProposal() {
    if (!walletClient || !targetAddr || !desc.trim()) return
    setCreating(true)
    setStatus({ type: '', message: '' })
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      const tx = await token.createProposal(targetAddr, desc.trim())
      await tx.wait()
      setStatus({ type: 'success', message: 'Proposal created!' })
      setShowCreate(false)
      setTargetAddr('')
      setDesc('')
      await refresh()
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
    setCreating(false)
  }

  async function doVote(pid, support) {
    if (!walletClient) return
    setVoting(v => ({ ...v, [pid]: true }))
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      const tx = await token.vote(pid, support)
      await tx.wait()
      await refresh()
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
    setVoting(v => ({ ...v, [pid]: false }))
  }

  async function doExecute(pid) {
    if (!walletClient) return
    setExecuting(e => ({ ...e, [pid]: true }))
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, signer)
      const tx = await token.executeProposal(pid)
      await tx.wait()
      await refresh()
    } catch (err) {
      setStatus({ type: 'error', message: err.reason || err.message })
    }
    setExecuting(e => ({ ...e, [pid]: false }))
  }

  function proposalStatus(p) {
    if (p.executed) {
      const total = p.votesFor + p.votesAgainst
      return total > 0 && p.votesFor * 100 >= total * 60 ? 'PASSED' : 'REJECTED'
    }
    if (now >= p.deadline) return 'AWAITING EXECUTION'
    return 'ACTIVE'
  }

  function statusClass(s) {
    if (s === 'PASSED') return 'status-passed'
    if (s === 'REJECTED') return 'status-rejected'
    if (s === 'AWAITING EXECUTION') return 'status-awaiting'
    return 'status-active'
  }

  function timeLeft(deadline) {
    const s = deadline - now
    if (s <= 0) return 'Ended'
    const m = Math.floor(s / 60)
    const h = Math.floor(m / 60)
    if (h > 0) return `${h}h ${m % 60}m left`
    return `${m}m ${s % 60}s left`
  }

  const canPropose = isConnected && vtbBalance >= 10_000 && mintingClosed && !governanceClosed
  const canVote = isConnected && vtbBalance >= 10_000 && mintingClosed && !governanceClosed

  if (!mintingClosed) {
    return (
      <div className="landing-card" style={{ textAlign: 'center', padding: 60 }}>
        <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-dim)', marginBottom: 8 }}>Governance Locked</p>
        <p style={{ fontSize: 14, color: 'var(--text-dim)' }}>Voting and proposals will open after the mint phase is complete (all 300M TVT minted).</p>
      </div>
    )
  }

  return (
    <div className="landing-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Governance</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Your TVT: <b style={{ color: '#ccff00' }}>{vtbBalance.toLocaleString()}</b>
          </span>
          {canPropose && (
            <button className="action-btn" style={{ padding: '8px 16px', fontSize: 13 }} onClick={() => setShowCreate(true)}>
              + New Proposal
            </button>
          )}
        </div>
      </div>

      {governanceClosed && (
        <div className="status-msg success" style={{ marginBottom: 16 }}>
          Governance has concluded — the locked supply has been released.
        </div>
      )}

      {/* Create Proposal Form */}
      {showCreate && (
        <div style={{
          background: '#000', border: '1px solid #ccff00',
          borderRadius: 0, padding: 20, marginBottom: 20
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#ccff00' }}>Create Proposal</p>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: 'rgba(204,255,0,0.6)', display: 'block', marginBottom: 4 }}>Target Wallet</label>
            <input
              type="text" value={targetAddr} onChange={e => setTargetAddr(e.target.value)}
              placeholder="0x..."
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 0, border: '1px solid rgba(204,255,0,0.3)',
                background: '#111', color: '#fff', fontSize: 14, fontFamily: 'SF Mono, monospace'
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: 'rgba(204,255,0,0.6)', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea
              value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Why should the 600M locked TVT be sent to this wallet?"
              rows={3}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 0, border: '1px solid rgba(204,255,0,0.3)',
                background: '#111', color: '#fff', fontSize: 14, resize: 'vertical'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="action-btn mint-btn" disabled={creating || !targetAddr || !desc.trim()} onClick={createProposal}>
              {creating ? 'Submitting...' : 'Submit Proposal'}
            </button>
            <button className="batch-btn" onClick={() => { setShowCreate(false); setTargetAddr(''); setDesc('') }}>Cancel</button>
          </div>
        </div>
      )}

      {status.message && <div className={`status-msg ${status.type}`} style={{ marginBottom: 16 }}>{status.message}</div>}

      {/* Proposals List */}
      {proposals.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 40, fontSize: 14 }}>
          No proposals yet. {canPropose ? 'Create the first one!' : 'You need 10K TVT to create a proposal.'}
        </p>
      ) : (
        proposals.map(p => {
          const st = proposalStatus(p)
          const total = p.votesFor + p.votesAgainst
          const pct = total > 0 ? (p.votesFor / total * 100).toFixed(1) : '0.0'
          return (
            <div key={p.id} style={{
              background: '#000', border: '1px solid #ccff00',
              borderRadius: 0, padding: 20, marginBottom: 12
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Proposal #{p.id + 1}</span>
                <span className={statusClass(st)} style={{
                  padding: '4px 12px', borderRadius: 0, fontSize: 11, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>{st}</span>
              </div>

              <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12, lineHeight: 1.5 }}>
                {p.description.length > 120 ? p.description.slice(0, 120) + '...' : p.description}
              </p>

              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => setDetail(p)} style={{
                  background: '#000', border: '1px solid #ccff00',
                  color: '#ccff00', padding: '6px 12px', borderRadius: 0, cursor: 'pointer', fontSize: 12
                }}>View Full Details →</button>
                <span style={{ color: '#888' }}>{p.totalVoters} voter{p.totalVoters !== 1 ? 's' : ''}</span>
              </div>

              {/* Vote Bar */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#4ade80' }}>For: {p.votesFor}</span>
                  <span style={{ color: '#ef4444' }}>Against: {p.votesAgainst}</span>
                </div>
                <div style={{ height: 6, borderRadius: 0, background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: '#ccff00', transition: 'width 0.3s', borderRadius: 0 }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                  {pct}% yes • Need 60% to pass
                </div>
              </div>

              {/* Time & Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <span style={{ fontSize: 12, color: st === 'ACTIVE' ? '#fbbf24' : 'var(--text-dim)' }}>
                  {st === 'ACTIVE' ? timeLeft(p.deadline) : 'Ended'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {st === 'ACTIVE' && canVote && !p.hasVoted && (
                    <>
                      <button className="action-btn" style={{ padding: '8px 16px', fontSize: 12, background: '#16a34a' }}
                        disabled={voting[p.id]} onClick={() => doVote(p.id, true)}>
                        {voting[p.id] ? '...' : '✓ Yes'}
                      </button>
                      <button className="action-btn" style={{ padding: '8px 16px', fontSize: 12, background: '#dc2626' }}
                        disabled={voting[p.id]} onClick={() => doVote(p.id, false)}>
                        {voting[p.id] ? '...' : '✗ No'}
                      </button>
                    </>
                  )}
                  {st === 'ACTIVE' && canVote && p.hasVoted && (
                    <span style={{ fontSize: 12, color: 'var(--gold)' }}>✓ Voted</span>
                  )}
                  {st === 'AWAITING EXECUTION' && (
                    <button className="action-btn" style={{ padding: '8px 16px', fontSize: 12 }}
                      disabled={executing[p.id]} onClick={() => doExecute(p.id)}>
                      {executing[p.id] ? '...' : 'Execute'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      )}

      {/* ─── Detail Modal ─── */}
      {detail && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20
        }} onClick={() => setDetail(null)}>
          <div style={{
            background: '#000', border: '1px solid #ccff00', borderRadius: 0,
            padding: 28, maxWidth: 560, width: '100%', maxHeight: '80vh', overflowY: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Proposal #{detail.id + 1}</h3>
              <button onClick={() => setDetail(null)} style={{
                background: 'none', border: 'none', color: '#ccff00', fontSize: 20, cursor: 'pointer', padding: '4px 8px'
              }}>✕</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(204,255,0,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Description</label>
              <p style={{ fontSize: 14, color: '#ddd', lineHeight: 1.6, margin: 0 }}>{detail.description}</p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(204,255,0,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Proposer</label>
              <code onClick={() => navigator.clipboard.writeText(detail.proposer)} title="Click to copy" style={{
                display: 'block', padding: '10px 14px', background: '#111',
                borderRadius: 0, fontSize: 13, color: '#ccff00', wordBreak: 'break-all',
                fontFamily: 'SF Mono, monospace', cursor: 'pointer',
                border: '1px solid rgba(204,255,0,0.2)'
              }}>{detail.proposer}</code>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, color: 'rgba(204,255,0,0.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, display: 'block' }}>Target Wallet</label>
              <code onClick={() => navigator.clipboard.writeText(detail.targetWallet)} title="Click to copy" style={{
                display: 'block', padding: '10px 14px', background: '#111',
                borderRadius: 0, fontSize: 13, color: '#4ade80', wordBreak: 'break-all',
                fontFamily: 'SF Mono, monospace', cursor: 'pointer',
                border: '1px solid rgba(204,255,0,0.2)'
              }}>{detail.targetWallet}</code>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div className="stat-box">
                <span className="stat-box-label">Votes For</span>
                <span className="stat-box-value" style={{ color: '#4ade80' }}>{detail.votesFor}</span>
              </div>
              <div className="stat-box">
                <span className="stat-box-label">Votes Against</span>
                <span className="stat-box-value" style={{ color: '#ef4444' }}>{detail.votesAgainst}</span>
              </div>
              <div className="stat-box">
                <span className="stat-box-label">Total Voters</span>
                <span className="stat-box-value">{detail.totalVoters}</span>
              </div>
            </div>

            <div style={{ fontSize: 12, color: 'rgba(204,255,0,0.6)', marginTop: 8 }}>
              Status: <span className={statusClass(proposalStatus(detail))} style={{
                padding: '2px 10px', borderRadius: 0, fontSize: 11, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>{proposalStatus(detail)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
