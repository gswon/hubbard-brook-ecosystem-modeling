"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
    { key: "airtemp",    label: "Temp",     unit: "°C",  decimals: 1 },
    { key: "windspeed",  label: "Wind",     unit: "m/s", decimals: 1 },
    { key: "precip",     label: "Precip",   unit: "mm",  decimals: 2 },
    { key: "solar",      label: "Solar",    unit: "W",   decimals: 0 },
    { key: "rh",         label: "Humidity", unit: "%",   decimals: 0 },
    { key: "pressure",   label: "Pressure", unit: "hPa", decimals: 1 },
    { key: "stream",     label: "Stream",   unit: "mm",  decimals: 3 },
    { key: "snow",       label: "Snow",     unit: "mm",  decimals: 1 },
];

export default function WeatherVisualizer() {
    const [data,      setData]      = useState<WeatherData | null>(null);
    const [summary,   setSummary]   = useState<WeatherSummary | null>(null);
    const [dailyData, setDailyData] = useState<WeatherData[]>([]);
    const [loading,   setLoading]   = useState(true);
    const [error,     setError]     = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>({ start: "2024-01-01", end: "2024-12-31" });

    // Date/Hour controls
    const [currentDate, setCurrentDate] = useState("2024-01-05");
    const [currentHour, setCurrentHour] = useState(12);
    const [isPlaying,   setIsPlaying]   = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Live mode
    const [isLive,        setIsLive]        = useState(false);
    const [lastLiveUpdate, setLastLiveUpdate] = useState<Date | null>(null);
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
            .catch(() => {});
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

    const summaryCardColor = (level: string) => {
        if (level === "severe")   return "bg-red-950/70 border-red-500/40";
        if (level === "moderate") return "bg-orange-950/70 border-orange-500/40";
        return "bg-blue-950/70 border-blue-500/40";
    };
    const summaryTitleColor = (level: string) => {
        if (level === "severe")   return "text-red-300";
        if (level === "moderate") return "text-orange-300";
        return "text-blue-300";
    };
    const summaryIcon = (level: string) => {
        if (level === "severe") return "⚠️";
        if (level === "moderate") return "🌤";
        return "☀️";
    };
    const valuesBg = (level: string) => {
        if (level === "severe")   return "bg-red-950/50";
        if (level === "moderate") return "bg-orange-950/50";
        return "bg-blue-950/50";
    };

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    return (
        <div className="wv-container">
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
                    
                    {/* 2) Tree visualizer layer */}
                    <div className="absolute left-0 top-0 w-full md:w-[60%] h-full z-10 flex items-end justify-center">
                        <TreeVisualizer
                            airtemp={data.airtemp}
                            windspeed={data.windspeed}
                            stream={data.stream}
                            snowDepth={data.snow}
                            date={data.date}
                        />
                    </div>
                </>
            )}

            {/* 3) Foreground UI layer */}
            <div className="relative z-20 w-full h-full flex flex-col md:flex-row items-center justify-end p-6 md:p-12 pointer-events-none">
                
                {/* Right side container for all UI elements */}
                <div className="w-full max-w-[40rem] flex flex-col gap-6 pointer-events-auto h-full justify-center">

                    {/* Alerts Stack (Removed) */}

                    {/* Main glass control panel */}
                    <div className="glass-panel w-full flex flex-col justify-between shadow-2xl relative border border-white/10 p-8 rounded-[2rem]">
                        {/* Title & Live Status */}
                        <div className="flex justify-between items-start mb-8 w-full">
                            <div>
                                <h1 className="text-4xl tracking-widest font-extralight text-slate-100 flex items-center gap-3">
                                    hubbard brook <span className="font-bold tracking-normal opacity-90">viz</span>
                                </h1>
                                <p className="text-xs tracking-wider text-slate-400 mt-2 uppercase">Forest Ecosystem Monitor</p>
                            </div>
                            <div className="flex flex-col items-end gap-2 text-xs">
                                <button onClick={handleLiveToggle} className={`flex items-center gap-2 px-4 py-1.5 rounded-full border transition-all ${isLive ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300" : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"}`}>
                                    {isLive && (
                                        <span className="relative flex h-2 w-2">
                                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                    )}
                                    <span className="font-medium tracking-wider">{isLive ? "LIVE" : "GO LIVE"}</span>
                                </button>
                                {isLive && lastLiveUpdate && (
                                   <span className="text-[10px] text-white/40 uppercase font-mono tracking-wider">
                                       Upd: {lastLiveUpdate.toLocaleTimeString()}
                                   </span>
                                )}
                            </div>
                        </div>

                        {/* Date Picker Component */}
                        <div className="w-full flex justify-end mb-6">
                            {!isLive ? (
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                        <input
                                            type="date"
                                            value={currentDate}
                                            min={dateRange.start}
                                            max={dateRange.end}
                                            onChange={(e) => setCurrentDate(e.target.value || dateRange.start)}
                                            className="w-full bg-white/5 hover:bg-white/10 transition-colors pl-10 pr-4 py-2 text-sm text-slate-200 rounded-lg border border-white/10 focus:outline-none focus:ring-1 focus:ring-teal-500/50"
                                            style={{ colorScheme: "dark" }}
                                        />
                                    </div>
                                    <div className="text-xl font-bold font-mono tracking-tight text-white drop-shadow-md">
                                        @ {currentHour.toString().padStart(2, "0")}:00
                                    </div>
                                </div>
                            ) : data ? (
                                <div className="flex items-center gap-4 text-emerald-400 font-mono">
                                    <span className="font-bold">{data.date}</span>
                                    <span className="text-xl font-bold">@ {data.hour.toString().padStart(2, "0")}:00</span>
                                </div>
                            ) : null}
                        </div>

                        {/* Playback Controls & Timeline */}
                        {!isLive && (
                            <div className="flex flex-col gap-3 mb-8 w-full">
                                <div className="flex items-center justify-between text-xs font-medium text-slate-400 font-mono">
                                    <button
                                        onClick={() => setIsPlaying(!isPlaying)}
                                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 cursor-pointer"
                                        disabled={loading}
                                    >
                                        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                                        <span className="uppercase tracking-widest">{isPlaying ? 'Pause' : 'Play'}</span>
                                    </button>
                                    <span>0:00</span>
                                    <span>12:00</span>
                                    <span>23:00</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="23"
                                    value={currentHour}
                                    onChange={(e) => setCurrentHour(parseInt(e.target.value))}
                                    className="wv-slider mt-2"
                                />
                            </div>
                        )}

                        {/* Environment Metrics Grid */}
                        <div className="grid grid-cols-4 md:grid-cols-8 gap-2 pt-6 border-t border-white/10 relative">
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
                                    <div key={key} className="wv-metric-cell">
                                        <span className="wv-metric-label">{label}</span>
                                        <span className="wv-metric-value mb-1">
                                            {typeof val === "number" ? val.toFixed(decimals) : "—"}
                                            <span className="wv-metric-unit">{unit}</span>
                                        </span>
                                        <svg width="40" height="14" className="opacity-40 mt-auto overflow-visible">
                                            {sparkPath && <path d={sparkPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />}
                                        </svg>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
