// iFactoryOS is a pure client-rendered SPA: it is built to static files and
// served by Caddy from /ifactory_apps/os, with all data fetched from the backend
// API at runtime. No SSR / no prerender — routing is client-side with a
// 200.html fallback (see adapter-static config in vite.config.ts).
export const ssr = false;
export const prerender = false;
