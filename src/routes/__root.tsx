import type { QueryClient } from "@tanstack/react-query";

import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { useApplyTheme } from "@/state/client/themeStore";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

type RouterContextType = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContextType>()({
  component: RootComponent,
});

// enable the devtools if you are debugging tanstack routing and query issues
function RootComponent() {
  // Apply theme from store to document root
  useApplyTheme();

  return (
    <>
      <Outlet />
      <ReactQueryDevtools initialIsOpen={false} />
      <TanStackRouterDevtools />
    </>
  );
}
