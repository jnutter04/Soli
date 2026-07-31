export default function manifest() {
  return {
    name: "Soli: know what you actually keep",
    short_name: "Soli",
    description:
      "See your real take-home after product, booth rent and taxes.",
    // Installed users should land in the app, not the marketing page.
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F6EFE4",
    theme_color: "#BC6B4C",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Log a service", short_name: "Log", url: "/app?tab=log" },
    ],
  };
}
