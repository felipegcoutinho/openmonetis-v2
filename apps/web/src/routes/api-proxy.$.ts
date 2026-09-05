import { createFileRoute } from "@tanstack/react-router";
import { proxyApiRequest } from "@/lib/api-proxy";

function forward({ params, request }: { params: { _splat?: string }; request: Request }) {
  return proxyApiRequest(request, params._splat ?? "");
}

export const Route = createFileRoute("/api-proxy/$")({
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
