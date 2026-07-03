import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InkDesk",
  description: "Tattoo studio consultation automation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
