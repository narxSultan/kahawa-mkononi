import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService, type RoleName } from "./auth.service";

export function accessGuard(args: { roles: RoleName[]; delegatedCode?: string }): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const auth = inject(AuthService);
    await auth.init();

    const role = auth.role();
    if (!role) return router.parseUrl("/login");
    if (args.roles.includes(role)) return true;

    if (role === "STAFF" && args.delegatedCode && auth.delegatedPermissions().includes(args.delegatedCode)) return true;
    return router.parseUrl("/dashboard");
  };
}

