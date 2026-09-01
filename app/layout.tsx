import type { Metadata } from "next";
import { JetBrains_Mono, Poppins } from "next/font/google";
import "./globals.css";

const sans = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Irixs Toolbox (By Damian)",
  description: "AFAS hulpmiddelen voor PURE-migraties, voorbeeld-JSON en UpdateConnector-schema's.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nl" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
