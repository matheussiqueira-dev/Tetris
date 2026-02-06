import type { Metadata } from "next";
import { Oswald, Sora } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const bodyFont = Sora({
  variable: "--font-body",
  subsets: ["latin"]
});

const titleFont = Oswald({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700"]
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Tetris Gesture Control Deck",
    template: "%s | Tetris Gesture Control Deck"
  },
  description:
    "Jogue Tetris no navegador com controle por gestos usando OpenCV.js, modos competitivos e leaderboard online.",
  applicationName: "Tetris Gesture Control Deck",
  keywords: [
    "tetris",
    "opencv",
    "nextjs",
    "computer vision",
    "gestures",
    "webcam game",
    "gesture control"
  ],
  alternates: {
    canonical: "/"
  },
  authors: [
    {
      name: "Matheus Siqueira",
      url: "https://www.matheussiqueira.dev/"
    }
  ],
  creator: "Matheus Siqueira",
  publisher: "Matheus Siqueira",
  category: "games",
  openGraph: {
    title: "Tetris Gesture Control Deck",
    description:
      "Experiencia de Tetris por gestos com OpenCV.js, performance em tempo real e ranking online.",
    type: "website",
    locale: "pt_BR",
    siteName: "Tetris Gesture Control Deck",
    url: "/"
  },
  twitter: {
    card: "summary_large_image",
    title: "Tetris Gesture Control Deck",
    description: "Controle Tetris com a mao via webcam e acompanhe seu ranking em tempo real."
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${bodyFont.variable} ${titleFont.variable}`}>{children}</body>
    </html>
  );
}
