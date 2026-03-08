"use client";

import { motion } from "framer-motion";

interface TreeVisualizerProps {
    airtemp: number; // oC
    windspeed: number; // m/s
    stream: number; // mm
}

export default function TreeVisualizer({
    airtemp,
    windspeed,
    stream,
}: TreeVisualizerProps) {
    // 1. Temperature to Leaf Color
    // Cold (< 0): White/Light Blue
    // Mild (0 - 15): Light Green
    // Warm (15 - 25): Vibrant Green
    // Hot (> 25): Orange/Brown
    const getLeafColor = (temp: number) => {
        if (temp < 0) return "#e0f2fe"; // sky-100
        if (temp < 10) return "#bbf7d0"; // green-200
        if (temp < 20) return "#4ade80"; // green-400
        if (temp < 25) return "#22c55e"; // green-500
        if (temp < 30) return "#facc15"; // yellow-400
        return "#ea580c"; // orange-600
    };

    // 2. Stream to Soil/Root Color
    // Dry (< 0.05): Light Tan
    // Wet (> 0.2): Dark Brown
    const getSoilColor = (moisture: number) => {
        if (moisture < 0.05) return "#d6d3d1"; // stone-300
        if (moisture < 0.1) return "#a8a29e"; // stone-400
        if (moisture < 0.2) return "#78716c"; // stone-500
        return "#44403c"; // stone-700
    };

    // 3. Windspeed to Sway Amount
    const swayAmount = Math.min(windspeed * 3, 25); // Max 25 degrees sway
    const swayDuration = Math.max(0.5, 3 - windspeed * 0.5); // Faster wind = shorter duration

    return (
        <div className="relative flex h-full w-full items-end justify-center overflow-hidden">
            {/* Soil/Ground base */}
            <motion.div
                animate={{ backgroundColor: getSoilColor(stream) }}
                transition={{ duration: 1 }}
                className="absolute bottom-0 h-1/4 w-full rounded-t-[100%] blur-sm"
            />

            <svg
                viewBox="0 0 200 300"
                className="relative z-10 mx-auto h-[60vh] max-h-[600px] w-full max-w-[400px]"
                preserveAspectRatio="xMidYMax meet"
            >
                {/* Roots */}
                <motion.path
                    d="M90 280 Q80 295 70 300 M110 280 Q120 295 130 300 M100 280 L100 300"
                    stroke={getSoilColor(stream)}
                    strokeWidth="6"
                    strokeLinecap="round"
                    fill="transparent"
                    animate={{ stroke: getSoilColor(stream) }}
                    transition={{ duration: 1 }}
                />

                {/* Tree Trunk & Branches */}
                <motion.g
                    style={{ originX: "100px", originY: "300px" }}
                    animate={{
                        rotate: [0, swayAmount, 0, -swayAmount, 0],
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: swayDuration,
                        ease: "easeInOut",
                    }}
                >
                    {/* Main Trunk */}
                    <path
                        d="M95 280 C95 200 90 120 100 80 C110 120 105 200 105 280 Z"
                        fill="#5c4033"
                    />
                    {/* Left Branch */}
                    <path
                        d="M95 180 Q60 140 40 120"
                        stroke="#5c4033"
                        strokeWidth="12"
                        strokeLinecap="round"
                        fill="transparent"
                    />
                    {/* Right Branch */}
                    <path
                        d="M105 160 Q130 110 160 90"
                        stroke="#5c4033"
                        strokeWidth="10"
                        strokeLinecap="round"
                        fill="transparent"
                    />

                    {/* Leaves (Grouped to move with trunk) */}
                    <motion.g
                        animate={{ fill: getLeafColor(airtemp) }}
                        transition={{ duration: 1.5 }}
                    >
                        {/* Main Canopy */}
                        <circle cx="100" cy="80" r="45" opacity="0.9" />
                        {/* Left Canopy */}
                        <circle cx="50" cy="110" r="35" opacity="0.85" />
                        {/* Right Canopy */}
                        <circle cx="150" cy="85" r="30" opacity="0.85" />
                        {/* Top Canopy */}
                        <circle cx="100" cy="40" r="30" opacity="0.8" />
                    </motion.g>
                </motion.g>
            </svg>
        </div>
    );
}
