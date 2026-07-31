import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import SWRegister from "@/components/SWRegister";
import ErrorReporter from "@/components/ErrorReporter";

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

const title = "Soli: know what you actually keep";
const description =
  "Soli helps service pros see their real take-home after product, booth rent & taxes.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    siteName: "Soli",
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
