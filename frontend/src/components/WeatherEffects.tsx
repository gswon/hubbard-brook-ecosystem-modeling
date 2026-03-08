"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WeatherEffectsProps {
    precip: number; // mm
    solar: number; // W/m2
    rh: number; // %
}

export default function WeatherEffects({ precip, solar, rh }: WeatherEffectsProps) {
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

    // 1. Generate Rain Particles based on precipitation
    useEffect(() => {
        if (precip <= 0) {
            setParticles([]);
            return;
        }

        // Rough calc: 0.1mm = fine rain, 1mm = steady rain, 5mm = heavy rain
        const particleCount = Math.min(Math.floor(precip * 50), 150); // Max 150 particles for perf

        const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            x: Math.random() * 100, // 0-100vw
            y: Math.random() * -100, // start above screen
            delay: Math.random() * 2, // stagger start times
        }));

        setParticles(newParticles);
    }, [precip]);

    // 2. Solar to Sky Color (Background Brightness)
    // Max recorded in dataset ~500-1000 W/m2 for bright sum
    const getSkyColor = (solarRad: number) => {
        if (solarRad < 10) return "linear-gradient(to bottom, #0f172a, #1e293b)"; // Night
        if (solarRad < 100) return "linear-gradient(to bottom, #334155, #64748b)"; // Dawn/Dusk/Cloudy
        if (solarRad < 300) return "linear-gradient(to bottom, #7dd3fc, #bae6fd)"; // Light blue
        return "linear-gradient(to bottom, #38bdf8, #7dd3fc)"; // Bright blue
    };

    // 3. Relative Humidity -> Fog/Mist Overlay
    // High humidity = opaque white overlay
    const getFogOpacity = (humidity: number) => {
        if (humidity < 60) return 0;
        if (humidity < 80) return 0.2;
        return 0.4;
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* Sky Background */}
            <motion.div
                className="absolute inset-0"
                animate={{ background: getSkyColor(solar) }}
                transition={{ duration: 2 }}
            />

            {/* Fog Overlay */}
            <motion.div
                className="absolute inset-0 bg-white"
                animate={{ opacity: getFogOpacity(rh) }}
                transition={{ duration: 2 }}
            />

            {/* Rain Particles */}
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute w-[2px] rounded-full bg-blue-400/60"
                    style={{
                        left: `${p.x}vw`,
                        top: `${p.y}vh`,
                        height: precip > 2 ? "40px" : "20px", // heavy rain = longer drops
                    }}
                    animate={{
                        y: ["0vh", "120vh"], // fall past the screen
                    }}
                    transition={{
                        repeat: Infinity,
                        duration: 0.8 + Math.random() * 0.4,
                        delay: p.delay,
                        ease: "linear",
                    }}
                />
            ))}

            {/* Sun/Moon Indicator (Optional visual flair) */}
            <motion.div
                className="absolute right-10 top-10 h-16 w-16 rounded-full"
                animate={{
                    backgroundColor: solar > 50 ? "#fef08a" : "#cbd5e1", // Yellow sun vs Gray moon
                    boxShadow: solar > 50 ? "0 0 40px 10px rgba(253, 224, 71, 0.4)" : "0 0 20px 2px rgba(255, 255, 255, 0.1)",
                }}
                transition={{ duration: 2 }}
            />
        </div>
    );
}
