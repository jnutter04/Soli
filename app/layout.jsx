import "./globals.css";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";
import ErrorReporter from "@/components/ErrorReporter";

import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";

/* Self-hosted at build time and served from our own origin.

   These used to load through an @import inside a <style> block on every page,
   which is the slowest way to ask for a font: the browser cannot see the
   request until it has parsed the CSS, and then it blocks rendering on a
   third-party host. On an Instagram in-app browser over mobile data that is a
   visible stall on the first screen anyone sees. `swap` means text is readable
   in a fallback immediately rather than invisible while the font arrives. */
const fraunces = Fraunces({
  subsets: ["latin"],
  axes: ["opsz"], // optical sizing, which the display face relies on
  display: "swap",
  variable: "--font-fraunces",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-hanken",
});

const title = SITE_TITLE;
const description = SITE_DESCRIPTION;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: "/" },
  verification: { google: "jm-VHJNBe-27OaGamQ9r9HTPyNmmXrgemUGj2G24A6s" },
  keywords: [
    "salon bookkeeping",
    "booth rent calculator",
    "beauty business profit",
    "esthetician income tracker",
    "how much should I charge",
    "self employed beauty taxes",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  openGraph: {
    title,
    description,
    siteName: SITE_NAME,
    url: SITE_URL,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  appleWebApp: { capable: true, title: "Soli", statusBarStyle: "default" },
};

// Tints the mobile browser chrome to match whichever theme is showing.
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6EFE4" },
    { media: "(prefers-color-scheme: dark)", color: "#181410" },
  ],
};

// Runs before paint so there's no light-mode flash. Uses saved choice, else OS.
const themeInit = `(function(){try{var t=localStorage.getItem('soli-theme');if(t!=='light'&&t!=='dark'){t=(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';}document.documentElement.dataset.theme=t;}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body><ErrorReporter>{children}</ErrorReporter><SWRegister /><Analytics /></body>
    </html>
  );
}
