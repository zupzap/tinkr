/** The only addresses allowed to call the API. */
export const SITES = new Set(["tinkr.page", "www.tinkr.page"]);

// Vercel sets this to the project's production address, so it works before the domain is live.
if (process.env.VERCEL_PROJECT_PRODUCTION_URL) SITES.add(process.env.VERCEL_PROJECT_PRODUCTION_URL);
if (process.env.NODE_ENV !== "production") SITES.add("localhost:3002");
