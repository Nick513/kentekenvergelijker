import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = "https://kentekenvergelijker.nl";
const siteTitle = "Kentekenvergelijker - Vergelijk auto's op kenteken";
const siteDescription =
  "Vergelijk 2 tot 4 Nederlandse kentekens side-by-side. Zie merk, model, uitvoering en uitrusting van de exacte auto's, van stoelverwarming tot rijassistentie.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteTitle,
    template: "%s | Kentekenvergelijker",
  },
  description: siteDescription,
  keywords: [
    "kenteken vergelijken",
    "auto vergelijken",
    "kenteken opzoeken",
    "auto uitrusting vergelijken",
    "Nederlandse kentekens",
    "occasion vergelijken",
    "auto specificaties",
  ],
  authors: [{ name: "Kentekenvergelijker" }],
  creator: "Kentekenvergelijker",
  openGraph: {
    type: "website",
    locale: "nl_NL",
    url: siteUrl,
    siteName: "Kentekenvergelijker",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
  alternates: {
    canonical: siteUrl,
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-kv-bg font-sans text-kv-navy">{children}</body>
    </html>
  );
}
