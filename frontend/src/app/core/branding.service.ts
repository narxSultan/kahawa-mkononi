import { Injectable, signal } from "@angular/core";
import { GraphqlClient } from "./graphql.client";
import { APP_CONFIG } from "./config";

function apiBase() {
  return String(APP_CONFIG.apiUrl || "").replace(/\/graphql\/?$/, "");
}

function absUrl(url: string | null | undefined) {
  const u = String(url ?? "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${apiBase()}${u}`;
  return `${apiBase()}/${u}`;
}

@Injectable({ providedIn: "root" })
export class BrandingService {
  logoUrl = signal<string | null>(null);

  constructor(private gql: GraphqlClient) {
    void this.load();
  }

  private applyCss(url: string | null) {
    const root = document.documentElement;
    if (!url) {
      root.style.removeProperty("--brand-logo");
      return;
    }
    root.style.setProperty("--brand-logo", `url("${absUrl(url)}")`);
  }

  async load() {
    try {
      const data = await this.gql.request<{ appBranding: { logoUrl?: string | null } }>(`query Branding { appBranding { logoUrl } }`);
      const url = data.appBranding?.logoUrl ?? null;
      this.logoUrl.set(url);
      this.applyCss(url);
    } catch {
      this.logoUrl.set(null);
      this.applyCss(null);
    }
  }
}

