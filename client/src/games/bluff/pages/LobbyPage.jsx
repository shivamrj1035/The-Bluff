import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../store/useGameStore';
import { toast } from '../../../components/common/Toast';
import Avatar from '../../../components/common/Icons';
import ChatInput from '../../../components/common/ChatInput';

const css = `
.lobby-wrap { display:flex; height:100vh; width:100vw; overflow:hidden; background:radial-gradient(ellipse at 30% 0%, #1a0a3d 0%, #0c0c1a 55%, #060614 100%); font-family:'Inter',sans-serif; }
.lobby-sidebar { width:200px; flex-shrink:0; display:flex; flex-direction:column; padding:16px 12px; border-right:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.2); gap:6px; overflow-y:auto; }
.lobby-logo { display:flex; align-items:center; gap:8px; padding:8px 6px 14px; }
.lobby-logo span { font-size:0.88rem; font-weight:900; color:#fff; letter-spacing:-0.01em; }
.lobby-logo .spade { font-size:18px; }
.snav-item { display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:12px; cursor:pointer; font-size:0.8rem; font-weight:700; color:#6b7280; border:none; background:none; width:100%; transition:all 0.15s; }
.snav-item:hover { background:rgba(255,255,255,0.05); color:#d1d5db; }
.snav-item.active { background:rgba(124,58,237,0.25); color:#a78bfa; border:1px solid rgba(124,58,237,0.3); }
.snav-icon { font-size:16px; flex-shrink:0; }
.invite-card { margin-top:auto; background:linear-gradient(135deg,rgba(124,58,237,0.2),rgba(91,33,182,0.15)); border:1px solid rgba(124,58,237,0.25); border-radius:16px; padding:14px 12px; }
.invite-card h5 { margin:0 0 4px; font-size:0.78rem; font-weight:900; color:#fff; }
.invite-card p { margin:0 0 10px; font-size:0.68rem; color:#6b7280; line-height:1.4; }
.invite-btn { width:100%; padding:8px; background:linear-gradient(135deg,#7c3aed,#5b21b6); border:none; border-radius:10px; color:#fff; font-size:0.75rem; font-weight:800; cursor:pointer; }
.online-count { margin-top:10px; padding:6px 0; }
.online-count .dot { display:inline-block; width:7px; height:7px; border-radius:50%; background:#10b981; margin-right:6px; }
.online-count p { margin:0; font-size:0.65rem; color:#6b7280; font-weight:700; }
.online-count strong { font-size:1.1rem; color:#fff; display:block; }

.lobby-main { flex:1; display:flex; flex-direction:column; overflow:hidden; min-width:0; }
.lobby-header { display:flex; align-items:center; justify-content:space-between; padding:10px 16px; border-bottom:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.15); flex-shrink:0; }
.lh-actions { display:flex; align-items:center; gap:8px; }
.lh-btn { display:flex; align-items:center; gap:6px; padding:7px 12px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:#9ca3af; font-size:0.75rem; font-weight:700; cursor:pointer; }
.lh-user { display:flex; align-items:center; gap:8px; padding:6px 10px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; }
.lh-av { width:28px; height:28px; border-radius:50%; background:linear-gradient(135deg,#f97316,#ea580c); display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:900; color:#fff; }
.lh-info { display:flex; flex-direction:column; line-height:1; }
.lh-name { font-size:0.78rem; font-weight:800; color:#fff; }
.lh-status { font-size:0.62rem; color:#10b981; margin-top:2px; }

.lobby-body { flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:12px; }
.room-code-section { text-align:center; }
.rc-label { font-size:0.62rem; font-weight:800; color:#6b7280; letter-spacing:0.2em; margin-bottom:4px; display:flex; align-items:center; justify-content:center; gap:8px; }
.rc-label::before,.rc-label::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.07); max-width:60px; }
.room-code { font-size:2.4rem; font-weight:900; letter-spacing:0.18em; background:linear-gradient(135deg,#c4b5fd,#7c3aed); -webkit-background-clip:text; -webkit-text-fill-color:transparent; filter:drop-shadow(0 0 16px rgba(124,58,237,0.5)); margin:0; line-height:1; }
.invite-link-row { display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:8px 12px; }
.invite-link-row code { flex:1; font-size:0.72rem; color:#6b7280; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:700; }
.copy-btn { padding:5px 12px; background:rgba(124,58,237,0.15); border:1px solid rgba(124,58,237,0.3); border-radius:8px; color:#a78bfa; font-size:0.72rem; font-weight:800; cursor:pointer; white-space:nowrap; }
.copy-btn.copied { background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.3); color:#10b981; }

.players-panel { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:16px; overflow:hidden; }
.players-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid rgba(255,255,255,0.05); }
.players-title { font-size:0.78rem; font-weight:900; color:#fff; letter-spacing:0.06em; }
.drag-hint { font-size:0.6rem; color:#7c3aed; font-weight:800; letter-spacing:0.06em; }
.player-count-badge { padding:3px 10px; background:rgba(255,255,255,0.06); border-radius:20px; font-size:0.72rem; font-weight:900; color:#9ca3af; }
.player-list { display:flex; flex-direction:column; }
.p-row { display:flex; align-items:center; gap:8px; padding:8px 14px; border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.15s; }
.p-row:last-child { border-bottom:none; }
.p-row.me { background:rgba(124,58,237,0.08); }
.p-num { width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:900; color:#6b7280; background:rgba(255,255,255,0.05); flex-shrink:0; }
.p-num.first { background:rgba(124,58,237,0.2); color:#a78bfa; }
.p-name { font-size:0.82rem; font-weight:800; color:#fff; }
.p-badges { display:flex; gap:4px; flex-wrap:wrap; }
.badge { font-size:0.6rem; font-weight:800; letter-spacing:0.06em; }
.badge-host { color:#f59e0b; }
.badge-first { color:#7c3aed; }
.badge-you { color:#a78bfa; }
.badge-dc { color:#ef4444; }
.p-reorder { display:flex; flex-direction:column; gap:2px; margin-left:auto; }
.reorder-btn { padding:1px 5px; font-size:0.6rem; border-radius:4px; background:rgba(124,58,237,0.1); border:1px solid rgba(124,58,237,0.25); color:#a78bfa; cursor:pointer; line-height:1; }
.reorder-btn:disabled { background:transparent; border-color:transparent; color:#1f2937; cursor:default; }
.kick-btn { padding:4px 8px; font-size:0.62rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.2); border-radius:6px; color:#ef4444; font-weight:800; cursor:pointer; }
.dot-live { width:7px; height:7px; border-radius:50%; background:#10b981; flex-shrink:0; }

.chat-row { padding:8px 14px 10px; }
.start-area { padding:0; display:flex; flex-direction:column; gap:8px; }
.hint-text { text-align:center; font-size:0.62rem; color:#7c3aed; font-weight:800; letter-spacing:0.08em; display:flex; align-items:center; justify-content:center; gap:6px; }
.start-btn { display:flex; align-items:center; justify-content:center; gap:10px; padding:14px; background:linear-gradient(135deg,#7c3aed,#a855f7); border:none; border-radius:14px; color:#fff; font-size:0.95rem; font-weight:900; cursor:pointer; letter-spacing:0.08em; box-shadow:0 8px 24px rgba(124,58,237,0.4); width:100%; }
.start-btn:disabled { opacity:0.4; cursor:not-allowed; }
.leave-btn { display:flex; align-items:center; justify-content:center; gap:8px; padding:11px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:14px; color:#6b7280; font-size:0.78rem; font-weight:800; cursor:pointer; width:100%; }
.waiting-box { display:flex; align-items:center; justify-content:center; gap:10px; padding:12px; background:rgba(0,0,0,0.2); border-radius:12px; border:1px solid rgba(255,255,255,0.04); }
.spin { width:18px; height:18px; border:2px solid #7c3aed; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; }
@keyframes spin { to { transform:rotate(360deg); } }

.lobby-right { width:220px; flex-shrink:0; border-left:1px solid rgba(255,255,255,0.05); background:rgba(0,0,0,0.15); overflow-y:auto; padding:12px; display:flex; flex-direction:column; gap:10px; }
.r-card { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:12px; }
.r-card-title { display:flex; align-items:center; gap:6px; font-size:0.7rem; font-weight:900; color:#d1d5db; margin-bottom:8px; letter-spacing:0.04em; }
.r-card-title .icon { font-size:14px; }
.safety-bullets { font-size:0.65rem; color:#6b7280; font-weight:700; margin:0 0 4px; }
.safety-safe { font-size:0.65rem; color:#10b981; font-weight:800; margin:0; }
.tips-list { display:flex; flex-direction:column; gap:4px; }
.tip-item { font-size:0.66rem; color:#6b7280; display:flex; gap:5px; }
.tip-item::before { content:'•'; color:#7c3aed; flex-shrink:0; }
.activity-list { display:flex; flex-direction:column; gap:6px; }
.act-item { display:flex; align-items:center; gap:6px; }
.act-av { width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg,#f97316,#ea580c); display:flex; align-items:center; justify-content:center; font-size:0.55rem; font-weight:900; color:#fff; flex-shrink:0; }
.act-text { font-size:0.63rem; color:#9ca3af; flex:1; }
.act-time { font-size:0.6rem; color:#4b5563; white-space:nowrap; }
.bonus-card { background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(234,88,12,0.08)); border:1px solid rgba(245,158,11,0.2); }
.bonus-title { color:#f59e0b; }
.bonus-text { font-size:0.65rem; color:#6b7280; margin:0 0 8px; }
.bonus-btn { width:100%; padding:8px; background:linear-gradient(135deg,#7c3aed,#5b21b6); border:none; border-radius:10px; color:#fff; font-size:0.72rem; font-weight:800; cursor:pointer; }

@media(max-width:768px){
  .lobby-sidebar { display:none; }
  .lobby-right { display:none; }
  .lobby-wrap { flex-direction:column; }
  .room-code { font-size:1.8rem; }
}
@media(max-width:900px){
  .lobby-right { width:180px; }
  .lobby-sidebar { width:170px; }
}
`;

export default function LobbyPage() {
  const {
    gameState, startGame, roomId, disconnect, kickPlayer,
    reorderPlayers, hostTransferredName, hostTransferredId,
    chatMessages, playerName, avatar,
  } = useGameStore();
  const [copied, setCopied] = useState(false);
  const prevHostTransfer = useRef(null);
  const [activity, setActivity] = useState([]);

  const players = gameState?.players || [];
  const myId = gameState?.myId ?? null;
  const isHost = Boolean(gameState && myId && gameState.hostId === myId);
  const canStart = players.length >= 2;

  useEffect(() => {
    if (hostTransferredName && hostTransferredId && hostTransferredId !== prevHostTransfer.current) {
      prevHostTransfer.current = hostTransferredId;
      if (hostTransferredId === myId) toast.success('👑 You are now the host!');
      else toast.info(`👑 ${hostTransferredName} is the new host`);
    }
  }, [hostTransferredName, hostTransferredId, myId]);

  useEffect(() => {
    if (players.length > 0) {
      const items = players.slice(-3).reverse().map((p, i) => ({
        id: `${p.id}-${i}`,
        name: p.name,
        text: i === players.length - 1 ? 'created the table' : 'joined the table',
        time: 'Just now',
      }));
      setActivity(items);
    }
  }, [players.length]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?room=${roomId}`).then(() => {
      setCopied(true);
      toast.success('Link copied!');
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const movePlayer = (idx, dir) => {
    const arr = [...players];
    const swap = idx + dir;
    if (swap < 0 || swap >= arr.length) return;
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    reorderPlayers(arr.map(p => p.id));
  };

  const avatarLetter = (playerName || '?')[0]?.toUpperCase();

  if (!gameState) {
    return (
      <div style={{ height:'100vh', width:'100vw', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'radial-gradient(ellipse at 50% 0%, #1a0a3d 0%, #0c0c1a 60%, #060614 100%)', gap:16 }}>
        <div style={{ width:40, height:40, border:'3px solid #7c3aed', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#a78bfa', fontWeight:800, fontSize:'0.9rem', letterSpacing:'0.1em', margin:0 }}>JOINING ROOM...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div className="lobby-wrap">
      <style>{css}</style>

      {/* ── Sidebar ── */}
      <aside className="lobby-sidebar">
        <div className="lobby-logo">
          <span className="spade">♠</span>
          <span>THE BLUFF</span>
        </div>
        {[
          { icon:'🎮', label:'Play Now', active:true },
          { icon:'🃏', label:'My Tables' },
          { icon:'👥', label:'Friends' },
          { icon:'📋', label:'History' },
          { icon:'⚙️', label:'Settings' },
        ].map(n => (
          <button key={n.label} className={`snav-item${n.active?' active':''}`}>
            <span className="snav-icon">{n.icon}</span>
            {n.label}
          </button>
        ))}

        <div className="invite-card" style={{ marginTop:'auto' }}>
          <div style={{ fontSize:'1.2rem', marginBottom:6 }}>👑</div>
          <h5>Invite &amp; Earn</h5>
          <p>Invite friends and earn exciting rewards!</p>
          <button className="invite-btn">Invite Now</button>
        </div>

        <div className="online-count">
          <p><span className="dot" />Players Online</p>
          <strong>1,248</strong>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="lobby-main">
        {/* Header */}
        <div className="lobby-header">
          <span style={{ fontSize:'0.8rem', color:'#6b7280', fontWeight:700 }}>Game Lobby</span>
          <div className="lh-actions">
            <button className="lh-btn">❓ How to Play</button>
            <button className="lh-btn">🏆 Leaderboard</button>
            <div className="lh-user">
              <div className="lh-av">{avatarLetter}</div>
              <div className="lh-info">
                <span className="lh-name">{playerName || 'Player'}</span>
                <span className="lh-status">● Online</span>
              </div>
              <span style={{ color:'#6b7280', fontSize:12 }}>▾</span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="lobby-body">
          {/* Room Code */}
          <div className="room-code-section">
            <div className="rc-label">ROOM CODE</div>
            <h1 className="room-code">{roomId}</h1>
          </div>

          {/* Invite link */}
          <div className="invite-link-row">
            <span style={{ color:'#7c3aed', fontSize:14 }}>🔗</span>
            <code>{window.location.origin}?room={roomId}</code>
            <button onClick={copyLink} className={`copy-btn${copied?' copied':''}`}>
              {copied ? '✓ Copied' : '📋 Copy Link'}
            </button>
          </div>

          {/* Players */}
          <div className="players-panel">
            <div className="players-header">
              <span className="players-title">PLAYERS</span>
              {isHost && canStart && <span className="drag-hint">↕ DRAG ORDER = TURN ORDER</span>}
              <span className="player-count-badge">{players.length}/8</span>
            </div>
            <div className="player-list">
              <AnimatePresence>
                {players.map((p, i) => (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity:0, x:-10 }}
                    animate={{ opacity:1, x:0 }}
                    exit={{ opacity:0, x:10 }}
                    className={`p-row${p.id === myId ? ' me' : ''}`}
                  >
                    <div className={`p-num${i===0?' first':''}`}>{i+1}</div>
                    <Avatar name={p.name} size={30} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="p-name">{p.name.toUpperCase()}</div>
                      <div className="p-badges">
                        {gameState.hostId === p.id && <span className="badge badge-host">👑 HOST</span>}
                        {i === 0 && <span className="badge badge-first">GOES FIRST</span>}
                        {p.id === myId && <span className="badge badge-you">(YOU)</span>}
                        {!p.isConnected && <span className="badge badge-dc">DISCONNECTED</span>}
                      </div>
                    </div>
                    {isHost && (
                      <div className="p-reorder">
                        <button className="reorder-btn" onClick={() => movePlayer(i,-1)} disabled={i===0}>▲</button>
                        <button className="reorder-btn" onClick={() => movePlayer(i,1)} disabled={i===players.length-1}>▼</button>
                      </div>
                    )}
                    {isHost && p.id !== myId && (
                      <button className="kick-btn" onClick={() => kickPlayer(p.id)}>KICK</button>
                    )}
                    <div className="dot-live" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <div className="chat-row">
              <ChatInput compact={true} />
            </div>
          </div>

          {/* Start / Leave */}
          <div className="start-area">
            {isHost ? (
              <>
                {canStart && <div className="hint-text">✦ SET TURN ORDER ABOVE, THEN START ✦</div>}
                {!canStart && <div className="hint-text" style={{ color:'#6b7280' }}>Waiting for at least 2 players…</div>}
                <button className="start-btn" onClick={startGame} disabled={!canStart}>
                  START SESSION ⚡
                </button>
              </>
            ) : (
              <div className="waiting-box">
                <div className="spin" />
                <span style={{ color:'#6b7280', fontSize:'0.8rem', fontWeight:800 }}>WAITING FOR HOST TO START...</span>
              </div>
            )}
            <button className="leave-btn" onClick={disconnect}>
              🚪 LEAVE TABLE
            </button>
          </div>
        </div>
      </main>

      {/* ── Right Panel ── */}
      <aside className="lobby-right">
        <div className="r-card">
          <div className="r-card-title"><span className="icon">🛡️</span> Room Safety</div>
          <p className="safety-bullets">Secure • Private • Encrypted</p>
          <p className="safety-safe">Your game is 100% safe</p>
        </div>

        <div className="r-card">
          <div className="r-card-title"><span className="icon">💡</span> Game Tips</div>
          <div className="tips-list">
            {['Drag to change turn order','Host goes first','Share room code with friends','Have fun and play fair!'].map(t=>(
              <div key={t} className="tip-item">{t}</div>
            ))}
          </div>
        </div>

        <div className="r-card">
          <div className="r-card-title"><span className="icon">🕐</span> Recent Activity</div>
          <div className="activity-list">
            {activity.length === 0 ? (
              <div className="tip-item">No activity yet</div>
            ) : activity.map(a => (
              <div key={a.id} className="act-item">
                <div className="act-av">{a.name[0]?.toUpperCase()}</div>
                <span className="act-text"><b>{a.name}</b> {a.text}</span>
                <span className="act-time">{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="r-card bonus-card">
          <div className="r-card-title bonus-title"><span className="icon">🎁</span> Daily Bonus</div>
          <p className="bonus-text">Play daily and claim exciting rewards!</p>
          <button className="bonus-btn">Claim Now</button>
        </div>
      </aside>
    </div>
  );
}
