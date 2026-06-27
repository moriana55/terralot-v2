import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // macOS: Turbopack üst dizini (Desktop) tarayıp "Operation not permitted" panic atıyor.
  // Kökü proje dizinine sabitle → tarama yukarı çıkmaz.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
