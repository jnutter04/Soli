/* One canonical home for the site's public URL.

   soli.beauty redirects to www.soli.beauty, so www is where pages actually
   live. Canonical links, the sitemap and Open Graph URLs all have to point at
   the address that serves content: aiming them at a redirecting host splits
   search ranking signals between two versions of the same page. */
export const SITE_URL = "https://www.soli.beauty";

export const SITE_NAME = "Soli";
export const SITE_TITLE = "Soli: know what you actually keep";
export const SITE_DESCRIPTION =
  "Soli shows beauty pros their real take-home after product, booth rent and taxes. Track every service, including cash and Venmo, and see which ones actually pay.";
