const BCU_QUOTES_URL =
  "https://www.bcu.gub.uy/Estadisticas-e-Indicadores/Paginas/Cotizaciones.aspx";

// Último cierre conocido. Solo se usa si el BCU no responde temporalmente.
const FALLBACK_USD_UYU_RATE = 40.143;

export interface ExchangeRate {
  usdUyu: number;
  date: string | null;
  fallback: boolean;
}

export async function getBcuUsdUyuRate(): Promise<ExchangeRate> {
  try {
    const response = await fetch(BCU_QUOTES_URL, {
      next: { revalidate: 60 * 60 * 6 },
    });
    if (!response.ok) throw new Error(`BCU respondió ${response.status}`);

    const html = await response.text();
    const normalized = html.replace(/&nbsp;/gi, " ").replace(/\s+/g, " ");
    const match = normalized.match(
      /DLS\.\s*USA\s*BILLETE[\s\S]{0,1200}?(\d{2}\/\d{2}\/\d{4})[\s\S]{0,600}?(\d{1,3},\d{2,4})/i,
    );
    if (!match) throw new Error("No se encontró la cotización del dólar");

    const usdUyu = Number(match[2].replace(",", "."));
    if (!Number.isFinite(usdUyu) || usdUyu <= 0) {
      throw new Error("Cotización inválida");
    }

    return { usdUyu, date: match[1], fallback: false };
  } catch {
    return { usdUyu: FALLBACK_USD_UYU_RATE, date: null, fallback: true };
  }
}

export function convertUsdUyu(
  amount: number,
  from: string,
  to: "USD" | "UYU",
  usdUyu: number,
) {
  const source = from === "UYU" ? "UYU" : "USD";
  if (source === to) return amount;
  return source === "USD" ? amount * usdUyu : amount / usdUyu;
}
