import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import { StoreProvider } from "@/lib/store";
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
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
