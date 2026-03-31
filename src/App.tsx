import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Terminal, Volume2, VolumeX } from 'lucide-react';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE;
const GAME_SPEED = 90; // Faster for more juice

const TRACKS = [
  { id: 1, title: "SYS.OP.01_VOID_WALKER", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" },
  { id: 2, title: "SYS.OP.02_NEURAL_DECAY", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3" },
  { id: 3, title: "SYS.OP.03_CYBER_GHOST", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3" }
];

export default function App() {
  // --- React UI State ---
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // --- Music Player State ---
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);

  // --- Canvas & Game Engine State ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  
  const generateFood = (snake: {x: number, y: number}[]) => {
    let newFood;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      if (!snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)) {
        break;
      }
    }
    return newFood;
  };

  const gameState = useRef({
    snake: [{ x: 10, y: 10 }],
    direction: { x: 0, y: -1 },
    nextDirection: { x: 0, y: -1 },
    food: generateFood([{ x: 10, y: 10 }]),
    lastMoveTime: 0,
    particles: [] as any[],
    shakeTime: 0,
    isGameOver: false,
    isPaused: false,
    score: 0
  });

  const resetGame = () => {
    gameState.current = {
      snake: [{ x: 10, y: 10 }],
      direction: { x: 0, y: -1 },
      nextDirection: { x: 0, y: -1 },
      food: generateFood([{ x: 10, y: 10 }]),
      lastMoveTime: performance.now(),
      particles: [],
      shakeTime: 0,
      isGameOver: false,
      isPaused: false,
      score: 0
    };
    setScore(0);
    setGameOver(false);
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const state = gameState.current;

    ctx.save();
    
    // Screen Shake
    if (state.shakeTime > 0) {
      const magnitude = state.shakeTime > 200 ? 12 : 4;
      const dx = (Math.random() - 0.5) * magnitude;
      const dy = (Math.random() - 0.5) * magnitude;
      ctx.translate(dx, dy);
    }

    // Draw Grid
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for(let i=0; i<=GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw Food
    ctx.shadowBlur = 20;
    ctx.shadowColor = '#ff00ff';
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(state.food.x * CELL_SIZE + 2, state.food.y * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);

    // Draw Snake
    state.snake.forEach((segment, index) => {
      if (index === 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = '#ffffff';
      } else {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
      }
      ctx.fillRect(segment.x * CELL_SIZE + 1, segment.y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    });

    // Draw Particles
    ctx.globalCompositeOperation = 'lighter';
    state.particles.forEach(p => {
      ctx.fillStyle = `rgba(255, 0, 255, ${p.life})`;
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ff00ff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 * p.life, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }, []);

  const update = useCallback((time: number) => {
    const state = gameState.current;

    if (state.isPaused || state.isGameOver) {
      draw(); // Keep drawing even when paused to show the state
      requestRef.current = requestAnimationFrame(update);
      return;
    }

    // Update particles
    state.particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
    });
    state.particles = state.particles.filter(p => p.life > 0);

    // Update shake
    if (state.shakeTime > 0) {
      state.shakeTime -= 16;
    }

    // Move snake
    if (time - state.lastMoveTime > GAME_SPEED) {
      state.direction = state.nextDirection;
      const head = state.snake[0];
      const newHead = { x: head.x + state.direction.x, y: head.y + state.direction.y };

      // Collisions
      if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE ||
          state.snake.some(s => s.x === newHead.x && s.y === newHead.y)) {
        state.isGameOver = true;
        setGameOver(true);
        state.shakeTime = 500; // Big shake on death
      } else {
        state.snake.unshift(newHead);
        
        // Ate food
        if (newHead.x === state.food.x && newHead.y === state.food.y) {
          state.score += 10;
          setScore(state.score);
          setHighScore(prev => Math.max(prev, state.score));
          state.food = generateFood(state.snake);
          state.shakeTime = 150; // Small shake on eat
          
          // Spawn particles
          for(let i=0; i<25; i++) {
            state.particles.push({
              x: newHead.x * CELL_SIZE + CELL_SIZE/2,
              y: newHead.y * CELL_SIZE + CELL_SIZE/2,
              vx: (Math.random() - 0.5) * 15,
              vy: (Math.random() - 0.5) * 15,
              life: 1,
              color: '#ff00ff'
            });
          }
        } else {
          state.snake.pop();
        }
      }
      state.lastMoveTime = time;
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [draw]);

  // --- Event Listeners ---
  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [update]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      const state = gameState.current;

      if (state.isGameOver && e.key === " ") {
        resetGame();
        return;
      }

      const dir = state.direction;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (dir.y !== 1) state.nextDirection = { x: 0, y: -1 };
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (dir.y !== -1) state.nextDirection = { x: 0, y: 1 };
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (dir.x !== 1) state.nextDirection = { x: -1, y: 0 };
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (dir.x !== -1) state.nextDirection = { x: 1, y: 0 };
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      gameState.current.isPaused = true;
      setIsPaused(true);
    };
    const handleFocus = () => {
      gameState.current.isPaused = false;
      setIsPaused(false);
    };
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // --- Music Player Logic ---
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Audio play error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  };

  const prevTrack = () => {
    setCurrentTrack((prev) => (prev - 1 + TRACKS.length) % TRACKS.length);
    setIsPlaying(true);
  };

  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play().catch(e => console.error("Audio play error:", e));
    }
  }, [currentTrack, isPlaying]);

  return (
    <div className="min-h-screen bg-[#050505] text-[#00ffff] font-mono flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="scanlines"></div>
      <div className="crt-flicker absolute inset-0 bg-black/10 pointer-events-none"></div>

      {/* Header */}
      <header className="mb-8 text-center z-10">
        <h1 className="text-4xl md:text-6xl font-bold glitch-text tracking-widest uppercase">
          NEON_SERPENT_OS
        </h1>
        <p className="text-[#ff00ff] mt-2 text-sm md:text-base tracking-widest">
          V 1.0.0 // SYSTEM OVERRIDE ACTIVE
        </p>
      </header>

      {/* Main Content Grid */}
      <div className="flex flex-col lg:flex-row gap-8 z-10 w-full max-w-6xl justify-center items-start">

        {/* Left Panel - Stats / Info */}
        <div className="hidden lg:flex flex-col gap-4 w-64 neon-border-cyan p-4 bg-black/50 backdrop-blur-sm shadow-[0_0_20px_rgba(0,255,255,0.2)]">
          <div className="flex items-center gap-2 border-b border-[#00ffff]/30 pb-2 mb-2">
            <Terminal size={18} className="text-[#ff00ff]" />
            <span className="text-[#ff00ff] uppercase tracking-wider">Terminal</span>
          </div>
          <div className="text-xs space-y-2 opacity-80">
            <p>&gt; INITIALIZING...</p>
            <p>&gt; LOADING MODULE: SNAKE.EXE</p>
            <p>&gt; LOADING MODULE: AUDIO.SYS</p>
            <p className="text-[#ff00ff]">&gt; WARNING: GLITCH DETECTED</p>
            <p>&gt; AWAITING USER INPUT...</p>
          </div>
          <div className="mt-auto pt-4 border-t border-[#00ffff]/30">
            <p className="text-sm uppercase flex items-center gap-3">Score: <span className="text-5xl neon-text-magenta glitch-text">{score}</span></p>
            <p className="text-sm uppercase mt-4 flex items-center gap-3">High Score: <span className="text-4xl neon-text-cyan glitch-text">{highScore}</span></p>
          </div>
        </div>

        {/* Center - Game Board */}
        <div className="flex flex-col items-center">
          <div className="neon-border-magenta p-1 bg-black/80 relative glitch-container shadow-[0_0_30px_rgba(255,0,255,0.3)]">
            {gameOver && (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center crt-curve">
                <h2 className="text-5xl text-[#ff00ff] glitch-text mb-4">SYSTEM FAILURE</h2>
                <p className="mb-6 text-2xl neon-text-cyan">SCORE: {score}</p>
                <button
                  onClick={resetGame}
                  className="px-8 py-3 text-xl neon-border-cyan hover:bg-[#00ffff] hover:text-black transition-colors uppercase tracking-widest"
                >
                  REBOOT
                </button>
              </div>
            )}
            
            {isPaused && !gameOver && (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center crt-curve">
                <h2 className="text-5xl text-[#00ffff] glitch-text mb-4">SYSTEM PAUSED</h2>
                <p className="text-[#ff00ff] tracking-widest uppercase text-xl">Awaiting Focus...</p>
              </div>
            )}

            <div className="crt-curve bg-[#050505] overflow-hidden">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                className="block w-full max-w-[400px] aspect-square"
                style={{ imageRendering: 'pixelated' }}
              />
            </div>
          </div>

          {/* Mobile Score */}
          <div className="lg:hidden mt-4 flex justify-between items-center w-full max-w-[400px] neon-border-cyan p-2 bg-black/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
            <span className="uppercase flex items-center gap-2">Score: <span className="text-3xl neon-text-magenta glitch-text">{score}</span></span>
            <span className="uppercase flex items-center gap-2">Best: <span className="text-2xl neon-text-cyan glitch-text">{highScore}</span></span>
          </div>
        </div>

        {/* Right Panel - Music Player */}
        <div className="w-full max-w-[400px] lg:w-80 neon-border-cyan p-4 bg-black/50 backdrop-blur-sm flex flex-col gap-4 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
          <div className="flex items-center gap-2 border-b border-[#00ffff]/30 pb-2">
            <Volume2 size={18} className="text-[#ff00ff]" />
            <span className="text-[#ff00ff] uppercase tracking-wider">Audio.Sys</span>
          </div>

          <div className="bg-black/80 p-4 neon-border-magenta relative overflow-hidden group">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,0,255,0.1),transparent)] -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
            <p className="text-xs text-[#00ffff]/70 mb-2 uppercase">Now Playing</p>
            <p className="text-lg truncate font-bold tracking-wider glitch-text inline-block">
              {TRACKS[currentTrack].title}
            </p>
            {isPlaying && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-1 items-end h-4">
                <div className="w-1 bg-[#00ffff] animate-[bounce_1s_infinite]"></div>
                <div className="w-1 bg-[#00ffff] animate-[bounce_1.2s_infinite]"></div>
                <div className="w-1 bg-[#00ffff] animate-[bounce_0.8s_infinite]"></div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-8 mt-4">
            <button onClick={prevTrack} className="hover:text-[#ff00ff] transition-colors focus:outline-none">
              <SkipBack size={28} />
            </button>
            <button
              onClick={togglePlay}
              className="w-16 h-16 flex items-center justify-center neon-border-cyan rounded-full hover:bg-[#00ffff] hover:text-black transition-all focus:outline-none shadow-[0_0_15px_rgba(0,255,255,0.5)]"
            >
              {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-2" />}
            </button>
            <button onClick={nextTrack} className="hover:text-[#ff00ff] transition-colors focus:outline-none">
              <SkipForward size={28} />
            </button>
          </div>

          <div className="flex items-center gap-4 mt-6">
            <VolumeX size={20} className="text-[#00ffff]/70" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full"
            />
            <Volume2 size={20} className="text-[#00ffff]/70" />
          </div>

          <audio
            ref={audioRef}
            src={TRACKS[currentTrack].url}
            onEnded={nextTrack}
            className="hidden"
          />
        </div>

      </div>
    </div>
  );
}
