import { SITE_URL } from "@/lib/site";

/* The signed-in app, login and password reset are behind auth and hold nothing
   a searcher could use, so they are kept out of the index. Only the public
   marketing and legal pages are offered up. */
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/app", "/login", "/auth/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
