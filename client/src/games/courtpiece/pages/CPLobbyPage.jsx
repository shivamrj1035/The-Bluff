import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCPStore } from '../store/useCPStore';
import { useGameStore } from '../../bluff/store/useGameStore';
import AvatarDisplay from '../../../components/common/AvatarDisplay';
import ChatInput from '../../../components/common/ChatInput';
import ChatBubble from '../../../components/common/ChatBubble';
import { toast } from '../../../components/common/Toast';

const TEAM_COLORS = { A: '#f59e0b', B: '#a78bfa' };

export default function CPLobbyPage() {
  const {
    cpGameState, cpRoomId, cpStatus, cpDisconnect, cpStartGame,
    cpKickPlayer, cpReorderPlayers, cpSendChat, cpChatMessages,
    cpHostTransferredName, cpHostTransferredId, cpSocket,
  } = useCPStore();
  const { playerName, avatar } = useGameStore();

  const [copied, setCopied] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

  const myId    = cpGameState?.myId;
  const myTeam  = cpGameState?.myTeam;
  const isHost  = Boolean(cpGameState && myId && cpGameState.hostId === myId);
  const players = cpGameState?.players || [];
  const connectedCount = players.filter(p => p.isConnected).length;
  const canStart = isHost && connectedCount === 4;

  // Host transfer toast
  useEffect(() => {
    if (!cpHostTransferredName) return;
    if (cpHostTransferredId === myId) toast.success('👑 You are now the host!');
    else toast.info(`👑 ${cpHostTransferredName} is the new host`);
  }, [cpHostTransferredId, cpHostTransferredName, myId]);

  const copyInvite = () => {
    const url = `${window.location.origin}?game=courtpiece&room=${cpRoomId}`;
    navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const getTeamLabel = (index) => index % 2 === 0 ? 'A' : 'B';

  if (!cpGameState) {
    return (
      <div style={{ height:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#0f0a1a', gap:20 }}>
        <div style={{ width:36, height:36, border:'3px solid #fb923c', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
        <p style={{ color:'#fff', fontWeight:700 }}>Joining table...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      minHeight:'100vh', width:'100vw',
      background:'radial-gradient(circle at 20% 10%, rgba(251,146,60,0.12), transparent 30%), linear-gradient(180deg,#0f0a1a 0%,#030208 100%)',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'24px 16px', gap:20,
    }}>
      {/* Top bar */}
      <div style={{ width:'100%', maxWidth:560, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div>
          <p style={{ margin:0, fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.14em', color:'#fb923c' }}>COURT PIECE LOBBY</p>
          <h2 style={{ margin:'2px 0 0', fontSize:'1.4rem', fontWeight:900, color:'#fff' }}>
            Table <span style={{ color:'#fb923c', fontFamily:'monospace' }}>{cpRoomId}</span>
          </h2>
        </div>
        <button
          onClick={() => { cpDisconnect(); }}
          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.25)', color:'#f87171', padding:'8px 14px', borderRadius:12, fontWeight:700, fontSize:'0.8rem', cursor:'pointer' }}
        >
          Leave
        </button>
      </div>

      {/* Main card */}
      <motion.div
        initial={{ opacity:0, y:16 }}
        animate={{ opacity:1, y:0 }}
        style={{
          width:'100%', maxWidth:560, borderRadius:24,
          background:'linear-gradient(160deg,rgba(15,10,35,0.97),rgba(5,3,12,0.98))',
          border:'1px solid rgba(251,146,60,0.18)',
          boxShadow:'0 24px 64px rgba(0,0,0,0.5)',
          overflow:'hidden',
        }}
      >
        {/* Player list */}
        <div style={{ padding:'20px 20px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <p style={{ margin:0, fontSize:'0.68rem', fontWeight:800, letterSpacing:'0.14em', color:'#6b7280' }}>
              PLAYERS ({connectedCount}/4)
            </p>
            <p style={{ margin:0, fontSize:'0.68rem', color:'#6b7280' }}>
              Pos → Team: 1,3=A · 2,4=B
            </p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {players.map((p, idx) => {
              const team = getTeamLabel(idx);
              const teamColor = TEAM_COLORS[team];
              const isMe = p.id === myId;
              const isPlayerHost = p.id === cpGameState?.hostId;
              const chatMsg = cpChatMessages?.find(m => m.senderId === p.id);

              return (
                <div key={p.id} style={{ position:'relative', display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:14, background: isMe ? 'rgba(251,146,60,0.06)' : 'rgba(255,255,255,0.03)', border:`1px solid ${isMe ? 'rgba(251,146,60,0.18)' : 'rgba(255,255,255,0.05)'}` }}>
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
                        {p.name} {isMe && <span style={{ color:'#fb923c', fontSize:'0.72rem' }}>(You)</span>}
                      </span>
                    </div>
                    <div style={{ fontSize:'0.65rem', fontWeight:800, color: teamColor, textTransform:'uppercase', letterSpacing:'0.08em' }}>
                      Team {team} {idx === 0 || idx === 1 ? '· Reveals card' : ''}
                    </div>
                  </div>

                  {/* Team badge */}
                  <div style={{ padding:'4px 10px', borderRadius:8, background:`${teamColor}22`, border:`1px solid ${teamColor}44`, fontSize:'0.7rem', fontWeight:800, color: teamColor }}>
                    {team}
                  </div>

                  {/* Reorder buttons (host only) */}
                  {isHost && !isMe && (
                    <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
                      {idx > 0 && (
                        <button onClick={() => { const ids = players.map(x => x.id); [ids[idx-1], ids[idx]] = [ids[idx], ids[idx-1]]; cpReorderPlayers(ids); }}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontSize:'0.7rem', borderRadius:6, padding:'2px 6px', cursor:'pointer' }}>▲</button>
                      )}
                      {idx < players.length - 1 && (
                        <button onClick={() => { const ids = players.map(x => x.id); [ids[idx], ids[idx+1]] = [ids[idx+1], ids[idx]]; cpReorderPlayers(ids); }}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontSize:'0.7rem', borderRadius:6, padding:'2px 6px', cursor:'pointer' }}>▼</button>
                      )}
                    </div>
                  )}

                  {/* Kick button */}
                  {isHost && !isMe && (
                    <button onClick={() => cpKickPlayer(p.id)}
                      style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#f87171', fontSize:'0.65rem', borderRadius:8, padding:'4px 8px', cursor:'pointer', fontWeight:700 }}>
                      Kick
                    </button>
                  )}
                </div>
              );
            })}

            {/* Empty slots */}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:14, background:'rgba(255,255,255,0.015)', border:'1px dashed rgba(255,255,255,0.06)' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>?</div>
                <span style={{ color:'#374151', fontSize:'0.85rem', fontWeight:600 }}>Waiting for player...</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat */}
        <div style={{ padding:'16px 20px 0' }}>
          <ChatInput roomId={cpRoomId} socket={cpSocket} mode="inline" />
        </div>

        {/* Invite + Start */}
        <div style={{ padding:'16px 20px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          <button
            onClick={copyInvite}
            style={{ padding:'11px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#9ca3af', fontWeight:700, fontSize:'0.82rem', cursor:'pointer' }}
          >
            {copied ? '✅ Link Copied!' : '🔗 Copy Invite Link'}
          </button>

          {isHost ? (
            <motion.button
              whileHover={canStart ? { scale:1.02 } : {}} whileTap={canStart ? { scale:0.98 } : {}}
              onClick={canStart ? cpStartGame : undefined}
              style={{
                padding:'16px', borderRadius:16,
                background: canStart ? 'linear-gradient(135deg,#c2410c,#9a3412)' : 'rgba(255,255,255,0.06)',
                border:'none', color: canStart ? '#fff' : '#4b5563',
                fontSize:'1rem', fontWeight:800, cursor: canStart ? 'pointer' : 'not-allowed',
                boxShadow: canStart ? '0 12px 32px rgba(251,146,60,0.3)' : 'none',
              }}
            >
              {connectedCount < 4 ? `Waiting for players... (${connectedCount}/4)` : '🃏 Start Court Piece'}
            </motion.button>
          ) : (
            <div style={{ padding:'16px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', color:'#6b7280', fontSize:'0.88rem', fontWeight:600, textAlign:'center' }}>
              Waiting for host to start...
            </div>
          )}
        </div>
      </motion.div>

      {/* Team preview */}
      <div style={{ width:'100%', maxWidth:560, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {['A','B'].map(team => {
          const teamPlayers = players.filter((_, i) => i % 2 === 0 ? team === 'A' : team === 'B');
          return (
            <div key={team} style={{ padding:'14px 16px', borderRadius:16, background:'rgba(255,255,255,0.03)', border:`1px solid ${TEAM_COLORS[team]}22` }}>
              <p style={{ margin:'0 0 8px', fontSize:'0.65rem', fontWeight:800, letterSpacing:'0.14em', color: TEAM_COLORS[team] }}>TEAM {team}</p>
              {teamPlayers.length === 0 ? (
                <p style={{ margin:0, fontSize:'0.78rem', color:'#374151' }}>No players yet</p>
              ) : teamPlayers.map(p => (
                <div key={p.id} style={{ fontSize:'0.82rem', color: p.isConnected ? '#e2e8f0' : '#4b5563', fontWeight:600 }}>{p.name}</div>
              ))}
              <p style={{ margin:'6px 0 0', fontSize:'0.65rem', color:'#6b7280' }}>Partners sit opposite</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
