import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // macOS: Turbopack üst dizini (Desktop) tarayıp "Operation not permitted" panic atıyor.
  // Kökü proje dizinine sabitle → tarama yukarı çıkmaz.
  turbopack: {
    root: __dirname,
  },
  // offmarket-map-clusters rotası ~469K noktalı gz dosyasını fs ile okur —
  // Vercel/standalone build'de dosya izlemeye (file tracing) elle dahil et.
  outputFileTracingIncludes: {
    "/api/admin/offmarket-map-clusters": ["./src/data/offmarket-map-points.json.gz"],
  },
};

export default nextConfig;
