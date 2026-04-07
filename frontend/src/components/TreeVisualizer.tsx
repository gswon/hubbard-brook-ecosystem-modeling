"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useEffect, useState } from "react";

interface TreeVisualizerProps {
    airtemp: number;
    windspeed: number;
    stream: number;
    snowDepth: number;
    date: string; // YYYY-MM-DD
}

// ─── Season detection ─────────────────────────────────────────────
function getSeason(date: string) {
    const month = parseInt((date || "2024-01-01").split("-")[1] || "1");
    if (month === 12 || month <= 2) return "winter";
    if (month <= 5) return "spring";
    if (month <= 8) return "summer";
    return "autumn";
}

// ─── Leaf color by season / temp ─────────────────────────────────
function getLeafColor(season: string, airtemp: number): string {
    if (season === "winter") return "none";
    if (season === "autumn") {
        if (airtemp > 5) return "#ea580c"; // orange
        return "#b91c1c";                   // deep red
    }
    if (season === "spring") return "#a3e635"; // lime green
    return "#15803d"; // deep green (summer)
}

// ─── Procedural fractal tree ──────────────────────────────────────
type Branch = { x1: number; y1: number; x2: number; y2: number; thickness: number; depth: number };
type Leaf = { cx: number; cy: number; r: number; opacity: number; isBlossom: boolean };

function buildTree(): { branches: Branch[]; leaves: Leaf[] } {
    const branches: Branch[] = [];
    const leaves: Leaf[] = [];

    function grow(x: number, y: number, len: number, angle: number, thickness: number, depth: number) {
        if (depth === 0) return;

        const bend = (Math.random() - 0.5) * 0.3;
        const a = angle + bend;
        const targetX = x + len * Math.sin(a);
        const targetY = y - len * Math.cos(a);

        branches.push({ x1: x, y1: y, x2: targetX, y2: targetY, thickness, depth });

        if (depth <= 3) {
            const leafCount = depth === 1 ? 6 : 3;
            for (let i = 0; i < leafCount; i++) {
                leaves.push({
                    cx: targetX + (Math.random() * 50 - 25),
                    cy: targetY + (Math.random() * 50 - 25),
                    r: 6 + Math.random() * 12, // smaller leaf radius
                    opacity: 0.6 + Math.random() * 0.25, // lower opacity so branches show
                    isBlossom: Math.random() > 0.8,
                });
            }
        }

        const shrink = 0.7 + (Math.random() * 0.15);
        grow(targetX, targetY, len * shrink, a - 0.25 - Math.random() * 0.3, thickness * 0.65, depth - 1);
        grow(targetX, targetY, len * shrink, a + 0.25 + Math.random() * 0.3, thickness * 0.65, depth - 1);

        if (Math.random() > 0.35 && depth > 2) {
            grow(targetX, targetY, len * 0.6 * shrink, a + (Math.random() * 0.2 - 0.1), thickness * 0.6, depth - 1);
        }
    }

    grow(150, 300, 85, 0, 18, 7);
    return { branches, leaves };
}

// ─── Dense grass generation (pure SVG, CSS-animated) ─────────────
type GrassBlade = {
    x: number; y: number; h: number; bend: number;
    color: string; width: number; delay: number; opacity: number;
};

function generateGrass(stream: number, season: string): GrassBlade[] {
    const blades: GrassBlade[] = [];
    const isDry = stream < 0.05;

    // Color palette with natural variation
    const baseColors = season === "winter"
        ? ["#9ca3af", "#a8a29e", "#d6d3d1"]
        : isDry
            ? ["#a8a29e", "#78716c", "#d4c9a8"]
            : season === "autumn"
                ? ["#a16207", "#ca8a04", "#92400e", "#b45309"]
                : season === "spring"
                    ? ["#86efac", "#4ade80", "#a3e635", "#6ee7b7"]
                    : ["#22c55e", "#16a34a", "#15803d", "#4ade80", "#166534"];

    // ── Fill the ENTIRE mound surface, not just the edge ──
    // Mound bezier: M-50,400 Q150,150 350,400 Z
    // For the top curve: y(t) = (1-t)²·400 + 2(1-t)t·150 + t²·400
    // The "surface" is everything between the curve y(t) and y=400 (bottom)
    //
    // Sample a grid of (x, y) positions across the interior:
    //   - x spans from -20 to 320 (visible mound face)
    //   - for each x, find the curve-top yTop, then place blades from yTop down to ~395

    const xSteps = season === "winter" ? 25 : 50;   // columns
    const yRows = season === "winter" ? 3 : 6;    // rows per column

    for (let xi = 0; xi < xSteps; xi++) {
        const x = -20 + (xi / (xSteps - 1)) * 340;

        // Find yTop on the bezier for this x
        const t = (x + 50) / 400;
        if (t < 0.02 || t > 0.98) continue; // skip extreme edges
        const yTop = Math.pow(1 - t, 2) * 400 + 2 * (1 - t) * t * 150 + Math.pow(t, 2) * 400;

        const yBottom = 398;
        const surfaceHeight = yBottom - yTop;
        if (surfaceHeight < 5) continue;

        for (let yi = 0; yi < yRows; yi++) {
            // Distribute rows from top of curve down to bottom
            const rowFraction = yi / (yRows - 1); // 0 = top of curve, 1 = bottom
            const baseY = yTop + rowFraction * surfaceHeight;

            // Random jitter so it's not a rigid grid
            const jitterX = (Math.random() - 0.5) * (340 / xSteps) * 0.8;
            const jitterY = (Math.random() - 0.5) * (surfaceHeight / yRows) * 0.5;
            const finalX = x + jitterX;
            const finalY = baseY + jitterY;

            // Grass near the top of the mound is taller (closer to viewer in pseudo-3D)
            // Grass near bottom is shorter (receding into the hill)
            const depthScale = 1 - rowFraction * 0.7; // top=1x, bottom=0.3x
            const h = isDry
                ? (2 + Math.random() * 4) * depthScale
                : season === "winter"
                    ? (1.5 + Math.random() * 3) * depthScale
                    : (5 + Math.random() * 14) * depthScale;

            let type: "grass" | "leaf" | "flower" = "grass";
            let color = baseColors[Math.floor(Math.random() * baseColors.length)];
            
            // Autumn leaves have 50% chance, Spring flowers 10%
            if (season === "autumn" && Math.random() > 0.5) {
                type = "leaf";
                const leafColors = ["#ea580c", "#c2410c", "#b91c1c", "#f59e0b", "#9a3412"];
                color = leafColors[Math.floor(Math.random() * leafColors.length)];
            } else if (season === "spring" && Math.random() > 0.9) {
                type = "flower";
                const flowerColors = ["#fbcfe8", "#fecdd3", "#fef08a", "#e0e7ff", "#ffffff"];
                color = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            }

            const leafSize = (4 + Math.random() * 4) * depthScale; // Much larger than original
            
            blades.push({
                x: finalX,
                y: finalY,
                h: type === "grass" ? h : leafSize,
                bend: type === "grass" ? (Math.random() - 0.5) * 10 * depthScale : Math.random() * 360,
                color: color,
                width: type === "grass" ? (0.8 + Math.random() * 1.2) * depthScale : leafSize * 1.8,
                delay: Math.random() * 3,
                opacity: type === "grass" ? 0.5 + depthScale * 0.5 : 0.85,
                type: type as any
            });
        }
    }
    return blades;
}

// ─── Environment Hooks ───────────────────────────────────────────
function useFallingLeaves(windspeed: number, season: string, leafColor: string) {
    const [leaves, setLeaves] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);
    useEffect(() => {
        if (season === "winter" || (season !== "autumn" && windspeed < 5)) {
            setLeaves([]); return;
        }
        const n = Math.min(Math.floor(windspeed * 3) + (season === "autumn" ? 12 : 0), 35);
        setLeaves(Array.from({ length: n }).map((_, i) => ({
            id: i, x: Math.random() * 80, y: Math.random() * 40, delay: Math.random() * 4,
        })));
    }, [Math.round(windspeed), season]);
    return leaves;
}

function useButterflies(season: string, airtemp: number) {
    const [bugs, setBugs] = useState<{ id: number; x: number; delay: number; color: string }[]>([]);
    useEffect(() => {
        if (airtemp < 10 || season === "winter" || season === "autumn") {
            setBugs([]); return;
        }
        setBugs(Array.from({ length: 4 }).map((_, i) => ({
            id: i, x: 20 + Math.random() * 60, delay: Math.random() * 3,
            color: ["#fef08a", "#bae6fd", "#fbcfe8"][Math.floor(Math.random() * 3)]
        })));
    }, [season, Math.round(airtemp / 10)]);
    return bugs;
}

export default function TreeVisualizer({ airtemp, windspeed, stream, snowDepth, date }: TreeVisualizerProps) {
    const season = getSeason(date);
    const leafColor = getLeafColor(season, airtemp);

    const baseSoilColor = stream < 0.05 ? "#574f4a" : "#292524";

    const { branches, leaves } = useMemo(() => buildTree(), []);
    const fallingLeaves = useFallingLeaves(windspeed, season, leafColor);
    const butterflies = useButterflies(season, airtemp);
    const grassBlades = useMemo(() => generateGrass(stream, season), [stream < 0.05, season]);

    const swayDeg = Math.min(windspeed * 1.8, 18);
    const swayDuration = Math.max(0.8, 4 - windspeed * 0.2);
    const rainDroop = stream > 0.1 ? Math.min(stream * 20, 6) : 0;
    const trunkColor = season === "winter" ? "#1f140e" : "#2a1c12";

    // CSS variable for wind-reactive grass sway
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

            {/* Falling leaves outside SVG so they span screen */}
            {fallingLeaves.map(leaf => (
                <motion.div
                    key={leaf.id}
                    className="absolute rounded-tl-full rounded-br-full pointer-events-none"
                    style={{ backgroundColor: leafColor === "none" ? "#ea580c" : leafColor, opacity: 0.85, width: 14, height: 10 }}
                    initial={{ left: `${leaf.x}vw`, top: `${leaf.y}vh` }}
                    animate={{
                        top: "120vh", left: [`${leaf.x}vw`, `${leaf.x + windspeed * 5 + Math.random() * 15}vw`],
                        rotate: [0, 180 + Math.random() * 360],
                    }}
                    transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: leaf.delay, ease: "easeIn" }}
                />
            ))}

            {/* Butterflies */}
            {butterflies.map(b => (
                <motion.div
                    key={b.id} className="absolute w-3 h-3 rounded-full pointer-events-none blur-[1px]"
                    style={{ backgroundColor: b.color }}
                    initial={{ left: `${b.x}vw`, top: "60vh" }}
                    animate={{
                        top: ["60vh", "30vh", "50vh", "20vh"], left: [`${b.x}vw`, `${b.x + 5}vw`, `${b.x - 5}vw`, `${b.x + 10}vw`],
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{ duration: 6 + Math.random() * 4, repeat: Infinity, delay: b.delay, ease: "easeInOut" }}
                />
            ))}

            {/* Scale SVG nicely: 300x400 canvas */}
            <svg viewBox="0 0 300 400" className="tv-svg absolute inset-x-0 bottom-0 w-[120%] max-w-[800px] h-[90%] mx-auto"
                preserveAspectRatio="xMidYMax meet" overflow="visible">

                {/* SVG Definitions */}
                <defs>
                    {/* Ground mound gradient */}
                    <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={stream < 0.05 ? "#78716c" : "#57534e"} />
                        <stop offset="35%" stopColor={baseSoilColor} />
                        <stop offset="100%" stopColor={stream < 0.05 ? "#44403c" : "#1c1917"} />
                    </linearGradient>

                    {/* Soil texture noise overlay */}
                    <linearGradient id="soilHighlight" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="transparent" />
                        <stop offset="30%" stopColor="rgba(255,255,255,0.06)" />
                        <stop offset="50%" stopColor="transparent" />
                        <stop offset="70%" stopColor="rgba(255,255,255,0.04)" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>

                    {/* Tree shadow radial gradient */}
                    <radialGradient id="shadowGrad" cx="50%" cy="50%" rx="50%" ry="50%">
                        <stop offset="0%" stopColor="rgba(0,0,0,0.35)" />
                        <stop offset="60%" stopColor="rgba(0,0,0,0.15)" />
                        <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                    </radialGradient>
                </defs>

                {/* Ground Mound — rich gradient */}
                <motion.path
                    d="M-50,400 Q150,150 350,400 Z"
                    fill="url(#groundGrad)"
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2 }}
                />
                {/* Soil highlight overlay */}
                <path
                    d="M-50,400 Q150,155 350,400 Z"
                    fill="url(#soilHighlight)"
                    opacity={0.5}
                />
                {/* Subtle rim light on top edge of mound */}
                <path
                    d="M-20,395 Q150,158 320,395"
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth="1.5"
                />

                {/* Dense Grass Blades (CSS-animated, no Framer Motion) */}
                {snowDepth < 5 && grassBlades.map((g, i) => (
                    <path
                        key={`grass${i}`}
                        d={`M${g.x},${g.y} Q${g.x + g.bend},${g.y - g.h * 0.6} ${g.x + g.bend * 1.8},${g.y - g.h}`}
                        stroke={g.color}
                        strokeWidth={g.width}
                        fill="none"
                        strokeLinecap="round"
                        opacity={g.opacity}
                        className="grass-blade"
                        style={{
                            transformOrigin: `${g.x}px ${g.y}px`,
                            animationDelay: `${g.delay}s`,
                        }}
                    />
                ))}

                {/* Snow Cap */}
                {snowDepth > 5 && (
                    <motion.path
                        d="M-50,400 Q150,150 350,400 Z"
                        fill="#f1f5f9" opacity={Math.min(snowDepth / 50, 1)}
                        initial={{ opacity: 0 }} animate={{ opacity: Math.min(snowDepth / 50, 1) }}
                    />
                )}

                {/* Tree Shadow — soft radial gradient */}
                <ellipse cx="150" cy="297" rx={55 + windspeed * 0.8} ry="10" fill="url(#shadowGrad)" />

                {/* Tree Structure */}
                <motion.g
                    style={{ originX: "150px", originY: "300px" }}
                    animate={{
                        rotate: [0, swayDeg, 0, -swayDeg * 0.6, 0],
                        skewX: [0, swayDeg * 0.05, 0, -swayDeg * 0.03, 0],
                        skewY: [0, rainDroop * 0.1, 0],
                    }}
                    transition={{ repeat: Infinity, duration: swayDuration, ease: "easeInOut" }}
                >
                    {/* Branches */}
                    {branches.map((b, i) => (
                        <line key={i} x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2}
                            stroke={trunkColor} strokeWidth={b.thickness} strokeLinecap="round" />
                    ))}

                    {/* Foliage */}
                    <AnimatePresence>
                        {season !== "winter" && (
                            <motion.g
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1, fill: leafColor }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 2 }}
                                style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.4))" }}
                            >
                                {leaves.map((leaf, i) => {
                                    if (season === "spring" && leaf.isBlossom) {
                                        return (
                                            <motion.circle key={i} cx={leaf.cx} cy={leaf.cy} r={leaf.r * 0.6}
                                                fill="#fbcfe8" opacity={0.9}
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ repeat: Infinity, duration: 2 + Math.random() }}
                                            />
                                        );
                                    }
                                    return (
                                        <motion.circle key={i} cx={leaf.cx} cy={leaf.cy} r={leaf.r} opacity={leaf.opacity}
                                            animate={{ scale: [1, 1 + windspeed * 0.01, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 + Math.random(), ease: "easeInOut" }}
                                        />
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
