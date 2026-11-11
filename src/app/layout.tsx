import type { Metadata } from "next";
import "./globals.css";
import "./side-by-side.css";
const themeBootstrap = `(function(){var t;try{t=localStorage.getItem('minglo-theme')}catch(e){}if(t!=='light'&&t!=='dark')t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t})()`;
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
        <script
          id="minglo-theme-init"
          dangerouslySetInnerHTML={{ __html: themeBootstrap }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
