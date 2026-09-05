import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { createIsomorphicFn, getGlobalStartContext } from "@tanstack/react-start";
import { routeTree } from "./routeTree.gen";

const getContentSecurityPolicyNonce = createIsomorphicFn()
  .server(() => getGlobalStartContext()?.nonce)
  .client(
    () =>
      document.querySelector<HTMLMetaElement>('meta[property="csp-nonce"]')?.content ?? undefined,
  );

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,

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
