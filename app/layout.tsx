import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_JP } from "next/font/google";
import "@fontsource/dseg7-modern/400.css";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["200", "300", "400"],
  variable: "--font-noto",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["200", "300"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Moon Signal",
  description: "\u2014",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${noto.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="h-full overflow-hidden bg-black font-sans font-extralight tracking-wide">
        {children}
      </body>
    </html>
  );
}
