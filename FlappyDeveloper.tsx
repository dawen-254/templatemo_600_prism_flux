import React, { useEffect, useRef, useState, useCallback } from "react";

/**
 * Flappy Developer — a portfolio mini-game.
 * Drop this component anywhere (e.g. /games/flappy route or a modal trigger).
 * No external dependencies beyond React. Renders to an HTML5 Canvas.
 */

// ---------- Constants ----------
const CANVAS_W = 480;
const CANVAS_H = 640;
const GROUND_H = 80;

const GRAVITY = 0.45;
const JUMP_FORCE = -8;
const BASE_PIPE_SPEED = 2.6;
const BASE_PIPE_GAP = 170;
const PIPE_WIDTH = 64;
const PIPE_SPAWN_MS = 1500;
const BIRD_SIZE = 30;
const BIRD_X = 110;

const SKILLS = [
  { at: 5, label: "React" },
  { at: 10, label: "TypeScript" },
  { at: 15, label: "Node.js" },
  { at: 20, label: "Docker" },
  { at: 25, label: "PostgreSQL" },
  { at: 30, label: "Full Stack ★" },
];

const ACHIEVEMENTS = [
  { at: 10, label: "Bug Hunter" },
  { at: 25, label: "Full Stack" },
  { at: 50, label: "Coffee Addict" },
  { at: 100, label: "Impossible" },
];

type GameState = "ready" | "playing" | "gameover";

interface Pipe {
  x: number;
  gapY: number; // center of gap
  passed: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export default function FlappyDeveloper() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef<number>(0);
  const lastTsRef = useRef<number>(0);

  // Mutable game refs (avoid re-render churn inside the loop)
  const birdRef = useRef({ y: CANVAS_H / 2, velocity: 0, rotation: 0 });
  const pipesRef = useRef<Pipe[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const speedRef = useRef(BASE_PIPE_SPEED);
  const gapRef = useRef(BASE_PIPE_GAP);
  const shakeRef = useRef(0);

  const [state, setState] = useState<GameState>("ready");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("flappyDevHighScore") || 0);
    } catch {
      return 0;
    }
  });
  const [unlockedSkill, setUnlockedSkill] = useState<string | null>(null);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const seenAchievements = useRef<Set<string>>(new Set());

  // ---------- Reset ----------
  const resetGame = useCallback(() => {
    birdRef.current = { y: CANVAS_H / 2, velocity: 0, rotation: 0 };
    pipesRef.current = [];
    particlesRef.current = [];
    scoreRef.current = 0;
    speedRef.current = BASE_PIPE_SPEED;
    gapRef.current = BASE_PIPE_GAP;
    shakeRef.current = 0;
    lastSpawnRef.current = 0;
    seenAchievements.current = new Set();
    setScore(0);
    setUnlockedSkill(null);
    setNewAchievements([]);
  }, []);

  // ---------- Input ----------
  const flap = useCallback(() => {
    if (state === "ready") {
      resetGame();
      setState("playing");
      birdRef.current.velocity = JUMP_FORCE;
    } else if (state === "playing") {
      birdRef.current.velocity = JUMP_FORCE;
    } else if (state === "gameover") {
      resetGame();
      setState("playing");
      birdRef.current.velocity = JUMP_FORCE;
    }
  }, [state, resetGame]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        flap();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flap]);

  // ---------- Game over ----------
  const endGame = useCallback(() => {
    setState("gameover");
    shakeRef.current = 12;
    const final = scoreRef.current;
    setHighScore((prev) => {
      const next = Math.max(prev, final);
      try {
        localStorage.setItem("flappyDevHighScore", String(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  }, []);

  // ---------- Main loop ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const drawBackground = (t: number) => {
      const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(1, "#1e293b");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      // Parallax "code rain" dots
      ctx.fillStyle = "rgba(56, 189, 248, 0.18)";
      for (let i = 0; i < 18; i++) {
        const x = (i * 53 + (t * 0.01) % 53) % CANVAS_W;
        const y = (i * 97) % (CANVAS_H - GROUND_H);
        ctx.fillText(i % 2 === 0 ? "0" : "1", x, y);
      }

      // Ground
      ctx.fillStyle = "#0b1120";
      ctx.fillRect(0, CANVAS_H - GROUND_H, CANVAS_W, GROUND_H);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, CANVAS_H - GROUND_H);
      ctx.lineTo(CANVAS_W, CANVAS_H - GROUND_H);
      ctx.stroke();
    };

    const drawPipe = (pipe: Pipe) => {
      const gap = gapRef.current;
      const topH = pipe.gapY - gap / 2;
      const bottomY = pipe.gapY + gap / 2;

      ctx.fillStyle = "#22d3ee";
      ctx.strokeStyle = "#0e7490";
      ctx.lineWidth = 3;

      // top "bracket" pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, topH);
      ctx.strokeRect(pipe.x, 0, PIPE_WIDTH, topH);
      ctx.fillStyle = "#0891b2";
      ctx.font = "bold 22px monospace";
      ctx.fillText("{", pipe.x + PIPE_WIDTH / 2 - 6, topH - 12);

      // bottom pipe
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_H - GROUND_H - bottomY);
      ctx.strokeRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_H - GROUND_H - bottomY);
      ctx.fillStyle = "#0891b2";
      ctx.fillText("}", pipe.x + PIPE_WIDTH / 2 - 6, bottomY + 26);
    };

    const drawBird = () => {
      const b = birdRef.current;
      ctx.save();
      ctx.translate(BIRD_X, b.y);
      ctx.rotate(Math.max(-0.5, Math.min(0.9, b.rotation)));
      ctx.fillStyle = "#fbbf24";
      ctx.strokeStyle = "#92400e";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-BIRD_SIZE / 2, -BIRD_SIZE / 2, BIRD_SIZE, BIRD_SIZE, 8);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 13px monospace";
      ctx.textAlign = "center";
      ctx.fillText("</>", 0, 5);
      ctx.restore();
    };

    const spawnParticles = (x: number, y: number, color: string) => {
      for (let i = 0; i < 14; i++) {
        particlesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6,
          life: 30,
        });
      }
    };

    const update = (dt: number, ts: number) => {
      if (state !== "playing") return;
      const b = birdRef.current;

      b.velocity += GRAVITY;
      b.y += b.velocity;
      b.rotation = b.velocity * 0.04;

      // Difficulty ramp
      speedRef.current = Math.min(5, BASE_PIPE_SPEED + scoreRef.current * 0.03);
      gapRef.current = Math.max(120, BASE_PIPE_GAP - scoreRef.current * 1.2);

      // Spawn pipes
      if (ts - lastSpawnRef.current > PIPE_SPAWN_MS) {
        lastSpawnRef.current = ts;
        const margin = 80;
        const gapY =
          margin + Math.random() * (CANVAS_H - GROUND_H - margin * 2);
        pipesRef.current.push({ x: CANVAS_W + PIPE_WIDTH, gapY, passed: false });
      }

      // Move pipes + scoring
      for (const pipe of pipesRef.current) {
        pipe.x -= speedRef.current;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X - BIRD_SIZE / 2) {
          pipe.passed = true;
          scoreRef.current += 1;
          setScore(scoreRef.current);

          const skill = SKILLS.find((s) => s.at === scoreRef.current);
          if (skill) {
            setUnlockedSkill(skill.label);
            spawnParticles(BIRD_X, b.y, "#38bdf8");
          }
          const ach = ACHIEVEMENTS.find((a) => a.at === scoreRef.current);
          if (ach && !seenAchievements.current.has(ach.label)) {
            seenAchievements.current.add(ach.label);
            setNewAchievements((prev) => [...prev, ach.label]);
          }
        }
      }
      pipesRef.current = pipesRef.current.filter((p) => p.x > -PIPE_WIDTH);

      // Particles
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1;
      }
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // Collision: ground / ceiling
      if (b.y + BIRD_SIZE / 2 > CANVAS_H - GROUND_H || b.y - BIRD_SIZE / 2 < 0) {
        spawnParticles(BIRD_X, b.y, "#f87171");
        endGame();
        return;
      }

      // Collision: pipes (rect overlap)
      const gap = gapRef.current;
      const bLeft = BIRD_X - BIRD_SIZE / 2 + 4;
      const bRight = BIRD_X + BIRD_SIZE / 2 - 4;
      const bTop = b.y - BIRD_SIZE / 2 + 4;
      const bBottom = b.y + BIRD_SIZE / 2 - 4;

      for (const pipe of pipesRef.current) {
        const pLeft = pipe.x;
        const pRight = pipe.x + PIPE_WIDTH;
        const topH = pipe.gapY - gap / 2;
        const bottomY = pipe.gapY + gap / 2;

        const overlapsX = bLeft < pRight && bRight > pLeft;
        if (overlapsX) {
          const hitsTop = bTop < topH;
          const hitsBottom = bBottom > bottomY;
          if (hitsTop || hitsBottom) {
            spawnParticles(BIRD_X, b.y, "#f87171");
            endGame();
            return;
          }
        }
      }

      if (shakeRef.current > 0) shakeRef.current -= 1;
    };

    const drawHUD = () => {
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 36px monospace";
      ctx.textAlign = "center";
      ctx.fillText(String(scoreRef.current), CANVAS_W / 2, 60);
    };

    const drawParticles = () => {
      for (const p of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, p.life / 30);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(p.x, p.y, 4, 4);
      }
      ctx.globalAlpha = 1;
    };

    const render = (ts: number) => {
      if (!lastTsRef.current) lastTsRef.current = ts;
      const dt = ts - lastTsRef.current;
      lastTsRef.current = ts;

      update(dt, ts);

      ctx.save();
      if (shakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * shakeRef.current;
        const dy = (Math.random() - 0.5) * shakeRef.current;
        ctx.translate(dx, dy);
      }

      drawBackground(ts);
      for (const pipe of pipesRef.current) drawPipe(pipe);
      drawParticles();
      drawBird();
      if (state === "playing") drawHUD();

      ctx.restore();

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, endGame]);

  // Auto-dismiss skill toast
  useEffect(() => {
    if (!unlockedSkill) return;
    const id = setTimeout(() => setUnlockedSkill(null), 1800);
    return () => clearTimeout(id);
  }, [unlockedSkill]);

  useEffect(() => {
    if (newAchievements.length === 0) return;
    const id = setTimeout(() => setNewAchievements([]), 2200);
    return () => clearTimeout(id);
  }, [newAchievements]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: CANVAS_W,
          maxWidth: "100%",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
          border: "1px solid #1e293b",
        }}
        onMouseDown={flap}
        onTouchStart={(e) => {
          e.preventDefault();
          flap();
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", width: "100%", height: "auto", cursor: "pointer" }}
        />

        {state === "ready" && (
          <Overlay>
            <h2 style={titleStyle}>Flappy Developer</h2>
            <p style={subStyle}>
              Tap, click, or press Space to fly through the brackets.
            </p>
            <p style={subStyle}>Unlock a new skill every 5 points.</p>
            <Badge>High Score: {highScore}</Badge>
          </Overlay>
        )}

        {state === "gameover" && (
          <Overlay>
            <h2 style={titleStyle}>Game Over</h2>
            <p style={{ ...subStyle, fontSize: 22, color: "#fbbf24" }}>
              Score: {score}
            </p>
            <Badge>High Score: {highScore}</Badge>
            <p style={{ ...subStyle, marginTop: 12 }}>
              Tap to try again
            </p>
          </Overlay>
        )}

        {unlockedSkill && (
          <Toast>
            <strong>Skill unlocked:</strong> {unlockedSkill}
          </Toast>
        )}

        {newAchievements.length > 0 && (
          <Toast offset={unlockedSkill ? 56 : 0}>
            🏆 {newAchievements[newAchievements.length - 1]}
          </Toast>
        )}
      </div>

      <p style={{ color: "#64748b", fontSize: 13 }}>
        Space / Click / Tap to flap &nbsp;•&nbsp; High score saved locally
      </p>
    </div>
  );
}

// ---------- Small presentational helpers ----------

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  color: "#f8fafc",
  letterSpacing: 0.5,
};

const subStyle: React.CSSProperties = {
  margin: "4px 0",
  color: "#cbd5e1",
  fontSize: 14,
  textAlign: "center",
  maxWidth: 280,
};

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        background: "rgba(2, 6, 23, 0.72)",
        backdropFilter: "blur(2px)",
        textAlign: "center",
        padding: 24,
      }}
    >
      {children}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        marginTop: 8,
        padding: "4px 12px",
        borderRadius: 999,
        background: "#1e293b",
        border: "1px solid #334155",
        color: "#38bdf8",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Toast({
  children,
  offset = 0,
}: {
  children: React.ReactNode;
  offset?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 16 + offset,
        left: "50%",
        transform: "translateX(-50%)",
        background: "#0f172a",
        border: "1px solid #38bdf8",
        color: "#e2e8f0",
        padding: "8px 14px",
        borderRadius: 8,
        fontSize: 13,
        whiteSpace: "nowrap",
        boxShadow: "0 4px 16px rgba(56, 189, 248, 0.25)",
      }}
    >
      {children}
    </div>
  );
}
