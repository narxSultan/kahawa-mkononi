import type { RoleName } from "@prisma/client";
import type { RequestContext } from "./requestContext.js";

export function assertAuthenticated(ctx: RequestContext) {
  if (!ctx.user) throw new Error("UNAUTHENTICATED");
}

export function assertAnyRole(ctx: RequestContext, roles: RoleName[]) {
  assertAuthenticated(ctx);
  const role = ctx.user!.roleName;
  if (!roles.includes(role)) throw new Error("FORBIDDEN");
}

export function isAdmin(ctx: RequestContext) {
  return ctx.user?.roleName === "ADMIN";
}

export function isManager(ctx: RequestContext) {
  return ctx.user?.roleName === "MANAGER";
}

export function isStaff(ctx: RequestContext) {
  return ctx.user?.roleName === "STAFF";
}

export function isCallCentreAgent(ctx: RequestContext) {
  return ctx.user?.roleName === "CALL_CENTRE_AGENT";
}

export function isCustomer(ctx: RequestContext) {
  return ctx.user?.roleName === "CUSTOMER";
}
