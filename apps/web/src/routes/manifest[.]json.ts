import { createFileRoute } from "@tanstack/react-router";
import { getBrowserThemeColor } from "@/lib/browser-theme-colors";
import { createWebAppManifest } from "@/lib/web-app-manifest";

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const theme = new URL(request.url).searchParams.get("theme");
        const manifest = createWebAppManifest(getBrowserThemeColor(theme));

        return new Response(JSON.stringify(manifest), {
          headers: {
            // Each appearance has its own address, so a cached copy never shows another one.
            "Cache-Control": "public, max-age=3600",
            "Content-Type": "application/manifest+json; charset=utf-8",
          },
        });
      },
    },
  },
});
