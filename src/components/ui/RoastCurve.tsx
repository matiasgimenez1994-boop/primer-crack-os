"use client";

interface RoastCurveProps {
  chargeTemp?: number;
  totalTime?: number;
  turningPointTime?: number;
  turningPointTemp?: number;
  yellowingTime?: number;
  yellowingTemp?: number;
  firstCrackTime?: number;
  developmentTime?: number;
  endTemp?: number;
  className?: string;
  height?: number;
  showLabels?: boolean;
}

const PHASE_COLORS = {
  drying:      "#6B7C5C",  // verde oliva — secado
  maillard:    "#C17B4E",  // terracota — maillard
  development: "#B04A3A",  // rojo oscuro — desarrollo
};

export function RoastCurve({
  chargeTemp = 200,
  totalTime = 0,
  turningPointTime,
  turningPointTemp,
  yellowingTime,
  yellowingTemp,
  firstCrackTime,
  developmentTime,
  endTemp,
  className = "",
  height = 140,
  showLabels = true,
}: RoastCurveProps) {
  if (!totalTime || totalTime <= 0) {
    return (
      <div className={`flex items-center justify-center bg-[#FDFAF6] rounded-xl border border-border-default ${className}`}
        style={{ height }}>
        <p className="text-xs text-text-secondary">Ingresá los tiempos para ver la curva</p>
      </div>
    );
  }

  const W = 320;
  const H = height;
  const padL = 32; const padR = 12; const padT = 16; const padB = showLabels ? 28 : 12;
  const cW = W - padL - padR;
  const cH = H - padT - padB;

  // Construir puntos de la curva con física real del tueste
  const tp_t = turningPointTime ?? totalTime * 0.12;
  const tp_temp = turningPointTemp ?? chargeTemp - 25;
  const y_t = yellowingTime ?? totalTime * 0.38;
  const y_temp = yellowingTemp ?? chargeTemp + 15;
  const fc_t = firstCrackTime ?? totalTime * 0.78;
  const fc_temp = chargeTemp + 45;
  const dev_start = firstCrackTime ? firstCrackTime : totalTime * 0.78;
  const end_temp = endTemp ?? chargeTemp + 58;

  const pts = [
    { t: 0,          temp: chargeTemp,  label: "Carga",      color: "#6B7C5C",  phase: "drying" },
    { t: tp_t,       temp: tp_temp,     label: "P. Inflexión", color: "#4A7C59", phase: "drying" },
    { t: y_t,        temp: y_temp,      label: "Amarilleo",  color: "#C17B4E",  phase: "maillard" },
    { t: fc_t,       temp: fc_temp,     label: "1er Crack",  color: "#B04A3A",  phase: "development" },
    { t: totalTime,  temp: end_temp,    label: "Fin",        color: "#8B2020",  phase: "development" },
  ];

  const allTemps = pts.map(p => p.temp);
  const minT = Math.min(...allTemps) - 5;
  const maxT = Math.max(...allTemps) + 10;
  const tRange = maxT - minT;

  const toX = (t: number) => padL + (t / totalTime) * cW;
  const toY = (temp: number) => padT + cH - ((temp - minT) / tRange) * cH;

  // Path suavizado con bezier
  const pathD = pts.reduce((acc, p, i) => {
    const x = toX(p.t); const y = toY(p.temp);
    if (i === 0) return `M ${x} ${y}`;
    const prev = pts[i - 1];
    const px = toX(prev.t); const py = toY(prev.t === 0 ? prev.temp : prev.temp);
    const cpx = (px + x) / 2;
    return `${acc} C ${cpx} ${py}, ${cpx} ${y}, ${x} ${y}`;
  }, "");

  // Zonas de fase
  const yellowX = toX(y_t);
  const firstCrackX = toX(fc_t);
  const endX = toX(totalTime);

  return (
    <div className={`bg-[#FDFAF6] rounded-xl border border-border-default overflow-hidden ${className}`}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height }} className="block">
        {/* Zonas de fase */}
        {/* Secado */}
        <rect x={padL} y={padT} width={yellowX - padL} height={cH}
          fill={PHASE_COLORS.drying} opacity="0.06" />
        {/* Maillard */}
        <rect x={yellowX} y={padT} width={firstCrackX - yellowX} height={cH}
          fill={PHASE_COLORS.maillard} opacity="0.07" />
        {/* Desarrollo */}
        <rect x={firstCrackX} y={padT} width={endX - firstCrackX} height={cH}
          fill={PHASE_COLORS.development} opacity="0.08" />

        {/* Líneas de fase */}
        <line x1={yellowX} y1={padT} x2={yellowX} y2={padT + cH}
          stroke={PHASE_COLORS.maillard} strokeWidth="1" strokeDasharray="3,2" opacity="0.4" />
        <line x1={firstCrackX} y1={padT} x2={firstCrackX} y2={padT + cH}
          stroke={PHASE_COLORS.development} strokeWidth="1.2" strokeDasharray="3,2" opacity="0.5" />

        {/* Labels de fase */}
        {showLabels && (
          <>
            <text x={padL + 4} y={padT + 10} fontSize="7" fill={PHASE_COLORS.drying} opacity="0.7" fontWeight="600">SECADO</text>
            <text x={yellowX + 4} y={padT + 10} fontSize="7" fill={PHASE_COLORS.maillard} opacity="0.7" fontWeight="600">MAILLARD</text>
            <text x={firstCrackX + 4} y={padT + 10} fontSize="7" fill={PHASE_COLORS.development} opacity="0.7" fontWeight="600">DESARROLLO</text>
          </>
        )}

        {/* Eje Y - temp labels */}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => {
          const temp = Math.round(minT + frac * tRange);
          const y = toY(temp);
          return (
            <g key={frac}>
              <line x1={padL - 3} y1={y} x2={padL} y2={y} stroke="#E8E0D4" strokeWidth="0.5" />
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E8E0D4" strokeWidth="0.5" strokeDasharray="2,3" />
              <text x={padL - 4} y={y + 3} fontSize="7" fill="#6B5744" textAnchor="end" opacity="0.7">{temp}</text>
            </g>
          );
        })}

        {/* Eje X - tiempo */}
        {showLabels && [0, 0.25, 0.5, 0.75, 1].map(frac => {
          const t = frac * totalTime;
          const x = toX(t);
          return (
            <g key={frac}>
              <text x={x} y={H - 4} fontSize="7" fill="#6B5744" textAnchor="middle" opacity="0.7">
                {t.toFixed(1)}'
              </text>
            </g>
          );
        })}

        {/* Curva principal */}
        <path d={pathD} stroke="#2C1810" strokeWidth="2.2" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Puntos de evento */}
        {pts.map((p, i) => {
          const x = toX(p.t); const y = toY(p.temp);
          const isKey = i > 0;
          return (
            <g key={i}>
              {isKey && (
                <circle cx={x} cy={y} r={i === pts.length - 1 ? 4.5 : 3.5}
                  fill={p.color} stroke="white" strokeWidth="1.5" />
              )}
              {isKey && showLabels && (
                <text x={x} y={y - 7} fontSize="7" fill={p.color} textAnchor="middle" fontWeight="600">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Punto de carga */}
        <circle cx={toX(0)} cy={toY(chargeTemp)} r="3.5"
          fill="#6B7C5C" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* Leyenda de etapas */}
      {showLabels && (
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border-default bg-white/50">
          {[
            { color: PHASE_COLORS.drying, label: "Secado" },
            { color: PHASE_COLORS.maillard, label: "Maillard" },
            { color: PHASE_COLORS.development, label: "Desarrollo" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
              <span className="text-xs text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
