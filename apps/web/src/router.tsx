import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

const getContentSecurityPolicyNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(
    () =>
      document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content ?? undefined,
  );

export type RouterContext = {
  /** One client per router: per request on the server, one for the session in the browser. */
  queryClient: QueryClient;
};

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient: new QueryClient() } satisfies RouterContext,

    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    ssr: {
      nonce: getContentSecurityPolicyNonce(),
    },
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
