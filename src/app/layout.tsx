import type { Metadata } from "next";
import "./globals.css";
import "./side-by-side.css";
const themeBootstrap = `(function(){var t;try{t=localStorage.getItem('minglo-theme')}catch(e){}document.documentElement.dataset.theme=t==='dark'?'dark':'light'})()`;
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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link
          rel="preload"
          href="/fonts/public-sans-semibold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          id="minglo-theme-init"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
