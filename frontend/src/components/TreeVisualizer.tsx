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
    if (month <= 5)                 return "spring";
    if (month <= 8)                 return "summer";
    return "autumn";
}

// ─── Leaf color by season / temp ─────────────────────────────────
function getLeafColor(season: string, airtemp: number): string {
    if (season === "winter") return "none";
    if (season === "autumn") {
        if (airtemp > 5)  return "#ea580c"; // orange
        return "#b91c1c";                   // deep red
    }
    if (season === "spring") return "#a3e635"; // lime green
    // summer
    return "#15803d"; // deep green
}

// ─── Procedural fractal tree ──────────────────────────────────────
type Branch = { x1: number; y1: number; x2: number; y2: number; thickness: number; depth: number };
type Leaf   = { cx: number; cy: number; r: number; opacity: number; isBlossom: boolean };

function buildTree(): { branches: Branch[]; leaves: Leaf[] } {
    const branches: Branch[] = [];
    const leaves: Leaf[]     = [];

    // Base coordinates are modified to allow a much taller/wider tree. SVG will be scaled.
    function grow(x: number, y: number, len: number, angle: number, thickness: number, depth: number) {
        if (depth === 0) return;
        
        // Organic bend
        const bend = (Math.random() - 0.5) * 0.3;
        const a = angle + bend;
        const targetX = x + len * Math.sin(a);
        const targetY = y - len * Math.cos(a);

        branches.push({ x1: x, y1: y, x2: targetX, y2: targetY, thickness, depth });

        if (depth <= 3) {
            // Generate leaves at the tips
            const leafCount = depth === 1 ? 8 : 4;
            for (let i = 0; i < leafCount; i++) {
                leaves.push({
                    cx: targetX + (Math.random() * 50 - 25),
                    cy: targetY + (Math.random() * 50 - 25),
                    r: 8 + Math.random() * 14,
                    opacity: 0.7 + Math.random() * 0.3,
                    isBlossom: Math.random() > 0.8, // 20% chance to be a spring blossom
                });
            }
        }

        const shrink = 0.7 + (Math.random() * 0.15);

        // Branch left
        grow(targetX, targetY, len * shrink, a - 0.25 - Math.random() * 0.3, thickness * 0.65, depth - 1);
        // Branch right
        grow(targetX, targetY, len * shrink, a + 0.25 + Math.random() * 0.3, thickness * 0.65, depth - 1);
        
        // Middle branch occasionally for organic fullness
        if (Math.random() > 0.35 && depth > 2) {
             grow(targetX, targetY, len * 0.6 * shrink, a + (Math.random() * 0.2 - 0.1), thickness * 0.6, depth - 1);
        }
    }
    
    // Start with a thick, tall trunk originating from the new ground height
    grow(150, 300, 85, 0, 18, 7);
    return { branches, leaves };
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
        // Butterflies only in spring/summer when warm
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

function useGrass(stream: number, season: string) {
    return useMemo(() => {
        // Generate grass blades
        const blades = [];
        const isDry = stream < 0.05;
        const color = season === "winter" ? "#d6d3d1" : (isDry ? "#a8a29e" : (season === "autumn" ? "#a16207" : "#4ade80"));
        for (let i = 0; i < 40; i++) {
            // Adjust grass to fit the curved mound exactly
            const x = -10 + Math.random() * 320; // Spread across the visible part of the mound
            
            // The mound is a quadratic bezier: M-50,400 Q150,150 350,400
            // Find t from x: x(t) = (1-t)^2*(-50) + 2(1-t)t*(150) + t^2*(350)
            const t = (x + 50) / 400;
            // y(t) = (1-t)^2*400 + 2(1-t)t*150 + t^2*400
            const baseY = Math.pow(1 - t, 2) * 400 + 2 * (1 - t) * t * 150 + Math.pow(t, 2) * 400;

            blades.push({
                x,
                y: baseY,
                h: isDry ? 4 + Math.random() * 6 : 8 + Math.random() * 12,
                bend: (Math.random() - 0.5) * 10,
                color
            });
        }
        return blades;
    }, [stream < 0.05, season]);
}

export default function TreeVisualizer({ airtemp, windspeed, stream, snowDepth, date }: TreeVisualizerProps) {
    const season    = getSeason(date);
    const leafColor = getLeafColor(season, airtemp);
    
    // Soil dynamically changes color
    const baseSoilColor = stream < 0.05 ? "#574f4a" : "#292524"; 

    const { branches, leaves } = useMemo(() => buildTree(), []);
    const fallingLeaves = useFallingLeaves(windspeed, season, leafColor);
    const butterflies   = useButterflies(season, airtemp);
    const grassBlades   = useGrass(stream, season);

    const swayDeg      = Math.min(windspeed * 1.8, 18);
    const swayDuration = Math.max(0.8, 4 - windspeed * 0.2);
    const rainDroop    = stream > 0.1 ? Math.min(stream * 20, 6) : 0;
    const trunkColor   = season === "winter" ? "#1f140e" : "#2a1c12";

    return (
        <div className="tv-container pointer-events-none absolute inset-0 pb-[8vh] flex justify-center items-end">

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

                {/* Ground Patch */}
                <motion.path
                    d="M-50,400 Q150,150 350,400 Z"
                    animate={{ fill: baseSoilColor }}
                    transition={{ duration: 2 }}
                />

                {/* Grass blades */}
                {snowDepth < 5 && grassBlades.map((g, i) => (
                    <motion.path key={`grass${i}`}
                        d={`M${g.x},${g.y} Q${g.x + g.bend},${g.y - g.h / 2} ${g.x + g.bend * 1.5},${g.y - g.h}`}
                        stroke={g.color} strokeWidth="1.5" fill="none" strokeLinecap="round"
                        animate={{ skewX: [0, windspeed * 0.5, 0] }}
                        style={{ originX: `${g.x}px`, originY: `${g.y}px` }}
                        transition={{ repeat: Infinity, duration: 1.5 + Math.random(), ease: "easeInOut" }}
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

                {/* Tree Shadow */}
                <ellipse cx="150" cy="295" rx={50 + windspeed} ry="8" fill="#000" opacity="0.25" />

                {/* Tree Structure */}
                <motion.g
                    style={{ originX: "150px", originY: "300px" }}
                    animate={{
                        rotate: [0, swayDeg, 0, -swayDeg * 0.6, 0],
                        skewX:  [0, swayDeg * 0.05, 0, -swayDeg * 0.03, 0],
                        skewY:  [0, rainDroop * 0.1, 0],
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
                                    // In spring, render blossoms
                                    if (season === "spring" && leaf.isBlossom) {
                                        return (
                                            <motion.circle key={i} cx={leaf.cx} cy={leaf.cy} r={leaf.r * 0.6}
                                                fill="#fbcfe8" opacity={0.9} // pink blossom
                                                animate={{ scale: [1, 1.1, 1] }}
                                                transition={{ repeat: Infinity, duration: 2 + Math.random() }}
                                            />
                                        );
                                    }
                                    // Normal leaf
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
