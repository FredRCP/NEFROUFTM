import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEFRO-UFTM",
  description: "Acompanhamento nefrológico — equipe HC-UFTM",
  // No Next.js 16, o manifest.ts em /app gera automaticamente a rota
  // /manifest.webmanifest — não precisa referenciar manualmente aqui.
  icons: {
    icon: [
      { url: "/icons/icon-48.png",  sizes: "48x48",  type: "image/png" },
      { url: "/icons/icon-96.png",  sizes: "96x96",  type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e3a5f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}