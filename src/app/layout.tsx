import type { Metadata } from "next";
import { Cinzel, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sherlock AI — The game is afoot",
  description:
    "An immersive AI detective experience. Build your case, interrogate suspects, and solve the mystery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} h-full antialiased dark`}
    >
      <body className="min-h-full bg-[#060608] text-white relative overflow-hidden">
        <div className="immersive-vignette pointer-events-none fixed inset-0 z-[100] select-none" aria-hidden />
        <div className="film-grain pointer-events-none fixed inset-0 z-[101] select-none" aria-hidden />
        <div className="relative z-0 min-h-full">{children}</div>
      </body>
    </html>
  );
}
