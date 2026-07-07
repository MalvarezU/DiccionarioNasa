import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/session-provider";

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
});

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nasa Yuwe — Diccionario Bilingüe",
  description:
    "Diccionario bilingüe Nasa Yuwe–Español. Preservando y compartiendo la lengua del pueblo Nasa (Páez) de Colombia.",
  keywords: [
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
  },
  openGraph: {
    title: "Nasa Yuwe — Diccionario Bilingüe",
    description:
      "Diccionario bilingüe Nasa Yuwe–Español. Preservando y compartiendo la lengua del pueblo Nasa de Colombia.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${newsreader.variable} ${publicSans.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster />
        {/* Register service worker for offline app shell */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').catch(function(err) {
                console.warn('SW registration failed:', err);
              });
            });
          }
        `}</Script>
      </body>
    </html>
  );
}
