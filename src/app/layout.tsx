import type { Metadata, Viewport } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Track Metrics",
  description: "Record athletic performance metrics in real time",
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
        className={`${geist.variable} ${jetbrainsMono.variable} h-full antialiased font-secondary`}
      >
        <AuthProvider>
          <StoreProvider>{children}</StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
