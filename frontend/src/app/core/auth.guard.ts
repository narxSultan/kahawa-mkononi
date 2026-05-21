import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { tokenStorage } from "./token.storage";

export const authGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const token = tokenStorage.getAccessToken();
  if (!token) return router.parseUrl("/login");
  return true;
};

