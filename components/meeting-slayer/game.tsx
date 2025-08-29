"use client";
import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import type React from "react";

import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";
// Fluent UI (Teams) icons
import {
  Alert24Regular as ActivityIcon,
  Chat24Regular as ChatIcon,
  PeopleTeam24Regular as TeamsIcon,
  Call24Regular as CallsIcon,
  CalendarLtr24Regular as CalendarIcon,
  Video24Regular as MeetIcon,
  Cloud24Regular as OneDriveIcon,
  Sparkle24Regular as CopilotIcon,
  Whiteboard24Regular as WhiteboardIcon,
  ApprovalsApp24Regular as ApprovalsIcon,
  AppsList24Regular as AppsIcon,
  Dismiss24Regular as DismissIcon,
  Link24Regular as LinkIcon,
  VideoClip24Regular as VideoBtnIcon,
  ChevronLeft24Regular,
  ChevronRight24Regular,
} from "@fluentui/react-icons";

// Teams v2 dark approximations (3-5 colors max)
const COLORS = {
  primary: "#5B5FC7", // Teams brand purple
  bg: "#1F1F1F", // app background
  panel: "#232323", // topbar/sidebar
  border: "#2F2F2F", // separators/grid
  meetingBg: "#20223A", // meeting card
  ball: "#22D3EE",
} as const;

type Difficulty = "Fresher" | "Manager" | "Director";
type Brick = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  alive: boolean;
  breaking?: boolean;
};

export default function MeetingSlayer() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ w: 0, h: 0 });

  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [started, setStarted] = useState(false);
  const [bricks, setBricks] = useState<Brick[]>([]);
  const bricksRef = useRef<Brick[]>([]);
  const [score, setScore] = useState(0); // meetings slayed (removed)
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);

  // Meet now modal
  const [meetNowOpen, setMeetNowOpen] = useState(false);
  const [meetTitle, setMeetTitle] = useState("Meeting with Pranay Gupta");

  // physics
  const paddle = useRef({ x: 200, y: 0, w: 120, h: 14, speed: 560 });
  const ball = useRef({ x: 240, y: 300, r: 8, vx: 260, vy: -260 });
  const keys = useRef({ left: false, right: false });
  const draggingRef = useRef(false);
  const running = started && !gameOver && !win;

  const paddleEl = useRef<HTMLDivElement>(null);
  const ballEl = useRef<HTMLDivElement>(null);

  // board resize
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setBoardSize({ w: r.width, h: r.height });
      paddle.current.y = r.height - 36;
      paddle.current.x = Math.min(Math.max(paddle.current.x, 0), r.width - paddle.current.w);
      applyTransforms();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // keys
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = true;
      if (e.key === "ArrowRight") keys.current.right = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keys.current.left = false;
      if (e.key === "ArrowRight") keys.current.right = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  function applyTransforms() {
    const p = paddle.current;
    const b = ball.current;
    if (paddleEl.current) paddleEl.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    if (ballEl.current)
      ballEl.current.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`;
  }

  const destroyedIdsRef = useRef<Set<string>>(new Set());

  useRaf(running, (dt) => {
    const { w, h } = boardSize;
    if (!w || !h) return;

    // paddle
    const p = paddle.current;
    if (keys.current.left) p.x -= p.speed * dt;
    if (keys.current.right) p.x += p.speed * dt;
    p.x = Math.max(0, Math.min(p.x, w - p.w));

    // ball
    const b = ball.current;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // walls
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx *= -1;
    }
    if (b.x + b.r > w) {
      b.x = w - b.r;
      b.vx *= -1;
    }
    if (b.y - b.r < 0) {
      b.y = b.r;
      b.vy *= -1;
    }
    if (b.y - b.r > h + 24) {
      setGameOver(true);
      return;
    }

    // paddle collision
    if (b.vy > 0 && aabb(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, p.x, p.y, p.w, p.h)) {
      b.y = p.y - b.r;
      b.vy *= -1;
      const hit = (b.x - (p.x + p.w / 2)) / (p.w / 2);
      b.vx += hit * 200;
      const max = 540;
      const spd = Math.hypot(b.vx, b.vy);
      if (spd > max) {
        const k = max / spd;
        b.vx *= k;
        b.vy *= k;
      }
    }

    // brick collisions
    const list = bricksRef.current;
    let hitIndex = -1;
    for (let i = 0; i < list.length; i++) {
      const br = list[i];
      if (!br.alive || br.breaking) continue;
      if (aabb(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2, br.x, br.y + 8, br.w, br.h)) {
        hitIndex = i;
        break;
      }
    }
    if (hitIndex >= 0) {
      const br = list[hitIndex];

      const leftOverlap = b.x + b.r - br.x;
      const rightOverlap = br.x + br.w - (b.x - b.r);
      const topOverlap = b.y + b.r - (br.y + 8);
      const bottomOverlap = br.y + 8 + br.h - (b.y - b.r);
      const ox = Math.min(leftOverlap, rightOverlap);
      const oy = Math.min(topOverlap, bottomOverlap);

      if (ox < oy) {
        b.vx *= -1;
        if (leftOverlap < rightOverlap) b.x = br.x - b.r - 0.5;
        else b.x = br.x + br.w + b.r + 0.5;
      } else {
        b.vy *= -1;
        if (topOverlap < bottomOverlap) b.y = br.y + 8 - b.r - 0.5;
        else b.y = br.y + 8 + br.h + b.r + 0.5;
      }

      if (!destroyedIdsRef.current.has(br.id)) {
        destroyedIdsRef.current.add(br.id);
        list[hitIndex] = { ...br, breaking: true };
        startTransition(() => setBricks([...list]));

        setTimeout(() => {
          const current = bricksRef.current;
          const idx = current.findIndex((x) => x.id === br.id);
          if (idx !== -1) {
            current[idx] = { ...current[idx], alive: false, breaking: false };
            bricksRef.current = [...current];
            startTransition(() => setBricks([...bricksRef.current]));
            setScore((s) => s + 1);
          }
        }, 160);
      }
    }

    applyTransforms();
  });

  function initGame(level: Difficulty) {
    setDifficulty(level);
    setScore(0);
    setGameOver(false);
    setWin(false);

    const { w, h } = boardSize;
    paddle.current = { x: w / 2 - 60, y: h - 36, w: 120, h: 14, speed: 560 };
    const ang = (Math.random() * 0.5 + 0.25) * Math.PI;
    const speed = 360;
    ball.current = {
      x: w / 2,
      y: h * 0.65,
      r: 8,
      vx: Math.cos(ang) * speed * (Math.random() < 0.5 ? -1 : 1),
      vy: -Math.sin(ang) * speed,
    };

    const generated = generateMeetings(w, h * 0.84, level);
    bricksRef.current = generated;
    destroyedIdsRef.current = new Set<string>();
    setBricks(generated);
    setStarted(true);
    applyTransforms();
  }

  useEffect(() => {
    if (started && bricks.length > 0 && bricks.every((b) => !b.alive)) {
      setWin(true);
      const rect = boardRef.current?.getBoundingClientRect();

      // Multi-burst confetti (fireworks style)
      const count = 200;
      const originX = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
      const originY = rect ? (rect.top + rect.height / 3) / window.innerHeight : 0.3;

      const defaults = {
        origin: { x: originX, y: originY },
        colors: [COLORS.primary, "#A78BFA", "#60A5FA", "#FFFFFF"],
      };

      const fire = (particleRatio: number, opts = {}) => {
        confetti({
          ...defaults,
          ...opts,
          particleCount: Math.floor(count * particleRatio),
        });
      };

      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });

      fire(0.2, {
        spread: 60,
      });

      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });

      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    }
  }, [started, bricks]);

  // compute Mon–Fri header with dates
  const weekInfo = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 Sun
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    const labels = Array.from({ length: 5 }).map((_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        key: i,
        dow: d.toLocaleDateString(undefined, { weekday: "short" }),
        dd: d.toLocaleDateString(undefined, { day: "2-digit" }),
        month: d.toLocaleDateString(undefined, { month: "long" }),
        yyyy: d.getFullYear(),
      };
    });
    const first = labels[0];
    const last = labels[labels.length - 1];
    const range = `${first.dd}–${last.dd} ${last.month}, ${last.yyyy}`;
    return { labels, range };
  }, []);

  const aliveCount = useMemo(() => bricks.filter((b) => b.alive).length, [bricks]);

  function movePaddleTo(clientX: number) {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const desired = clientX - rect.left - paddle.current.w / 2;
    paddle.current.x = Math.max(0, Math.min(desired, rect.width - paddle.current.w));
    applyTransforms();
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    movePaddleTo(e.clientX);
    e.preventDefault();
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    movePaddleTo(e.clientX);
    e.preventDefault();
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    (e.currentTarget as any).releasePointerCapture?.(e.pointerId);
    e.preventDefault();
  }

  return (
    <div className="flex h-[100dvh] md:h-screen" style={{ background: COLORS.bg }}>
      {/* Sidebar with Fluent UI icons */}
      <aside
        aria-label="Teams sidebar"
        className="hidden md:flex h-full flex-col items-center gap-2 w-16 p-3 border-r"
        style={{ background: COLORS.panel, borderColor: COLORS.border }}>
        {[
          { k: "Activity", I: ActivityIcon },
          { k: "Chat", I: ChatIcon },
          { k: "Teams", I: TeamsIcon },
          { k: "Calls", I: CallsIcon },
          { k: "Calendar", I: CalendarIcon, active: true },
          { k: "Meet", I: MeetIcon },
          { k: "OneDrive", I: OneDriveIcon },
          { k: "Copilot", I: CopilotIcon },
          { k: "Whiteboard", I: WhiteboardIcon },
          { k: "Approvals", I: ApprovalsIcon },
          { k: "Apps", I: AppsIcon },
        ].map(({ k, I, active }) => (
          <button
            key={k}
            title={k}
            aria-label={k}
            className={cn(
              "w-10 h-10 rounded-md grid place-items-center border",
              active ? "ring-2" : ""
            )}
            style={{
              background: COLORS.panel,
              borderColor: COLORS.border,
              color: active ? "#FFFFFF" : "rgba(255,255,255,0.8)",
              boxShadow: active ? `inset 0 0 0 2px ${COLORS.primary}` : undefined,
            }}>
            <I />
          </button>
        ))}
      </aside>

      {/* Main */}
      <section className="flex-1 flex flex-col min-h-0 text-white">
        {/* Top bar */}
        <div
          className="w-full border-b"
          style={{ background: COLORS.panel, borderColor: COLORS.border }}>
          <div className="mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                className="px-2 h-7 rounded-md border text-white/80 inline-flex items-center justify-center"
                style={{ background: COLORS.panel, borderColor: COLORS.border }}
                aria-label="Previous">
                <ChevronLeft24Regular />
              </button>
              <button
                className="px-2 h-7 rounded-md border text-white/80 inline-flex items-center justify-center"
                style={{ background: COLORS.panel, borderColor: COLORS.border }}
                aria-label="Next">
                <ChevronRight24Regular />
              </button>
              <div className="text-sm text-white/90">{weekInfo.range}</div>
            </div>

            <div className="text-sm font-medium">Meetings Slayed: {score}</div>

            <div className="hidden md:flex items-center gap-2">
              {[
                { label: "Work week" },
                { label: "Filter" },
                { label: "Meet now", onClick: () => setMeetNowOpen(true) },
              ].map((t) => (
                <button
                  key={t.label}
                  onClick={t.onClick}
                  className="text-xs md:text-sm px-2 py-1 rounded-md border text-white/85"
                  style={{ background: COLORS.panel, borderColor: COLORS.border }}>
                  {t.label}
                </button>
              ))}
              <button
                className="text-xs md:text-sm px-3 py-1 rounded-md text-white border"
                style={{ background: COLORS.primary, borderColor: COLORS.primary }}>
                New event
              </button>
            </div>
          </div>
        </div>

        {/* Calendar board */}
        <div
          className={cn(
            "relative mx-auto w-full max-w-[1400px] px-2 md:px-6 py-4 flex-1 min-h-0",
            started && !win && !gameOver ? "" : "backdrop-blur-sm"
          )}>
          <div className="flex h-full gap-2">
            {/* Time gutter (left) */}
            <div
              className="hidden md:block w-14 shrink-0 rounded-md border overflow-hidden"
              style={{ background: COLORS.panel, borderColor: COLORS.border }}
              aria-label="Time gutter">
              {/* header spacer to align with day headers */}
              <div className="h-10 -mb-[27px]" style={{ borderColor: COLORS.border }} />
              <div className="relative">
                {Array.from({ length: 15 }).map((_, i) => {
                  const hour = 5 + i; // 5 → 19
                  return (
                    <div
                      key={hour}
                      className="h-[78px] p-2 text-[11px] flex items-start justify-end text-white/60"
                      style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <span className="">{hour}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Playable calendar grid */}
            <div
              ref={boardRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="relative rounded-md border overflow-hidden h-full flex-1"
              style={{
                touchAction: "none",
                userSelect: "none",
                WebkitUserSelect: "none",
                background: `repeating-linear-gradient(0deg, ${COLORS.bg}, ${COLORS.bg} 38px, ${COLORS.border} 39px, ${COLORS.bg} 78px),
                             repeating-linear-gradient(90deg, ${COLORS.bg}, ${COLORS.bg} calc(20% - 1px), ${COLORS.border} calc(20% - 1px), ${COLORS.border} 20%)`,
                borderColor: COLORS.border,
              }}>
              {/* Day headers: dd and dow */}
              <div className="absolute left-0 top-0 w-full h-10 flex">
                {weekInfo.labels.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex-1 border-r flex items-center gap-2 px-3 text-xs"
                    style={{ borderColor: COLORS.border, background: COLORS.panel }}>
                    <span className="text-white/85 text-sm font-medium">{item.dd}</span>
                    <span className="text-white/70">{item.dow}</span>
                  </div>
                ))}
              </div>

              {/* Meetings */}
              {bricks.map((br) => {
                if (!br.alive && !br.breaking) return null;
                const breaking = br.breaking && br.alive;
                return (
                  <div
                    key={br.id}
                    className={cn(
                      "absolute rounded-[6px] text-xs shadow-sm border transition-opacity duration-150 will-change-transform",
                      breaking ? "opacity-0 scale-90" : "opacity-100"
                    )}
                    style={{
                      left: br.x,
                      top: br.y + 10, // account for header height
                      width: br.w,
                      height: br.h,
                      background: COLORS.meetingBg,
                      borderColor: COLORS.primary,
                    }}>
                    <div
                      className="absolute left-0 top-0 h-full w-[4px] rounded-l-[6px]"
                      style={{ background: COLORS.primary }}
                    />
                    <div className="p-2 pl-3 leading-tight">
                      <div className="font-medium text-white/90 text-pretty">{br.title}</div>
                      <div className="text-[10px] text-white/60">Microsoft Teams Meeting</div>
                    </div>
                  </div>
                );
              })}

              {/* Paddle */}
              <div
                ref={paddleEl}
                aria-label="Paddle"
                className="absolute rounded-md will-change-transform"
                style={{
                  left: 0,
                  top: 0,
                  width: paddle.current.w,
                  height: paddle.current.h,
                  background: COLORS.primary,
                  boxShadow: "0 0 10px rgba(91,95,199,0.45)",
                  transform: `translate3d(${paddle.current.x}px, ${paddle.current.y}px, 0)`,
                }}
              />
              {/* Ball */}
              <div
                ref={ballEl}
                aria-label="Ball"
                className="absolute rounded-full will-change-transform"
                style={{
                  left: 0,
                  top: 0,
                  width: ball.current.r * 2,
                  height: ball.current.r * 2,
                  background: COLORS.ball,
                  boxShadow: "0 0 8px rgba(34,211,238,0.6)",
                  transform: `translate3d(${ball.current.x - ball.current.r}px, ${
                    ball.current.y - ball.current.r
                  }px, 0)`,
                }}
              />
            </div>
          </div>

          {/* Overlays */}
          {!started && <StartOverlay onStart={initGame} />}

          {gameOver && (
            <OverlayCard
              title="Game Over"
              subtitle="You can’t escape meetings forever…"
              score={score}
              actionText="Play Again"
              onAction={() => difficulty && initGame(difficulty)}
            />
          )}

          {win && (
            <OverlayCard
              title="Yay! No meetings this week 🎉"
              subtitle="Calendar cleared."
              score={score}
              actionText="Play Again"
              onAction={() => difficulty && initGame(difficulty)}
            />
          )}

          {/* Meet now modal */}
          {meetNowOpen && (
            <div className="absolute inset-0 grid place-items-center">
              <div
                className="w-full max-w-xl rounded-2xl border p-6 md:p-7 relative"
                style={{ background: "#2B2B2B", borderColor: COLORS.border }}
                role="dialog"
                aria-modal="true"
                aria-label="Start a meeting now">
                <button
                  onClick={() => setMeetNowOpen(false)}
                  className="absolute right-4 top-4 text-white/70"
                  aria-label="Close">
                  <DismissIcon />
                </button>
                <h3 className="text-2xl font-semibold text-white">Start a meeting now</h3>
                <label className="block mt-5 text-white/85">Meeting name</label>
                <input
                  value={meetTitle}
                  onChange={(e) => setMeetTitle(e.target.value)}
                  className="mt-2 w-full rounded-md border px-3 py-3 bg-transparent text-white"
                  style={{ borderColor: COLORS.border }}
                />
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white border"
                    style={{ background: COLORS.primary, borderColor: COLORS.primary }}>
                    <VideoBtnIcon />
                    Start meeting
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm text-white/90 border"
                    style={{ background: "transparent", borderColor: COLORS.border }}>
                    <LinkIcon />
                    Get a link to share
                  </button>
                </div>
              </div>
            </div>
          )}

          <span className="sr-only" aria-live="polite">
            {aliveCount} meetings remaining
          </span>
        </div>
      </section>
    </div>
  );
}

function useRaf(active: boolean, cb: (dt: number) => void) {
  const last = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    function loop(ts: number) {
      if (last.current == null) last.current = ts;
      // ball speed
      const dt = (ts - last.current) / 900;
      last.current = ts;
      cb(dt);
      rafRef.current = requestAnimationFrame(loop);
    }
    if (active) rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      last.current = null;
    };
  }, [active, cb]);
}

function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number
) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function generateMeetings(width: number, height: number, difficulty: Difficulty): Brick[] {
  const P = 8;
  const W = width - P * 2;
  const H = height - P * 2;
  const cols = 5;
  const rows = 10;
  const colW = W / cols;
  const rowH = H / rows;
  const bricks: Brick[] = [];

  let density = 0.35;
  if (difficulty === "Fresher") density = 0.22;
  if (difficulty === "Manager") density = 0.45;
  if (difficulty === "Director") density = 0.7;

  const rng = (a: number, b: number) => Math.random() * (b - a) + a;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < density) {
        let x = P + c * colW;
        let y = P + r * rowH;
        let w = colW * (difficulty === "Director" ? rng(0.85, 1.2) : rng(0.8, 1.0));
        let h = rowH * (difficulty === "Director" ? rng(0.9, 1.4) : rng(0.7, 1.0));
        const jitter = difficulty === "Fresher" ? 4 : difficulty === "Manager" ? 10 : 18;
        x += rng(-jitter, jitter);
        y += rng(-jitter, jitter);
        w = Math.max(50, Math.min(w, W - (x - P)));
        h = Math.max(28, Math.min(h, H - (y - P)));
        bricks.push({
          id: `b-${r}-${c}-${Math.random().toString(36).slice(2, 7)}`,
          x,
          y,
          w,
          h,
          title: randomTitle(),
          alive: true,
        });
      }
    }
  }

  // Ensure playable amount on easy
  if (bricks.length < 6) {
    for (let i = bricks.length; i < 6; i++) {
      const c = Math.floor(rng(0, cols));
      const r = Math.floor(rng(0, rows));
      bricks.push({
        id: `f-${i}`,
        x: P + c * colW + rng(-4, 4),
        y: P + r * rowH + rng(-4, 4),
        w: colW * 0.8,
        h: rowH * 0.8,
        title: randomTitle(),
        alive: true,
      });
    }
  }

  return bricks;
}

function randomTitle() {
  const titles = [
    "Daily Stand-up",
    "Design Sync",
    "Refinement",
    "1:1 Connect",
    "DevOps Call",
    "Planning",
    "Sprint Review",
    "Arch Check-in",
    "Retro",
    "Focus Block",
  ];
  return titles[Math.floor(Math.random() * titles.length)];
}

function StartOverlay({ onStart }: { onStart: (d: Difficulty) => void }) {
  const [selected, setSelected] = useState<Difficulty>("Fresher");
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="w-full max-w-xl rounded-lg border p-6 md:p-8 mx-4 text-center"
        style={{ background: "#141824", borderColor: "#2F2F2F" }}>
        <h1 className="text-2xl md:text-3xl font-semibold text-balance text-white">
          Meeting Slayer
        </h1>
        <p className="mt-2 text-white/80">The only way to escape endless calls.</p>

        <div className="mt-5 flex items-center justify-center gap-3 text-white/80">
          <span
            className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm font-medium"
            style={{ background: "#232323", borderColor: "#2F2F2F", color: "var(--foreground)" }}>
            ←
          </span>
          <span className="text-xs">Move</span>
          <span
            className="inline-flex items-center justify-center rounded-md border px-3 py-1 text-sm font-medium"
            style={{ background: "#232323", borderColor: "#2F2F2F", color: "var(--foreground)" }}>
            →
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {(["Fresher", "Manager", "Director"] as Difficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setSelected(d)}
              className={cn(
                "rounded-md border px-4 py-3 text-sm text-left",
                selected === d ? "ring-2 ring-offset-0" : "opacity-80 hover:opacity-100"
              )}
              style={{
                background: "#232323",
                borderColor: "#2F2F2F",
                outlineColor: "#5B5FC7" as any,
              }}>
              <div className="font-medium text-white">{d}</div>
              <div className="text-white/70 text-xs mt-1">
                {d === "Fresher" && "Sparse calendar, simple layout"}
                {d === "Manager" && "Busier week, some randomness"}
                {d === "Director" && "Wall-to-wall meetings, overlaps"}
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <button
            onClick={() => onStart(selected)}
            className="rounded-md px-5 py-2 text-sm text-white border"
            style={{ background: "#5B5FC7", borderColor: "#5B5FC7" }}>
            Start
          </button>
        </div>
      </div>
    </div>
  );
}

function OverlayCard({
  title,
  subtitle,
  score,
  actionText,
  onAction,
}: {
  title: string;
  subtitle: string;
  score: number;
  actionText: string;
  onAction: () => void;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className="w-full max-w-md rounded-lg border p-6 md:p-8 mx-4 text-center"
        style={{ background: "#141824", borderColor: "#2F2F2F" }}>
        <h2 className="text-2xl font-semibold text-white">{title}</h2>
        <p className="mt-2 text-white/80">{subtitle}</p>
        <div className="mt-4 text-white">Meetings Slayed: {score}</div>
        <div className="mt-6">
          <button
            onClick={onAction}
            className="rounded-md px-5 py-2 text-sm text-white border"
            style={{ background: "#5B5FC7", borderColor: "#5B5FC7" }}>
            {actionText}
          </button>
        </div>
      </div>
    </div>
  );
}
