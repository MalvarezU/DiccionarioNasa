import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { SessionProvider } from "@/components/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    icon: "/favicon.ico",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <SessionProvider>
          {children}
        </SessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
