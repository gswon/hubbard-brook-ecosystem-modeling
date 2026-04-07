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

    // ── March: Winter → Spring ────────────────────────────
    if (month === 3) {
        const eased = t * t; // slow start, accelerating
        return {
            baseSeason: t < 0.5 ? "winter" : "spring",
            foliageDensity: eased * 0.6,              // reaches 60% by Mar 31
            leafColors: PALETTES.spring.leaf,
            grassColors: lerpColorArr(PALETTES.winter.grass, PALETTES.spring.grass, eased),
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: Math.max(0, (t - 0.4) * 1.6), // blossoms from ~Mar 12
            flowerDensity: Math.max(0, (t - 0.6) * 0.5),
            showLeaves: t > 0.15,  // first buds ~Mar 5
            isDry,
        };
    }

    // ── April: Spring ramps up ────────────────────────────
    if (month === 4) {
        return {
            baseSeason: "spring",
            foliageDensity: 0.6 + t * 0.35, // 60%→95%
            leafColors: PALETTES.spring.leaf,
            grassColors: PALETTES.spring.grass,
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 1 - t * 0.3, // blossoms fade slightly late April
            flowerDensity: 0.3 + t * 0.5,
            showLeaves: true,
            isDry,
        };
    }

    // ── May: Late spring, full foliage ────────────────────
    if (month === 5) {
        return {
            baseSeason: "spring",
            foliageDensity: 0.95 + t * 0.05, // 95%→100%
            leafColors: lerpColorArr(PALETTES.spring.leaf, PALETTES.summer.leaf, t * 0.3),
            grassColors: lerpColorArr(PALETTES.spring.grass, PALETTES.summer.grass, t * 0.3),
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: Math.max(0, 0.7 - t * 0.7), // blossoms disappear
            flowerDensity: 0.8 - t * 0.3,
            showLeaves: true,
            isDry,
        };
    }

    // ── June: Spring → Summer ────────────────────────────
    if (month === 6) {
        return {
            baseSeason: "summer",
            foliageDensity: 1,
            leafColors: lerpColorArr(PALETTES.spring.leaf, PALETTES.summer.leaf, 0.3 + t * 0.7),
            grassColors: lerpColorArr(PALETTES.spring.grass, PALETTES.summer.grass, 0.3 + t * 0.7),
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0.3 + t * 0.2,
            showLeaves: true,
            isDry,
        };
    }

    // ── July: Full summer ─────────────────────────────────
    if (month === 7) {
        return {
            baseSeason: "summer",
            foliageDensity: 1,
            leafColors: PALETTES.summer.leaf,
            grassColors: PALETTES.summer.grass,
            groundLeafColors: [],
            fallingLeafIntensity: 0,
            blossomDensity: 0,
            flowerDensity: 0.4,
            showLeaves: true,
            isDry,
        };
    }

    // ── August: Summer → Autumn (gradual color change!) ──
    if (month === 8) {
        return {
            baseSeason: t < 0.6 ? "summer" : "autumn",
            foliageDensity: 1 - t * 0.05,  // barely thins
            leafColors: lerpColorArr(PALETTES.summer.leaf, PALETTES.autumn.leaf, t),
            grassColors: lerpColorArr(PALETTES.summer.grass, PALETTES.autumn.grass, t),
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: Math.max(0, (t - 0.5) * 0.4), // a few leaves late Aug
            blossomDensity: 0,
            flowerDensity: Math.max(0, 0.3 - t * 0.3),
            showLeaves: true,
            isDry,
        };
    }

    // ── September: Early autumn ───────────────────────────
    if (month === 9) {
        return {
            baseSeason: "autumn",
            foliageDensity: 0.95 - t * 0.05, // 95%→90%
            leafColors: PALETTES.autumn.leaf,
            grassColors: PALETTES.autumn.grass,
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: 0.3 + t * 0.3,
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: true,
            isDry,
        };
    }

    // ── October: Peak autumn, heavy leaf fall ─────────────
    if (month === 10) {
        return {
            baseSeason: "autumn",
            foliageDensity: 0.9 - t * 0.2,  // 90%→70% leaves remain
            leafColors: PALETTES.autumn.leaf,
            grassColors: lerpColorArr(PALETTES.autumn.grass, PALETTES.winter.grass, t * 0.3),
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: 0.6 + t * 0.4, // heavy!
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: true,
            isDry,
        };
    }

    // ── November: Autumn → Winter (tree goes bare!) ───────
    if (month === 11) {
        const decay = t * t; // accelerating loss
        return {
            baseSeason: t < 0.5 ? "autumn" : "winter",
            foliageDensity: Math.max(0, 0.7 * (1 - decay)), // 70%→~0%
            leafColors: PALETTES.autumn.leaf,
            grassColors: lerpColorArr(PALETTES.autumn.grass, PALETTES.winter.grass, 0.3 + t * 0.7),
            groundLeafColors: PALETTES.autumn.groundLeaf,
            fallingLeafIntensity: Math.max(0, 1 - decay * 0.6), // heavy early Nov, less as tree empties
            blossomDensity: 0,
            flowerDensity: 0,
            showLeaves: decay < 0.9, // nearly bare by ~Nov 27
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
type TreeLeaf = { cx: number; cy: number; r: number; opacity: number; isBlossom: boolean; angle: number };

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
                    opacity: 0.6 + Math.random() * 0.25,
                    isBlossom: Math.random() > 0.8,
                    angle: Math.random() * 360,
                });
            }
        }
        const s = 0.7 + Math.random() * 0.15;
        grow(tx, ty, len * s, a - 0.25 - Math.random() * 0.3, thickness * 0.65, depth - 1);
        grow(tx, ty, len * s, a + 0.25 + Math.random() * 0.3, thickness * 0.65, depth - 1);
        if (Math.random() > 0.35 && depth > 2)
            grow(tx, ty, len * 0.6 * s, a + (Math.random() * 0.2 - 0.1), thickness * 0.6, depth - 1);
    }

    grow(150, 300, 85, 0, 18, 7);
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

    const xSteps = info.baseSeason === "winter" ? 25 : 50;
    const yRows = info.baseSeason === "winter" ? 3 : 6;

    for (let xi = 0; xi < xSteps; xi++) {
        const x = -20 + (xi / (xSteps - 1)) * 340;
        const t = (x + 50) / 400;
        if (t < 0.02 || t > 0.98) continue;
        const yTop = (1 - t) ** 2 * 400 + 2 * (1 - t) * t * 150 + t ** 2 * 400;
        const yBottom = 398;
        const surfaceHeight = yBottom - yTop;
        if (surfaceHeight < 5) continue;

        for (let yi = 0; yi < yRows; yi++) {
            const rowFrac = yi / (yRows - 1);
            const baseY = yTop + rowFrac * surfaceHeight;
            const jx = (Math.random() - 0.5) * (340 / xSteps) * 0.8;
            const jy = (Math.random() - 0.5) * (surfaceHeight / yRows) * 0.5;
            const fx = x + jx;
            const fy = baseY + jy;
            const depthScale = 1 - rowFrac * 0.7;

            const h = info.isDry
                ? (2 + Math.random() * 4) * depthScale
                : info.baseSeason === "winter"
                    ? (1.5 + Math.random() * 3) * depthScale
                    : (5 + Math.random() * 14) * depthScale;

            let type: "grass" | "leaf" | "flower" = "grass";
            let color = info.grassColors[Math.floor(Math.random() * info.grassColors.length)];

            // Ground leaves — controlled by season info
            if (info.groundLeafColors.length > 0 && info.fallingLeafIntensity > 0 && Math.random() < info.fallingLeafIntensity * 0.5) {
                type = "leaf";
                color = info.groundLeafColors[Math.floor(Math.random() * info.groundLeafColors.length)];
            }
            // Wildflowers — controlled by flowerDensity
            else if (info.flowerDensity > 0 && Math.random() < info.flowerDensity * 0.12) {
                type = "flower";
                const flowerColors = ["#f9a8d4", "#fb923c", "#fbbf24", "#c084fc", "#f472b6", "#e879f9"];
                color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            }

            const leafSize = (3 + Math.random() * 3) * depthScale;

            elements.push({
                x: fx, y: fy,
                h: type === "grass" ? h : leafSize,
                bend: type === "grass"
                    ? (Math.random() - 0.5) * 10 * depthScale
                    : (Math.random() - 0.5) * 4 * depthScale,
                color,
                width: type === "grass" ? (0.8 + Math.random() * 1.2) * depthScale : leafSize,
                delay: Math.random() * 3,
                opacity: type === "grass" ? 0.5 + depthScale * 0.5 : type === "flower" ? 0.9 : 0.75,
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
        <g transform={`translate(${cx},${cy}) rotate(${angle}) scale(${scale})`} className={className}>
            <path
                d="M0,-12 C4,-10 8,-4 8,0 C8,6 4,12 0,12 C-4,12 -8,6 -8,0 C-8,-4 -4,-10 0,-12Z"
                fill={fill} opacity={opacity}
            />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
            <line x1="0" y1="-4" x2="4" y2="-1" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
            <line x1="0" y1="0" x2="-4" y2="3" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
            <line x1="0" y1="4" x2="3" y2="7" stroke="rgba(0,0,0,0.1)" strokeWidth="0.3" />
        </g>
    );
}

function SvgFlowerShape({ cx, cy, size, color, petalCount, delay }: {
    cx: number; cy: number; size: number; color: string;
    petalCount: number; delay: number;
}) {
    const angle = 360 / petalCount;
    return (
        <g transform={`translate(${cx},${cy})`} className="ground-flower"
            style={{ transformOrigin: `${cx}px ${cy}px`, animationDelay: `${delay}s` } as React.CSSProperties}>
            {Array.from({ length: petalCount }).map((_, i) => (
                <ellipse key={i} cx={0} cy={-size * 0.8} rx={size * 0.4} ry={size * 0.7}
                    fill={color} opacity={0.85} transform={`rotate(${i * angle})`} />
            ))}
            <circle cx={0} cy={0} r={size * 0.3} fill="#fbbf24" opacity={0.95} />
            <circle cx={0} cy={0} r={size * 0.15} fill="#f59e0b" opacity={0.8} />
        </g>
    );
}

// ═══════════════════════════════════════════════════════════════════
// ✦  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

export default function TreeVisualizer({ airtemp, windspeed, stream, snowDepth, date, hour = 12 }: TreeVisualizerProps) {
    // Continuous season info (gradual transitions!)
    const seasonInfo = useMemo(() => getSeasonInfo(date, airtemp, stream), [date, airtemp, stream < 0.05]);

    const baseSoilColor = stream < 0.05 ? "#574f4a" : "#292524";

    const { branches, leaves } = useMemo(() => buildTree(), []);
    const fallingLeaves = useFallingLeaves(windspeed, seasonInfo);
    const butterflies = useButterflies(seasonInfo, airtemp);
    const fireflies = useFireflies(seasonInfo, hour, airtemp);

    // Ground elements react to the season info (gradual colors/density)
    const groundElements = useMemo(
        () => generateGroundElements(seasonInfo),
        [seasonInfo.baseSeason, Math.round(seasonInfo.fallingLeafIntensity * 5), Math.round(seasonInfo.flowerDensity * 5), seasonInfo.isDry]
    );

    // How many tree leaves to render (based on foliage density)
    const visibleLeafCount = Math.floor(leaves.length * seasonInfo.foliageDensity);

    const swayDeg = Math.min(windspeed * 1.8, 18);
    const swayDuration = Math.max(0.8, 4 - windspeed * 0.2);
    const rainDroop = stream > 0.1 ? Math.min(stream * 20, 6) : 0;
    const trunkColor = seasonInfo.baseSeason === "winter" ? "#1f140e" : "#2a1c12";

    const grassSwayDeg = Math.min(windspeed * 2.5, 20);
    const grassSwaySpeed = Math.max(0.8, 2.5 - windspeed * 0.12);

    return (
        <div
            className="tv-container pointer-events-none absolute inset-0 pb-[8vh] flex justify-center items-end"
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

            {/* Butterflies */}
            {butterflies.map(b => (
                <motion.div
                    key={b.id} className="absolute w-3 h-3 rounded-full pointer-events-none blur-[1px]"
                    style={{ backgroundColor: b.color }}
                    initial={{ left: `${b.x}vw`, top: "60vh" }}
                    animate={{
                        top: ["60vh", "30vh", "50vh", "20vh"],
                        left: [`${b.x}vw`, `${b.x + 5}vw`, `${b.x - 5}vw`, `${b.x + 10}vw`],
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
                />
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
            <svg viewBox="0 0 300 400" className="tv-svg absolute inset-x-0 bottom-0 w-[120%] max-w-[800px] h-[90%] mx-auto"
                preserveAspectRatio="xMidYMax meet" overflow="visible">

                <defs>
                    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stream < 0.05 ? "#78716c" : "#57534e"} />
                        <stop offset="35%" stopColor={baseSoilColor} />
                        <stop offset="100%" stopColor={stream < 0.05 ? "#44403c" : "#1c1917"} />
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
                </defs>

                {/* Ground mound */}
                <motion.path d="M-50,400 Q150,150 350,400 Z" fill="url(#groundGrad)"
                    animate={{ opacity: 1 }} transition={{ duration: 2 }} />
                <path d="M-50,400 Q150,155 350,400 Z" fill="url(#soilHighlight)" opacity={0.5} />
                <path d="M-20,395 Q150,158 320,395" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />

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
                            opacity={g.opacity} className="grass-blade"
                            style={{ transformOrigin: `${g.x}px ${g.y}px`, animationDelay: `${g.delay}s` }} />
                    );
                })}

                {/* Snow cap */}
                {snowDepth > 5 && (
                    <>
                        <motion.path d="M-50,400 Q150,150 350,400 Z"
                            fill="#f1f5f9" opacity={Math.min(snowDepth / 50, 1)}
                            initial={{ opacity: 0 }} animate={{ opacity: Math.min(snowDepth / 50, 1) }} />
                        {snowDepth > 15 && Array.from({ length: 8 }).map((_, i) => {
                            const st = 0.15 + (i / 8) * 0.7;
                            const sx = -50 + st * 400;
                            const sy = (1 - st) ** 2 * 400 + 2 * (1 - st) * st * 155 + st ** 2 * 400;
                            return <circle key={`sp${i}`} cx={sx} cy={sy + 5 + Math.random() * 20}
                                r={1 + Math.random() * 1.5} fill="white" className="snow-sparkle"
                                style={{ animationDelay: `${i * 0.4}s` }} />;
                        })}
                    </>
                )}

                {/* Tree shadow */}
                <ellipse cx="150" cy="297" rx={55 + windspeed * 0.8} ry="10" fill="url(#shadowGrad)" />

                {/* Tree structure */}
                <motion.g
                    style={{ originX: "150px", originY: "300px" }}
                    animate={{
                        rotate: [0, swayDeg, 0, -swayDeg * 0.6, 0],
                        skewX: [0, swayDeg * 0.05, 0, -swayDeg * 0.03, 0],
                        skewY: [0, rainDroop * 0.1, 0],
                    }}
                    transition={{ repeat: Infinity, duration: swayDuration, ease: "easeInOut" }}
                >
                    {branches.map((b, i) => (
                        <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
                            stroke={trunkColor} strokeWidth={b.thickness} strokeLinecap="round" />
                    ))}

                    {/* Foliage — density controlled by foliageDensity */}
                    <AnimatePresence>
                        {seasonInfo.showLeaves && visibleLeafCount > 0 && (
                            <motion.g
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: seasonInfo.foliageDensity, scale: 0.8 + seasonInfo.foliageDensity * 0.2 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 2 }}
                                style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.4))" }}
                            >
                                {leaves.slice(0, visibleLeafCount).map((leaf, i) => {
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
            </svg>
        </div>
    );
}
