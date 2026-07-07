import { useAccount } from 'wagmi'
import { useEffect, useState } from 'react'
import { ethers } from 'ethers'
import { readProvider, TOKEN_ADDRESS, TOKEN_ABI } from './constants'

export default function HomePage({ onStartMint }) {
  const { isConnected } = useAccount()
  const [stats, setStats] = useState({ totalMinted: 0, mintable: 0, locked: 0, deployer: 0 })

  useEffect(() => {
    (async () => {
      try {
        const token = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, readProvider)
        const [minted, mintable, locked, deployer] = await Promise.all([
          token.totalMinted(), token.MINTABLE_SHARE(), token.LOCKED_SUPPLY(), token.DEPLOYER_SHARE()
        ])
        setStats({
          totalMinted: Number(ethers.formatUnits(minted, 6)),
          mintable: Number(ethers.formatUnits(mintable, 6)),
          locked: Number(ethers.formatUnits(locked, 6)),
          deployer: Number(ethers.formatUnits(deployer, 6)),
        })
      } catch (e) { console.error(e) }
    })()
  }, [])

  const totalSupply = stats.mintable + stats.locked + stats.deployer

  return (
    <>
      {/* ─── Hero ─── */}
      <section className="home-hero" style={{
        display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 36, alignItems: 'center',
        padding: '48px 0 32px'
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px',
            background: '#000', color: '#ffffff',
            border: '1px solid #ccff00', fontSize: 14, fontWeight: 700, marginBottom: 22
          }}>
            ● Fair Launch · 1 Batch = 10,000 TVT
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 0.95, letterSpacing: '-0.04em',
            marginBottom: 22, color: '#ffffff',
            textShadow: '3px 3px 0 #778800'
          }}>
            THE VLAD<br />TENEV BULL
          </h1>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: 'rgba(255,255,255,0.68)', maxWidth: 620, marginBottom: 30 }}>
            TVT is a fair-launch ERC-20 token on Robinhood Chain with a fixed supply of 1,000,000,000.
            Mint at a fixed price, participate in governance, and unlock the 600M locked supply through community voting.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {onStartMint && (
              <button onClick={onStartMint} style={{
                padding: '14px 28px', border: '1px solid #ccff00', cursor: 'pointer',
                background: '#000', color: '#ffffff',
                fontSize: 15, fontWeight: 800
              }}>
                {isConnected ? 'Go to Mint' : 'Connect to Start'}
              </button>
            )}
            <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 14 }}>Price: 2 USDG / batch</span>
          </div>
        </div>

        {/* Mint Preview Card */}
        <div style={{
          position: 'relative', padding: 28,
          background: '#000',
          border: '1px solid #ccff00',
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)', backdropFilter: 'blur(18px)', overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute', width: 200, height: 200, right: -70, top: -70,
            background: 'rgba(56,255,173,0.20)', filter: 'blur(50px)', borderRadius: '50%'
          }} />
          <div style={{
            position: 'relative', minHeight: 180,
            background: '#000',
            border: '1px solid #ccff00', display: 'grid', placeItems: 'center', marginBottom: 20, borderRadius: 0
          }}>
            <span style={{
              fontSize: 'clamp(56px, 10vw, 110px)', fontWeight: 950, letterSpacing: '-0.08em',
              color: 'rgba(255,255,255,0.94)', textShadow: '0 0 42px rgba(56,255,173,0.35)'
            }}>TVT</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: 22, letterSpacing: '-0.03em' }}>Public Mint</h2>
              <p style={{ color: 'rgba(255,255,255,0.52)', fontSize: 13 }}>1 batch per transaction</p>
            </div>
            <span style={{
              padding: '9px 13px', background: '#000',
              color: '#ccff00', fontWeight: 900, fontSize: 14,
              border: '1px solid rgba(204,255,0,0.3)'
            }}>2 USDG</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 8,
            color: 'rgba(255,255,255,0.70)', fontSize: 13
          }}>
            <span>Minted</span>
            <span>{stats.totalMinted.toLocaleString()} / 300,000,000</span>
          </div>
          <div style={{
            height: 12, background: 'rgba(255,255,255,0.09)', overflow: 'hidden',
            border: '1px solid #ccff00', marginBottom: 16
          }}>
            <div style={{
              width: stats.mintable > 0 ? (stats.totalMinted / stats.mintable * 100).toFixed(1) + '%' : '0%',
              height: '100%',
              background: '#889900',
              boxShadow: '0 0 24px rgba(136,153,0,0.45)', transition: 'width 0.35s ease'
            }} />
          </div>
          <p style={{ color: 'rgba(255,255,255,0.50)', fontSize: 12, textAlign: 'center' }}>
            Batch size: 10,000 TVT · Remaining: {Math.max(0, stats.mintable - stats.totalMinted).toLocaleString()} TVT
          </p>
        </div>
      </section>

      {/* ─── Stats ─── */}
      <section className="home-stats" style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '24px 0 48px'
      }}>
        {[
          { label: 'Total Supply', value: '1,000,000,000' },
          { label: 'Public Mint', value: '300,000,000' },
          { label: 'Locked (Governance)', value: '600,000,000' },
          { label: 'LP Allocation', value: '100,000,000' },
        ].map(s => (
          <div key={s.label} style={{
            padding: 20, background: '#000',
            border: '1px solid #ccff00'
          }}>
            <div style={{ color: 'rgba(255,255,255,0.52)', fontSize: 12, marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em' }}>{s.value}</div>
          </div>
        ))}
      </section>

      {/* ─── Info Panels ─── */}
      <section className="home-panels" style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, paddingBottom: 60
      }}>
        <div style={{
          padding: 28, background: '#000',
          border: '1px solid #ccff00'
        }}>
          <h3 style={{ fontSize: 20, marginBottom: 18 }}>Supply Allocation</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              { pct: '10%', text: '100,000,000 TVT for Uniswap liquidity — held by treasury.' },
              { pct: '30%', text: '300,000,000 TVT available for public mint at 2 USDG per 10K batch.' },
              { pct: '60%', text: '600,000,000 TVT locked — released only by successful governance vote.' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, fontSize: 14 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ccff00',
                  boxShadow: '0 0 14px rgba(204,255,0,0.65)', flex: '0 0 auto', marginTop: 7
                }} />
                <span><b style={{ color: '#7cffc4' }}>{item.pct}</b> — {item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: 28, background: '#000',
          border: '1px solid #ccff00'
        }}>
          <h3 style={{ fontSize: 20, marginBottom: 18 }}>Governance</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              'When mint sells out, 600M locked TVT can be released by a successful community vote.',
              'Only minters can vote — you must have personally minted at least 100,000 TVT.',
              'Minimum 200 votes must be cast for a proposal to be eligible — otherwise it is rejected.',
              '60% yes threshold required to pass. Voting window: 72 hours per proposal.',
              'Max 5 proposals per week. One wallet = one vote per proposal.',
              'Any proposal claiming a wallet belongs to the CEO of Robinhood — if passed — releases all 600M TVT to that address.',
              'Deployer and treasury wallets cannot vote — governance belongs to the community.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, fontSize: 14 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ccff00',
                  boxShadow: '0 0 14px rgba(204,255,0,0.65)', flex: '0 0 auto', marginTop: 7
                }} />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          padding: 28, background: '#000',
          border: '1px solid #ccff00'
        }}>
          <h3 style={{ fontSize: 20, marginBottom: 18 }}>How It Works</h3>
          <div style={{ display: 'grid', gap: 14 }}>
            {[
              'Connect wallet → Mint 1 batch (10K TVT) per transaction.',
              'Repeat as many times as you want — each mint is exactly 1 batch for 2 USDG.',
              'When all 300M mintable TVT are sold, governance unlocks automatically.',
              'After mint-out, treasury provides Uniswap V2 liquidity using the 100M TVT allocation + raised USDG.',
              'Vote on proposals to decide where the 600M locked TVT should go.',
            ].map((text, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55, fontSize: 14 }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: '#ccff00',
                  boxShadow: '0 0 14px rgba(204,255,0,0.65)', flex: '0 0 auto', marginTop: 7
                }} />
                <span>{i + 1}. {text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
