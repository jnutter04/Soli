import "./globals.css";

export const metadata = {
  title: "Soli — know what you actually keep",
  description:
    "Soli helps service pros see their real take-home after product, booth rent & taxes.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
