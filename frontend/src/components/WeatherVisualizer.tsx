"use client";
import { motion, AnimatePresence } from "framer-motion";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import TreeVisualizer from "./TreeVisualizer";
import WeatherEffects from "./WeatherEffects";
import { Loader2, Play, Pause, Calendar, Radio, RefreshCw, Wind, Thermometer, Droplets, Sun } from "lucide-react";

// Column aliases returned by the new backend
interface WeatherData {
    airtemp: number;
    windspeed: number;
    precip: number;
    solar: number;
    rh: number;
    snow: number;
    stream: number;
    et: number;
    pressure: number;
    streamflow: number;
    soil: number;
    wind_dir: number;
    date: string;
    hour: number;
    date_full: string;
}

interface WeatherMetric {
    name: string;
    raw_column: string;
    value: number;
    score: number;
}

interface WeatherSummary {
    severe: WeatherMetric[];
    moderate: WeatherMetric[];
    chill: WeatherMetric[];
}

const API = "http://127.0.0.1:8000";
const LIVE_POLL_MS = 60 * 60 * 1000; // 1 hour

interface DateRange {
    start: string;
    end: string;
}

const METRIC_DISPLAY: { key: keyof WeatherData; label: string; unit: string; decimals: number }[] = [
    { key: "airtemp", label: "Temp", unit: "°C", decimals: 1 },
    { key: "windspeed", label: "Wind", unit: "m/s", decimals: 1 },
    { key: "precip", label: "Precip", unit: "mm", decimals: 2 },
    { key: "solar", label: "Solar", unit: "W", decimals: 0 },
    { key: "rh", label: "Humidity", unit: "%", decimals: 0 },
    { key: "pressure", label: "Pressure", unit: "hPa", decimals: 1 },
    { key: "stream", label: "Stream", unit: "mm", decimals: 3 },
    { key: "snow", label: "Snow", unit: "mm", decimals: 1 },
];

// ------------------------------------------------------------------
// Sub-components to prevent glitches (remounting)
// ------------------------------------------------------------------
interface DetailModalProps {
    selectedMetric: string;
    data: WeatherData | null;
    dailyData: WeatherData[];
    activeIndex: number | null;
    setActiveIndex: (idx: number | null) => void;
    hoveredIndex: number | null;
    setHoveredIndex: (idx: number | null) => void;
    onClose: () => void;
}

function DetailModal({ 
    selectedMetric, data, dailyData, activeIndex, setActiveIndex, hoveredIndex, setHoveredIndex, onClose 
}: DetailModalProps) {
    const config = METRIC_DISPLAY.find(m => m.key === selectedMetric);
    if (!config || !data) return null;

    const values = dailyData.map(d => d[config.key] as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    // Use internal chart dimensions
    const chartWidth = 600;
    const chartHeight = 200;
    const padding = 40;
    const innerW = chartWidth - padding * 2;
    const innerH = chartHeight - padding * 2;

    // Memoize points to handle data updates without flickering
    const points = useMemo(() => {
        return values.map((v, i) => {
            const x = padding + (i / (values.length - 1)) * innerW;
            const y = padding + innerH - ((v - min) / range) * innerH;
            return { x, y, val: v };
        });
    }, [values, min, max, range, innerW, innerH]);

    const path = `M${points[0].x},${points[0].y} ` + points.slice(1).map(p => `L${p.x},${p.y}`).join(" ");
    const areaPath = `${path} L${points[points.length - 1].x},${chartHeight - padding} L${points[0].x},${chartHeight - padding} Z`;

    const activePoint = activeIndex !== null ? points[activeIndex] : null;

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-xl pointer-events-auto"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="glass-panel w-full max-w-4xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl relative"
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-8 text-white/40 hover:text-white transition-colors p-2 z-[110]"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <div className="mb-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-2xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                            {config.key === 'airtemp' ? <Thermometer className="w-5 h-5 text-teal-400" /> :
                             config.key === 'windspeed' ? <Wind className="w-5 h-5 text-teal-400" /> :
                             config.key === 'precip' ? <Droplets className="w-5 h-5 text-teal-400" /> :
                             <Sun className="w-5 h-5 text-teal-400" />}
                        </div>
                        <h2 className="text-3xl font-light tracking-tight text-white">{config.label} <span className="text-white/30">Trends</span></h2>
                    </div>
                    <p className="text-sm text-white/40 tracking-wider font-mono">24-HOUR ANALYSIS • {data.date}</p>
                </div>

                <div className="grid grid-cols-3 gap-6 mb-10">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Current</div>
                        <div className="text-2xl font-mono text-white">{(data[config.key] as number).toFixed(config.decimals)}{config.unit}</div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Peak</div>
                        <div className="text-2xl font-mono text-emerald-400">{max.toFixed(config.decimals)}{config.unit}</div>
                    </div>
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                        <div className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Low</div>
                        <div className="text-2xl font-mono text-teal-400">{min.toFixed(config.decimals)}{config.unit}</div>
                    </div>
                </div>

                <div className="relative w-full aspect-[3/1] bg-black/20 rounded-3xl border border-white/5 overflow-hidden group">
                    <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full">
                        <defs>
                            <linearGradient id="modalChartGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.3" />
                                <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                            </linearGradient>
                        </defs>
                        {[0, 0.25, 0.5, 0.75, 1].map(f => (
                            <line key={f} x1={padding} y1={padding + innerH * f} x2={chartWidth - padding} y2={padding + innerH * f} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                        ))}
                        <path d={areaPath} fill="url(#modalChartGrad)" />
                        <path d={path} fill="none" stroke="#2dd4bf" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                        <AnimatePresence>
                            {hoveredIndex !== null && points[hoveredIndex] && (
                                <motion.line
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    x1={points[hoveredIndex].x} y1={padding} x2={points[hoveredIndex].x} y2={chartHeight - padding}
                                    stroke="rgba(45, 212, 191, 0.3)" strokeWidth="1" strokeDasharray="4 4"
                                />
                            )}
                        </AnimatePresence>

                        {points.map((p, i) => (
                            <g key={i}>
                                <rect
                                    x={p.x - innerW / 48} y={padding}
                                    width={innerW / 24} height={innerH}
                                    fill="transparent"
                                    onMouseEnter={() => setHoveredIndex(i)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => setActiveIndex(i === activeIndex ? null : i)}
                                    className="cursor-pointer"
                                />
                                <motion.circle
                                    cx={p.x} cy={p.y}
                                    animate={{ 
                                        r: i === activeIndex ? 6 : i === hoveredIndex ? 4 : 0,
                                        fill: i === activeIndex ? "#2dd4bf" : "white",
                                        stroke: "#2dd4bf",
                                        strokeWidth: i === activeIndex ? 4 : 2
                                    }}
                                    className="pointer-events-none"
                                />
                            </g>
                        ))}
                    </svg>

                    <AnimatePresence>
                        {activePoint && (
                            <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                style={{ 
                                    position: 'absolute',
                                    left: `${(activePoint.x / chartWidth) * 100}%`,
                                    top: `${(activePoint.y / chartHeight) * 100}%`,
                                    transform: 'translate(-50%, -130%)'
                                }}
                                className="bg-slate-900/90 border border-teal-500/50 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-xl pointer-events-none z-50 whitespace-nowrap"
                            >
                                <div className="text-[10px] text-teal-400 font-mono font-bold">{activeIndex}:00</div>
                                <div className="text-sm font-mono text-white">
                                    {activePoint.val.toFixed(config.decimals)}
                                    <span className="text-[10px] ml-1 opacity-60">{config.unit}</span>
                                </div>
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900/90 border-r border-b border-teal-500/50 rotate-45" />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="absolute bottom-4 left-[40px] right-[40px] flex justify-between text-[10px] text-white/20 font-mono tracking-widest">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>23:00</span>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

export default function WeatherVisualizer() {
    const [data, setData] = useState<WeatherData | null>(null);
    const [summary, setSummary] = useState<WeatherSummary | null>(null);
    const [dailyData, setDailyData] = useState<WeatherData[]>([]);
    const [loading, setLoading] = useState(true);
    const [narration, setNarration] = useState<string | null>(null);
    const [narrationLoading, setNarrationLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ start: "2024-01-01", end: "2024-12-31" });

    // Date/Hour controls
    const [currentDate, setCurrentDate] = useState("2024-01-05");
    const [currentHour, setCurrentHour] = useState(12);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isNarrationOpen, setIsNarrationOpen] = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Live mode
    const [isLive, setIsLive] = useState(false);
    const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
    const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const liveIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // ------------------------------------------------------------------
    // Fetch helpers
    // ------------------------------------------------------------------
    const fetchTimeline = useCallback(async (date: string, hour: number) => {
        setLoading(true);
        setError(null);
        try {
            const [tlRes, sumRes] = await Promise.all([
                fetch(`${API}/weather-timeline?date=${date}&hour=${hour}`),
                fetch(`${API}/weather-summary?date=${date}&hour=${hour}`),
            ]);
            if (tlRes.status === 404) {
                // No data for this timestamp — silently skip if we already have data
                setLoading(false);
                return;
            }
            if (!tlRes.ok) throw new Error("Failed to fetch timeline data");
            setData(await tlRes.json());
            if (sumRes.ok) setSummary((await sumRes.json()).summary);
        } catch (err) {
            console.error(err);
            setError("Could not connect to backend. Make sure FastAPI is running on port 8000.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchNarration = useCallback(async () => {
        if (!currentDate) return;
        setIsPlaying(false); // Auto-pause on request
        setNarrationLoading(true);
        try {
            const narRes = await fetch(`${API}/weather-narration?date=${currentDate}&hour=${currentHour}`);
            if (narRes.ok) {
                const narData = await narRes.json();
                setNarration(narData.narration);
            } else {
                setNarration("The forest is silent for this period... (No analysis available)");
            }
        } catch (err) {
            console.error("Narration fetch failed", err);
            setNarration("Could not reach the AI ecosystem analyzer.");
        } finally {
            setNarrationLoading(false);
        }
    }, [currentDate, currentHour]);

    const fetchLive = useCallback(async () => {
        setError(null);
        try {
            const res = await fetch(`${API}/latest-data`);
            if (!res.ok) throw new Error("Live fetch failed");
            const liveData: WeatherData = await res.json();
            setData(liveData);
            setCurrentDate(liveData.date);
            setCurrentHour(liveData.hour);
            setLastLiveUpdate(new Date());
            // Also fetch summary for the live row
            const sumRes = await fetch(`${API}/weather-summary?date=${liveData.date}&hour=${liveData.hour}`);
            if (sumRes.ok) setSummary((await sumRes.json()).summary);
        } catch (err) {
            console.error(err);
            setError("Could not load live data.");
        }
    }, []);

    // ------------------------------------------------------------------
    // Effects
    // ------------------------------------------------------------------

    // Load date range from API on mount
    useEffect(() => {
        fetch(`${API}/date-range`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) { setDateRange(d); setCurrentDate(d.start); } })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (!isLive) fetchTimeline(currentDate, currentHour);
    }, [currentDate, currentHour, isLive, fetchTimeline]);

    // Load daily metric trace when date changes (for manual)
    useEffect(() => {
        if (currentDate) {
            fetch(`${API}/weather-day?date=${currentDate}`)
                .then(r => r.ok ? r.json() : [])
                .then(d => setDailyData(d))
                .catch(err => console.error(err));
        }
    }, [currentDate]);

    // Time-lapse playback
    useEffect(() => {
        if (isLive) {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
            return;
        }
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setCurrentHour((prev) => {
                    if (prev >= 23) {
                        const next = new Date(currentDate);
                        next.setDate(next.getDate() + 1);
                        setCurrentDate(next.toISOString().split("T")[0]);
                        return 0;
                    }
                    return prev + 1;
                });
            }, 3000); // 3 seconds per hour
        } else if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
        }
        return () => { if (playIntervalRef.current) clearInterval(playIntervalRef.current); };
    }, [isPlaying, currentDate, isLive]);

    // Live polling every hour
    useEffect(() => {
        if (isLive) {
            setIsPlaying(false);
            fetchLive();
            liveIntervalRef.current = setInterval(fetchLive, LIVE_POLL_MS);
        } else {
            if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
        }
        return () => { if (liveIntervalRef.current) clearInterval(liveIntervalRef.current); };
    }, [isLive, fetchLive]);

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------
    const handleLiveToggle = () => setIsLive((v) => !v);

    return (
        <div className="wv-container">
            <AnimatePresence>
                {selectedMetric && (
                    <DetailModal 
                        selectedMetric={selectedMetric}
                        data={data}
                        dailyData={dailyData}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                        hoveredIndex={hoveredIndex}
                        setHoveredIndex={setHoveredIndex}
                        onClose={() => { setSelectedMetric(null); setActiveIndex(null); setHoveredIndex(null); }}
                    />
                )}
            </AnimatePresence>

            {/* Background layers */}
            {data && (
                <>
                    <WeatherEffects
                        precip={data.precip}
                        solar={data.solar}
                        rh={data.rh}
                        airtemp={data.airtemp}
                        snowDepth={data.snow}
                        windspeed={data.windspeed}
                        streamflow={data.streamflow || 0}
                        hour={data.hour}
                    />

                    {/* 2) Tree visualizer layer - Full width for seamless ground */}
                    <div className="absolute inset-0 z-10 flex items-end justify-start pointer-events-none">
                        <TreeVisualizer
                            airtemp={data.airtemp}
                            windspeed={data.windspeed}
                            stream={data.stream}
                            snowDepth={data.snow}
                            date={data.date}
                            hour={data.hour}
                        />
                    </div>
                </>
            )}

            {/* 3) Foreground UI layer - Anchored to absolute bottom-right */}
            <div className="absolute inset-0 z-20 flex items-end justify-end p-6 md:p-10 pointer-events-none">

                {/* Right side container for all UI elements - Compact and Bottom-Right aligned */}
                <div className="w-full max-w-[38rem] flex flex-col gap-4 pointer-events-auto">

                    {/* AI Narration Card */}
                    <AnimatePresence mode="wait">
                        {isNarrationOpen && (
                            <motion.div
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="glass-panel w-full border border-white/10 p-5 rounded-[1.5rem] shadow-2xl relative overflow-hidden group mb-2"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-teal-500/50" />
                                <div className="flex items-start gap-4">
                                    <div className="mt-1 flex-shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                                            <Radio className={`w-4 h-4 text-teal-300 ${narrationLoading ? 'animate-pulse' : ''}`} />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-[10px] tracking-[0.2em] text-teal-400 font-bold uppercase">AI Ecosystem Observation</span>
                                            {narrationLoading && <div className="text-[10px] text-white/40 italic flex items-center gap-1"><RefreshCw className="w-2 h-2 animate-spin" /> Decoding forest whispers...</div>}
                                            <button 
                                                onClick={() => setIsNarrationOpen(false)}
                                                className="text-white/20 hover:text-white/60 transition-colors"
                                            >
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </button>
                                        </div>

                                        {!narration && !narrationLoading ? (
                                            <div className="py-4 flex flex-col items-center gap-4">
                                                <p className="text-sm text-white/40 text-center italic">Observing the silent woods. Would you like an AI analysis of this moment?</p>
                                                <button
                                                    onClick={fetchNarration}
                                                    className="px-6 py-2.5 rounded-full bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/40 text-teal-300 text-xs font-bold tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(20,184,166,0.1)] hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] active:scale-95"
                                                >
                                                    Get Current Weather Observation
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="text-sm md:text-base text-slate-200 leading-relaxed font-light italic">
                                                {narrationLoading ? (
                                                    <span className="opacity-40">Connecting to the forest network...</span>
                                                ) : (
                                                    <div className="flex flex-col gap-4">
                                                        <span>{narration}</span>
                                                        <button
                                                            onClick={fetchNarration}
                                                            className="self-end text-[10px] text-teal-400/60 hover:text-teal-400 uppercase tracking-widest flex items-center gap-1 transition-colors"
                                                        >
                                                            <RefreshCw className="w-3 h-3" /> Update Observation
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Main glass control panel */}
                    <div className="glass-panel w-full flex flex-col justify-between shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative border border-white/10 p-6 rounded-[2rem] overflow-hidden">
                        {/* Subtle inner glow backdrop for premium feel */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-teal-500/10 blur-[80px] pointer-events-none" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-emerald-500/10 blur-[80px] pointer-events-none" />
                        {/* Title & Live Status */}
                        <div className="flex justify-between items-start mb-8 w-full">
                            <div>
                                <h1 className="text-3xl tracking-widest font-extralight text-slate-100 flex items-center gap-3">
                                    hubbard brook <span className="font-bold tracking-normal opacity-90">viz</span>
                                </h1>
                                <p className="text-[10px] tracking-[0.2em] text-white/40 mt-1 uppercase">Forest Ecosystem Monitor</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-xs">
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => {
                                            const next = !isNarrationOpen;
                                            setIsNarrationOpen(next);
                                            if (next) setIsPlaying(false); // Pause if opening observer
                                        }} 
                                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isNarrationOpen ? "bg-teal-500/20 border-teal-500/50 text-teal-300" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}
                                        title="AI Narration"
                                    >
                                        <Radio className={`w-3.5 h-3.5 ${isNarrationOpen ? 'animate-pulse' : ''}`} />
                                        <span className="font-medium tracking-wider">{isNarrationOpen ? "HIDE AI" : "AI OBSERVER"}</span>
                                    </button>
                                    <button onClick={handleLiveToggle} className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isLive ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}>
                                        {isLive && (
                                            <span className="relative flex h-2 w-2">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                            </span>
                                        )}
                                        <span className="font-medium tracking-wider">{isLive ? "LIVE" : "GO LIVE"}</span>
                                    </button>
                                </div>
                                {isLive && lastLiveUpdate && (
                                    <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider">
                                        Upd: {lastLiveUpdate.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Date Picker & Time Indicator */}
                        <div className="w-full flex justify-between items-center mb-4 px-1">
                            {!isLive ? (
                                <>
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
                                        <input
                                            type="date"
                                            value={currentDate}
                                            min={dateRange.start}
                                            max={dateRange.end}
                                            onChange={(e) => {
                                                setCurrentDate(e.target.value || dateRange.start);
                                                setIsPlaying(false);
                                            }}
                                            className="bg-white/5 hover:bg-white/10 transition-colors pl-9 pr-3 py-1.5 text-xs text-slate-200 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                                            style={{ colorScheme: "dark" }}
                                        />
                                    </div>
                                    <div className="text-lg font-bold font-mono tracking-tight text-white drop-shadow-md">
                                        {currentHour.toString().padStart(2, "0")}:00
                                    </div>
                                </>
                            ) : data ? (
                                <div className="flex w-full justify-between items-center text-emerald-400 font-mono text-sm">
                                    <span className="font-bold">{data.date}</span>
                                    <span className="text-lg font-bold">{data.hour.toString().padStart(2, "0")}:00</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Playback Controls & Timeline */}
                        {!isLive && (
                            <div className="flex items-center gap-6 mb-10 w-full px-1">
                                <motion.button
                                    whileHover={{ scale: 1.05, backgroundColor: "rgba(255,255,255,0.15)" }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => {
                                        const nextPlaying = !isPlaying;
                                        setIsPlaying(nextPlaying);
                                        if (nextPlaying) setIsNarrationOpen(false); // Auto-hide observer on play
                                    }}
                                    className="flex items-center justify-center gap-2.5 px-5 py-2 rounded-full bg-white/10 text-white border border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.05)] cursor-pointer min-w-[7rem] h-10 backdrop-blur-md transition-shadow hover:shadow-[0_0_20px_rgba(20,184,166,0.3)] group"
                                    disabled={loading}
                                >
                                    <div className="flex items-center justify-center w-5 h-5 rounded-full bg-teal-500/20 group-hover:bg-teal-500/40 transition-colors">
                                        {isPlaying ? <Pause className="w-3 h-3 text-teal-300" /> : <Play className="w-3 h-3 text-teal-300 fill-teal-300" />}
                                    </div>
                                    <span className="uppercase tracking-[0.15em] text-[10px] font-bold">
                                        {isPlaying ? 'Pause' : 'Play'}
                                    </span>
                                </motion.button>

                                <div className="flex-1 flex flex-col gap-2">
                                    <div className="flex justify-between text-[10px] font-medium text-white/30 font-mono px-0.5">
                                        <span>0:00</span>
                                        <span>06:00</span>
                                        <span>12:00</span>
                                        <span>18:00</span>
                                        <span>23:00</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="23"
                                        value={currentHour}
                                        onChange={(e) => setCurrentHour(parseInt(e.target.value))}
                                        className="wv-slider w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Environment Metrics Grid */}
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 md:gap-3 pt-6 border-t border-white/10 relative px-1">
                            {isLive && (
                                <button
                                    onClick={fetchLive}
                                    className="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1 bg-slate-800 text-[10px] uppercase tracking-widest text-slate-300 rounded-full border border-white/10 hover:bg-slate-700 transition-colors"
                                >
                                    <RefreshCw className="h-3 w-3" /> Refresh
                                </button>
                            )}
                            {data && METRIC_DISPLAY.map(({ key, label, unit, decimals }) => {
                                const val = data[key] as number;

                                // Prepare sparkline SVG path
                                let sparkPath = "";
                                let isFlat = true;
                                if (dailyData.length > 0) {
                                    const values = dailyData.map((d: WeatherData) => d[key] as number);
                                    const min = Math.min(...values);
                                    const max = Math.max(...values);
                                    const range = max - min;
                                    isFlat = range === 0;
                                    const pts = values.map((v: number, i: number) => {
                                        const x = (i / (values.length - 1)) * 40;
                                        const y = isFlat ? 7 : 14 - ((v - min) / range) * 14;
                                        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
                                    });
                                    sparkPath = pts.join(" ");
                                }

                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedMetric(key as string)}
                                        className="wv-metric-cell text-left hover:bg-white/10 hover:scale-[1.03] active:scale-[0.98] transition-all cursor-pointer group"
                                    >
                                        <span className="wv-metric-label group-hover:text-teal-300 transition-colors">{label}</span>
                                        <span className="wv-metric-value mb-1">
                                            {typeof val === "number" ? val.toFixed(decimals) : "—"}
                                            <span className="wv-metric-unit">{unit}</span>
                                        </span>
                                        <svg width="40" height="14" className="opacity-40 group-hover:opacity-100 transition-opacity mt-auto overflow-visible">
                                            {sparkPath && <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                                        </svg>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
