import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useJKStore } from '../store/useJKStore';
import { useGameStore } from '../../bluff/store/useGameStore';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import ChatInput from '../../../components/common/ChatInput';
import ChatBubble from '../../../components/common/ChatBubble';
import { toast } from '../../../components/common/Toast';

export default function JKLobbyPage() {
  const {
    jkGameState, jkRoomId, jkStatus, jkLeaveRoom, jkStartGame,
    jkKickPlayer, jkReorderPlayers, jkSendChat, jkChatMessages,
    jkHostTransferredName, jkHostTransferredId, jkSocket, jkAddBot
  } = useJKStore();
  const { playerName, avatar, setScreen } = useGameStore();

  const [copied, setCopied] = useState(false);

  const myId    = jkGameState?.myId;
  const isHost  = Boolean(jkGameState && myId && jkGameState.hostId === myId);
  const players = jkGameState?.players || [];
  const connectedCount = players.filter(p => p.isConnected).length;
  const canStart = isHost && connectedCount >= 2;

  // Host transfer toast
  useEffect(() => {
    if (!jkHostTransferredName) return;
    if (jkHostTransferredId === myId) toast.success('👑 You are now the host!');
    else toast.info(`👑 ${jkHostTransferredName} is the new host`);
  }, [jkHostTransferredId, jkHostTransferredName, myId]);

  // Error toast
  const { jkError } = useJKStore();
  useEffect(() => {
    if (jkError) toast.error(jkError);
  }, [jkError]);

  const copyInvite = () => {
    const url = `${window.location.origin}?game=joker&room=${jkRoomId}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (!jkGameState) {
    return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f0a1a', gap:20 }}>
        <div style={{ width:36, height:36, border:'3px solid var(--red)', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#fff', fontWeight:700 }}>Joining table...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight:'100vh', width:'100vw',
      background:'radial-gradient(circle at 20% 10%, rgba(239,68,68,0.12), transparent 30%), linear-gradient(180deg,#0f0a1a 0%,#030208 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'24px 16px', gap:20,
    }}>
      {/* Top bar */}
      <div style={{ width:'100%', maxWidth:560, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:0, fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.14em', color:'var(--red)' }}>JOKER LOBBY</p>
          <h2 style={{ margin:'2px 0 0', fontSize:'1.4rem', fontWeight:900, color:'#fff' }}>
            Table <span style={{ color:'var(--red)', fontFamily:'monospace' }}>{jkRoomId}</span>
          </h2>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button
            onClick={() => { jkLeaveRoom(); setScreen('LEADERBOARD'); }}
            style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', padding:'8px 14px', borderRadius:12, fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}
          >
            🏆 Leaderboard
          </button>
          <button
            onClick={() => { jkLeaveRoom(); }}
            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'8px 14px', borderRadius:12, fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity:0, y:16 }}
        animate={{ opacity:1, y:0 }}
        style={{
          width:'100%', maxWidth:560, borderRadius:24,
          background:'linear-gradient(160deg,rgba(15,10,35,0.97),rgba(5,3,12,0.98))',
          border:'1px solid rgba(239,68,68,0.18)',
          boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
          overflow:'hidden',
        }}
      >
        {/* Player list */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <p style={{ margin:0, fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.14em', color:'#6b7280' }}>
              PLAYERS ({connectedCount}/6)
            </p>
            <p style={{ margin:0, fontSize:'0.68rem', color:'#6b7280' }}>
              Clockwise Turn Order
            </p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {players.map((p, idx) => {
              const isMe = p.id === myId;
              const isPlayerHost = p.id === jkGameState?.hostId;
              const chatMsg = jkChatMessages?.find(m => m.senderId === p.id);

              const slotBg = isPlayerHost
                ? 'rgba(245, 158, 11, 0.04)'
                : isMe
                  ? 'rgba(139, 92, 246, 0.04)'
                  : 'rgba(255, 255, 255, 0.02)';
              const slotBorder = isPlayerHost
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : isMe
                  ? '1px solid rgba(139, 92, 246, 0.35)'
                  : '1px solid rgba(255, 255, 255, 0.06)';

              return (
                <div key={p.id} style={{
                  position:'relative',
                  display:'flex',
                  alignItems:'center',
                  gap:12,
                  padding:'10px 14px',
                  borderRadius:14,
                  background: slotBg,
                  border: slotBorder,
                  boxShadow: isPlayerHost ? '0 4px 12px rgba(245, 158, 11, 0.05)' : isMe ? '0 4px 12px rgba(139, 92, 246, 0.05)' : 'none'
                }}>
                  {chatMsg && (
                    <div style={{ position:'absolute', bottom:'100%', left:60, zIndex:20, marginBottom:6, pointerEvents:'none' }}>
                      <ChatBubble message={chatMsg.message} isMe={isMe} />
                    </div>
                  )}

                  {/* Turn order */}
                  <div style={{ width:22, height:22, borderRadius:8, background:'rgba(255,255,255,0.05)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:800, color:'#6b7280', flexShrink:0 }}>
                    {idx + 1}
                  </div>

                  <AvatarDisplay avatarId={p.avatar} playerName={p.name} size={36} animated={false} />

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      {isPlayerHost && <span style={{ fontSize:'0.65rem' }}>👑</span>}
                      <span style={{ fontWeight:700, fontSize:'0.9rem', color: p.isConnected ? '#e2e8f0' : '#4b5563', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {p.name} {isMe && <span style={{ color:'#8b5cf6', fontSize:'0.72rem' }}>(You)</span>}
                        {p.isBot && (
                          <span style={{
                            color: p.difficulty === 'hard' ? '#ef4444' : p.difficulty === 'medium' ? '#eab308' : '#22c55e',
                            fontSize: '0.7rem',
                            fontWeight: 800,
                            marginLeft: 6,
                            background: p.difficulty === 'hard' ? 'rgba(239,68,68,0.1)' : p.difficulty === 'medium' ? 'rgba(234,179,8,0.1)' : 'rgba(34,197,94,0.1)',
                            padding: '2px 6px',
                            borderRadius: 6,
                            border: `1px solid ${p.difficulty === 'hard' ? 'rgba(239,68,68,0.2)' : p.difficulty === 'medium' ? 'rgba(234,179,8,0.2)' : 'rgba(34,197,94,0.2)'}`,
                          }}>
                            🤖 {p.difficulty || 'easy'}
                          </span>
                        )}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.65rem', fontWeight:800, color: 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>
                      {idx === 0 ? 'Starts Game' : `Seat ${idx + 1}`}
                    </div>
                  </div>

                  {/* Reorder buttons (host only) */}
                  {isHost && !isMe && (
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {idx > 0 && (
                        <button onClick={() => { const ids = players.map(x => x.id); [ids[idx-1], ids[idx]] = [ids[idx], ids[idx-1]]; jkReorderPlayers(ids); }}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontSize:'0.7rem', borderRadius:6, padding:'2px 6px', cursor:'pointer' }}>▲</button>
                      )}
                      {idx < players.length - 1 && (
                        <button onClick={() => { const ids = players.map(x => x.id); [ids[idx], ids[idx+1]] = [ids[idx+1], ids[idx]]; jkReorderPlayers(ids); }}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontSize:'0.7rem', borderRadius:6, padding:'2px 6px', cursor:'pointer' }}>▼</button>
                      )}
                    </div>
                  )}

                  {/* Kick button */}
                  {isHost && !isMe && (
                    <button onClick={() => jkKickPlayer(p.id)}
                      style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:'0.65rem', borderRadius:8, padding:'4px 8px', cursor:'pointer', fontWeight:700 }}>
                      Kick
                    </button>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:14, background:'rgba(255,255,255,0.015)', border:'1px dashed rgba(255,255,255,0.06)' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>?</div>
                <span style={{ color:'#374151', fontSize:'0.85rem', fontWeight:600 }}>Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ padding:'16px 20px 0' }}>
          <ChatInput roomId={jkRoomId} socket={jkSocket} mode="inline" onSend={jkSendChat} />
        </div>

        {/* Invite + Start */}
        <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          <button
            onClick={copyInvite}
            style={{ padding:'11px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}
          >
            {copied ? '✅ Link Copied!' : '🔗 Copy Invite Link'}
          </button>

          {isHost && players.length < 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '4px 0' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#6b7280', alignSelf: 'flex-start', letterSpacing: '0.05em' }}>ADD BOT PLAYER</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => jkAddBot('easy')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  🟢 Easy
                </button>
                <button
                  onClick={() => jkAddBot('medium')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)', color: '#eab308', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  🟡 Medium
                </button>
                <button
                  onClick={() => jkAddBot('hard')}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  🔴 Hard
                </button>
              </div>
            </div>
          )}

          {isHost ? (
            <motion.button
              whileHover={canStart ? { scale:1.02 } : {}} whileTap={canStart ? { scale:0.98 } : {}}
              onClick={canStart ? jkStartGame : undefined}
              style={{
                padding:'16px', borderRadius:16,
                background: canStart ? 'linear-gradient(135deg,var(--red),var(--purple))' : 'rgba(255,255,255,0.06)',
                border:'none', color: canStart ? '#fff' : '#4b5563',
                fontSize:'1rem', fontWeight:800, cursor: canStart ? 'pointer' : 'not-allowed',
                boxShadow: canStart ? '0 12px 32px rgba(239,68,68,0.3)' : 'none',
              }}
            >
              {connectedCount < 2 ? `Waiting for players... (${connectedCount}/2)` : '🃏 Start Joker'}
            </motion.button>
          ) : (
            <div style={{ padding:'16px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#6b7280', fontSize:'0.88rem', fontWeight:600, textAlign:'center' }}>
              Waiting for host to start...
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
