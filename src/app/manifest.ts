import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bamboo Panel — Bamboo Beauty Lifes",
    short_name: "Bamboo",
    description: "Randevu, müşteri ve kasa yönetimi",
    start_url: "/panel",
    display: "standalone",
    background_color: "#f3f6f1",
    theme_color: "#0a7a1e",
    lang: "tr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
