"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface WeatherEffectsProps {
    precip: number; // mm
    solar: number; // W/m2
    rh: number; // %
    airtemp: number; // oC
    snowDepth: number; // mm
    windspeed: number; // m/s
    hour: number; // 0-23
}

export default function WeatherEffects({ precip, solar, rh, airtemp, windspeed, hour }: WeatherEffectsProps) {
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number; scale: number }[]>([]);
    const [windLines, setWindLines] = useState<{ id: number; top: number; delay: number; duration: number }[]>([]);

    useEffect(() => {
        if (precip <= 0) {
            setParticles([]);
            return;
        }

        const particleCount = Math.min(Math.floor(precip * 80), 300); // Increased density
        const newParticles = Array.from({ length: particleCount }).map((_, i) => ({
            id: i,
            x: Math.random() * 140 - 20, // Start very off-screen for heavy wind
            y: Math.random() * -100,
            delay: Math.random() * 2,
            scale: 0.5 + Math.random() * 1.5, // Much larger variance for vividness
        }));
        setParticles(newParticles);
    }, [precip]);

    useEffect(() => {
        if (windspeed < 2) {
            setWindLines([]);
            return;
        }

        const lineCount = Math.min(Math.floor(windspeed * 3), 30);
        const newWindLines = Array.from({ length: lineCount }).map((_, i) => ({
            id: i,
            top: Math.random() * 80 + 10, 
            delay: Math.random() * 5,
            duration: Math.max(0.2, 1.5 - windspeed * 0.1) + Math.random() * 0.5, // Faster lines
        }));
        setWindLines(newWindLines);
    }, [windspeed]);

    const getSkyColor = (solarRad: number) => {
        if (solarRad < 10) return "linear-gradient(to bottom, #020617, #0f172a, #1e293b)"; // Night
        if (solarRad < 100) return "linear-gradient(to bottom, #1e293b, #475569, #cbd5e1)"; // Dawn/Dusk
        if (solarRad < 300) return "linear-gradient(to bottom, #38bdf8, #bae6fd, #e0f2fe)"; // Light blue
        return "linear-gradient(to bottom, #0ea5e9, #38bdf8, #7dd3fc)"; // Bright vivid blue
    };

    const getFogOpacity = (humidity: number) => {
        if (humidity < 60) return 0;
        if (humidity < 80) return 0.25;
        return 0.55;
    };

    const precipitationLevel = precip;
    const isSnowing = precipitationLevel > 0 && airtemp <= 0;
    const windAngle = windspeed * 2.5;

    // Celestial Body Trajectory Logic
    const isDay = solar > 20 || (hour >= 6 && hour < 18);
    let celestialProgress = 0;
    if (isDay) {
        // Sweeps 0 to 1 between 6 AM and 6 PM
        celestialProgress = Math.max(0, Math.min(1, (hour - 6) / 12));
    } else {
        // Sweeps 0 to 1 between 6 PM and 6 AM
        celestialProgress = Math.max(0, Math.min(1, hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12));
    }
    
    // arc from left to right (10vw to 90vw)
    const cx = 10 + celestialProgress * 80;
    // Parabola peaking at 15vh (noon/midnight), dropping to 45vh at horizon (6am/6pm)
    const cy = 45 - Math.sin(celestialProgress * Math.PI) * 30; 

    return (
        <div className="we-container overflow-hidden">
            {/* Sky Background */}
            <motion.div
                className="we-layer absolute inset-0"
                animate={{ background: getSkyColor(solar) }}
                transition={{ duration: 1.5 }}
            />

            {/* Fog Overlay */}
            <motion.div
                className="we-fog pointer-events-none absolute inset-0 bg-white"
                animate={{ opacity: getFogOpacity(rh) }}
                transition={{ duration: 2 }}
            />

            {/* Majestic Celestial Trajectory (Sun/Moon) */}
            <motion.div
                className="absolute shadow-[0_0_50px_rgba(255,255,255,0.2)] rounded-full flex items-center justify-center z-0"
                style={{
                    left: `calc(${cx}vw - 4rem)`,
                    top: `calc(${cy}vh - 4rem)`,
                }}
                animate={{
                    width: isDay ? "8rem" : "6rem",
                    height: isDay ? "8rem" : "6rem",
                    backgroundColor: isDay ? "#fef08a" : "#e2e8f0", 
                    opacity: isDay ? 1 : 0.85,
                    boxShadow: isDay 
                        ? `0 0 ${80 + (solar/5)}px ${20 + (solar/10)}px rgba(253, 224, 71, ${Math.min(1, solar/200)})` 
                        : "0 0 40px 10px rgba(255, 255, 255, 0.4)",
                }}
                transition={{ duration: 1.5, type: "spring", bounce: 0 }}
            >
                {/* Intense Sun Lens Flare / Glow */}
                {isDay && solar > 100 && (
                    <motion.div
                        className="absolute inset-[-150%] rounded-full opacity-60 pointer-events-none"
                        style={{
                            background: "radial-gradient(circle, rgba(253,224,71,0.7) 0%, rgba(253,224,71,0) 70%)",
                            filter: "blur(20px)"
                        }}
                        animate={{
                            scale: [1, 1.25, 1],
                            opacity: [0.6, 0.9, 0.6],
                        }}
                        transition={{
                            duration: 5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                    />
                )}
            </motion.div>

            {/* Wind Lines */}
            {windLines.map((line) => (
                <motion.div
                    key={`line-${line.id}`}
                    className="absolute h-[1px] bg-white w-48 blur-[1px]"
                    style={{ top: `${line.top}vh`, left: "-20vw", opacity: 0.3 }}
                    animate={{ x: ["-20vw", "120vw"], opacity: [0, 0.4, 0] }}
                    transition={{
                        repeat: Infinity,
                        duration: line.duration,
                        delay: line.delay,
                        ease: "linear",
                    }}
                />
            ))}

            {/* Vivid Rain/Snow Particles */}
            {particles.map((p) => {
                const snowDuration = 2 + Math.random() * 2 - (windspeed * 0.1);
                const rainDuration = Math.max(0.3, 0.6 + Math.random() * 0.3 - (windspeed * 0.05));
                const windOffset = windspeed * 5;

                return (
                    <motion.div
                        key={`particle-${p.id}`}
                        className={`absolute pointer-events-none ${isSnowing ? "" : "bg-gradient-to-b from-blue-100/50 to-blue-300/90"}`}
                        style={isSnowing ? {
                            left: `${p.x}vw`,
                            top: `${p.y}vh`,
                            width: `${12 * p.scale}px`,
                            height: `${12 * p.scale}px`,
                            backgroundColor: "white",
                            borderRadius: "50%",
                            filter: "blur(1px)",
                            boxShadow: "0 0 10px 3px rgba(255,255,255,0.8)"
                        } : {
                            left: `${p.x}vw`,
                            top: `${p.y}vh`,
                            width: precipitationLevel > 5 ? "4px" : "2px",
                            height: precipitationLevel > 2 ? "80px" : "40px",
                            rotate: `${windAngle}deg`,
                            opacity: 0.8 + Math.random() * 0.2
                        }}
                        animate={{
                            y: ["0vh", "120vh"],
                            x: isSnowing 
                                ? [`${p.x}vw`, `${p.x + windOffset + (Math.random() * 20 - 10)}vw`] 
                                : [`${p.x}vw`, `${p.x + windOffset}vw`]
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: isSnowing ? Math.max(1, snowDuration) : rainDuration,
                            delay: p.delay,
                            ease: "linear",
                        }}
                    />
                );
            })}
        </div>
    );
}
