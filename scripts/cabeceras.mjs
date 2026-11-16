// Cabeceras de seguridad. Una sola fuente: las usa `vite preview` (y así la prueba
// de punta a punta corre con ellas) y se escriben en dist/_headers para Netlify.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React usa style="..." en algunos elementos
  "img-src 'self' data: blob: https://*.supabase.co",
  "media-src 'self' blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

export const CABECERAS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(self), geolocation=(), payment=()",
  "X-Frame-Options": "DENY",
};

/** Archivo _headers de Netlify. */
export const archivoHeaders = () =>
  ["/*", ...Object.entries(CABECERAS).map(([k, v]) => `  ${k}: ${v}`), "", "/sw.js", "  Cache-Control: no-cache", "", "/assets/*", "  Cache-Control: public, max-age=31536000, immutable", ""].join("\n");
