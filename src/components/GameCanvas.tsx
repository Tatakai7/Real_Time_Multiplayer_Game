import { useEffect, useRef, useState } from 'react';
import { RoomPlayer, Player, supabase } from '../lib/supabase';

interface GameCanvasProps {
  roomId: string;
  player: Player;
  roomPlayers: RoomPlayer[];
  gameType: string;
  onPositionUpdate: (x: number, y: number) => void;
  onScoreUpdate: (score: number) => void;
}

interface Collectible {
  id: string;
  x: number;
  y: number;
  type: 'coin' | 'gem' | 'star';
  value: number;
  collected: boolean;
}

interface Position {
  x: number;
  y: number;
}

export function GameCanvas({ roomId, player, roomPlayers, gameType, onPositionUpdate, onScoreUpdate }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [collectibles, setCollectibles] = useState<Collectible[]>([]);
  const [myPosition, setMyPosition] = useState<Position>({ x: 400, y: 300 });
  const [myScore, setMyScore] = useState(0);
  const [gameTime, setGameTime] = useState(60);
  const keysPressed = useRef<Set<string>>(new Set());
  const animationFrameId = useRef<number>();
  const lastUpdateTime = useRef<number>(0);

  useEffect(() => {
    initializeCollectibles();

    const timer = setInterval(() => {
      setGameTime((prev) => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(e.key)) {
        e.preventDefault();
        keysPressed.current.add(e.key.toLowerCase());
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const gameLoop = () => {
      updateGame();
      renderGame(ctx);
      animationFrameId.current = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [myPosition, collectibles, roomPlayers, myScore]);

  const initializeCollectibles = () => {
    const items: Collectible[] = [];
    const types: Array<'coin' | 'gem' | 'star'> = ['coin', 'coin', 'coin', 'gem', 'gem', 'star'];
    const values = { coin: 10, gem: 25, star: 50 };

    for (let i = 0; i < 20; i++) {
      const type = types[Math.floor(Math.random() * types.length)];
      items.push({
        id: `${Date.now()}-${i}`,
        x: Math.random() * 750 + 25,
        y: Math.random() * 550 + 25,
        type,
        value: values[type],
        collected: false,
      });
    }

    setCollectibles(items);
  };

  const updateGame = () => {
    const now = Date.now();
    if (now - lastUpdateTime.current < 16) return;

    const speed = 5;
    let newX = myPosition.x;
    let newY = myPosition.y;

    if (keysPressed.current.has('arrowup') || keysPressed.current.has('w')) newY -= speed;
    if (keysPressed.current.has('arrowdown') || keysPressed.current.has('s')) newY += speed;
    if (keysPressed.current.has('arrowleft') || keysPressed.current.has('a')) newX -= speed;
    if (keysPressed.current.has('arrowright') || keysPressed.current.has('d')) newX += speed;

    newX = Math.max(20, Math.min(780, newX));
    newY = Math.max(20, Math.min(580, newY));

    if (newX !== myPosition.x || newY !== myPosition.y) {
      setMyPosition({ x: newX, y: newY });
      if (now - lastUpdateTime.current > 50) {
        onPositionUpdate(newX, newY);
        lastUpdateTime.current = now;
      }
    }

    checkCollisions(newX, newY);
  };

  const checkCollisions = (x: number, y: number) => {
    const playerRadius = 20;
    let scoreChanged = false;
    let newScore = myScore;

    setCollectibles((prev) =>
      prev.map((item) => {
        if (item.collected) return item;

        const dx = item.x - x;
        const dy = item.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < playerRadius + 15) {
          newScore += item.value;
          scoreChanged = true;
          return { ...item, collected: true };
        }

        return item;
      })
    );

    if (scoreChanged && newScore !== myScore) {
      setMyScore(newScore);
      onScoreUpdate(newScore);
    }
  };

  const renderGame = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, 800, 600);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 800, 600);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i < 800; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 600);
      ctx.stroke();
    }
    for (let i = 0; i < 600; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(800, i);
      ctx.stroke();
    }

    collectibles.forEach((item) => {
      if (item.collected) return;

      ctx.save();
      ctx.translate(item.x, item.y);

      if (item.type === 'coin') {
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.type === 'gem') {
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.moveTo(0, -15);
        ctx.lineTo(10, -5);
        ctx.lineTo(10, 10);
        ctx.lineTo(0, 15);
        ctx.lineTo(-10, 10);
        ctx.lineTo(-10, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (item.type === 'star') {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const x = Math.cos(angle) * 15;
          const y = Math.sin(angle) * 15;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          const innerAngle = angle + Math.PI / 5;
          const innerX = Math.cos(innerAngle) * 7;
          const innerY = Math.sin(innerAngle) * 7;
          ctx.lineTo(innerX, innerY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.restore();
    });

    roomPlayers.forEach((rp) => {
      const isMe = rp.player_id === player.id;
      const x = isMe ? myPosition.x : Number(rp.position_x);
      const y = isMe ? myPosition.y : Number(rp.position_y);

      ctx.save();
      ctx.translate(x, y);

      ctx.fillStyle = rp.players?.avatar_color || '#3B82F6';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      if (isMe) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(rp.players?.username.charAt(0).toUpperCase() || 'P', 0, 5);

      ctx.font = '12px sans-serif';
      ctx.fillStyle = isMe ? '#FFFFFF' : '#94A3B8';
      ctx.fillText(rp.players?.username || '', 0, -30);

      ctx.restore();
    });
  };

  const endGame = async () => {
    const sortedPlayers = [...roomPlayers].sort((a, b) => {
      const scoreA = a.player_id === player.id ? myScore : a.score;
      const scoreB = b.player_id === player.id ? myScore : b.score;
      return scoreB - scoreA;
    });

    const myRank = sortedPlayers.findIndex((rp) => rp.player_id === player.id) + 1;

    await supabase.from('game_scores').insert([
      {
        room_id: roomId,
        player_id: player.id,
        score: myScore,
        rank: myRank,
        game_type: gameType,
      },
    ]);

    const isWinner = myRank === 1;
    await supabase
      .from('players')
      .update({
        total_score: player.total_score + myScore,
        games_played: player.games_played + 1,
        wins: isWinner ? player.wins + 1 : player.wins,
      })
      .eq('id', player.id);

    await supabase
      .from('game_rooms')
      .update({ status: 'finished' })
      .eq('id', roomId);
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-xl border border-slate-700/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="text-white">
            <span className="text-2xl font-bold">{Math.floor(gameTime / 60)}:{(gameTime % 60).toString().padStart(2, '0')}</span>
            <span className="text-sm text-slate-400 ml-2">Time Left</span>
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="text-white">
            <span className="text-2xl font-bold text-yellow-400">{myScore}</span>
            <span className="text-sm text-slate-400 ml-2">Your Score</span>
          </div>
        </div>
        <div className="text-sm text-slate-400">
          Use Arrow Keys or WASD to move
        </div>
      </div>

      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full rounded-lg border border-slate-700 shadow-2xl"
        style={{ maxWidth: '100%', height: 'auto' }}
      />

      {gameTime === 0 && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
          <div className="bg-slate-800 rounded-xl p-8 text-center border border-slate-700">
            <h2 className="text-3xl font-bold text-white mb-4">Game Over!</h2>
            <div className="text-5xl font-bold text-yellow-400 mb-2">{myScore}</div>
            <p className="text-slate-400">Final Score</p>
          </div>
        </div>
      )}
    </div>
  );
}
