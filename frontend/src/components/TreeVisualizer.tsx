"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useState } from "react";

interface TreeVisualizerProps {
    airtemp: number;
    windspeed: number;
    stream: number;
    snowDepth: number;
    date: string; // YYYY-MM-DD
    hour?: number;
}

// ═══════════════════════════════════════════════════════════════════
// ✦  CONTINUOUS SEASON SYSTEM — No abrupt changes
// ═══════════════════════════════════════════════════════════════════

// Color interpolation helpers
function hexToRgb(hex: string): [number, number, number] {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [0, 0, 0];
}
function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, "0")).join("");
}
function lerpColor(a: string, b: string, t: number): string {
    const [r1, g1, b1] = hexToRgb(a);
    const [r2, g2, b2] = hexToRgb(b);
    return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}
function lerpColorArr(from: string[], to: string[], t: number): string[] {
    const len = Math.max(from.length, to.length);
    return Array.from({ length: len }, (_, i) =>
        lerpColor(from[i % from.length], to[i % to.length], t)
    );
}

function shadeHex(hex: string, percent: number): string {
    const [r, g, b] = hexToRgb(hex);
    return rgbToHex(r * (1 - percent), g * (1 - percent), b * (1 - percent));
}

// ─── Season palettes ─────────────────────────────────────────────
const PALETTES = {
    winter: {
        leaf: [] as string[],
        grass: ["#9ca3af", "#a8a29e", "#d6d3d1"],
        groundLeaf: ["#78716c", "#a8a29e"],
    },
    spring: {
        leaf: ["#a3e635", "#86efac", "#4ade80", "#bef264"],
        grass: ["#86efac", "#4ade80", "#a3e635", "#6ee7b7"],
        groundLeaf: [],
    },
    summer: {
        leaf: ["#15803d", "#16a34a", "#22c55e", "#166534"],
        grass: ["#22c55e", "#16a34a", "#15803d", "#4ade80", "#166534"],
        groundLeaf: [],
    },
    autumn: {
        leaf: ["#ea580c", "#dc2626", "#f59e0b", "#b91c1c", "#9a3412", "#c2410c"],
        grass: ["#a16207", "#ca8a04", "#92400e", "#b45309"],
        groundLeaf: ["#ea580c", "#c2410c", "#b91c1c", "#f59e0b", "#9a3412"],
    },
};

interface SeasonInfo {
    baseSeason: string;
    foliageDensity: number;   // 0 = bare tree, 1 = full canopy
    leafColors: string[];
    grassColors: string[];
    groundLeafColors: string[];
    fallingLeafIntensity: number; // 0 = none, 1 = heavy
    blossomDensity: number;   // 0 = none, 1 = full blossoms (spring)
    flowerDensity: number;    // 0 = none, 1 = many wildflowers
    showLeaves: boolean;
    isDry: boolean;
}

function getSeasonInfo(date: string, airtemp: number, stream: number): SeasonInfo {
    const parts = (date || "2024-06-15").split("-");
    const month = parseInt(parts[1] || "6");
    const day = parseInt(parts[2] || "15");
    const t = Math.min(1, Math.max(0, (day - 1) / 29)); // 0→1 across the month
    const isDry = stream < 0.05;

    // ── March: Winter, late March bare branches, maybe tiny buds ──
    if (month === 3) {
        const eased = t * t * t;
        return {
            baseSeason: "winter",
            foliageDensity: eased * 0.1, // barely any leaves
            leafColors: PALETTES.spring.leaf,
            grassColors: lerpColorArr(PALETTES.winter.grass, PALETTES.spring.grass, t),
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: t > 0.8,
            isDry,
        };
    }

    // ── April: Spring begins, blossoms peak mid-to-late April ──
    if (month === 4) {
        return {
            baseSeason: "spring",
            foliageDensity: 0.1 + t * 0.5, // 10% → 60%
            leafColors: PALETTES.spring.leaf,
            grassColors: PALETTES.spring.grass,
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: t < 0.5 ? t * 2 : 1 - (t - 0.5) * 2, // Peaks at mid-April
            flowerDensity: t * 0.5,
            showLeaves: true,
            isDry,
        };
    }

    // ── May: Late spring, leaves filling out ──
    if (month === 5) {
        return {
            baseSeason: "spring",
            foliageDensity: 0.6 + t * 0.3, // 60% → 90%
            leafColors: PALETTES.spring.leaf,
            grassColors: PALETTES.spring.grass,
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0.5 + t * 0.3,
            showLeaves: true,
            isDry,
        };
    }

    // ── June: Spring → Summer (Peaks to full green by late June) ──
    if (month === 6) {
        return {
            baseSeason: "summer",
            foliageDensity: 0.9 + t * 0.1, // 90% → 100%
            leafColors: lerpColorArr(PALETTES.spring.leaf, PALETTES.summer.leaf, t),
            grassColors: lerpColorArr(PALETTES.spring.grass, PALETTES.summer.grass, t),
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0.8 - t * 0.3, // wild flowers fade a bit
            showLeaves: true,
            isDry,
        };
    }

    // ── July & August: Peak Summer! Fully green ──
    if (month === 7 || month === 8) {
        return {
            baseSeason: "summer",
            foliageDensity: 1,
            leafColors: PALETTES.summer.leaf,
            grassColors: PALETTES.summer.grass,
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0.5,
            showLeaves: true,
            isDry,
        };
    }

    // ── September: Summer → Early Autumn (Colors just starting to shift late Sept) ──
    if (month === 9) {
        const shift = Math.max(0, (t - 0.5) * 2); // Only changes in late Sept
        return {
            baseSeason: "summer",
            foliageDensity: 1,
            leafColors: lerpColorArr(PALETTES.summer.leaf, PALETTES.autumn.leaf, shift * 0.4),
            grassColors: lerpColorArr(PALETTES.summer.grass, PALETTES.autumn.grass, shift * 0.4),
            groundLeafColors: [],
            fallingLeafIntensity: shift * 0.1,
            blossomDensity: 0,
            flowerDensity: 0.3 * (1 - t),
            showLeaves: true,
            isDry,
        };
    }

    // ── October: Autumn peaks mid-October, then leaves start falling ──
    if (month === 10) {
        // Color transition completes by mid-October
        const colorT = Math.min(1, t * 2);

        // Leaves stay 100% until mid-October, then fall to 50% by end of October
        const density = t < 0.5 ? 1 : 1 - (t - 0.5);

        return {
            baseSeason: "autumn",
            foliageDensity: density,
            // Start from where Sept left off (40% autumn) to 100% autumn
            leafColors: lerpColorArr(
                lerpColorArr(PALETTES.summer.leaf, PALETTES.autumn.leaf, 0.4),
                PALETTES.autumn.leaf,
                colorT
            ),
            grassColors: lerpColorArr(
                lerpColorArr(PALETTES.summer.grass, PALETTES.autumn.grass, 0.4),
                PALETTES.autumn.grass,
                colorT
            ),
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: t < 0.5 ? 0.3 + t : 0.8 + (t - 0.5), // Heavy falling in late Oct
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: true,
            isDry,
        };
    }

    // ── November: Autumn → Winter (Leaves rapidly drop off) ──
    if (month === 11) {
        const decay = Math.min(1, t * 1.5); // Fully bare by ~Nov 20
        return {
            baseSeason: t < 0.4 ? "autumn" : "winter",
            foliageDensity: 0.5 * (1 - decay), // Drops from 50% to 0%
            leafColors: PALETTES.autumn.leaf,
            grassColors: lerpColorArr(PALETTES.autumn.grass, PALETTES.winter.grass, Math.min(1, t * 1.5)),
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: (1 - decay) * 0.5,
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: decay < 1,
            isDry,
        };
    }

    // ── December, January, February: Full winter ──────────
    return {
        baseSeason: "winter",
        foliageDensity: 0,
        leafColors: [],
        grassColors: PALETTES.winter.grass,
        groundLeafColors: PALETTES.winter.groundLeaf,
        fallingLeafIntensity: 0,
        blossomDensity: 0,
        flowerDensity: 0,
        showLeaves: false,
        isDry,
    };
}

// ═══════════════════════════════════════════════════════════════════
// ✦  PROCEDURAL FRACTAL TREE
// ═══════════════════════════════════════════════════════════════════

type Branch = { x1: number; y1: number; x2: number; y2: number; thickness: number; depth: number };
type TreeLeaf = { cx: number; cy: number; r: number; opacity: number; isBlossom: boolean; angle: number; dropThreshold: number; branchDepth: number };

function buildTree(): { branches: Branch[]; leaves: TreeLeaf[] } {
    const branches: Branch[] = [];
    const leaves: TreeLeaf[] = [];

    function grow(x: number, y: number, len: number, angle: number, thickness: number, depth: number) {
        if (depth === 0) return;
        const bend = (Math.random() - 0.5) * 0.3;
        const a = angle + bend;
        const tx = x + len * Math.sin(a);
        const ty = y - len * Math.cos(a);
        branches.push({ x1: x, y1: y, x2: tx, y2: ty, thickness, depth });

        if (depth <= 3) {
            const n = depth === 1 ? 6 : 3;
            for (let i = 0; i < n; i++) {
                leaves.push({
                    cx: tx + (Math.random() * 50 - 25),
                    cy: ty + (Math.random() * 50 - 25),
                    r: 6 + Math.random() * 12,
                    opacity: 0.85 + Math.random() * 0.15, // more opaque
                    isBlossom: Math.random() > 0.8,
                    angle: Math.random() * 360,
                    dropThreshold: Math.random(), // slight random jitter within depth
                    branchDepth: depth
                });
            }
        }
        const s = 0.7 + Math.random() * 0.15;
        grow(tx, ty, len * s, a - 0.25 - Math.random() * 0.3, thickness * 0.65, depth - 1);
        grow(tx, ty, len * s, a + 0.25 + Math.random() * 0.3, thickness * 0.65, depth - 1);
        if (Math.random() > 0.35 && depth > 2)
            grow(tx, ty, len * 0.6 * s, a + (Math.random() * 0.2 - 0.1), thickness * 0.6, depth - 1);
    }

    grow(200, 280, 85, 0, 18, 7);
    return { branches, leaves };
}

// ═══════════════════════════════════════════════════════════════════
// ✦  GROUND ELEMENTS: grass, flowers, fallen leaves
// ═══════════════════════════════════════════════════════════════════

type GroundElement = {
    x: number; y: number; h: number; bend: number;
    color: string; width: number; delay: number; opacity: number;
    type: "grass" | "leaf" | "flower";
    angle: number;
    petalCount?: number;
};

function generateGroundElements(info: SeasonInfo): GroundElement[] {
    const elements: GroundElement[] = [];

    // Expanded massive rolling hill coverage
    // Focus density on the visible area [0, 1000] with some buffer
    const xSteps = info.baseSeason === "winter" ? 120 : 500;
    const yRows = info.baseSeason === "winter" ? 6 : 18;

    const vStart = -200;
    const vEnd = 1200;
    const vWidth = vEnd - vStart;

    for (let xi = 0; xi < xSteps; xi++) {
        const fx = vStart + (xi / (xSteps - 1)) * vWidth;

        // Align with the SVG's Q200,150 curve which peaks at y=275
        // (Quadratic Bezier peak y = 0.25*y0 + 0.5*y_ctrl + 0.25*y2)
        const distFromPeak = Math.abs(fx - 200);
        const maxDist = 5200;
        const t = distFromPeak / maxDist;

        const yPeak = 275;
        const yBase = 400;
        const surfaceY = yPeak + (t * t) * (yBase - yPeak);

        const surfaceHeight = 80;
        if (surfaceHeight < 2) continue;

        for (let yi = 0; yi < yRows; yi++) {
            const rowFrac = yi / (yRows - 1);
            const baseY = surfaceY + rowFrac * surfaceHeight;
            const jx = (Math.random() - 0.5) * (vWidth / xSteps) * 2.5;
            const jy = (Math.random() - 0.5) * (surfaceHeight / yRows);
            const finalX = fx + jx;
            const finalY = baseY + jy;
            const depthScale = 1 - rowFrac * 0.5;

            const h = info.isDry
                ? (4 + Math.random() * 8) * depthScale
                : info.baseSeason === "winter"
                    ? (3 + Math.random() * 5) * depthScale
                    : (12 + Math.random() * 22) * depthScale; // Much taller, lush grass

            let type: "grass" | "leaf" | "flower" = "grass";
            let color = info.grassColors[Math.floor(Math.random() * info.grassColors.length)];

            // Ground leaves — controlled by season info
            if (info.groundLeafColors.length > 0 && info.fallingLeafIntensity > 0 && Math.random() < info.fallingLeafIntensity * 0.4) {
                type = "leaf";
                color = info.groundLeafColors[Math.floor(Math.random() * info.groundLeafColors.length)];
            }
            // Wildflowers — controlled by flowerDensity
            else if (info.flowerDensity > 0 && Math.random() < info.flowerDensity * 0.08) {
                type = "flower";
                const flowerColors = ["#f9a8d4", "#fb923c", "#fbbf24", "#c084fc", "#f472b6", "#e879f9"];
                color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            }

            const leafSize = (3 + Math.random() * 4) * depthScale;

            elements.push({
                x: finalX, y: finalY,
                h: type === "grass" ? h : leafSize,
                bend: type === "grass"
                    ? (Math.random() - 0.5) * 8 * depthScale // Straighter, more upright
                    : (Math.random() - 0.5) * 4 * depthScale,
                color,
                width: type === "grass" ? (1.2 + Math.random() * 2.5) * depthScale : leafSize,
                delay: Math.random() * 3,
                opacity: type === "grass" ? 0.7 + depthScale * 0.3 : type === "flower" ? 0.95 : 0.85,
                type,
                angle: Math.random() * 360,
                petalCount: type === "flower" ? (4 + Math.floor(Math.random() * 3)) : undefined,
            });
        }
    }
    return elements;
}

// ═══════════════════════════════════════════════════════════════════
// ✦  ENVIRONMENT HOOKS
// ═══════════════════════════════════════════════════════════════════

function useFallingLeaves(windspeed: number, info: SeasonInfo) {
    const [leaves, setLeaves] = useState<{
        id: number; x: number; y: number; delay: number;
        size: number; color: string;
    }[]>([]);

    const intensity = info.fallingLeafIntensity;
    useEffect(() => {
        if (intensity <= 0 && windspeed < 5) { setLeaves([]); return; }

        const baseCount = Math.floor(intensity * 20);
        const windBonus = Math.floor(windspeed * 1.5);
        const n = Math.min(baseCount + windBonus, 45);
        if (n <= 0) { setLeaves([]); return; }

        const colors = info.leafColors.length > 0 ? info.leafColors : PALETTES.autumn.leaf;
        setLeaves(Array.from({ length: n }).map((_, i) => ({
            id: i,
            x: Math.random() * 85,
            y: -5 + Math.random() * 30,
            delay: Math.random() * 5,
            size: 10 + Math.random() * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
        })));
    }, [Math.round(windspeed), Math.round(intensity * 10)]);
    return leaves;
}

function useButterflies(info: SeasonInfo, airtemp: number) {
    const [bugs, setBugs] = useState<{ id: number; x: number; delay: number; color: string }[]>([]);
    useEffect(() => {
        if (airtemp < 10 || info.baseSeason === "winter" || info.flowerDensity <= 0) {
            setBugs([]); return;
        }
        const count = Math.min(Math.ceil(info.flowerDensity * 4), 5);
        setBugs(Array.from({ length: count }).map((_, i) => ({
            id: i, x: 20 + Math.random() * 60, delay: Math.random() * 3,
            color: ["#fef08a", "#bae6fd", "#fbcfe8"][Math.floor(Math.random() * 3)]
        })));
    }, [info.baseSeason, Math.round(airtemp / 10), Math.round(info.flowerDensity * 10)]);
    return bugs;
}

function useFireflies(info: SeasonInfo, hour: number, airtemp: number) {
    const [flies, setFlies] = useState<{
        id: number; x: number; y: number; delay: number; size: number;
    }[]>([]);
    useEffect(() => {
        const isEvening = hour >= 19 || hour <= 5;
        if (!isEvening || info.baseSeason === "winter" || airtemp < 8) { setFlies([]); return; }
        const count = info.baseSeason === "summer" ? 8 : 4;
        setFlies(Array.from({ length: count }).map((_, i) => ({
            id: i, x: 10 + Math.random() * 70, y: 30 + Math.random() * 50,
            delay: Math.random() * 6, size: 3 + Math.random() * 3,
        })));
    }, [info.baseSeason, hour >= 19 || hour <= 5, airtemp < 8]);
    return flies;
}

// ═══════════════════════════════════════════════════════════════════
// ✦  SVG SHAPE COMPONENTS
// ═══════════════════════════════════════════════════════════════════

function SvgLeafShape({ cx, cy, r, fill, opacity, angle, className }: {
    cx: number; cy: number; r: number; fill: string;
    opacity: number; angle: number; className?: string;
}) {
    const scale = r / 12;
    return (
        <g transform={`translate(${cx},${cy}) rotate(${angle}) scale(${scale})`}>
            <g className={className}>
                <path
                    d="M0,-12 C4,-10 8,-4 8,0 C8,6 4,12 0,12 C-4,12 -8,6 -8,0 C-8,-4 -4,-10 0,-12Z"
                    fill={fill} opacity={opacity}
                />
                <line x1="0" y1="-10" x2="0" y2="10" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
                <line x1="0" y1="-4" x2="4" y2="-1" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
                <line x1="0" y1="0" x2="-4" y2="3" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
                <line x1="0" y1="4" x2="3" y2="7" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
            </g>
        </g>
    );
}

function SvgFlowerShape({ cx, cy, size, color, petalCount, delay }: {
    cx: number; cy: number; size: number; color: string;
    petalCount: number; delay: number;
}) {
    const angle = 360 / petalCount;
    return (
        <g transform={`translate(${cx},${cy})`}>
            <g className="ground-flower"
                style={{ transformOrigin: `0px 0px`, animationDelay: `${delay}s` } as React.CSSProperties}>
                {Array.from({ length: petalCount }).map((_, i) => (
                    <ellipse key={i} cx={0} cy={-size * 0.8} rx={size * 0.4} ry={size * 0.7}
                        fill={color} opacity={0.85} transform={`rotate(${i * angle})`} />
                ))}
                <circle cx={0} cy={0} r={size * 0.3} fill="#fbbf24" opacity={0.95} />
                <circle cx={0} cy={0} r={size * 0.15} fill="#f59e0b" opacity={0.8} />
            </g>
        </g>
    );
}

// ═══════════════════════════════════════════════════════════════════
// ✦  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TreeVisualizer({ airtemp, windspeed, stream, snowDepth, date, hour = 12 }: TreeVisualizerProps) {
    // Continuous season info (gradual transitions!)
    const seasonInfo = useMemo(() => getSeasonInfo(date, airtemp, stream), [date, airtemp, stream < 0.05]);

    // Match ground directly to grass theme for dense appearance, adjusting for stream dryness
    const rawSurface = seasonInfo.grassColors[0] || "#57534e";
    const rawDeep = seasonInfo.grassColors[seasonInfo.grassColors.length - 1] || "#1c1917";
    const surfaceColor = stream < 0.05 ? lerpColor(rawSurface, "#8c7b70", 0.4) : shadeHex(rawSurface, 0.1);
    const deepColor = stream < 0.05 ? lerpColor(rawDeep, "#4a403b", 0.5) : shadeHex(rawDeep, 0.6);

    const { branches, leaves } = useMemo(() => buildTree(), []);
    const fallingLeaves = useFallingLeaves(windspeed, seasonInfo);
    const butterflies = useButterflies(seasonInfo, airtemp);
    const fireflies = useFireflies(seasonInfo, hour, airtemp);

    // Ground elements react to the season info (gradual colors/density)
    const groundElements = useMemo(
        () => generateGroundElements(seasonInfo),
        [seasonInfo.baseSeason, Math.round(seasonInfo.fallingLeafIntensity * 5), Math.round(seasonInfo.flowerDensity * 5), seasonInfo.isDry]
    );

    // No more slicing which drops chunks at a time.
    // We will conditionally render leaves based on their internal dropThreshold.

    const swayDeg = windspeed < 0.5 ? 0 : Math.min(windspeed * 1.8, 18);
    const swayDuration = Math.max(0.8, 4 - windspeed * 0.2);
    const rainDroop = stream > 0.1 ? Math.min(stream * 20, 6) : 0;
    const trunkColor = seasonInfo.baseSeason === "winter" ? "#1f140e" : "#2a1c12";

    const grassSwayDeg = Math.min(windspeed * 2.5, 20);
    const grassSwaySpeed = Math.max(0.8, 2.5 - windspeed * 0.12);

    return (
        <div className="tv-container pointer-events-none absolute inset-0 flex items-end"
            style={{
                "--grass-sway": `${grassSwayDeg}deg`,
                "--grass-speed": `${grassSwaySpeed}s`,
            } as React.CSSProperties}
        >
            {/* Falling leaves — realistic shapes with flutter */}
            {fallingLeaves.map(leaf => (
                <motion.div
                    key={leaf.id}
                    className="absolute falling-leaf pointer-events-none"
                    style={{
                        backgroundColor: leaf.color,
                        width: leaf.size, height: leaf.size * 1.3,
                    }}
                    initial={{ left: `${leaf.x}vw`, top: `${leaf.y}vh`, opacity: 0 }}
                    animate={{
                        top: "110vh",
                        left: [`${leaf.x}vw`, `${leaf.x + windspeed * 4 + Math.random() * 12}vw`],
                        rotate: [0, 120 + Math.random() * 300],
                        rotateY: [0, 180, 360],
                        opacity: [0, 0.9, 0.9, 0.5, 0],
                    }}
                    transition={{
                        duration: 4 + Math.random() * 3,
                        repeat: Infinity, delay: leaf.delay, ease: "easeIn",
                    }}
                />
            ))}

            {/* Butterflies — SVG wing shapes */}
            {butterflies.map(b => (
                <motion.div
                    key={b.id} className="absolute pointer-events-none"
                    style={{ width: 28, height: 20 }}
                    initial={{ left: `${b.x}vw`, top: "60vh", opacity: 0 }}
                    animate={{
                        top: ["65vh", "35vh", "55vh", "25vh"],
                        left: [`${b.x}vw`, `${b.x + 6}vw`, `${b.x - 4}vw`, `${b.x + 9}vw`],
                        opacity: [0, 1, 1, 0.8, 0]
                    }}
                    transition={{ duration: 7 + Math.random() * 4, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
                >
                    <motion.svg viewBox="0 0 28 20" width="28" height="20"
                        animate={{ scaleX: [1, -1, 1] }}
                        transition={{ duration: 0.25, repeat: Infinity, ease: "easeInOut" }}
                    >
                        {/* Left upper wing */}
                        <path d="M14,10 C10,4 2,2 1,7 C0,12 6,14 14,10Z" fill={b.color} opacity={0.85} />
                        {/* Left lower wing */}
                        <path d="M14,10 C10,13 4,17 5,19 C7,21 12,16 14,10Z" fill={b.color} opacity={0.7} />
                        {/* Right upper wing */}
                        <path d="M14,10 C18,4 26,2 27,7 C28,12 22,14 14,10Z" fill={b.color} opacity={0.85} />
                        {/* Right lower wing */}
                        <path d="M14,10 C18,13 24,17 23,19 C21,21 16,16 14,10Z" fill={b.color} opacity={0.7} />
                        {/* Body */}
                        <ellipse cx="14" cy="10" rx="1.2" ry="5" fill="#1a0a00" opacity={0.8} />
                        {/* Antennae */}
                        <line x1="14" y1="5" x2="11" y2="1" stroke="#1a0a00" strokeWidth="0.5" />
                        <line x1="14" y1="5" x2="17" y2="1" stroke="#1a0a00" strokeWidth="0.5" />
                        <circle cx="11" cy="1" r="0.7" fill="#1a0a00" />
                        <circle cx="17" cy="1" r="0.7" fill="#1a0a00" />
                    </motion.svg>
                </motion.div>
            ))}

            {/* Fireflies — summer/autumn evenings */}
            {fireflies.map(f => (
                <div key={`ff-${f.id}`} className="firefly" style={{
                    left: `${f.x}vw`, top: `${f.y}vh`,
                    width: f.size, height: f.size, backgroundColor: "#fef08a",
                    animationDelay: `${f.delay}s, ${f.delay + 1}s`,
                }} />
            ))}

            {/* SVG Canvas */}
            <svg viewBox="0 0 1000 400" className="tv-svg absolute inset-0 w-full h-full"
                preserveAspectRatio="xMidYMax slice" overflow="visible">

                <defs>
                    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={surfaceColor} />
                        <stop offset="40%" stopColor={lerpColor(surfaceColor, deepColor, 0.4)} />
                        <stop offset="100%" stopColor={deepColor} />
                    </linearGradient>
                    <linearGradient id="soilHighlight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="30%" stopColor="rgba(255,255,255,0.06)" />
                        <stop offset="50%" stopColor="transparent" />
                        <stop offset="70%" stopColor="rgba(255,255,255,0.04)" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>
                    <radialGradient id="shadowGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                        <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
                        <stop offset="60%" stopColor="rgba(0,0,0,0.15)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>
                    <linearGradient id="bottomFade" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="white" stopOpacity="1" />
                        <stop offset="85%" stopColor="white" stopOpacity="1" />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <mask id="groundMask">
                        <rect x="-5000" y="-1000" width="10000" height="3000" fill="url(#bottomFade)" />
                    </mask>
                </defs>

                <motion.g animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={{ duration: 2 }} mask="url(#groundMask)">
                    {/* Primary wide rolling hill, massive width to avoid edges */}
                    <path d="M-5000,400 Q200,150 6000,400 L6000,2000 L-5000,2000 Z" fill="url(#groundGrad)" />

                    {/* Darker underbelly shadow to give the ground roundness and volume beneath the crest */}
                    <path d="M-5000,400 Q200,195 6000,400 Z" fill="rgba(0,0,0,0.15)" style={{ mixBlendMode: 'multiply', filter: 'blur(10px)' }} />

                    {/* Lighter specular soil highlight right along the top crest */}
                    <path d="M-5000,400 Q200,153 6000,400" fill="none" stroke="url(#soilHighlight)" opacity={0.7} strokeWidth="3" style={{ filter: 'blur(1.5px)' }} />
                    <path d="M-5000,400 Q200,156 6000,400" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" style={{ filter: 'blur(1px)' }} />
                    <path d="M-5000,395 Q200,158 6000,395" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />

                    {/* Bottom gradient shadow to anchor the tree roots locally */}
                    <path d="M-250,405 Q200,300 650,405 Z" fill="rgba(0,0,0,0.4)" style={{ filter: 'blur(12px)' }} />
                </motion.g>

                {/* Tree shadow */}
                <ellipse cx="200" cy="277" rx={55 + windspeed * 0.8} ry="7" fill="url(#shadowGrad)" />

                {/* Trunk base — fixed wide ellipse (not swaying) planted on the ground */}
                <ellipse cx="200" cy="278" rx={15} ry="5" fill={trunkColor} opacity={0.9} />

                {/* Tree structure - anchored exactly at root coordinates */}
                <motion.g
                    style={{ originX: "200px", originY: "280px" }}
                    animate={{
                        rotate: swayDeg,
                        skewX: swayDeg * 0.1,
                        skewY: rainDroop * 0.1,
                    }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                >
                    {branches.map((b, i) => {
                        // Darken slightly for depth on finer branches
                        const colorShift = Math.max(0, (7 - b.depth) * 8);
                        const r = parseInt(trunkColor.slice(1, 3), 16);
                        const g = parseInt(trunkColor.slice(3, 5), 16);
                        const bC = parseInt(trunkColor.slice(5, 7), 16);
                        const branchColor = `rgb(${Math.min(255, r + colorShift)},${Math.min(255, g + colorShift)},${Math.min(255, bC + colorShift)})`;
                        return (
                            <line key={i}
                                x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
                                stroke={branchColor}
                                strokeWidth={b.thickness}
                                strokeLinecap="round"
                            />
                        );
                    })}

                    {/* Foliage — density controlled by foliageDensity matching dropThreshold */}
                    <AnimatePresence>
                        {seasonInfo.showLeaves && seasonInfo.foliageDensity > 0 && (
                            <motion.g
                                initial={{ opacity: 0, scale: 0.8 }}
                                // Use solid opacity=1 so leaves aren't globally transparent during density changes
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 2 }}
                                style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.4))" }}
                            >
                                {leaves.map((leaf, i) => {
                                    // ── Depth-based seasoning logic ──
                                    // depth 1 = outer edge (tips)
                                    // depth 3 = inner branches
                                    // Edge-first growth: tips appear at low density, inner leaves appear later.
                                    // Edge-last shedding: density drops, inner leaves fall first, tips remain.
                                    
                                    // Base threshold for this leaf's depth (1 -> 0, 3 -> 0.7)
                                    const depthBase = (leaf.branchDepth - 1) * 0.35;
                                    // Add unique jitter so they don't pop in/out in batches
                                    const visibilityThreshold = Math.min(0.95, depthBase + (leaf.dropThreshold * 0.3));
                                    
                                    if (seasonInfo.foliageDensity < visibilityThreshold) return null;
                                    
                                    const color = seasonInfo.leafColors.length > 0
                                        ? seasonInfo.leafColors[i % seasonInfo.leafColors.length]
                                        : "#15803d";

                                    // Cherry blossom (spring only, controlled by blossomDensity)
                                    if (leaf.isBlossom && seasonInfo.blossomDensity > 0 && Math.random() < seasonInfo.blossomDensity) {
                                        return (
                                            <motion.g key={i}
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ repeat: Infinity, duration: 2 + Math.random() }}>
                                                {[0, 72, 144, 216, 288].map((a, pi) => (
                                                    <ellipse key={pi}
                                                        cx={leaf.cx + Math.cos(a * Math.PI / 180) * leaf.r * 0.4}
                                                        cy={leaf.cy + Math.sin(a * Math.PI / 180) * leaf.r * 0.4}
                                                        rx={leaf.r * 0.25} ry={leaf.r * 0.4}
                                                        fill="#fbcfe8" opacity={0.85}
                                                        transform={`rotate(${a}, ${leaf.cx + Math.cos(a * Math.PI / 180) * leaf.r * 0.4}, ${leaf.cy + Math.sin(a * Math.PI / 180) * leaf.r * 0.4})`}
                                                    />
                                                ))}
                                                <circle cx={leaf.cx} cy={leaf.cy} r={leaf.r * 0.15} fill="#fbbf24" opacity={0.9} />
                                            </motion.g>
                                        );
                                    }

                                    return (
                                        <motion.g key={i}
                                            animate={{ scale: [1, 1 + windspeed * 0.01, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 + Math.random(), ease: "easeInOut" }}>
                                            <SvgLeafShape cx={leaf.cx} cy={leaf.cy} r={leaf.r}
                                                fill={color} opacity={leaf.opacity} angle={leaf.angle} />
                                        </motion.g>
                                    );
                                })}
                            </motion.g>
                        )}
                    </AnimatePresence>
                </motion.g>
                {/* Ground elements */}
                {snowDepth < 5 && groundElements.map((g, i) => {
                    if (g.type === "flower" && g.petalCount) {
                        return <SvgFlowerShape key={`g${i}`} cx={g.x} cy={g.y}
                            size={g.h} color={g.color} petalCount={g.petalCount} delay={g.delay} />;
                    }
                    if (g.type === "leaf") {
                        return <SvgLeafShape key={`g${i}`} cx={g.x} cy={g.y}
                            r={g.h * 1.2} fill={g.color} opacity={g.opacity}
                            angle={g.angle} className="ground-leaf" />;
                    }
                    return (
                        <path key={`g${i}`}
                            d={`M${g.x},${g.y} Q${g.x + g.bend},${g.y - g.h * 0.6} ${g.x + g.bend * 1.8},${g.y - g.h}`}
                            stroke={g.color} strokeWidth={g.width} fill="none" strokeLinecap="round"
                            opacity={g.opacity} />
                    );
                })}

                {/* Majestic Snow cap */}
                {snowDepth > 5 && (
                    <>
                        <motion.path d="M-850,400 Q150,150 1150,400 L1150,1200 L-850,1200 Z"
                            fill="#f1f5f9" opacity={Math.min(snowDepth / 50, 1)}
                            initial={{ opacity: 0 }} animate={{ opacity: Math.min(snowDepth / 50, 1) }} />
                        {snowDepth > 15 && Array.from({ length: 14 }).map((_, i) => {
                            const st = (i / 13);
                            const sx = -300 + st * 900;
                            const t = (sx + 850) / 2000;
                            const sy = (1 - t) ** 2 * 400 + 2 * (1 - t) * t * 155 + t ** 2 * 400;
                            return <circle key={`sp${i}`} cx={sx} cy={sy + 5 + Math.random() * 20}
                                r={1 + Math.random() * 1.5} fill="white" className="snow-sparkle"
                                style={{ animationDelay: `${i * 0.4}s` }} />;
                        })}
                    </>
                )}


            </svg>
        </div>
    );
}