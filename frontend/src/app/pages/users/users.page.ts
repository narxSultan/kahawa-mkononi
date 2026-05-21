import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { AuthService, type RoleName } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type UserStatus = "ACTIVE" | "SUSPENDED" | "DELETED";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "User Management" | t }}</h2>
          <div class="muted">{{ "Create, search, and manage accounts" | t }}</div>
        </div>
        <div class="right">
          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
          <button class="btn primary" (click)="goNew()" *ngIf="canCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ "Add User" | t }}
          </button>
        </div>
      </div>

	      <div class="card pad" style="margin-top:12px">
	        <div class="filters">
	          <input class="search" [(ngModel)]="search" placeholder="{{ 'Search name, email, phone, username' | t }}" (input)="onSearchInput()" />
	          <select class="sel" [(ngModel)]="role" (change)="resetAndLoad()">
	            <option value="">{{ "All roles" | t }}</option>
	            <option value="ADMIN" *ngIf="isAdmin()">ADMIN</option>
	            <option value="MANAGER">MANAGER</option>
	            <option value="STAFF">STAFF</option>
	            <option value="CALL_CENTRE_AGENT" *ngIf="isAdmin()">CALL_CENTRE_AGENT</option>
	          </select>
	          <select class="sel" [(ngModel)]="status" (change)="resetAndLoad()">
	            <option value="">{{ "Active + Suspended" | t }}</option>
	            <option value="ACTIVE">ACTIVE</option>
	            <option value="SUSPENDED">SUSPENDED</option>
	            <option value="DELETED" *ngIf="isAdmin()">DELETED</option>
	          </select>
	          <select class="sel" [(ngModel)]="serviceCentreId" (change)="resetAndLoad()" *ngIf="isAdmin()">
	            <option value="">{{ "All centres" | t }}</option>
	            <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
	          </select>
	          <button class="btn" (click)="resetAndLoad()" [disabled]="loading()">
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
	              <path
	                d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
	              />
            </svg>
            {{ "Search" | t }}
          </button>
        </div>
      </div>

	      <div class="card pad" style="margin-top:12px">
	        <div class="table-wrap">
	          <table class="table">
            <thead>
              <tr>
                <th>{{ "Name" | t }}</th>
                <th>{{ "Email" | t }}</th>
                <th>{{ "Phone" | t }}</th>
                <th>{{ "Role" | t }}</th>
                <th>{{ "Centre" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th>{{ "Joined" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of users()">
                <td style="font-weight:800">{{ u.fullName }}</td>
                <td>{{ u.email }}</td>
                <td>{{ u.phone || "—" }}</td>
                <td><span class="badge">{{ u.role?.name }}</span></td>
                <td>{{ u.serviceCentre?.centreName || "—" }}</td>
                <td>
                  <span class="badge" [class.success]="u.status==='ACTIVE'" [class.warning]="u.status==='SUSPENDED'" [class.danger]="u.status==='DELETED'">
                    {{ u.status }}
                  </span>
                </td>
                <td>{{ (u.createdAt || "").slice(0, 10) }}</td>
                <td style="text-align:right">
                  <div class="menu-cell">
                    <button class="kebab" type="button" aria-label="Actions" (click)="toggleMenu(u.id, $event)">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
                      </svg>
                    </button>

                    <div class="menu-pop" *ngIf="menuOpenId()===u.id" (click)="$event.stopPropagation()">
                      <button class="menu-act" (click)="goProfile(u.id)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 5c-5 0-9 7-9 7s4 7 9 7 9-7 9-7-4-7-9-7Zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10Zm0-2.5A2.5 2.5 0 1 0 12 9a2.5 2.5 0 0 0 0 5Z"
                          />
                        </svg>
                        {{ "View" | t }}
                      </button>
                      <button class="menu-act" (click)="goEdit(u.id)" *ngIf="canEditUser(u)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z"
                          />
                        </svg>
                        {{ "Edit" | t }}
                      </button>
                      <button class="menu-act" *ngIf="canResetPassword(u)" (click)="resetPassword(u)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M12 1a5 5 0 0 1 5 5v2h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5Zm3 7V6a3 3 0 1 0-6 0v2h6Zm-3 5a2 2 0 0 0-1 3.732V18a1 1 0 1 0 2 0v-1.268A2 2 0 0 0 12 13Z"
                          />
                        </svg>
                        {{ "Reset Password" | t }}
                      </button>
                      <button class="menu-act" *ngIf="canSuspend(u)" (click)="suspend(u.id)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
                        </svg>
                        Suspend
                      </button>
                      <button class="menu-act" *ngIf="canActivate(u)" (click)="activate(u.id)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
                        </svg>
                        Activate
                      </button>
                      <button class="menu-act danger" *ngIf="canDelete(u)" (click)="remove(u.id, u.fullName)">
                        <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                          <path
                            d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
                          />
                        </svg>
                        {{ "Delete" | t }}
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
              <tr *ngIf="!users().length">
                <td colspan="8" class="muted" style="padding:14px">{{ "No users found" | t }}</td>
              </tr>
	            </tbody>
	          </table>
	        </div>
	        <div class="pager">
	          <button class="btn" (click)="prevPage()" [disabled]="loading() || page()<=1">
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
	            Prev
	          </button>
	          <div class="muted2">Page {{ page() }} / {{ totalPages() }}</div>
	          <button class="btn" (click)="nextPage()" [disabled]="loading() || !pageInfo()?.hasNextPage">
	            Next
	            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
	          </button>
	        </div>
	      </div>

      <div class="scrim2" *ngIf="resetOpen()" (click)="closeReset()"></div>
      <div class="modal" *ngIf="resetOpen()" (click)="$event.stopPropagation()">
        <div class="modal-card" (click)="$event.stopPropagation()">
          <div class="modal-title">{{ "Reset Password" | t }}</div>
          <div class="muted" style="margin-top:4px">
            {{ "User" | t }}: <b>{{ resetTarget()?.fullName || resetTarget()?.email }}</b>
          </div>

          <div class="row" style="gap:10px;margin-top:12px;flex-wrap:wrap">
            <input class="search" style="flex:1;min-width:220px" type="password" [(ngModel)]="resetNewPassword" placeholder="{{ 'New password (min 6 chars)' | t }}" />
            <input class="search" style="flex:1;min-width:220px" type="password" [(ngModel)]="resetConfirmPassword" placeholder="{{ 'Confirm password' | t }}" />
          </div>

          <div class="error" *ngIf="resetErr()">{{ resetErr() }}</div>
          <div class="ok" *ngIf="resetOk()">{{ "Password reset" | t }}</div>

          <div class="row" style="margin-top:12px;gap:10px;justify-content:flex-end">
            <button class="btn" (click)="closeReset()" [disabled]="resetBusy()">{{ "Cancel" | t }}</button>
            <button class="btn primary" (click)="submitReset()" [disabled]="resetBusy()">
              {{ resetBusy() ? ("Saving..." | t) : ("Reset" | t) }}
            </button>
          </div>
        </div>
      </div>

      <div class="scrim" *ngIf="menuOpenId()" (click)="closeMenu()"></div>

      <div class="error" *ngIf="error()">{{ error() }}</div>
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .search{padding:10px 12px;border:1px solid var(--border);border-radius:12px;min-width:320px;flex:1}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .menu-cell{position:relative;display:inline-flex;justify-content:flex-end}
      .kebab{width:40px;height:40px;border-radius:12px;border:1px solid var(--border);background:var(--white);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;color:var(--dark)}
      .kebab svg{width:18px;height:18px;fill:currentColor}
      .menu-pop{position:absolute;right:0;top:44px;min-width:160px;background:var(--white);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);padding:6px;z-index:30}
      .menu-act{width:100%;text-align:left;border:0;background:transparent;padding:10px 10px;border-radius:10px;cursor:pointer;color:var(--dark);font:inherit;display:flex;align-items:center;gap:10px}
      .menu-act:hover{background:rgba(245,239,230,.6)}
      .menu-act.danger{color:var(--danger)}
      .menu-act.danger:hover{background:rgba(198,40,40,.08)}
      .scrim{position:fixed;inset:0;background:transparent;z-index:20}
      .scrim2{position:fixed;inset:0;background:rgba(15,23,42,.25);z-index:25}
      .modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;padding:16px;z-index:30}
      .modal-card{width:min(720px,100%);background:#fff;border:1px solid var(--border);border-radius:16px;padding:14px;box-shadow:0 18px 60px rgba(0,0,0,.14)}
      .modal-title{font-weight:900;color:var(--dark);font-size:18px}
      .ok{margin-top:12px;color:var(--success);font-weight:900}
      .ico{width:16px;height:16px;fill:currentColor;flex:0 0 auto}
      .btn{display:inline-flex;align-items:center;gap:10px}
	      .error{margin-top:12px;color:var(--danger);white-space:pre-line}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	      @media (max-width:720px){.search{min-width:100%}}
	    `
	  ]
})
export class UsersPageComponent {
  private gql = inject(GraphqlClient);
  private router = inject(Router);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal<string | null>(null);
	  users = signal<any[]>([]);
	  centres = signal<any[]>([]);
	  menuOpenId = signal<string | null>(null);
	  page = signal(1);
	  readonly pageSize = 10;
	  pageInfo = signal<any | null>(null);
	  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
	  private searchTimer: any = null;

  search = "";
  role: RoleName | "" = "";
  status: UserStatus | "" = "";
  serviceCentreId = "";

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  isManager = computed(() => this.auth.role() === "MANAGER");

  canCreate = computed(() => ["ADMIN", "MANAGER"].includes(this.auth.role() ?? ""));

  resetOpen = signal(false);
  resetTarget = signal<any | null>(null);
  resetBusy = signal(false);
  resetErr = signal<string | null>(null);
  resetOk = signal(false);
  resetNewPassword = "";
  resetConfirmPassword = "";

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    if (this.isAdmin()) {
      const centres = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
        `query Centres { serviceCentres(pagination:{page:1,pageSize:100}){ nodes{ id centreName } } }`
      );
      this.centres.set(centres.serviceCentres.nodes);
    }
    await this.load();
  }

	  async load() {
	    this.loading.set(true);
	    this.error.set(null);
	    try {
	      const data = await this.gql.request<{ users: { nodes: any[]; pageInfo: any } }>(
	        `query Users($search: String, $role: RoleName, $status: UserStatus, $serviceCentreId: ID, $page: Int!, $pageSize: Int!) {
	          users(pagination:{page:$page,pageSize:$pageSize}, search:$search, role:$role, status:$status, serviceCentreId:$serviceCentreId) {
	            nodes { id fullName email phone username status createdAt role{ name } serviceCentre{ id centreName } }
	            pageInfo { page pageSize total hasNextPage }
	          }
	        }`,
	        {
	          search: this.search.trim() || null,
	          role: this.role || null,
	          status: this.status || null,
	          serviceCentreId: this.isAdmin() ? this.serviceCentreId || null : null,
	          page: this.page(),
	          pageSize: this.pageSize
	        }
	      );
	      this.users.set(data.users.nodes);
	      this.pageInfo.set(data.users.pageInfo);
	    } catch (e: any) {
	      this.error.set(String(e?.message ?? e));
	    } finally {
	      this.loading.set(false);
	    }
	  }

	  resetAndLoad() {
	    this.page.set(1);
	    void this.load();
	  }

	  onSearchInput() {
	    try {
	      if (this.searchTimer) clearTimeout(this.searchTimer);
	    } catch {
	      // ignore
	    }
	    this.searchTimer = setTimeout(() => this.resetAndLoad(), 250);
	  }

	  prevPage() {
	    if (this.page() <= 1) return;
	    this.page.set(this.page() - 1);
	    void this.load();
	  }

	  nextPage() {
	    if (!this.pageInfo()?.hasNextPage) return;
	    this.page.set(this.page() + 1);
	    void this.load();
	  }

  goNew() {
    this.closeMenu();
    void this.router.navigateByUrl("/users/new");
  }
  goEdit(id: string) {
    this.closeMenu();
    void this.router.navigateByUrl(`/users/${id}/edit`);
  }
  goProfile(id: string) {
    this.closeMenu();
    void this.router.navigateByUrl(`/users/${id}`);
  }

  toggleMenu(id: string, ev: Event) {
    ev.stopPropagation();
    this.menuOpenId.set(this.menuOpenId() === id ? null : id);
  }

  closeMenu() {
    this.menuOpenId.set(null);
  }

  canEditUser(u: any) {
    if (this.isAdmin()) return u.role?.name !== "ADMIN" || this.auth.user()?.email === u.email;
    if (this.isManager()) return u.role?.name === "STAFF";
    return false;
  }
  canSuspend(u: any) {
    if (u.status !== "ACTIVE") return false;
    if (this.isAdmin()) return u.role?.name !== "ADMIN";
    if (this.isManager()) return u.role?.name === "STAFF";
    return false;
  }
  canActivate(u: any) {
    if (u.status !== "SUSPENDED") return false;
    if (this.isAdmin()) return u.role?.name !== "ADMIN";
    if (this.isManager()) return u.role?.name === "STAFF";
    return false;
  }
  canDelete(u: any) {
    return this.isAdmin() && u.role?.name !== "ADMIN" && u.status !== "DELETED";
  }

  canResetPassword(u: any) {
    if (this.isAdmin()) return true;
    if (!this.isManager()) return false;
    const myCentreId = this.auth.user()?.serviceCentre?.id ?? null;
    if (!myCentreId) return false;
    if ((u.serviceCentre?.id ?? null) !== myCentreId) return false;
    return u.role?.name === "STAFF";
  }

  async resetPassword(u: any) {
    this.closeMenu();
    this.resetErr.set(null);
    this.resetOk.set(false);
    this.resetNewPassword = "";
    this.resetConfirmPassword = "";
    this.resetTarget.set(u);
    this.resetOpen.set(true);
  }

  closeReset() {
    if (this.resetBusy()) return;
    this.resetOpen.set(false);
    this.resetTarget.set(null);
    this.resetErr.set(null);
    this.resetOk.set(false);
    this.resetNewPassword = "";
    this.resetConfirmPassword = "";
  }

  async submitReset() {
    const u = this.resetTarget();
    if (!u?.id) return;
    const p1 = String(this.resetNewPassword ?? "");
    const p2 = String(this.resetConfirmPassword ?? "");
    if (p1.length < 6) return this.resetErr.set("Password too short (min 6).");
    if (p1 !== p2) return this.resetErr.set("Passwords do not match.");
    if (!confirm("Reset password now?")) return;

    this.resetBusy.set(true);
    this.resetErr.set(null);
    this.resetOk.set(false);
    try {
      await this.gql.request(`mutation ResetUserPassword($userId: ID!, $newPassword: String!) { resetUserPassword(userId:$userId, newPassword:$newPassword) }`, {
        userId: u.id,
        newPassword: p1
      });
      this.resetOk.set(true);
      setTimeout(() => this.closeReset(), 700);
    } catch (e: any) {
      this.resetErr.set(String(e?.message ?? e));
    } finally {
      this.resetBusy.set(false);
    }
  }

  async suspend(id: string) {
    this.closeMenu();
    if (!confirm("Suspend this user?")) return;
    await this.gql.request(`mutation Suspend($id: ID!){ suspendUser(id:$id){ id } }`, { id });
    await this.load();
  }

  async activate(id: string) {
    this.closeMenu();
    await this.gql.request(`mutation Activate($id: ID!){ activateUser(id:$id){ id } }`, { id });
    await this.load();
  }

  async remove(id: string, name: string) {
    this.closeMenu();
    if (!confirm(`Delete user ${name}?`)) return;
    await this.gql.request(`mutation Delete($id: ID!){ deleteUser(id:$id){ id } }`, { id });
    await this.load();
  }
}
