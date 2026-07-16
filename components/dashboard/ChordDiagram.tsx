"use client";

import { useMemo, useRef, useState, useEffect } from 'react';
import { useTheme } from '@/components/theme/ThemeProvider';
import { getAppThemeDefinition } from '@/lib/theme';

interface ChordNode {
  id: string;
  label: string;
  group: 'cast' | 'tag';
  value: number;
}

interface ChordLink {
  source: string;
  target: string;
  value: number;
}

interface ChordDiagramProps {
  nodes: ChordNode[];
  links: ChordLink[];
}

/* ── helpers ── */

function polarToCartesian(cx: number, cy: number, r: number, angleRad: number) {
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const s = polarToCartesian(cx, cy, r, endAngle);
  const e = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 0 ${e.x} ${e.y}`;
}

function ribbonPath(
  cx: number,
  cy: number,
  r: number,
  sourceStart: number,
  sourceEnd: number,
  targetStart: number,
  targetEnd: number,
): string {
  const cr = r * 0.42;

  const ss = polarToCartesian(cx, cy, r, sourceStart);
  const se = polarToCartesian(cx, cy, r, sourceEnd);
  const ts = polarToCartesian(cx, cy, r, targetStart);
  const te = polarToCartesian(cx, cy, r, targetEnd);

  const css = polarToCartesian(cx, cy, cr, sourceStart);
  const cse = polarToCartesian(cx, cy, cr, sourceEnd);
  const cts = polarToCartesian(cx, cy, cr, targetStart);
  const cte = polarToCartesian(cx, cy, cr, targetEnd);

  return [
    `M ${ss.x} ${ss.y}`,
    `C ${css.x} ${css.y}, ${cts.x} ${cts.y}, ${ts.x} ${ts.y}`,
    `L ${te.x} ${te.y}`,
    `C ${cte.x} ${cte.y}, ${cse.x} ${cse.y}, ${se.x} ${se.y}`,
    'Z',
  ].join(' ');
}

/* ── layout types ── */

interface ArcLayout {
  id: string;
  label: string;
  group: 'cast' | 'tag';
  value: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  colorIndex: number; // index within its group for palette lookup
}

interface RibbonLayout {
  source: string;
  target: string;
  value: number;
  sourceStart: number;
  sourceEnd: number;
  targetStart: number;
  targetEnd: number;
}

/* ── component ── */

export function ChordDiagram({ nodes, links }: ChordDiagramProps) {
  const { theme } = useTheme();
  const graphPalette = getAppThemeDefinition(theme).graphPalette;
  const castPalette = graphPalette.slice(0, 8);
  const tagPalette = graphPalette.slice(8, 16);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [svgSize, setSvgSize] = useState(600);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSvgSize(Math.min(entry.contentRect.width, 600));
      }
    });
    observer.observe(el);
    setSvgSize(Math.min(el.getBoundingClientRect().width, 600));
    return () => observer.disconnect();
  }, []);

  const cx = svgSize / 2;
  const cy = svgSize / 2;
  const R = svgSize * 0.36;
  const labelR = R + 20;

  /* ── compute layout ── */

  const { arcs, arcMap } = useMemo(() => {
    const arcs: ArcLayout[] = [];

    const castNodes = nodes.filter((n) => n.group === 'cast');
    const tagNodes = nodes.filter((n) => n.group === 'tag');

    const castTotal = castNodes.reduce((s, n) => s + n.value, 0) || 1;
    const tagTotal = tagNodes.reduce((s, n) => s + n.value, 0) || 1;

    // Cast: left half (π/2 → 3π/2)
    // Tags: right half (-π/2 → π/2)
    let angle = Math.PI / 2;
    castNodes.forEach((node, i) => {
      const delta = (node.value / castTotal) * Math.PI;
      arcs.push({
        id: node.id,
        label: node.label,
        group: 'cast' as const,
        value: node.value,
        startAngle: angle,
        endAngle: angle + delta,
        midAngle: angle + delta / 2,
        colorIndex: i,
      });
      angle += delta;
    });

    angle = -Math.PI / 2;
    tagNodes.forEach((node, i) => {
      const delta = (node.value / tagTotal) * Math.PI;
      arcs.push({
        id: node.id,
        label: node.label,
        group: 'tag' as const,
        value: node.value,
        startAngle: angle,
        endAngle: angle + delta,
        midAngle: angle + delta / 2,
        colorIndex: i,
      });
      angle += delta;
    });

    const arcMap = new Map(arcs.map((a) => [a.id, a]));
    return { arcs, arcMap };
  }, [nodes]);

  const ribbons = useMemo(() => {
    const result: RibbonLayout[] = [];
    const sourceOffset = new Map<string, number>();
    const targetOffset = new Map<string, number>();

    links.forEach((link) => {
      const srcArc = arcMap.get(link.source);
      const tgtArc = arcMap.get(link.target);
      if (!srcArc || !tgtArc) return;

      const srcWidth = (link.value / srcArc.value) * (srcArc.endAngle - srcArc.startAngle);
      const tgtWidth = (link.value / tgtArc.value) * (tgtArc.endAngle - tgtArc.startAngle);

      const srcOff = sourceOffset.get(link.source) ?? 0;
      const tgtOff = targetOffset.get(link.target) ?? 0;

      result.push({
        source: link.source,
        target: link.target,
        value: link.value,
        sourceStart: srcArc.startAngle + srcOff,
        sourceEnd: srcArc.startAngle + srcOff + srcWidth,
        targetStart: tgtArc.startAngle + tgtOff,
        targetEnd: tgtArc.startAngle + tgtOff + tgtWidth,
      });

      sourceOffset.set(link.source, srcOff + srcWidth);
      targetOffset.set(link.target, tgtOff + tgtWidth);
    });

    return result;
  }, [links, arcMap]);

  /* ── hover highlight ── */

  const highlighted = useMemo(() => {
    if (!hovered) return { arcs: new Set<string>(), ribbons: new Set<number>() };
    const arcIds = new Set<string>([hovered]);
    const ribbonIndices = new Set<number>();

    ribbons.forEach((r, i) => {
      if (r.source === hovered || r.target === hovered) {
        arcIds.add(r.source);
        arcIds.add(r.target);
        ribbonIndices.add(i);
      }
    });

    return { arcs: arcIds, ribbons: ribbonIndices };
  }, [hovered, ribbons]);

  /* ── guard ── */

  if (nodes.length < 4) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--text-muted)]">
        需要至少 4 个节点（声优 + 标签各 ≥2）才能绘制和弦图。
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full select-none flex justify-center">
      <svg
        width={svgSize}
        height={svgSize}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        className="overflow-visible"
      >
        {/* ── ribbons ── */}
        {ribbons.map((r, i) => {
          const srcArc = arcMap.get(r.source);
          const color = srcArc
            ? castPalette[srcArc.colorIndex % castPalette.length]
            : 'var(--text-muted)';
          const isHL = highlighted.ribbons.has(i);
          const isDim = hovered && !isHL;

          return (
            <path
              key={`r-${i}`}
              d={ribbonPath(cx, cy, R, r.sourceStart, r.sourceEnd, r.targetStart, r.targetEnd)}
              fill={color}
              opacity={isDim ? 0.03 : isHL ? 0.85 : 0.3}
              className="transition-all duration-300"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(r.source)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* ── outer arcs ── */}
        {arcs.map((a) => {
          const palette = a.group === 'cast' ? castPalette : tagPalette;
          const color = palette[a.colorIndex % palette.length];
          const isHL = highlighted.arcs.has(a.id);
          const isDim = hovered && !isHL;

          return (
            <path
              key={`a-${a.id}`}
              d={arcPath(cx, cy, R, a.startAngle, a.endAngle)}
              fill="none"
              stroke={color}
              strokeWidth={isHL ? 8 : 5}
              opacity={isDim ? 0.12 : 0.85}
              className="transition-all duration-300"
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHovered(a.id)}
              onMouseLeave={() => setHovered(null)}
            />
          );
        })}

        {/* ── labels ── */}
        {arcs.map((a) => {
          // push labels a bit further out for cast (left side) to avoid overlap
          const lr = a.group === 'cast' ? labelR + 4 : labelR;
          const pos = polarToCartesian(cx, cy, lr, a.midAngle);
          const isRight = pos.x > cx;
          const isHL = highlighted.arcs.has(a.id);
          const isDim = hovered && !isHL;

          return (
            <text
              key={`lbl-${a.id}`}
              x={pos.x}
              y={pos.y}
              textAnchor={isRight ? 'start' : 'end'}
              dominantBaseline="central"
              fill="var(--text-primary)"
              fontSize={isHL ? 13 : 11}
              fontWeight={isHL ? 600 : 400}
              opacity={isDim ? 0.18 : isHL ? 1 : 0.7}
              className="transition-all duration-300 pointer-events-none"
            >
              {a.label.length > 6 ? a.label.slice(0, 6) + '…' : a.label}
            </text>
          );
        })}

        {/* ── center text ── */}
        <circle cx={cx} cy={cy} r={28} fill="var(--bg-card)" opacity={0.85} className="pointer-events-none" />
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="pointer-events-none"
        >
          {hovered ? (
            <>
              <tspan x={cx} dy={-8} fontWeight={600} fill="var(--text-primary)" fontSize={14}>
                {nodes.find((n) => n.id === hovered)?.label ?? ''}
              </tspan>
              <tspan x={cx} dy={20} fill="var(--text-muted)" fontSize={12}>
                {nodes.find((n) => n.id === hovered)?.value ?? 0} 次
              </tspan>
            </>
          ) : (
            <>
              <tspan x={cx} dy={-6} fill="var(--text-muted)" fontSize={12}>声优</tspan>
              <tspan x={cx} dy={20} fill="var(--text-muted)" fontSize={11}>× 标签</tspan>
            </>
          )}
        </text>
      </svg>
    </div>
  );
}
