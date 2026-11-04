import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/session-provider";

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Piiyaak — Proyecto de preservación de la lengua Nasa Yuwe",
  description:
    "Piiyaak, plataforma para preservar y compartir la lengua Nasa Yuwe del pueblo Nasa (Páez) de Colombia: diccionario bilingüe, juegos y cursos.",
  keywords: [
    "Piiyaak",
    "Nasa Yuwe",
    "Páez",
    "diccionario",
    "lengua indígena",
    "Colombia",
    "bilingüe",
    "indigenous language",
  ],
  icons: {
    icon: "/libro-abierto.png",
    apple: "/icon-192.png",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Piiyaak — Proyecto de preservación de la lengua Nasa Yuwe",
    description:
      "Piiyaak, plataforma para preservar y compartir la lengua Nasa Yuwe del pueblo Nasa de Colombia: diccionario, juegos y cursos.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#2F3E4E",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${sourceSerif.variable} ${inter.variable} font-sans antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster />
        {/* Register service worker for offline app shell */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            var reg = function() {
              navigator.serviceWorker.register('/sw.js').catch(function(err) {
                console.warn('SW registration failed:', err);
              });
            };
            if (document.readyState === 'complete') {
              reg();
            } else {
              window.addEventListener('load', reg, { once: true });
            }
          }
        `}</Script>
      </body>
    </html>
  );
}
