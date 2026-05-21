import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { APP_CONFIG } from "./config";

export type GraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

@Injectable({ providedIn: "root" })
export class GraphqlClient {
  private http = inject(HttpClient);

  async request<T>(query: string, variables?: Record<string, any>): Promise<T> {
    const res = await firstValueFrom(
      this.http.post<GraphqlResponse<T>>(APP_CONFIG.apiUrl, { query, variables })
    );
    if (res.errors?.length) throw new Error(res.errors.map((e) => e.message).join("\n"));
    if (!res.data) throw new Error("No data returned");
    return res.data;
  }
}

