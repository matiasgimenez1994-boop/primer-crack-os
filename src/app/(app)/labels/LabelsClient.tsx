"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Tag, Settings2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ROAST_LEVEL_LABELS } from "@/lib/costs";
import type { RoastBatch } from "@/types";

interface Props {
  roasterName: string;
  batches: RoastBatch[];
  currency: string;
}

const SIZE_OPTIONS = [
  { id: "small",  label: "Pequeña",  w: 60,  h: 40,  desc: "60í—40mm" },
  { id: "medium", label: "Mediana",  w: 80,  h: 55,  desc: "80í—55mm" },
  { id: "large",  label: "Grande",   w: 100, h: 70,  desc: "100í—70mm" },
  { id: "tall",   label: "Alta",     w: 60,  h: 90,  desc: "60í—90mm" },
];

const WEIGHT_OPTIONS = [100, 200, 250, 500, 1000];

export function LabelsClient({ roasterName, batches, currency }: Props) {
  const [selectedBatch, setSelectedBatch] = useState<RoastBatch | null>(null);
  const [size, setSize] = useState("medium");
  const [weight, setWeight] = useState(250);
  const [copies, setCopies] = useState(1);
  const [showQR, setShowQR] = useState(true);
  const [showScore, setShowScore] = useState(true);
  const [showTasting, setShowTasting] = useState(true);
  const [showRoastDate, setShowRoastDate] = useState(true);
  const [showOrigin, setShowOrigin] = useState(true);
  const [customTagline, setCustomTagline] = useState("");
  const [labelColor, setLabelColor] = useState<"light" | "dark">("light");

  const sizeConfig = SIZE_OPTIONS.find(s => s.id === size) ?? SIZE_OPTIONS[1];
  const coffee = selectedBatch ? (selectedBatch as any).green_coffees : null;

  function handlePrint() {
    window.print();
  }

  const labelUrl = typeof window !== "undefined"
    ? `${window.location.origin}`
    : "";

  return (
    <div>
      <div className="page-header">
        <h1 className="text-xl font-semibold text-text-primary">Etiquetas para bolsas</h1>
        {selectedBatch && (
          <button onClick={handlePrint} className="btn-primary">
            <Printer className="w-4 h-4" /> Imprimir etiquetas
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel de configuración */}
        <div className="lg:col-span-1 flex flex-col gap-5 no-print">

          {/* Seleccionar tueste */}
          <div className="card p-5">
            <p className="section-title">1 · Seleccioná el tueste</p>
            <select
              className="input-base"
              value={selectedBatch?.id ?? ""}
              onChange={e => {
                const b = batches.find(b => b.id === e.target.value);
                setSelectedBatch(b ?? null);
              }}
            >
              <option value="">Seleccionar tueste...</option>
              {batches.map((b: RoastBatch) => (
                <option key={b.id} value={b.id}>
                  {(b as any).green_coffees?.name} · {formatDate(b.roast_date)}
                </option>
              ))}
            </select>
          </div>

          {/* Tamaño y presentación */}
          <div className="card p-5 flex flex-col gap-4">
            <p className="section-title">2 · Tamaño y presentación</p>

            <div>
              <label className="label-base">Tamaño de etiqueta</label>
              <div className="grid grid-cols-2 gap-2">
                {SIZE_OPTIONS.map(s => (
                  <button key={s.id} type="button"
                    onClick={() => setSize(s.id)}
                    className={`p-2.5 rounded-lg border-2 text-left transition-colors ${
                      size === s.id ? "border-accent-green bg-[#FDF5EE]" : "border-border-default hover:border-accent-green/30"
                    }`}
                  >
                    <p className="text-xs font-semibold text-text-primary">{s.label}</p>
                    <p className="text-xs text-text-secondary">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-base">Peso / presentación</label>
              <div className="flex flex-wrap gap-2">
                {WEIGHT_OPTIONS.map(w => (
                  <button key={w} type="button"
                    onClick={() => setWeight(w)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                      weight === w ? "border-accent-green bg-[#FDF5EE] text-accent-green" : "border-border-default text-text-secondary"
                    }`}
                  >
                    {w < 1000 ? `${w}g` : `${w/1000}kg`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="label-base">Color de etiqueta</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setLabelColor("light")}
                  className={`flex-1 p-2 rounded-lg border-2 text-xs font-medium transition-colors ${labelColor === "light" ? "border-accent-green" : "border-border-default"}`}>
                  <div className="w-full h-6 rounded bg-[#FDFAF6] border border-border-default mb-1" />
                  Clara
                </button>
                <button type="button" onClick={() => setLabelColor("dark")}
                  className={`flex-1 p-2 rounded-lg border-2 text-xs font-medium transition-colors ${labelColor === "dark" ? "border-accent-green" : "border-border-default"}`}>
                  <div className="w-full h-6 rounded bg-brand-dark mb-1" />
                  Oscura
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="label-base">Cantidad de copias</label>
                <input type="number" min="1" max="50" className="input-base font-mono w-20"
                  value={copies} onChange={e => setCopies(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
            </div>
          </div>

          {/* Opciones de contenido */}
          <div className="card p-5 flex flex-col gap-3">
            <p className="section-title">3 · Contenido</p>
            {[
              { key: "showOrigin", label: "Origen y productor", value: showOrigin, set: setShowOrigin },
              { key: "showTasting", label: "Notas de cata", value: showTasting, set: setShowTasting },
              { key: "showScore", label: "Puntaje Q", value: showScore, set: setShowScore },
              { key: "showRoastDate", label: "Fecha de tueste", value: showRoastDate, set: setShowRoastDate },
              { key: "showQR", label: "Código QR", value: showQR, set: setShowQR },
            ].map(({ key, label, value, set }) => (
              <label key={key} className="flex items-center justify-between cursor-pointer">
                <span className="text-sm text-text-primary">{label}</span>
                <div className={`w-10 h-5 rounded-full transition-colors relative ${value ? "bg-accent-green" : "bg-border-default"}`}
                  onClick={() => set(!value)}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
              </label>
            ))}

            <div className="pt-2 border-t border-border-default">
              <label className="label-base">Frase personalizada (opcional)</label>
              <input type="text" className="input-base text-xs"
                placeholder="Tostado artesanalmente · Montevideo"
                value={customTagline}
                onChange={e => setCustomTagline(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Preview de etiqueta */}
        <div className="lg:col-span-2">
          {!selectedBatch ? (
            <div className="card flex items-center justify-center" style={{ minHeight: 300 }}>
              <div className="text-center">
                <Tag className="w-10 h-10 text-border-default mx-auto mb-3" />
                <p className="text-sm text-text-secondary">Seleccioná un tueste para ver la etiqueta</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Preview en pantalla */}
              <div className="card p-6 mb-4 no-print">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-text-primary">Preview</p>
                  <p className="text-xs text-text-secondary">{sizeConfig.desc} · {copies} copia{copies > 1 ? "s" : ""}</p>
                </div>
                <div className="flex justify-center">
                  <LabelPreview
                    roasterName={roasterName}
                    batch={selectedBatch}
                    coffee={coffee}
                    weight={weight}
                    sizeConfig={sizeConfig}
                    showQR={showQR}
                    showScore={showScore}
                    showTasting={showTasting}
                    showRoastDate={showRoastDate}
                    showOrigin={showOrigin}
                    customTagline={customTagline}
                    labelColor={labelColor}
                    labelUrl={labelUrl}
                    scale={2}
                  />
                </div>
              </div>

              {/* Botón imprimir */}
              <div className="no-print">
                <button onClick={handlePrint}
                  className="btn-primary w-full justify-center text-sm py-3">
                  <Printer className="w-4 h-4" />
                  Imprimir {copies} etiqueta{copies > 1 ? "s" : ""}
                </button>
                <p className="text-xs text-text-secondary text-center mt-2">
                  Se abrirá el diálogo de impresión del navegador
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zona de impresión â€” solo visible al imprimir */}
      {selectedBatch && (
        <div className="print-only">
          <div className="print-labels-grid">
            {Array.from({ length: copies }).map((_, i) => (
              <LabelPreview
                key={i}
                roasterName={roasterName}
                batch={selectedBatch}
                coffee={coffee}
                weight={weight}
                sizeConfig={sizeConfig}
                showQR={showQR}
                showScore={showScore}
                showTasting={showTasting}
                showRoastDate={showRoastDate}
                showOrigin={showOrigin}
                customTagline={customTagline}
                labelColor={labelColor}
                labelUrl={labelUrl}
                scale={1}
                forPrint
              />
            ))}
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-only, .print-only * { visibility: visible; }
          .print-only { position: fixed; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-labels-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 4mm;
            padding: 8mm;
          }
        }
        @media screen {
          .print-only { display: none; }
        }
      `}</style>
    </div>
  );
}

interface LabelPreviewProps {
  roasterName: string;
  batch: RoastBatch;
  coffee: any;
  weight: number;
  sizeConfig: typeof SIZE_OPTIONS[0];
  showQR: boolean;
  showScore: boolean;
  showTasting: boolean;
  showRoastDate: boolean;
  showOrigin: boolean;
  customTagline: string;
  labelColor: "light" | "dark";
  labelUrl: string;
  scale?: number;
  forPrint?: boolean;
}

function LabelPreview({
  roasterName, batch, coffee, weight, sizeConfig,
  showQR, showScore, showTasting, showRoastDate, showOrigin,
  customTagline, labelColor, labelUrl, scale = 1, forPrint = false,
}: LabelPreviewProps) {
  const isDark = labelColor === "dark";
  const W = sizeConfig.w * scale * 3.78; // mm to px aprox
  const H = sizeConfig.h * scale * 3.78;

  const weightLabel = weight >= 1000 ? `${weight / 1000} kg` : `${weight} g`;

  const qrValue = `${labelUrl}/share/${batch.id}` ;

  return (
    <div
      style={{
        width: forPrint ? `${sizeConfig.w}mm` : W,
        height: forPrint ? `${sizeConfig.h}mm` : H,
        backgroundColor: isDark ? "#2C1810" : "#FDFAF6",
        border: isDark ? "none" : "1px solid #E8E0D4",
        borderRadius: forPrint ? 2 : 8,
        padding: forPrint ? "3mm" : 12,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "Inter, system-ui, sans-serif",
        color: isDark ? "#FDFAF6" : "#1C1208",
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Borde decorativo izquierdo */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: forPrint ? "2mm" : 6,
        backgroundColor: "#C17B4E",
        borderRadius: "2px 0 0 2px",
      }} />

      <div style={{ paddingLeft: forPrint ? "3mm" : 10, flex: 1, display: "flex", flexDirection: "column", gap: forPrint ? "1mm" : 4 }}>
        {/* Tostadería */}
        <p style={{
          fontSize: forPrint ? "6pt" : 9,
          color: isDark ? "#C17B4E" : "#C17B4E",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 1,
        }}>
          {roasterName}
        </p>

        {/* Nombre del café */}
        <p style={{
          fontSize: forPrint ? "9pt" : 14,
          fontWeight: 700,
          color: isDark ? "#FDFAF6" : "#1C1208",
          lineHeight: 1.2,
        }}>
          {coffee?.name ?? "Café"}
        </p>

        {/* Origen */}
        {showOrigin && coffee?.origin_country && (
          <p style={{ fontSize: forPrint ? "7pt" : 10, color: isDark ? "#E8D5C4" : "#6B5744" }}>
            {coffee.origin_country}
            {coffee.farm_producer ? ` · ${coffee.farm_producer}` : ""}
          </p>
        )}

        {/* Variedad y proceso */}
        {(coffee?.variety || coffee?.process) && (
          <p style={{ fontSize: forPrint ? "6.5pt" : 9, color: isDark ? "#BBA99A" : "#6B5744" }}>
            {[coffee.variety, coffee.process].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* Nivel de tueste */}
        {batch.roast_level && (
          <p style={{
            fontSize: forPrint ? "6.5pt" : 9,
            color: "#C17B4E",
            fontWeight: 600,
          }}>
            {ROAST_LEVEL_LABELS[batch.roast_level]}
          </p>
        )}

        {/* Puntaje */}
        {showScore && coffee?.score && (
          <p style={{ fontSize: forPrint ? "6pt" : 9, color: isDark ? "#BBA99A" : "#6B5744" }}>
            Q Score: {coffee.score}
          </p>
        )}

        {/* Notas de cata */}
        {showTasting && coffee?.tasting_notes && (
          <p style={{
            fontSize: forPrint ? "6pt" : 8.5,
            color: isDark ? "#BBA99A" : "#6B5744",
            fontStyle: "italic",
            lineHeight: 1.3,
          }}>
            {coffee.tasting_notes.length > 60
              ? coffee.tasting_notes.slice(0, 57) + "..."
              : coffee.tasting_notes}
          </p>
        )}
      </div>

      {/* Footer */}
      <div style={{
        paddingLeft: forPrint ? "3mm" : 10,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 6,
        marginTop: forPrint ? "1mm" : 4,
      }}>
        <div style={{ flex: 1 }}>
          {/* Peso */}
          <div style={{
            display: "inline-block",
            backgroundColor: "#C17B4E",
            color: "#FFFFFF",
            padding: forPrint ? "0.5mm 2mm" : "2px 6px",
            borderRadius: 3,
            fontSize: forPrint ? "8pt" : 12,
            fontWeight: 700,
            marginBottom: forPrint ? "1mm" : 4,
          }}>
            {weightLabel}
          </div>

          {/* Fecha */}
          {showRoastDate && (
            <p style={{ fontSize: forPrint ? "5.5pt" : 8, color: isDark ? "#BBA99A" : "#6B5744" }}>
              Tostado: {formatDate(batch.roast_date)}
            </p>
          )}

          {/* Tagline */}
          {customTagline && (
            <p style={{ fontSize: forPrint ? "5.5pt" : 8, color: isDark ? "#BBA99A" : "#6B5744", marginTop: 2 }}>
              {customTagline}
            </p>
          )}
        </div>

        {/* QR */}
        {showQR && (
          <div style={{ flexShrink: 0 }}>
            <QRCodeSVG
              value={qrValue}
              size={forPrint ? 28 : 44}
              bgColor="transparent"
              fgColor={isDark ? "#FDFAF6" : "#2C1810"}
              level="M"
            />
          </div>
        )}
      </div>
    </div>
  );
}

