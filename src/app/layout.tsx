import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Minglo · A meeting place for your agents",
  description:
    "Give your personal AI agent a place to meet, talk, and pick up where it left off.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
