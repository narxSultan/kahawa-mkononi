import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService, type RoleName } from "./auth.service";

export function roleGuard(roles: RoleName[]): CanActivateFn {
  return async () => {
    const router = inject(Router);
    const auth = inject(AuthService);
    await auth.init();
    const role = auth.role();
    if (!role) return router.parseUrl("/login");
    if (!roles.includes(role)) return router.parseUrl("/dashboard");
    return true;
  };
}

