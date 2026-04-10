"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState, useMemo } from "react";

interface WeatherEffectsProps {
    precip: number;
    solar: number;
    rh: number;
    airtemp: number;
    snowDepth: number;
    windspeed: number;
    streamflow: number;
    hour: number;
}

// ─── helpers ──────────────────────────────────────────────────────
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function getSkyGradient(solar: number, hour: number, airtemp: number, precip: number): string {
    const isStormy = precip > 1;
    if (isStormy) return "linear-gradient(to bottom, #1c1917, #292524, #44403c)";
    if (solar < 5)  return "linear-gradient(to bottom, #020617, #0f172a, #1e3a5f)";
    if (solar < 50) {
        // dawn/dusk palette based on hour
        return hour < 12
            ? "linear-gradient(to bottom, #0f172a, #7c2d12, #f97316, #fde68a)"
            : "linear-gradient(to bottom, #fde68a, #f97316, #7c2d12, #0f172a)";
    }
    if (solar < 200) return "linear-gradient(to bottom, #1e3a5f, #38bdf8, #bae6fd)";
    if (airtemp < 2) return "linear-gradient(to bottom, #1e3a5f, #60a5fa, #e0f2fe)"; // cold clear
    return "linear-gradient(to bottom, #0ea5e9, #38bdf8, #7dd3fc)"; // warm sunny
}

function getFogOpacity(rh: number, temp: number): number {
    if (rh < 70) return 0;
    if (temp < 2) return clamp((rh - 70) / 20, 0, 0.4); // cold fog
    return clamp((rh - 70) / 15, 0, 0.55);
}

// ─── Realistic Cloud Haze ──────────────────────────────────────────
function useCloudHaze(rh: number, precip: number) {
    return useMemo(() => {
        if (rh < 50 && precip === 0) return [];
        const count = precip > 0 ? 4 : clamp(Math.floor((rh - 40) / 15), 1, 4);
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            y: -10 + Math.random() * 50,  
            w: 80 + Math.random() * 120,   
            h: 40 + Math.random() * 50,    
            opacity: precip > 0 ? 0.35 : 0.15 + (rh / 100) * 0.2,
            speed: 80 + Math.random() * 150, 
            delay: i * -30,
        }));
    }, [Math.round(rh / 20), precip > 0]);
}

// ─── Rain drops ────────────────────────────────────────────────────
function useRainDrops(precip: number, windspeed: number) {
    return useMemo(() => {
        if (precip <= 0) return [];
        const count = clamp(Math.floor(precip * 120), 20, 400);
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: -20 + Math.random() * 140,
            delay: Math.random() * 1.5,
            scale: 0.6 + Math.random() * 1.2,
            speed: 0.25 + Math.random() * 0.2 - windspeed * 0.01,
        }));
    }, [Math.round(precip * 20), Math.round(windspeed)]);
}

// ─── Snow flakes ───────────────────────────────────────────────────
function useSnowFlakes(precip: number, airtemp: number, snowDepth: number) {
    return useMemo(() => {
        // Show snow when precipitating AND either cold enough OR snow is already on the ground
        const shouldSnow = precip > 0 && (airtemp < 2 || snowDepth > 0);
        if (!shouldSnow) return [];
        const count = clamp(Math.floor(precip * 200), 30, 350);
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: Math.random() * 110 - 5,
            delay: Math.random() * 4,
            size: 4 + Math.random() * 10,
            wander: Math.random() * 30 - 15,
            speed: 2.5 + Math.random() * 2.5,
        }));
    }, [Math.round(precip * 30), airtemp < 2, snowDepth > 0]);
}

// ─── Wind streaks ──────────────────────────────────────────────────
function useWindStreaks(windspeed: number) {
    return useMemo(() => {
        if (windspeed < 1.5) return []; // Lower threshold
        const count = clamp(Math.floor(windspeed * 5), 8, 80); // More streaks
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            top: 2 + Math.random() * 95,
            len: 60 + Math.random() * 180, // Longer
            delay: Math.random() * 5,
            speed: clamp(1.2 - windspeed * 0.1, 0.15, 1.2) + Math.random() * 0.2, // Faster
            opacity: 0.12 + Math.random() * 0.2, // Brighter
        }));
    }, [Math.round(windspeed)]);
}

// ─── Wind Flow Curves (Wind UI) ──────────────────────────────────────
function useWindFlow(windspeed: number) {
    return useMemo(() => {
        if (windspeed < 3.5) return [];
        const count = clamp(Math.floor(windspeed * 0.8), 2, 12);
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            top: 15 + Math.random() * 70,
            delay: Math.random() * 6,
            speed: clamp(2.5 - windspeed * 0.12, 0.6, 2.5) + Math.random() * 0.5,
            opacity: 0.1 + (windspeed / 20) * 0.4,
            width: 150 + Math.random() * 200,
        }));
    }, [Math.round(windspeed)]);
}

export default function WeatherEffects({ precip, solar, rh, airtemp, snowDepth, windspeed, streamflow, hour }: WeatherEffectsProps) {
    // Snow when precipitating AND (cold enough OR snow already on the ground)
    const isSnowing = precip > 0 && (airtemp < 2 || snowDepth > 0);
    // Rain only when precipitating AND it's warm AND no snow on the ground
    const isRaining = precip > 0 && airtemp >= 2 && snowDepth <= 0;
    const isStormy  = precip > 2 || (precip > 0.5 && windspeed > 6);
    const isVortex  = windspeed > 12; // extreme wind – vortex
    const isCalm    = windspeed < 1 && solar > 200 && rh < 60;
    const windAngle = clamp(windspeed * 4, 0, 35);

    const cloudHaze  = useCloudHaze(rh, precip);
    const rainDrops  = useRainDrops(isRaining ? precip : 0, windspeed);
    const snowFlakes = useSnowFlakes(precip, airtemp, snowDepth);
    const windStreaks = useWindStreaks(windspeed);
    const windFlow = useWindFlow(windspeed);

    // Celestial body
    const isDay = solar > 20 || (hour >= 6 && hour < 18);
    const celestialProgress = clamp(isDay ? (hour - 6) / 12 : (hour >= 18 ? (hour - 18) / 12 : (hour + 6) / 12), 0, 1);
    const cx = 10 + celestialProgress * 80;
    const cy = 45 - Math.sin(celestialProgress * Math.PI) * 30;

    const sunSize   = isDay ? "8rem" : "5.5rem";
    const sunColor  = isDay ? "#fef08a" : "#e2e8f0";
    const sunGlow   = isDay
        ? `0 0 ${80 + solar / 4}px ${24 + solar / 8}px rgba(253,224,71,${clamp(solar / 300, 0, 1)})`
        : "0 0 30px 8px rgba(200,220,255,0.3)";

    return (
        <div className="we-container overflow-hidden">

            {/* ── Sky ─────────────────────────────────────────────── */}
            <motion.div
                className="absolute inset-0"
                animate={{ background: getSkyGradient(solar, hour, airtemp, precip) }}
                transition={{ duration: 2 }}
            />

            {/* ── Storm overlay ────────────────────────────────────── */}
            <AnimatePresence>
                {isStormy && (
                    <motion.div
                        className="absolute inset-0 pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(30,15,5,0.7) 0%, transparent 80%)" }}
                    />
                )}
            </AnimatePresence>

            {/* ── Fog / mist ─────────────────────────────────────── */}
            <motion.div
                className="absolute inset-0 bg-white pointer-events-none"
                animate={{ opacity: getFogOpacity(rh, airtemp) }}
                transition={{ duration: 3 }}
            />

            {/* ── Realistic Cloud Haze ───────────────────────────── */}
            {cloudHaze.map(c => (
                <motion.div
                    key={`haze-${c.id}`}
                    className="absolute rounded-[100%] pointer-events-none blur-[80px]"
                    style={{ 
                        top: `${c.y}vh`, width: `${c.w}vw`, height: `${c.h}vh`, 
                        background: isStormy ? "#27272a" : (isDay ? "#f8fafc" : "#475569"),
                        opacity: c.opacity 
                    }}
                    initial={{ left: "-60vw" }}
                    animate={{ left: ["-60vw", "120vw"] }}
                    transition={{ repeat: Infinity, duration: c.speed, delay: c.delay, ease: "linear" }}
                />
            ))}

            {/* ── Sun / Moon ─────────────────────────────────────── */}
            <motion.div
                className="absolute rounded-full flex items-center justify-center z-0 pointer-events-none"
                style={{ left: `calc(${cx}vw - 4rem)`, top: `calc(${cy}vh - 4rem)` }}
                animate={{ width: sunSize, height: sunSize, backgroundColor: sunColor, boxShadow: sunGlow }}
                transition={{ duration: 1.5, type: "spring", bounce: 0 }}
            >
                {/* Sun rays – calm sunny day */}
                {isCalm && isDay && solar > 150 && (
                    <motion.div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    >
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div
                                key={i}
                                className="absolute top-1/2 left-1/2 origin-left pointer-events-none"
                                style={{
                                    width: `${40 + solar / 15}px`, height: "2px",
                                    background: "linear-gradient(to right, rgba(253,224,71,0.8), transparent)",
                                    transform: `rotate(${i * 45}deg) translateY(-50%)`,
                                    borderRadius: "999px",
                                }}
                            />
                        ))}
                    </motion.div>
                )}

                {/* Sun lens flare pulse */}
                {isDay && solar > 100 && (
                    <motion.div
                        className="absolute inset-[-150%] rounded-full pointer-events-none"
                        style={{ background: "radial-gradient(circle, rgba(253,224,71,0.5) 0%, transparent 70%)", filter: "blur(18px)" }}
                        animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
                        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                    />
                )}
            </motion.div>

            {/* ── Lightning flash (heavy storm) ─────────────────────── */}
            <AnimatePresence>
                {isStormy && (
                    <motion.div
                        className="absolute inset-0 bg-white pointer-events-none"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.25, 0, 0.1, 0] }}
                        transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 4 + Math.random() * 6, ease: "easeOut" }}
                    />
                )}
            </AnimatePresence>

            {/* ── Wind streaks ─────────────────────────────────────── */}
            {windStreaks.map(w => (
                <motion.div
                    key={`ws-${w.id}`}
                    className="absolute pointer-events-none"
                    style={{
                        top: `${w.top}vh`, left: "-15vw",
                        width: w.len, height: "1.5px",
                        background: "linear-gradient(to right, transparent, rgba(255,255,255,0.8), transparent)",
                        filter: "blur(0.5px)",
                        opacity: w.opacity,
                    }}
                    animate={{ x: ["-15vw", "130vw"], opacity: [0, w.opacity, 0] }}
                    transition={{ repeat: Infinity, duration: w.speed, delay: w.delay, ease: "linear" }}
                />
            ))}

            {/* ── Wind Flow (Curved UI paths) ─────────────────────── */}
            {windFlow.map(wf => (
                <motion.div
                    key={`wf-${wf.id}`}
                    className="absolute pointer-events-none overflow-visible"
                    style={{ top: `${wf.top}vh`, left: "-20vw", width: wf.width, height: 100 }}
                    animate={{ x: ["-20vw", "130vw"], opacity: [0, wf.opacity, wf.opacity, 0] }}
                    transition={{ repeat: Infinity, duration: wf.speed, delay: wf.delay, ease: "linear" }}
                >
                    <svg viewBox="0 0 300 100" fill="none" className="w-full h-full">
                        <path 
                            d="M0,50 Q75,20 150,50 T300,50" 
                            stroke="white" 
                            strokeWidth="1.5" 
                            strokeOpacity={0.6}
                            strokeDasharray="10 20"
                        />
                    </svg>
                </motion.div>
            ))}

            {/* ── Vortex / dust devil (extreme wind) ───────────────── */}
            <AnimatePresence>
                {isVortex && (
                    <motion.div
                        key="vortex"
                        className="absolute pointer-events-none"
                        style={{ bottom: "20vh", left: "60vw", width: 120, height: 300 }}
                        initial={{ opacity: 0, scaleX: 0 }}
                        animate={{ opacity: 1, scaleX: 1 }}
                        exit={{ opacity: 0, scaleX: 0 }}
                    >
                        {Array.from({ length: 12 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute"
                                style={{
                                    width: 3 + (i / 12) * 8,
                                    height: 3 + (i / 12) * 8,
                                    borderRadius: "50%",
                                    background: "rgba(200,180,140,0.7)",
                                    left: "50%",
                                    top: `${i * 22}px`,
                                }}
                                animate={{
                                    x: [0, (i % 2 === 0 ? 40 : -40) * (i / 6), 0],
                                    rotate: [0, 360],
                                    opacity: [0.8, 0.3, 0.8],
                                }}
                                transition={{ repeat: Infinity, duration: 0.8 + i * 0.1, ease: "linear" }}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Rain ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {isRaining && rainDrops.map(p => (
                    <motion.div
                        key={`rain-${p.id}`}
                        className="absolute pointer-events-none"
                        style={{
                            left: `${p.x}vw`, top: "-5vh",
                            width: precip > 3 ? "2.5px" : "1.5px",
                            height: precip > 3 ? "70px" : "40px",
                            background: "linear-gradient(to bottom, transparent, rgba(147,210,255,0.85))",
                            rotate: `${windAngle}deg`,
                            scale: p.scale,
                        }}
                        animate={{ y: ["0vh", "115vh"] }}
                        transition={{ repeat: Infinity, duration: clamp(p.speed, 0.2, 0.9), delay: p.delay, ease: "linear" }}
                    />
                ))}
            </AnimatePresence>

            {/* ── Snow ─────────────────────────────────────────────── */}
            <AnimatePresence>
                {isSnowing && snowFlakes.map(f => (
                    <motion.div
                        key={`snow-${f.id}`}
                        className="absolute rounded-full pointer-events-none"
                        style={{
                            left: `${f.x}vw`, top: "-3vh",
                            width: f.size, height: f.size,
                            background: "radial-gradient(circle, white 40%, rgba(255,255,255,0.3))",
                            filter: "blur(0.5px)",
                            boxShadow: "0 0 4px 1px rgba(255,255,255,0.5)",
                        }}
                        animate={{
                            y: ["0vh", "110vh"],
                            x: [`${f.x}vw`, `${f.x + f.wander + windspeed * 4}vw`],
                        }}
                        transition={{ repeat: Infinity, duration: f.speed, delay: f.delay, ease: "linear" }}
                    />
                ))}
            </AnimatePresence>

            {/* ── Ground snow shimmer ──────────────────────────────── */}
            <AnimatePresence>
                {snowDepth > 20 && (
                    <motion.div
                        className="absolute bottom-0 left-0 right-0 pointer-events-none"
                        style={{ height: "18vh", background: "linear-gradient(to top, rgba(240,249,255,0.95), transparent)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 2 }}
                    />
                )}
            </AnimatePresence>

            {/* ── Rain puddle ripples (bottom) ─────────────────────── */}
            <AnimatePresence>
                {precip > 0.5 && !isSnowing && (
                    <motion.div className="absolute bottom-0 left-0 right-0 h-12 pointer-events-none overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute rounded-full border border-blue-300/40"
                                style={{ left: `${15 + i * 18}vw`, bottom: 8, width: 20, height: 8 }}
                                animate={{ scaleX: [0.3, 3], scaleY: [0.3, 2], opacity: [0.6, 0] }}
                                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.3, ease: "easeOut" }}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Elegant Stream Flow ────────────────────────────────── */}
            <AnimatePresence>
                {streamflow > 0.01 && (
                    <motion.div 
                        className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden" 
                        style={{ height: `${clamp(streamflow * 50 + 20, 20, 150)}px` }}
                        initial={{ opacity: 0, y: 50 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: 50 }}
                        transition={{ duration: 2 }}
                    >
                        <div className="relative w-[300vw] h-full" style={{ background: "linear-gradient(to top, rgba(14,165,233,0.3), transparent)" }}>
                            {[...Array(3)].map((_, i) => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0"
                                    style={{
                                        borderTop: "1px solid rgba(56,189,248,0.4)",
                                        transform: `translateY(${i * 6}px)`,
                                        filter: "blur(0.5px)",
                                    }}
                                    animate={{
                                        x: ["0vw", "-100vw"]
                                    }}
                                    transition={{
                                        repeat: Infinity,
                                        duration: clamp(20 / streamflow, 3, 25) + i * 2,
                                        ease: "linear"
                                    }}
                                >
                                    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" className="w-full h-full opacity-60">
                                        <path d="M0,50 Q125,70 250,50 T500,50 T750,50 T1000,50" fill="none" stroke="rgba(186,230,253,0.6)" strokeWidth="1.5" />
                                        <path d="M0,50 Q125,30 250,50 T500,50 T750,50 T1000,50" fill="none" stroke="rgba(186,230,253,0.4)" strokeWidth="1" />
                                    </svg>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
