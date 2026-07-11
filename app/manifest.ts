import type { MetadataRoute } from "next";

// Web app manifest — enables an installable, standalone PWA on Android/desktop.
// (iOS uses the apple-icon + apple-web-app metadata for Add to Home Screen.)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Health",
    short_name: "Health",
    description: "5x5 workout & sleep tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
