import { Injectable, computed, signal } from "@angular/core";
import { tokenStorage } from "./token.storage";
import { GraphqlClient } from "./graphql.client";

export type RoleName = "ADMIN" | "MANAGER" | "STAFF" | "CALL_CENTRE_AGENT" | "CUSTOMER";

export type CurrentUser = {
  id: string;
  email: string;
  phone?: string | null;
  username?: string | null;
  fullName: string;
  profilePhoto?: string | null;
  status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  role: { name: RoleName };
  serviceCentre?: { id: string; centreName: string } | null;
};

@Injectable({ providedIn: "root" })
export class AuthService {
  private _user = signal<CurrentUser | null>(null);
  private _delegatedPermissions = signal<string[]>([]);
  readonly user = this._user.asReadonly();
  readonly delegatedPermissions = this._delegatedPermissions.asReadonly();
  readonly role = computed(() => this._user()?.role?.name ?? null);

  constructor(private gql: GraphqlClient) {}

  async init() {
    const token = tokenStorage.getAccessToken();
    if (!token) return;
    try {
      const data = await this.gql.request<{ me: CurrentUser | null; myDelegatedPermissions: string[] }>(`query Me {
        me { id email phone username fullName profilePhoto status role { name } serviceCentre { id centreName } }
        myDelegatedPermissions
      }`);
      this._user.set(data.me);
      this._delegatedPermissions.set(Array.isArray(data.myDelegatedPermissions) ? data.myDelegatedPermissions : []);
    } catch {
      this.logout();
    }
  }

  async login(email: string, password: string) {
    const data = await this.gql.request<{
      login: { tokens: { accessToken: string; refreshToken: string }; user: CurrentUser };
    }>(
      `mutation Login($input: LoginInput!) {
        login(input: $input) {
          tokens { accessToken refreshToken }
          user { id email phone username fullName profilePhoto status role { name } serviceCentre { id centreName } }
        }
      }`,
      { input: { email, password } }
    );
    tokenStorage.setAccessToken(data.login.tokens.accessToken);
    tokenStorage.setRefreshToken(data.login.tokens.refreshToken);
    this._user.set(data.login.user);
    try {
      const perms = await this.gql.request<{ myDelegatedPermissions: string[] }>(`query Perms { myDelegatedPermissions }`);
      this._delegatedPermissions.set(Array.isArray(perms.myDelegatedPermissions) ? perms.myDelegatedPermissions : []);
    } catch {
      this._delegatedPermissions.set([]);
    }
  }

  logout() {
    tokenStorage.clear();
    this._user.set(null);
    this._delegatedPermissions.set([]);
  }
}
