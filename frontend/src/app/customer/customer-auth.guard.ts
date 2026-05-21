import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthService } from "../core/auth.service";
import { tokenStorage } from "../core/token.storage";

export const customerAuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const auth = inject(AuthService);
  const token = tokenStorage.getAccessToken();
  if (!token) return router.parseUrl("/customer/login");
  await auth.init();
  if (auth.role() !== "CUSTOMER") return router.parseUrl("/customer/login");
  return true;
};

