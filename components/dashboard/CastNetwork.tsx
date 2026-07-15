"use client";

import { useRef, useState, useEffect, useCallback } from 'react';

/* ── types ── */

interface NetworkNode {
  id: string;
  label: string;
  value: number;
}

interface NetworkLink {
  source: string;
  target: string;
  value: number;
}

interface CastNetworkProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  height?: number;
}

/* ── palette ── */

const COLORS = [
  '#f97316', '#ef4444', '#8b5cf6', '#3b82f6',
  '#06b6d4', '#22c55e', '#eab308', '#ec4899',
  '#6366f1', '#14b8a6', '#f59e0b', '#84cc16',
  '#a855f7', '#0ea5e9', '#f43f5e', '#10b981',
  '#d946ef', '#fb923c', '#38bdf8', '#a3e635',
];

/* ── layout types ── */

interface LayoutNode {
  id: string;
  label: string;
  value: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  index: number;
}

interface LayoutLink {
  source: LayoutNode;
  target: LayoutNode;
  value: number;
}

/* ── helpers ── */

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/* ── component ── */

export function CastNetwork({ nodes: inputNodes, links: inputLinks, height = 500 }: CastNetworkProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(800);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const layoutRef = useRef<{ lnodes: LayoutNode[]; llinks: LayoutLink[]; settled: boolean } | null>(null);
  const animRef = useRef<number>(0);
  const dragRef = useRef<LayoutNode | null>(null);

  /* ── resize ── */

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setSvgWidth(el.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  /* ── build layout ── */

  const layoutData = useRef<{ lnodes: LayoutNode[]; llinks: LayoutLink[] } | null>(null);

  if (!layoutData.current) {
    const maxVal = Math.max(...inputNodes.map((n) => n.value), 1);
    const nodeMap = new Map<string, LayoutNode>();

    // Pre-compute degree (connection count) for smarter initial placement
    const degree = new Map<string, number>();
    inputNodes.forEach((n) => degree.set(n.id, 0));
    inputLinks.forEach((l) => {
      degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
      degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
    });

    // Sort by degree desc — high-degree nodes placed closer to center
    const sorted = [...inputNodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));

    const count = sorted.length;
    // Place on concentric rings — center of svg is (~400, ~250) initially
    const baseR = Math.min(500, height * 0.95);
    const initCx = 400;
    const initCy = height / 2;

    const lnodes: LayoutNode[] = inputNodes.map((n, i) => {
      const r = clamp(8 + (n.value / maxVal) * 18, 8, 26);
      const rank = sorted.findIndex((s) => s.id === n.id);
      const angle = (rank / count) * Math.PI * 2 - Math.PI / 2;
      // High-degree nodes on inner ring, low-degree on outer
      const ringR = baseR * (0.3 + 0.7 * (rank / count));
      const node: LayoutNode = {
        id: n.id,
        label: n.label,
        value: n.value,
        x: initCx + Math.cos(angle) * ringR,
        y: initCy + Math.sin(angle) * ringR,
        vx: 0,
        vy: 0,
        radius: r,
        color: COLORS[i % COLORS.length],
        index: i,
      };
      nodeMap.set(n.id, node);
      return node;
    });

    const llinks: LayoutLink[] = inputLinks
      .map((l) => {
        const source = nodeMap.get(l.source);
        const target = nodeMap.get(l.target);
        if (!source || !target) return null;
        return { source, target, value: l.value };
      })
      .filter(Boolean) as LayoutLink[];

    layoutData.current = { lnodes, llinks };
  }

  /* ── force simulation ── */

  const runSim = useCallback(() => {
    const data = layoutData.current;
    if (!data) return;
    const { lnodes, llinks } = data;
    const W = svgWidth;
    const H = height;
    const cx = W / 2;
    const cy = H / 2;

    let maxVel = Infinity;
    let iter = 0;

    const simulate = () => {
      if (iter > 600 || maxVel < 0.08) {
        layoutRef.current = { lnodes, llinks, settled: true };
        return;
      }
      iter++;

      const alpha = Math.max(0.02, 1 - iter / 500);

      // reset forces
      for (const n of lnodes) {
        n.vx *= 0.85; // damping
        n.vy *= 0.85;
      }

      // repulsion between all node pairs
      for (let i = 0; i < lnodes.length; i++) {
        for (let j = i + 1; j < lnodes.length; j++) {
          const a = lnodes[i];
          const b = lnodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          let dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = a.radius + b.radius + 48;
          if (dist < minDist) dist = minDist;
          const force = (alpha * 1400) / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      // spring attraction along links
      for (const l of llinks) {
        const dx = l.target.x - l.source.x;
        const dy = l.target.y - l.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const restLen = l.source.radius + l.target.radius + 110;
        const force = (dist - restLen) * alpha * 0.015;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        l.source.vx += fx;
        l.source.vy += fy;
        l.target.vx -= fx;
        l.target.vy -= fy;
      }

      // centering
      for (const n of lnodes) {
        const dx = cx - n.x;
        const dy = cy - n.y;
        n.vx += dx * alpha * 0.003;
        n.vy += dy * alpha * 0.003;
      }

      // update positions
      maxVel = 0;
      for (const n of lnodes) {
        n.x += n.vx;
        n.y += n.vy;
        n.x = clamp(n.x, n.radius, W - n.radius);
        n.y = clamp(n.y, n.radius, H - n.radius);
        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
        if (speed > maxVel) maxVel = speed;
      }

      layoutRef.current = { lnodes, llinks, settled: false };
      animRef.current = requestAnimationFrame(simulate);
    };

    simulate();
  }, [svgWidth, height]);

  useEffect(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    layoutData.current = null; // rebuild layout when inputs change
    // defer so the DOM has svgWidth ready
    const t = setTimeout(runSim, 50);
    return () => {
      clearTimeout(t);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [runSim]);

  /* ── force re-render during sim ── */
  const [, setTick] = useState(0);
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      setTick((t) => t + 1);
      if (layoutRef.current?.settled) return;
      requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; };
  }, []);

  const display = layoutRef.current;
  const lnodes = display?.lnodes ?? layoutData.current?.lnodes ?? [];
  const llinks = display?.llinks ?? layoutData.current?.llinks ?? [];

  /* ── hover helpers ── */

  const connectedIds = new Set<string>();
  const connectedLinkIndices = new Set<number>();
  if (hoveredId) {
    connectedIds.add(hoveredId);
    llinks.forEach((l, i) => {
      if (l.source.id === hoveredId || l.target.id === hoveredId) {
        connectedIds.add(l.source.id);
        connectedIds.add(l.target.id);
        connectedLinkIndices.add(i);
      }
    });
  }

  /* ── drag handlers ── */

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setDragId(nodeId);
    const node = lnodes.find((n) => n.id === nodeId);
    if (node) dragRef.current = node;
  };

  useEffect(() => {
    if (!dragId) return;
    const handleMove = (e: MouseEvent) => {
      const svg = svgRef.current;
      if (!svg || !dragRef.current) return;
      const rect = svg.getBoundingClientRect();
      dragRef.current.x = clamp(e.clientX - rect.left, dragRef.current.radius, svgWidth - dragRef.current.radius);
      dragRef.current.y = clamp(e.clientY - rect.top, dragRef.current.radius, height - dragRef.current.radius);
      dragRef.current.vx = 0;
      dragRef.current.vy = 0;
      if (layoutRef.current) layoutRef.current.settled = true;
      setTick((t) => t + 1);
    };
    const handleUp = () => setDragId(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragId, svgWidth, height]);

  /* ── guard ── */

  if (lnodes.length < 2) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[var(--text-muted)]">
        需要至少 2 个有声优才能绘制共演网络。
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none">
      <svg
        ref={svgRef}
        width={svgWidth}
        height={height}
        className="overflow-visible"
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* ── edges ── */}
        {llinks.map((l, i) => {
          const isHL = connectedLinkIndices.has(i);
          const isDim = hoveredId && !isHL;
          return (
            <line
              key={`e-${i}`}
              x1={l.source.x}
              y1={l.source.y}
              x2={l.target.x}
              y2={l.target.y}
              stroke={l.source.color}
              strokeWidth={isHL ? Math.max(2, l.value * 0.7) : Math.max(0.6, l.value * 0.35)}
              opacity={isDim ? 0.04 : isHL ? 0.7 : 0.2}
              className="transition-all duration-300"
            />
          );
        })}

        {/* ── nodes ── */}
        {lnodes.map((n) => {
          const isHL = connectedIds.has(n.id);
          const isDim = hoveredId && !isHL;
          const isDrag = dragId === n.id;
          return (
            <g key={n.id} style={{ cursor: isDrag ? 'grabbing' : 'grab' }}>
              {/* glow ring when highlighted */}
              {isHL && (
                <circle
                  cx={n.x} cy={n.y} r={n.radius + 6}
                  fill="none" stroke={n.color} strokeWidth={2} opacity={0.35}
                  className="pointer-events-none"
                />
              )}
              <circle
                cx={n.x} cy={n.y} r={n.radius}
                fill={n.color}
                opacity={isDim ? 0.15 : 0.9}
                stroke={isHL ? '#fff' : 'var(--bg-card)'}
                strokeWidth={isHL ? 2 : 1.5}
                className="transition-all duration-300"
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseDown={(e) => handleMouseDown(e, n.id)}
              />
              {/* label */}
              <text
                x={n.x}
                y={n.y + n.radius + 14}
                textAnchor="middle"
                fill="var(--text-primary)"
                fontSize={isHL ? 12 : 10}
                fontWeight={isHL ? 600 : 400}
                opacity={isDim ? 0.15 : isHL ? 1 : 0.65}
                className="transition-all duration-300 pointer-events-none"
              >
                {n.label.length > 5 ? n.label.slice(0, 5) + '…' : n.label}
              </text>
              {/* count badge */}
              <text
                x={n.x}
                y={n.y + 4}
                textAnchor="middle"
                fill="#fff"
                fontSize={10}
                fontWeight={600}
                opacity={isDim ? 0.15 : 0.95}
                className="transition-all duration-300 pointer-events-none"
              >
                {n.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
