import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/Engine';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, NEON_PALETTE } from './game/constants';
import { Keyboard, Settings2, Palette, Users, Link as LinkIcon, Copy, Check, Zap, RefreshCcw } from 'lucide-react';
import { MultiplayerManager, GameState, PlayerInput } from './game/MultiplayerManager';

export default function App() {
  const VERSION = '1.3.1';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const mpManagerRef = useRef<MultiplayerManager | null>(null);
  const isConnectedRef = useRef(false);
  const [kills, setKills] = useState({ p1: 0, p2: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  // Multiplayer State
  const [multiplayerMode, setMultiplayerMode] = useState<'none' | 'host' | 'join'>('none');
  const [peerId, setPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [iceState, setIceState] = useState<string>('');

  // Configuration State
  const [p1Color, setP1Color] = useState(COLORS.PLAYER1);
  const [p2Color, setP2Color] = useState(COLORS.PLAYER2);
  const [envColor, setEnvColor] = useState(COLORS.ENV);
  const [speedMultiplier, setSpeedMultiplier] = useState(2.0);

  useEffect(() => {
    console.log('[App] Multiplayer mode changed to:', multiplayerMode);
  }, [multiplayerMode]);

  useEffect(() => {
    if (canvasRef.current && !engineRef.current) {
      const engine = new GameEngine(canvasRef.current);
      engine.onKillsUpdate = (p1, p2) => {
        setKills({ p1, p2 });
      };
      engine.onPauseToggle = (paused) => {
        setIsPaused(paused);
      };
      engine.onGameOver = (winnerId) => {
        setWinner(winnerId);
      };
      engineRef.current = engine;
    }

    if (!mpManagerRef.current) {
      const mp = new MultiplayerManager();
      mp.onIdReady = (id) => {
        console.log('[App] Peer ID ready:', id);
        setPeerId(id);
      };
      mp.onIceStateChange = (state) => {
        setIceState(state);
      };
      mp.onConnected = () => {
        console.log('[App] Multiplayer connected!');
        setIsConnected(true);
        setIsConnecting(false);
        startGame(true);
      };
      mp.onData = (data) => {
        if (engineRef.current) {
          if (mp.isHost) {
            engineRef.current.remoteInput = data as PlayerInput;
          } else {
            engineRef.current.applyState(data as GameState);
          }
        }
      };
      mp.onDisconnected = () => {
        console.log('[App] Multiplayer disconnected');
        setIsConnected(false);
        setIsConnecting(false);
        quitGame();
      };
      mp.onError = (message) => {
        setIsConnecting(false);
        alert(message);
      };
      mpManagerRef.current = mp;
    }

    return () => {
      if (mpManagerRef.current) {
        mpManagerRef.current.disconnect();
      }
    };
  }, []);

  const hostGame = () => {
    console.log('[App] Host Game clicked');
    setMultiplayerMode('host');
    if (mpManagerRef.current) {
      mpManagerRef.current.init();
    }
    startGame(true);
  };

  useEffect(() => { isConnectedRef.current = isConnected; }, [isConnected]);

  const joinGame = () => {
    console.log('[App] Join Game clicked with ID:', targetPeerId);
    if (targetPeerId && mpManagerRef.current) {
      setIsConnecting(true);
      mpManagerRef.current.connect(targetPeerId);

      // Then in the timeout:
      setTimeout(() => {
        if (!isConnectedRef.current) {
          setIsConnecting(false);
        }
      }, 60000);
    } else {
      console.log('[App] Join Game failed: targetPeerId or mpManager missing');
    }
  };

  const copyId = () => {
    navigator.clipboard.writeText(peerId);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startGame = (isMp = false) => {
    console.log('[App] Starting game. Multiplayer:', isMp);
    setKills({ p1: 0, p2: 0 });
    setGameStarted(true);
    setIsPaused(false);
    setWinner(null);
    if (engineRef.current) {
      engineRef.current.isMultiplayer = isMp;
      engineRef.current.isHost = isMp && mpManagerRef.current?.isHost || false;
      engineRef.current.start({ p1Color, p2Color, speedMultiplier, envColor });
    }

    if (engineRef.current && mpManagerRef.current) {
      engineRef.current.onStateUpdate = (state) => {
        if (mpManagerRef.current?.isHost) mpManagerRef.current.send(state);
      };
      engineRef.current.onInputUpdate = (input) => {
        if (!mpManagerRef.current?.isHost) mpManagerRef.current?.send(input);
      };
    }
  };

  const resumeGame = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const quitGame = () => {
    console.log('[App] Quitting game');
    setGameStarted(false);
    setIsPaused(false);
    setIsConnecting(false);
    setWinner(null);
    if (engineRef.current) {
      engineRef.current.stop();
    }
    if (mpManagerRef.current) {
      mpManagerRef.current.disconnect();
      setMultiplayerMode('none');
      setIsConnected(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center font-sans overflow-hidden p-4">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,#1A0033_0%,#050505_100%)] -z-10" />
      
      <div className="mb-8 text-center relative w-full max-w-[1200px] flex justify-between items-end px-4">
        <div className="flex-1 text-left relative">
          <h1 className="text-6xl font-black tracking-tighter italic uppercase animate-pulse" style={{ color: envColor, filter: `drop-shadow(0 0 15px ${envColor})` }}>
            NEON BRAWL
          </h1>
          {/* Decorative scanline on title */}
          <div className="absolute top-1/2 left-0 w-full h-[2px] bg-white/20 blur-[1px] -translate-y-1/2 pointer-events-none animate-pulse"></div>
        </div>
        
        {gameStarted && (
          <div className="flex gap-4">
            <div className="bg-black/80 border-2 border-[#FF00FF] px-6 py-2 rounded-lg skew-x-[-10deg] shadow-[0_0_15px_rgba(255,0,255,0.3)]" style={{ borderColor: p1Color }}>
              <div className="text-[10px] uppercase font-bold skew-x-[10deg] tracking-widest" style={{ color: p1Color }}>P1</div>
              <div className="text-3xl font-black text-white skew-x-[10deg]">{kills.p1}</div>
            </div>
            <div className="bg-black/80 border-2 border-[#00FFFF] px-6 py-2 rounded-lg skew-x-[-10deg] shadow-[0_0_15px_rgba(0,255,255,0.3)]" style={{ borderColor: p2Color }}>
              <div className="text-[10px] uppercase font-bold skew-x-[10deg] tracking-widest" style={{ color: p2Color }}>P2</div>
              <div className="text-3xl font-black text-white skew-x-[10deg]">{kills.p2}</div>
            </div>
          </div>
        )}
      </div>

      <div className="relative group">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="bg-[#050505] rounded-xl shadow-[0_0_50px_rgba(255,0,255,0.2)] border-4 border-[#1A0033] cursor-crosshair max-w-full h-auto"
        />

        {gameStarted && multiplayerMode === 'host' && !isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-lg z-40">
            <div className="flex flex-col items-center gap-6 p-10 bg-black/90 border-2 border-[#00FFFF] rounded-2xl shadow-[0_0_50px_rgba(0,255,255,0.3)] skew-x-[-5deg]">
              <div className="flex items-center gap-4 skew-x-[5deg]">
                <div className="w-10 h-10 border-4 border-[#00FFFF] border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-4xl font-black italic uppercase text-[#00FFFF] tracking-tighter">
                  Waiting for P2
                </h2>
              </div>
              
              <div className="flex flex-col gap-3 w-full max-w-sm skew-x-[5deg]">
                <p className="text-[11px] text-gray-400 uppercase font-black tracking-[0.2em] text-center">Share this ID with your opponent</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white/5 border border-white/20 rounded-lg px-4 py-4 font-mono text-sm text-[#00FFFF] truncate text-center">
                    {peerId || 'GENERATING ID...'}
                  </div>
                  <button
                    onClick={copyId}
                    disabled={!peerId}
                    className="p-4 bg-white/10 hover:bg-white/20 rounded-lg transition-all disabled:opacity-50 group"
                  >
                    {isCopied ? <Check className="w-6 h-6 text-green-400" /> : <Copy className="w-6 h-6 group-hover:scale-110 transition-transform" />}
                  </button>
                </div>
              </div>

              <button 
                onClick={quitGame}
                className="mt-6 px-6 py-2 bg-red-500/10 border border-red-500/30 rounded text-[10px] uppercase font-black text-red-500 hover:bg-red-500 hover:text-white transition-all skew-x-[5deg]"
              >
                Cancel Hosting
              </button>
            </div>
          </div>
        )}

        {winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-lg border-0 z-50 overflow-y-auto p-8">
            <h2 className="text-7xl font-black italic uppercase mb-4 tracking-tighter animate-pulse" style={{ color: winner === 'Player 1' ? p1Color : p2Color, filter: `drop-shadow(0 0 20px ${winner === 'Player 1' ? p1Color : p2Color})` }}>
              {winner === 'Player 1' ? 'P1 WINS' : 'P2 WINS'}
            </h2>
            <p className="text-white/60 uppercase tracking-[0.3em] text-sm font-bold mb-12">Final Score: {kills.p1} - {kills.p2}</p>
            <div className="flex flex-col gap-4 w-64">
              <button
                onClick={() => startGame(multiplayerMode !== 'none')}
                className="px-8 py-4 bg-white text-black font-black text-xl uppercase italic skew-x-[-10deg] hover:bg-[#FF00FF] hover:text-white transition-all duration-200 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                style={{ '--hover-bg': envColor } as React.CSSProperties}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = envColor;
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = 'black';
                }}
              >
                <span className="inline-block skew-x-[10deg]">Play Again</span>
              </button>
              <button
                onClick={quitGame}
                className="px-8 py-4 bg-white/10 text-white font-black text-xl uppercase italic skew-x-[-10deg] hover:bg-white hover:text-black transition-all duration-200"
              >
                <span className="inline-block skew-x-[10deg]">Main Menu</span>
              </button>
            </div>
          </div>
        )}

        {isPaused && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-md rounded-lg z-50">
            <h2 className="text-7xl font-black italic uppercase text-white mb-12 tracking-tighter drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
              PAUSED
            </h2>
            <div className="flex flex-col gap-4 w-64">
              <button
                onClick={resumeGame}
                className="px-8 py-4 bg-[#FF00FF] text-white font-black text-xl uppercase italic skew-x-[-10deg] hover:bg-white hover:text-black transition-all duration-200 shadow-[0_0_20px_rgba(255,0,255,0.5)]"
              >
                <span className="inline-block skew-x-[10deg]">Resume</span>
              </button>
              <button
                onClick={quitGame}
                className="px-8 py-4 bg-white/10 text-white font-black text-xl uppercase italic skew-x-[-10deg] hover:bg-white hover:text-black transition-all duration-200"
              >
                <span className="inline-block skew-x-[10deg]">Quit</span>
              </button>
            </div>
          </div>
        )}

        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg backdrop-blur-none border-0 overflow-y-auto p-8">
            <div className="w-full max-w-4xl flex flex-col items-center gap-10">
              {multiplayerMode !== 'join' ? (
                <>
                  {/* Info Boxes Row */}
                  <div className="flex gap-4 w-full max-w-2xl animate-in fade-in zoom-in duration-300">
                    {/* Controls Box */}
                    <div className="flex-1 bg-white/5 border border-white/20 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#00FFFF]"></div>
                      <h3 className="font-black text-xl mb-4 uppercase italic tracking-tighter text-white flex items-center gap-2">
                        <Keyboard className="w-5 h-5 text-[#00FFFF]" />
                        Controls
                      </h3>
                      <div className="grid grid-cols-1 gap-2 text-[10px] text-gray-300 font-mono uppercase tracking-wider">
                        <div className="flex justify-between bg-white/5 px-3 py-2 rounded">
                          <span>Movement</span>
                          <span className="text-[#00FFFF]">WASD</span>
                        </div>
                        <div className="flex justify-between bg-white/5 px-3 py-2 rounded">
                          <span>Dash</span>
                          <span className="text-[#00FFFF]">SHIFT</span>
                        </div>
                        <div className="flex justify-between bg-white/5 px-3 py-2 rounded">
                          <span>Aim & Throw</span>
                          <span className="text-[#00FFFF]">CLICK & RELEASE</span>
                        </div>
                        <div className="flex justify-between bg-white/5 px-3 py-2 rounded">
                          <span>Slash / Recall</span>
                          <span className="text-[#00FFFF]">SPACE</span>
                        </div>
                      </div>
                    </div>

                    {/* Powerups Box */}
                    <div className="flex-1 bg-white/5 border border-white/20 rounded-xl p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[#FFFF00]"></div>
                      <h3 className="font-black text-xl mb-4 uppercase italic tracking-tighter text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[#FFFF00]" />
                        Powerups
                      </h3>
                      <div className="grid grid-cols-1 gap-2 text-[10px] text-gray-300 font-mono uppercase tracking-wider">
                        <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded">
                          <div className="w-8 h-8 flex items-center justify-center border border-[#FFFF00] rounded-full shadow-[0_0_10px_rgba(255,255,0,0.3)]">
                            <RefreshCcw className="w-4 h-4 text-[#FFFF00]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#FFFF00] font-black">MOONWALKER</span>
                            <span className="text-[8px] opacity-70">OPPONENT BECOMES A SMOOTH CRIMINAL</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded">
                          <div className="w-8 h-8 flex items-center justify-center border border-[#FF00FF] rounded-full shadow-[0_0_10px_rgba(255,0,255,0.3)]">
                            <Zap className="w-4 h-4 text-[#FF00FF]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[#FF00FF] font-black">ELECTRIC BOOGALOO</span>
                            <span className="text-[8px] opacity-70">PLAYER CHANNELS THE MAP FREQUENCY</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-6 items-center">
                    <button
                      onClick={hostGame}
                      className="w-60 py-1.5 bg-white text-black font-black text-base uppercase italic skew-x-[-10deg] hover:bg-[#FF00FF] hover:text-white transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                      <span className="inline-block skew-x-[10deg]">Host Game</span>
                    </button>
                    <button
                      onClick={() => setMultiplayerMode('join')}
                      className="w-60 py-1.5 bg-white text-black font-black text-base uppercase italic skew-x-[-10deg] hover:bg-[#FF00FF] hover:text-white transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                      <span className="inline-block skew-x-[10deg]">Join Game</span>
                    </button>
                    <button
                      onClick={() => startGame(false)}
                      className="w-60 py-1.5 bg-white text-black font-black text-base uppercase italic skew-x-[-10deg] hover:bg-[#FF00FF] hover:text-white transition-all duration-200 shadow-[0_0_15px_rgba(255,255,255,0.1)]"
                    >
                      <span className="inline-block skew-x-[10deg]">Practice</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-black/80 border-2 border-[#00FFFF] rounded-2xl p-10 flex flex-col gap-8 animate-in fade-in zoom-in slide-in-from-bottom-8 duration-500 shadow-[0_0_50px_rgba(0,255,255,0.2)] skew-x-[-5deg]">
                  <div className="text-center skew-x-[5deg]">
                    <h2 className="text-5xl font-black italic uppercase text-[#00FFFF] tracking-tighter mb-2">
                      Join Session
                    </h2>
                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-[0.3em]">Enter the Host Protocol ID</p>
                  </div>

                  <div className="flex flex-col gap-4 skew-x-[5deg]">
                    <input
                      id="host-id-input"
                      name="host-id"
                      type="text"
                      value={targetPeerId}
                      onChange={(e) => setTargetPeerId(e.target.value)}
                      placeholder="PASTE HOST ID..."
                      className="w-full bg-white/5 border-2 border-white/10 rounded-xl px-6 py-4 font-mono text-sm text-white focus:outline-none focus:border-[#00FFFF] uppercase text-center transition-all"
                    />
                    
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setMultiplayerMode('none')} 
                        className="flex-1 py-4 bg-white/10 text-white font-black text-sm uppercase italic skew-x-[-10deg] hover:bg-white hover:text-black transition-all duration-200"
                      >
                        <span className="inline-block skew-x-[10deg]">Back</span>
                      </button>
                      <button
                        onClick={joinGame}
                        disabled={!targetPeerId || isConnecting}
                        className="flex-[2] py-4 bg-[#00FFFF] text-black font-black text-sm uppercase italic skew-x-[-10deg] hover:bg-white transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                      >
                        <span className="inline-block skew-x-[10deg]">{isConnecting ? 'CONNECTING...' : 'CONNECT'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex gap-8 text-gray-600 text-[10px] font-bold uppercase tracking-[0.2em]">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          <span>Cyber-Link Active</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-[#39FF14] rounded-full animate-pulse shadow-[0_0_5px_#39FF14]" />
          <span>System Online</span>
        </div>
        <div className="flex items-center gap-2 opacity-50">
          <span>v{VERSION}</span>
        </div>
      </div>
    </div>
  );
}
