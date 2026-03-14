import type { Metadata, Viewport } from "next";
import { Host_Grotesk, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth-context";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import "./globals.css";

const hostGrotesk = Host_Grotesk({
  variable: "--font-host-grotesk",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Canby Track Metrics",
  description: "Record athletic performance metrics in real time",
  manifest: "/manifest.json",
  themeColor: "#141F54",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Track Metrics",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${hostGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased font-secondary`}
      >
        <AuthProvider>
          <StoreProvider>
            <div className="mx-auto w-full max-w-2xl h-full">
              {children}
            </div>
            <PWAInstallPrompt />
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
