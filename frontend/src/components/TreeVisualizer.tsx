"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

interface TreeVisualizerProps {
    airtemp: number; // oC
    windspeed: number; // m/s
    stream: number; // mm
    snowDepth: number; // mm
    date: string;
}

export default function TreeVisualizer({
    airtemp,
    windspeed,
    stream,
    snowDepth,
    date,
}: TreeVisualizerProps) {
    const dateStr = date || "1/1/2022";
    const month = parseInt(dateStr.split("/")[0]) || 1;
    const isWinter = month === 12 || month <= 2;
    const isAutumn = month === 10 || month === 11;
    const isSpring = month >= 3 && month <= 5;

    const getLeafColor = (temp: number) => {
        if (isWinter) return "transparent"; 
        if (isAutumn) return "#c2410c"; // Rust orange
        if (isSpring) return "#bbf7d0"; // Blossom light green
        if (temp < 10) return "#4ade80"; 
        return "#15803d"; // Darker realistic green
    };

    const getSoilColor = (moisture: number) => {
        if (snowDepth > 10) return "#f8fafc"; // Snow hill
        if (moisture < 0.05) return "#d6d3d1"; // Dry dirt
        if (moisture < 0.1) return "#78716c"; // Brownish
        return "#292524"; // Wet dark brown
    };

    const swayAmount = Math.min(windspeed * 1.5, 12); 
    const swayDuration = Math.max(1, 4 - windspeed * 0.5);

    // Procedural Fractal Tree Generation
    const { branches, treeLeaves } = useMemo(() => {
        const b: any[] = [];
        const l: any[] = [];
        
        function grow(x1: number, y1: number, len: number, angle: number, depth: number, maxDepth: number) {
            if (depth === 0) return;
            
            // Random bend for organic look
            const bend = (Math.random() - 0.5) * 0.15;
            const currentAngle = angle + bend;
            
            const x2 = x1 + len * Math.sin(currentAngle);
            const y2 = y1 - len * Math.cos(currentAngle);
            
            // Tapering thickness
            const thickness = Math.pow(depth / maxDepth, 1.5) * 16; 
            
            b.push({ x1, y1, x2, y2, thickness, depth });
            
            // Add leaves heavily clustered at the outer branches
            if (depth <= 2) {
                for (let i = 0; i < 6; i++) {
                    l.push({
                        cx: x2 + (Math.random() * 30 - 15),
                        cy: y2 + (Math.random() * 30 - 15),
                        r: 6 + Math.random() * 12,
                        opacity: 0.7 + Math.random() * 0.3
                    });
                }
            }
            
            // Sub-branches
            grow(x2, y2, len * (0.7 + Math.random()*0.1), currentAngle - 0.4 + Math.random() * 0.15, depth - 1, maxDepth);
            grow(x2, y2, len * (0.7 + Math.random()*0.1), currentAngle + 0.4 + Math.random() * 0.15, depth - 1, maxDepth);
            
            // Occasional center branch
            if (depth > 2 && Math.random() > 0.3) {
                 grow(x2, y2, len * 0.55, currentAngle + (Math.random() * 0.2 - 0.1), depth - 1, maxDepth);
            }
        }
        
        // Start trunk
        grow(100, 275, 45, 0, 7, 7); 
        return { branches: b, treeLeaves: l };
    }, []);

    // Falling Leaves logic
    const [fallingLeaves, setFallingLeaves] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);
    
    useEffect(() => {
        if (!isWinter && (isAutumn || windspeed > 4)) {
            const leafCount = Math.floor(windspeed * 2) + (isAutumn ? 8 : 0);
            setFallingLeaves(Array.from({ length: leafCount }).map((_, i) => ({
                id: i,
                x: 30 + Math.random() * 40, // 30% to 70%
                y: 20 + Math.random() * 30, // 20vh to 50vh
                delay: Math.random() * 4,
            })));
        } else {
            setFallingLeaves([]);
        }
    }, [windspeed, isAutumn, isWinter]);

    return (
        <div className="tv-container pointer-events-none absolute inset-0 pb-[10vh]">
            {/* Falling Leaves Layer */}
            {fallingLeaves.map(leaf => (
                <motion.div
                    key={leaf.id}
                    className="absolute w-3 h-3 rounded-tl-full rounded-br-full"
                    style={{ backgroundColor: getLeafColor(airtemp), opacity: 0.8 }}
                    initial={{ left: `${leaf.x}vw`, top: `${leaf.y}vh` }}
                    animate={{ 
                        top: "120vh", 
                        left: [`${leaf.x}vw`, `${leaf.x + windspeed * 5}vw`],
                        rotate: [0, 360, 720]
                    }}
                    transition={{
                        duration: 3 + Math.random() * 2,
                        repeat: Infinity,
                        delay: leaf.delay,
                        ease: "easeIn"
                    }}
                />
            ))}

            <svg
                viewBox="0 0 200 300"
                className="tv-svg absolute inset-0 w-full h-full max-w-none max-h-none"
                preserveAspectRatio="xMidYMax meet"
            >
                {/* Rolling Hill Background */}
                <motion.path 
                    d="M-50,300 Q100,240 250,300 Z" 
                    fill={getSoilColor(stream)} 
                    animate={{ fill: getSoilColor(stream) }}
                    transition={{ duration: 1.5 }}
                />

                {/* Tree Shadow */}
                <ellipse cx="100" cy="275" rx="35" ry="6" fill="#000" opacity="0.25" />

                {/* Detailed Fractal Tree */}
                <motion.g
                    style={{ originX: "100px", originY: "275px" }}
                    animate={{
                        rotate: [0, swayAmount, 0, -swayAmount * 0.8, 0],
                        skewX: [0, swayAmount * 0.1, 0, -swayAmount * 0.05, 0] 
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: swayDuration,
                        ease: "easeInOut",
                    }}
                >
                    {/* Bark / Branches */}
                    {branches.map((b, i) => (
                        <line 
                            key={`bark-${i}`}
                            x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} 
                            stroke="#2a1b0e" // Very deep, rich brown
                            strokeWidth={b.thickness}
                            strokeLinecap="round"
                        />
                    ))}

                    {/* Snow collected on upper branches in winter */}
                    {isWinter && snowDepth > 10 && branches.map((b, i) => {
                        if (b.depth >= 3 && b.depth <= 6) { 
                            return (
                                <line 
                                    key={`snow-${i}`}
                                    x1={b.x1 - 1} y1={b.y1 - 1} x2={b.x2 - 1} y2={b.y2 - 2} 
                                    stroke="#ffffff"
                                    strokeWidth={b.thickness * 0.5}
                                    strokeLinecap="round"
                                    opacity="0.9"
                                />
                            );
                        }
                        return null;
                    })}

                    {/* Voluminous Leaves */}
                    {!isWinter && (
                        <motion.g
                            animate={{ fill: getLeafColor(airtemp) }}
                            transition={{ duration: 1.5 }}
                            style={{ filter: "drop-shadow(0px 8px 12px rgba(0,0,0,0.35))" }}
                        >
                            {treeLeaves.map((leaf, i) => (
                                <motion.circle 
                                    key={`leaf-${i}`}
                                    cx={leaf.cx} cy={leaf.cy} r={leaf.r}
                                    opacity={leaf.opacity}
                                    animate={{ 
                                        scale: [1, 1 + Math.random() * 0.1, 1] 
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: 2 + Math.random() * 3,
                                        delay: Math.random() * 2,
                                        ease: "easeInOut"
                                    }}
                                />
                            ))}
                        </motion.g>
                    )}
                </motion.g>
            </svg>
        </div>
    );
}
