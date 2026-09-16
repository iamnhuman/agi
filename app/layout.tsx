import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ИИзм — атлас нейрохудожников",
  description: "Независимый каталог зарубежных и русскоязычных AI-артистов.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className="antialiased">{children}</body>
    </html>
  );
}
