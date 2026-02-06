import type { Metadata } from "next";
import { Bebas_Neue, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const bodyFont = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"]
});

const titleFont = Bebas_Neue({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: "400"
});

export const metadata: Metadata = {
  title: "Tetris por Gestos com OpenCV.js",
  description: "Tetris web em Next.js controlado por gestos de mao usando OpenCV.js e webcam.",
  keywords: [
    "tetris",
    "opencv",
    "nextjs",
    "computer vision",
    "gestures",
    "webcam game"
  ],
  openGraph: {
    title: "Tetris por Gestos com OpenCV.js",
    description: "Jogue Tetris com controle por mao em tempo real direto no navegador.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${titleFont.variable}`}>{children}</body>
    </html>
  );
}
