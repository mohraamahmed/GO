import { createMiddleware } from "@tanstack/react-start";
import { validateSession } from "./auth-service";
import type { User, Session } from "@prisma/client";

export const SESSION_COOKIE_NAME = "cfl_session";

export interface AuthenticatedContext {
  user: User;
  session: Session;
  clientIp?: string;
}

/**
 * Server middleware enforcing active session authentication.
 */
export const requireAuthMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { getCookie, deleteCookie, getRequestIP } = await import("@tanstack/react-start/server");
    const rawToken = getCookie(SESSION_COOKIE_NAME);

    if (!rawToken) {
      throw new Error("UNAUTHORIZED: يرجى تسجيل الدخول أولاً");
    }

    const authResult = await validateSession(rawToken);

    if (!authResult) {
      deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
      throw new Error("UNAUTHORIZED: انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً");
    }

    if (authResult.user.accountStatus === "BANNED") {
      deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
      throw new Error("FORBIDDEN: تم حظر هذا الحساب من استخدام النظام");
    }

    if (authResult.user.accountStatus === "SUSPENDED") {
      deleteCookie(SESSION_COOKIE_NAME, { path: "/" });
      throw new Error("FORBIDDEN: هذا الحساب معلق مؤقتاً، يرجى مراجعة الإدارة");
    }

    const clientIp = getRequestIP?.() || undefined;

    return next({
      context: {
        user: authResult.user,
        session: authResult.session,
        clientIp,
      } as AuthenticatedContext,
    });
  }
);

/**
 * Server middleware enforcing ADMIN privileges.
 */
export const requireAdminMiddleware = createMiddleware({ type: "function" })
  .middleware([requireAuthMiddleware])
  .server(async ({ next, context }) => {
    const ctx = context as unknown as AuthenticatedContext;

    if (!ctx.user || ctx.user.role !== "ADMIN") {
      throw new Error("FORBIDDEN: هذه العملية تتطلب صلاحيات المشرف العام (ADMIN)");
    }

    return next({ context: ctx });
  });
