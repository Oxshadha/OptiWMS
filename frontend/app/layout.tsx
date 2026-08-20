import React from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata = {
  title: "OptiWMS",
  description: "Warehouse Management System",
  icons: [
    { rel: "icon", url: "/favicon.ico" },
  ],
  manifest: "/manifest.json",
};

// Viewport configuration (Next.js 14.2+ requires separate export)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#CF0F47",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="optiwms">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'optiwms';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="font-sans">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}

