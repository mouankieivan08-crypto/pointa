import type { NextConfig } from "next";

/** En-têtes de sécurité appliqués à toutes les pages. */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // pas d'intégration dans une iframe (clickjacking)
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Caméra et position uniquement pour Pointa (pointage), rien d'autre.
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Photos et emplois du temps envoyés par formulaire (compressés côté téléphone).
    serverActions: { bodySizeLimit: "4mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
