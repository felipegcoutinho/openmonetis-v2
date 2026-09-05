import { createFileRoute } from "@tanstack/react-router";
import { proxyApiRequest } from "@/lib/api-proxy";

function forward({ params, request }: { params: { _splat?: string }; request: Request }) {
  return proxyApiRequest(request, `/api/${params._splat ?? ""}`);
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      DELETE: forward,
      GET: forward,
      OPTIONS: forward,
      PATCH: forward,
      POST: forward,
      PUT: forward,
    },
  },
});
