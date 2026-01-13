import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-main",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "draWG - Multiplayer Drawing Game",
  description: "A fun multiplayer drawing and quiz game for classrooms",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className={nunito.className} style={{ colorScheme: 'light' }}>
        {children}
      </body>
    </html>
  );
}
