import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getCurrentUserFn } from "@/lib/api-auth.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    try {
      const { user } = await getCurrentUserFn();
      if (!user) {
        throw redirect({ to: "/auth", search: { redirect: location.href } });
      }
      return { user };
    } catch (err) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: () => <Outlet />,
});
