"use client";

import { useState, useEffect, useRef } from "react";
import TreeVisualizer from "./TreeVisualizer";
import WeatherEffects from "./WeatherEffects";
import { Loader2, Play, Pause, Calendar } from "lucide-react";

interface WeatherData {
    snow_depth_max_mm: number;
    precip_total_mm: number;
    stream_total_mm: number;
    et_mm: number;
    solar_mean_wm2: number;
    windspeed_mean_ms: number;
    airtemp_mean_oC: number;
    rh_pct: number;
    Date: string;
    Hour: number;
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

export default function WeatherVisualizer() {
    const [data, setData] = useState<WeatherData | null>(null);
    const [summary, setSummary] = useState<WeatherSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Controlled Date/Hour
    const [currentDate, setCurrentDate] = useState("2022-01-05");
    const [currentHour, setCurrentHour] = useState(12);
    const [isPlaying, setIsPlaying] = useState(false);
    const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const formatForAPI = (isoDate: string) => {
        const [y, m, d] = isoDate.split("-");
        return `${parseInt(m)}/${parseInt(d)}/${y}`;
    };

    const fetchWeatherData = async (date: string, hour: number) => {
        setLoading(true);
        setError(null);
        try {
            // Fetching from the FastAPI backend running locally
            const apiDate = formatForAPI(date);
            const response = await fetch(`http://127.0.0.1:8000/weather-timeline?date=${apiDate}&hour=${hour}`);
            if (!response.ok) {
                throw new Error("Failed to fetch weather data");
            }
            const rawData = await response.json();
            setData(rawData);
            
            // Fetch summary too
            try {
                const sumRes = await fetch(`http://127.0.0.1:8000/weather-summary?date=${apiDate}&hour=${hour}`);
                if (sumRes.ok) {
                    const sumData = await sumRes.json();
                    setSummary(sumData.summary);
                }
            } catch (e) {
                console.error("Summary fetch failed", e);
            }
        } catch (err) {
            console.error(err);
            setError("Could not load data. Ensure FastAPI is running on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWeatherData(currentDate, currentHour);
    }, [currentDate, currentHour]);

    useEffect(() => {
        if (isPlaying) {
            playIntervalRef.current = setInterval(() => {
                setCurrentHour((prev) => {
                    if (prev >= 23) {
                        // Move to next day
                        const nextDate = new Date(currentDate);
                        nextDate.setDate(nextDate.getDate() + 1);
                        setCurrentDate(nextDate.toISOString().split("T")[0]);
                        return 0;
                    }
                    return prev + 1;
                });
            }, 1000); // 1 second per hour
        } else if (playIntervalRef.current) {
            clearInterval(playIntervalRef.current);
        }
        return () => {
            if (playIntervalRef.current) clearInterval(playIntervalRef.current);
        };
    }, [isPlaying, currentDate]);

    return (
        <div className="wv-container">
            {/* Visualizer Background layer */}
            {data && (
                <>
                    <WeatherEffects
                        precip={data.precip_total_mm}
                        solar={data.solar_mean_wm2}
                        rh={data.rh_pct}
                        airtemp={data.airtemp_mean_oC}
                        snowDepth={data.snow_depth_max_mm}
                        windspeed={data.windspeed_mean_ms}
                        hour={data.Hour}
                    />
                    <TreeVisualizer
                        airtemp={data.airtemp_mean_oC}
                        windspeed={data.windspeed_mean_ms}
                        stream={data.stream_total_mm}
                        snowDepth={data.snow_depth_max_mm}
                        date={data.Date}
                    />
                </>
            )}

            {/* Weather Story Overlay */}
            {summary && (
                <div className="absolute top-8 left-8 z-[100] w-72 flex flex-col gap-4 font-sans drop-shadow-2xl">
                    {summary.severe.length > 0 && (
                        <div className="wv-story-card severe">
                            <h3 className="wv-story-title text-red-300">⚠️ Severe Weather</h3>
                            <div className="wv-story-list">
                                {summary.severe.map(item => (
                                    <div key={item.name} className="wv-story-item">
                                        <span className="wv-story-name">{item.name.replace(/_/g, " ")}</span>
                                        <span className="wv-story-value bg-red-950/50">{item.value.toFixed(1)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {summary.moderate.length > 0 && (
                        <div className="wv-story-card moderate">
                            <h3 className="wv-story-title text-orange-300">Noticeable</h3>
                            <div className="wv-story-list">
                                {summary.moderate.map(item => (
                                    <div key={item.name} className="wv-story-item">
                                        <span className="wv-story-name">{item.name.replace(/_/g, " ")}</span>
                                        <span className="wv-story-value bg-orange-950/50">{item.value.toFixed(1)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {summary.chill.length > 0 && summary.severe.length === 0 && (
                        <div className="wv-story-card chill">
                            <h3 className="wv-story-title text-blue-300">☀️ Calm / Normal</h3>
                            <div className="wv-story-list">
                                {summary.chill.map(item => (
                                    <div key={item.name} className="wv-story-item">
                                        <span className="wv-story-name">{item.name.replace(/_/g, " ")}</span>
                                        <span className="wv-story-value bg-blue-950/50">{item.value.toFixed(1)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Loading overlay */}
            {loading && !data && (
                <div className="wv-loader-overlay">
                    <Loader2 className="wv-loader-icon" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <div className="wv-error-overlay">
                    <div>
                        <h2 className="wv-error-title">Connection Error</h2>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {/* Controls Overlay */}
            <div className="wv-controls-area">
                <div className="wv-controls-panel">
                    <div className="flex flex-col gap-6">
                        <div className="wv-controls-header">
                            <h1 className="wv-controls-title">
                                HUBBARD BROOK <span className="font-bold">VIZ</span>
                            </h1>

                            <div className="text-right">
                                <p className="text-sm font-medium text-white/60">Currently Viewing</p>
                                <div className="wv-date-picker-wrap">
                                    <div className="relative">
                                        <Calendar className="wv-date-icon" />
                                        <input 
                                            type="date" 
                                            value={currentDate}
                                            min="2022-01-01"
                                            max="2022-12-31"
                                            onChange={(e) => setCurrentDate(e.target.value || "2022-01-01")}
                                            className="wv-date-picker-input"
                                            style={{ colorScheme: "dark" }}
                                        />
                                    </div>
                                    <p className="wv-date-text">
                                        @ {currentHour.toString().padStart(2, "0")}:00
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Scrubber / Slider */}
                        <div className="wv-playback-container">
                            <div className="wv-playback-labels">
                                <button 
                                    onClick={() => setIsPlaying(!isPlaying)}
                                    className="wv-playback-btn"
                                >
                                    {isPlaying ? <Pause className="wv-icon-small" /> : <Play className="wv-icon-small" />}
                                    <span className="wv-btn-text">{isPlaying ? "Pause" : "Play"}</span>
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
                                className="wv-slider"
                            />
                        </div>

                        {/* Quick metrics readout */}
                        {data && (
                            <div className="wv-quick-metrics">
                                <div>
                                    <span className="wv-metric-label">Temp</span>
                                    <span className="wv-metric-value">{data.airtemp_mean_oC.toFixed(1)}°C</span>
                                </div>
                                <div>
                                    <span className="wv-metric-label">Wind</span>
                                    <span className="wv-metric-value">{data.windspeed_mean_ms.toFixed(1)}m/s</span>
                                </div>
                                <div>
                                    <span className="wv-metric-label">Precip</span>
                                    <span className="wv-metric-value">{data.precip_total_mm}mm</span>
                                </div>
                                <div>
                                    <span className="wv-metric-label">Solar</span>
                                    <span className="wv-metric-value">{data.solar_mean_wm2}W</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
