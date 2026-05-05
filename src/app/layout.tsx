import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Beulrock - Game Server Hub & Whitelist Manager",
  description: "Professional game server management platform with whitelist system, script executor, and real-time analytics for Roblox games.",
  keywords: ["Beulrock", "Roblox", "Game Server", "Whitelist", "Script Executor", "SaaS", "Game Management"],
  authors: [{ name: "Beulrock Team" }],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "Beulrock - Game Server Hub",
    description: "Professional game server management platform for Roblox",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Beulrock - Game Server Hub",
    description: "Professional game server management platform for Roblox",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
