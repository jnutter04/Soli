import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";
import ErrorReporter from "@/components/ErrorReporter";

import { SITE_URL, SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/site";

const title = SITE_TITLE;
const description = SITE_DESCRIPTION;

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  alternates: { canonical: "/" },
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body><ErrorReporter>{children}</ErrorReporter><SWRegister /><Analytics /></body>
    </html>
  );
}
