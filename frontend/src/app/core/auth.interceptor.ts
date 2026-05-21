import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, firstValueFrom, from, switchMap, throwError } from "rxjs";
import { APP_CONFIG } from "./config";
import { tokenStorage } from "./token.storage";

type RefreshResponse = {
  data?: { refresh?: { accessToken: string; refreshToken: string } };
  errors?: Array<{ message: string }>;
};

let refreshInFlight: Promise<string | null> | null = null;

function isRefreshMutation(req: { url: string; body: any }): boolean {
  if (req.url !== APP_CONFIG.apiUrl) return false;
  const q = typeof req.body?.query === "string" ? req.body.query : "";
  return q.includes("mutation Refresh") || q.includes("refresh(");
}

async function refreshAccessToken(rawHttp: HttpClient): Promise<string | null> {
  const rt = tokenStorage.getRefreshToken();
  if (!rt) return null;
  try {
    const res = await firstValueFrom(
      rawHttp.post<RefreshResponse>(APP_CONFIG.apiUrl, {
        query: `mutation Refresh($refreshToken: String!) { refresh(refreshToken: $refreshToken) { accessToken refreshToken } }`,
        variables: { refreshToken: rt }
      })
    );

    const errors = res?.errors ?? [];
    if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
    const tokens = res?.data?.refresh;
    if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error("INVALID_REFRESH");
    tokenStorage.setAccessToken(tokens.accessToken);
    tokenStorage.setRefreshToken(tokens.refreshToken);
    return tokens.accessToken;
  } catch {
    tokenStorage.clear();
    return null;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = tokenStorage.getAccessToken();
  const authReq = token
    ? req.clone({
        setHeaders: { Authorization: `Bearer ${token}` }
      })
    : req;

  const backend = inject(HttpBackend);
  const rawHttp = new HttpClient(backend);

  return next(authReq).pipe(
    catchError((err) => {
      if (!(err instanceof HttpErrorResponse) || err.status !== 401) return throwError(() => err);
      if (isRefreshMutation(req)) return throwError(() => err);
      if (!tokenStorage.getRefreshToken()) return throwError(() => err);

      refreshInFlight ??= refreshAccessToken(rawHttp).finally(() => {
        refreshInFlight = null;
      });

      return from(refreshInFlight).pipe(
        switchMap((newToken) => {
          if (!newToken) return throwError(() => err);
          return next(
            req.clone({
              setHeaders: { Authorization: `Bearer ${newToken}` }
            })
          );
        })
      );
    })
  );
};
