"use client";

import { useMemo, useState } from "react";
import { Activity, Circle, Pause, Play, RotateCcw, Save, Thermometer, Zap } from "lucide-react";

type RoastPoint = {
  seconds: number;
  bt: number;
  et: number;
  ror: number;
};

type RoastEvent = {
  id: string;
  label: string;
  seconds: number;
  bt: number;
};

const quickEvents = ["Carga", "Turning point", "Amarilleo", "1er crack", "Drop"];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function makeSimulatedPoint(seconds: number): RoastPoint {
  const minutes = seconds / 60;
  const chargeDrop = Math.max(0, 185 - minutes * 42);
  const recovery = 82 + Math.pow(Math.max(0, minutes - 1.6), 0.78) * 28;
  const bt = seconds < 96 ? chargeDrop : recovery;
  const et = 198 + minutes * 4.4 + Math.sin(minutes * 1.4) * 2.5;
  const ror = seconds < 96 ? -22 + minutes * 12 : Math.max(4, 24 - minutes * 1.45);
  return {
    seconds,
    bt: Math.round(clamp(bt, 78, 218) * 10) / 10,
    et: Math.round(clamp(et, 175, 248) * 10) / 10,
    ror: Math.round(ror * 10) / 10,
  };
}

function makeInitialCurve() {
  return Array.from({ length: 11 }, (_, index) => makeSimulatedPoint(index * 30));
}

function curvePath(points: RoastPoint[], field: "bt" | "et" | "ror", width: number, height: number, min: number, max: number) {
  if (points.length === 0) return "";
  const duration = Math.max(points[points.length - 1].seconds, 1);
  return points.map((point, index) => {
    const x = 48 + (point.seconds / duration) * (width - 72);
    const y = 20 + (1 - (point[field] - min) / (max - min)) * (height - 52);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function RoastStudioClient() {
  const [points, setPoints] = useState<RoastPoint[]>(makeInitialCurve);
  const [events, setEvents] = useState<RoastEvent[]>([
    { id: "charge", label: "Carga", seconds: 0, bt: 185 },
    { id: "tp", label: "Turning point", seconds: 96, bt: 82 },
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [greenWeight, setGreenWeight] = useState(3);
  const [roastedWeight, setRoastedWeight] = useState(2.55);
  const current = points[points.length - 1];
  const duration = current?.seconds ?? 0;
  const shrinkage = greenWeight > 0 ? ((greenWeight - roastedWeight) / greenWeight) * 100 : 0;

  const phase = useMemo(() => {
    const yellow = events.find((event) => event.label === "Amarilleo");
    const firstCrack = events.find((event) => event.label === "1er crack");
    const drop = events.find((event) => event.label === "Drop");
    if (drop) return "Finalizado";
    if (firstCrack) return "Desarrollo";
    if (yellow) return "Maillard";
    return "Secado";
  }, [events]);

  function tick() {
    setPoints((currentPoints) => {
      const last = currentPoints[currentPoints.length - 1];
      const nextSeconds = (last?.seconds ?? 0) + 15;
      return [...currentPoints, makeSimulatedPoint(nextSeconds)];
    });
  }

  function addEvent(label: string) {
    const point = points[points.length - 1] ?? makeSimulatedPoint(0);
    setEvents((currentEvents) => [
      ...currentEvents.filter((event) => event.label !== label),
      { id: `${label}-${point.seconds}`, label, seconds: point.seconds, bt: point.bt },
    ].sort((a, b) => a.seconds - b.seconds));
  }

  function reset() {
    setIsRunning(false);
    setPoints(makeInitialCurve());
    setEvents([
      { id: "charge", label: "Carga", seconds: 0, bt: 185 },
      { id: "tp", label: "Turning point", seconds: 96, bt: 82 },
    ]);
  }

  const width = 860;
  const height = 360;
  const btPath = curvePath(points, "bt", width, height, 70, 230);
  const etPath = curvePath(points, "et", width, height, 70, 250);
  const rorPath = curvePath(points, "ror", width, height, -30, 35);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-text-secondary">Tiempo</p>
          <p className="mt-2 text-2xl font-mono font-bold text-text-primary">{formatTime(duration)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-text-secondary">BT</p>
          <p className="mt-2 text-2xl font-mono font-bold text-text-primary">{current?.bt.toFixed(1)}°C</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-text-secondary">RoR</p>
          <p className="mt-2 text-2xl font-mono font-bold text-text-primary">{current?.ror.toFixed(1)}°/min</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase text-text-secondary">Fase</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">{phase}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="card overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-border-default">
            <div>
              <p className="text-sm font-semibold text-text-primary">Curva en vivo</p>
              <p className="text-xs text-text-secondary">Modo simulador hasta conectar la Yoshan 3 kg</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-secondary" onClick={() => setIsRunning((value) => !value)}>
                {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isRunning ? "Pausar" : "Iniciar"}
              </button>
              <button type="button" className="btn-secondary" onClick={tick}>
                <Activity className="w-4 h-4" /> +15s
              </button>
              <button type="button" className="btn-ghost" onClick={reset}>
                <RotateCcw className="w-4 h-4" /> Reiniciar
              </button>
            </div>
          </div>
          <div className="p-4 overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] w-full h-[360px]">
              <rect x="0" y="0" width={width} height={height} fill="#FDFAF6" rx="12" />
              {[0, 1, 2, 3, 4].map((line) => {
                const y = 20 + line * ((height - 52) / 4);
                return <line key={line} x1="48" y1={y} x2={width - 24} y2={y} stroke="#E8E0D4" strokeDasharray="4 6" />;
              })}
              {["Secado", "Maillard", "Desarrollo"].map((label, index) => (
                <text key={label} x={72 + index * 190} y="38" fontSize="12" fill="#6B5744" fontWeight="600">{label}</text>
              ))}
              <path d={etPath} fill="none" stroke="#C17B4E" strokeWidth="2" opacity="0.75" />
              <path d={btPath} fill="none" stroke="#2C1810" strokeWidth="3" />
              <path d={rorPath} fill="none" stroke="#4A7C59" strokeWidth="2" strokeDasharray="6 5" />
              {events.map((event) => {
                const x = 48 + (event.seconds / Math.max(duration, 1)) * (width - 72);
                return (
                  <g key={event.id}>
                    <line x1={x} y1="20" x2={x} y2={height - 32} stroke="#111827" strokeDasharray="3 4" opacity="0.28" />
                    <circle cx={x} cy="52" r="5" fill="#123D2B" />
                    <text x={x + 8} y="56" fontSize="11" fill="#123D2B" fontWeight="600">{event.label}</text>
                  </g>
                );
              })}
              <text x="56" y={height - 14} fontSize="11" fill="#6B5744">BT negro · ET naranja · RoR verde</text>
            </svg>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-accent-green" />
              <p className="text-sm font-semibold text-text-primary">Eventos rápidos</p>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {quickEvents.map((label) => (
                <button key={label} type="button" className="btn-secondary justify-start" onClick={() => addEvent(label)}>
                  <Circle className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Thermometer className="w-4 h-4 text-accent-green" />
              <p className="text-sm font-semibold text-text-primary">Lote en revisión</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">Verde kg</label>
                <input type="number" step="0.01" className="input-base font-mono" value={greenWeight} onChange={(event) => setGreenWeight(Number(event.target.value))} />
              </div>
              <div>
                <label className="label-base">Tostado kg</label>
                <input type="number" step="0.01" className="input-base font-mono" value={roastedWeight} onChange={(event) => setRoastedWeight(Number(event.target.value))} />
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-[#F8FAFC] p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Merma</span>
                <span className="font-mono font-semibold">{shrinkage.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-text-secondary">Estado</span>
                <span className="font-semibold text-status-warning">Revisión</span>
              </div>
            </div>
            <button type="button" className="btn-primary w-full justify-center mt-4" disabled>
              <Save className="w-4 h-4" /> Guardar al conectar Yoshan
            </button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border-default">
          <p className="text-sm font-semibold text-text-primary">Eventos del tueste</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-default bg-[#F8FAFC]">
              <th className="text-left px-5 py-3 text-xs font-semibold text-text-secondary">Evento</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">Tiempo</th>
              <th className="text-right px-5 py-3 text-xs font-semibold text-text-secondary">BT</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-b border-border-default last:border-0">
                <td className="px-5 py-3 font-medium text-text-primary">{event.label}</td>
                <td className="px-5 py-3 text-right font-mono">{formatTime(event.seconds)}</td>
                <td className="px-5 py-3 text-right font-mono">{event.bt.toFixed(1)}°C</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
