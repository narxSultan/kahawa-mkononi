import type { Env } from "../env.js";
import type { RoleName } from "@prisma/client";
import { verifyToken, type JwtUser } from "./jwt.js";

export type AuthUser = {
  userId: string;
  roleName: RoleName;
  serviceCentreId?: string | null;
};

export type RequestContext = {
  env: Env;
  user: AuthUser | null;
  requestId: string;
  ipAddress?: string | null;
};

export function buildContext(args: {
  env: Env;
  authorizationHeader?: string | undefined;
  requestId: string;
  ipAddress?: string | null | undefined;
}): RequestContext {
  const { env, authorizationHeader, requestId, ipAddress } = args;
  if (!authorizationHeader) return { env, user: null, requestId, ipAddress: ipAddress ?? null };
  const parts = String(authorizationHeader).trim().split(/\s+/);
  const type = parts[0] ?? "";
  const token = parts[1] ?? "";
  if (type.toLowerCase() !== "bearer" || !token) return { env, user: null, requestId, ipAddress: ipAddress ?? null };
  try {
    const decoded = verifyToken<JwtUser>(token, env.JWT_ACCESS_SECRET);
    return {
      env,
      user: {
        userId: decoded.sub,
        roleName: decoded.role as RoleName,
        serviceCentreId: decoded.serviceCentreId ?? null
      },
      requestId,
      ipAddress: ipAddress ?? null
    };
  } catch {
    return { env, user: null, requestId, ipAddress: ipAddress ?? null };
  }
}
