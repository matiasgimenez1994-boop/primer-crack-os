import type { Metadata } from"next";
import"./globals.css";
import { Toaster } from"sonner";

export const metadata: Metadata = {
  title:"Primer crack OS · Para tostadores de especialidad",
  description:"Gestión de inventario, tuestes y rentabilidad para tostadores de café de especialidad.",
  manifest:"/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle:"black-translucent",
    title:"Primer crack OS",
  },
  viewport: {
    width:"device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    apple:"/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (<html lang="es">
      <body>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background:"#2C1810",
              color:"#FDFAF6",
              border:"1px solid rgba(255,255,255,0.1)",
              fontSize:"13px",
            },
          }}
        />
      </body>
    </html>);
}
