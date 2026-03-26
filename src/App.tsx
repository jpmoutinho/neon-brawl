import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from './game/Engine';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, NEON_PALETTE } from './game/constants';
import { Keyboard, Settings2, Palette } from 'lucide-react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [kills, setKills] = useState({ p1: 0, p2: 0 });
  const [gameStarted, setGameStarted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  // Configuration State
  const [p1Color, setP1Color] = useState(COLORS.PLAYER1);
  const [p2Color, setP2Color] = useState(COLORS.PLAYER2);
  const [envColor, setEnvColor] = useState(COLORS.ENV);
  const [speedMultiplier, setSpeedMultiplier] = useState(2.0);

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
  }, []);

  const startGame = () => {
    setKills({ p1: 0, p2: 0 });
    setGameStarted(true);
    setIsPaused(false);
    setWinner(null);
    if (engineRef.current) {
      engineRef.current.start({ p1Color, p2Color, speedMultiplier, envColor });
    }
  };

  const resumeGame = () => {
    if (engineRef.current) {
      engineRef.current.togglePause();
    }
  };

  const quitGame = () => {
    setGameStarted(false);
    setIsPaused(false);
    setWinner(null);
    if (engineRef.current) {
      engineRef.current.stop();
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
          <p className="text-[#00FFFF] mt-2 uppercase tracking-[0.3em] text-xs font-bold drop-shadow-[0_0_5px_rgba(0,255,255,0.5)]">
            LASER DAGGER PROTOCOL 84
          </p>
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

        {winner && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg backdrop-blur-none border-0 z-50 overflow-y-auto p-8">
            <h2 className="text-7xl font-black italic uppercase mb-4 tracking-tighter animate-pulse" style={{ color: winner === 'Player 1' ? p1Color : p2Color, filter: `drop-shadow(0 0 20px ${winner === 'Player 1' ? p1Color : p2Color})` }}>
              {winner === 'Player 1' ? 'P1 WINS' : 'P2 WINS'}
            </h2>
            <p className="text-white/60 uppercase tracking-[0.3em] text-sm font-bold mb-12">Final Score: {kills.p1} - {kills.p2}</p>
            <div className="flex flex-col gap-4 w-64">
              <button
                onClick={startGame}
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
            <div className="mb-12 w-full max-w-md">
              {/* Instructions */}
              <div className="text-center">
                <div className="w-12 h-12 rounded-full mx-auto mb-4 border-4 border-white shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{ backgroundColor: p1Color }} />
                <h3 className="font-bold text-lg mb-2 uppercase italic tracking-tighter" style={{ color: p1Color }}>P1 Controls</h3>
                <div className="flex flex-col gap-1 text-[9px] text-gray-400 font-mono uppercase tracking-wider">
                  <span className="bg-black/60 px-2 py-1 rounded">WASD to Move / SHIFT to Dash</span>
                  <span className="bg-black/60 px-2 py-1 rounded">CLICK to Aim / RELEASE to Throw</span>
                  <span className="bg-black/60 px-2 py-1 rounded">SPACE to Slash / RECALL</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={startGame}
              className="group relative px-12 py-4 bg-white text-black font-black text-2xl uppercase italic skew-x-[-10deg] transition-all duration-200 active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
              style={{ 
                '--hover-bg': envColor 
              } as React.CSSProperties}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = envColor;
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = 'black';
              }}
            >
              <span className="inline-block skew-x-[10deg]">Start Brawl</span>
            </button>
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
      </div>
    </div>
  );
}
