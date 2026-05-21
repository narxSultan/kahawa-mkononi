import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, computed, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { APP_CONFIG } from "../../core/config";
import { TranslatePipe } from "../../shared/translate.pipe";
import { tokenStorage } from "../../core/token.storage";

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

@Component({
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="container">
      <h2>{{ "My Profile" | t }}</h2>
      <div class="muted">{{ "Account overview, duties, and notifications" | t }}</div>

      <div class="grid two" style="margin-top:12px">
        <div class="card pad">
          <div class="title">{{ "Account" | t }}</div>
          <div class="sub" *ngIf="!me()">{{ "Loading..." | t }}</div>
          <div class="list" *ngIf="me() as u">
            <div class="accountHead">
              <div class="avatar">
                <img *ngIf="u.profilePhoto; else ph" [src]="absUrl(u.profilePhoto)" alt="Profile photo" />
                <ng-template #ph><div class="ph">👤</div></ng-template>
              </div>
              <div class="who">
                <div style="font-weight:800">{{ u.fullName }}</div>
                <div class="sub">{{ u.email }}</div>
              </div>
              <div class="uploadRow">
                <input type="file" accept="image/*" (change)="onFile($event)" />
                <button class="btn" (click)="uploadPhoto()" [disabled]="!selectedFile || uploading()">{{ uploading() ? ("Uploading..." | t) : ("Upload photo" | t) }}</button>
              </div>
            </div>
            <div class="err" *ngIf="uploadErr()">{{ uploadErr() }}</div>
            <div class="item"><div class="k">{{ "Full name" | t }}</div><div class="v">{{ u.fullName }}</div></div>
            <div class="item"><div class="k">{{ "Email" | t }}</div><div class="v">{{ u.email }}</div></div>
            <div class="item"><div class="k">{{ "Phone" | t }}</div><div class="v">{{ u.phone || "—" }}</div></div>
            <div class="item"><div class="k">{{ "Username" | t }}</div><div class="v">{{ u.username || "—" }}</div></div>
            <div class="item"><div class="k">{{ "Role" | t }}</div><div class="v"><span class="badge">{{ u.role?.name }}</span></div></div>
            <div class="item"><div class="k">{{ "Centre" | t }}</div><div class="v">{{ u.serviceCentre?.centreName || "—" }}</div></div>
            <div class="item"><div class="k">{{ "Status" | t }}</div>
              <div class="v">
                <span class="badge" [class.success]="u.status==='ACTIVE'" [class.warning]="u.status==='SUSPENDED'" [class.danger]="u.status==='DELETED'">{{ u.status }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card pad">
          <div class="head">
            <div>
              <div class="title">{{ "Notifications" | t }}</div>
              <div class="sub">{{ "Unread" | t }}: {{ unreadCount() }}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="btn" (click)="load(true)" [disabled]="loading()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
                  />
                </svg>
                {{ "Refresh" | t }}
              </button>
            </div>
          </div>
          <div class="muted" *ngIf="!notifications().length">{{ "No notifications" | t }}</div>
          <div class="list" *ngIf="notifications().length">
            <div class="note" *ngFor="let n of notifications()">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
                <div class="name">{{ n.title }}</div>
                <span class="badge" [class.success]="n.isRead" [class.warning]="!n.isRead">{{ n.isRead ? ("Read" | t) : ("Unread" | t) }}</span>
              </div>
              <div class="sub">{{ n.type }} · {{ (n.createdAt||'').slice(0,16).replace('T',' ') }}</div>
            </div>
          </div>
          <div class="pager" *ngIf="pageInfo()">
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
      </div>

      <div class="card pad" style="margin-top:12px">
        <div class="head">
          <div>
            <div class="title">{{ "My Duties" | t }}</div>
            <div class="sub">{{ "Assigned tasks" | t }}</div>
          </div>
        </div>
        <div class="muted" *ngIf="!duties().length">{{ "No duties assigned" | t }}</div>
        <div class="list" *ngIf="duties().length">
          <div class="note" *ngFor="let d of duties()">
            <div class="name">{{ d.title }}</div>
            <div class="sub">{{ d.status }} · Priority: {{ d.priority }}<span *ngIf="d.dueDate"> · Due: {{ (d.dueDate||'').slice(0,10) }}</span></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .grid.two{grid-template-columns:1fr 1fr}
      @media (max-width: 900px){.grid.two{grid-template-columns:1fr}}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .list{margin-top:10px;display:flex;flex-direction:column;gap:10px}
      .item{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .k{font-size:12px;color:var(--muted)}
      .v{font-weight:800}
      .note{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(245,239,230,.45)}
      .name{font-weight:800;color:var(--dark)}
      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
      .avatar{width:56px;height:56px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:rgba(245,239,230,.45);display:flex;align-items:center;justify-content:center}
      .avatar img{width:100%;height:100%;object-fit:cover}
      .ph{font-size:26px}
      .err{margin:6px 0;color:var(--danger);font-weight:700}
      .accountHead{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:8px;text-align:center}
      .who{display:flex;flex-direction:column;align-items:center}
      .uploadRow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
    `
  ]
})
export class ProfilePageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private http = inject(HttpClient);

  loading = signal(false);
  me = signal<any | null>(null);
  unreadCount = signal(0);
  notifications = signal<any[]>([]);
  duties = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));

  role = computed(() => this.auth.role());
  uploading = signal(false);
  uploadErr = signal<string | null>(null);
  selectedFile: File | null = null;

  ngOnInit() {
    void this.load(true);
  }

  async load(reset = false) {
    this.loading.set(true);
    try {
      await this.auth.init();
      if (reset) this.page.set(1);
          const data = await this.gql.request<{
        me: any;
        unreadNotificationCount: number;
        notifications: { nodes: any[]; pageInfo: any };
        myDuties: { nodes: any[] };
      }>(
        `query Profile($page:Int!,$pageSize:Int!) {
          me { id fullName email phone username profilePhoto status role{ name } serviceCentre{ id centreName } }
          unreadNotificationCount
          notifications(pagination:{page:$page,pageSize:$pageSize}){ nodes{ id title type createdAt isRead } pageInfo{ page pageSize total hasNextPage } }
          myDuties(pagination:{page:1,pageSize:10}){ nodes{ id title priority status dueDate } }
        }`,
        { page: this.page(), pageSize: this.pageSize }
      );
      this.me.set(data.me);
      this.unreadCount.set(data.unreadNotificationCount);
      this.notifications.set(data.notifications.nodes ?? []);
      this.pageInfo.set(data.notifications.pageInfo ?? null);
      this.duties.set(data.myDuties.nodes);
    } finally {
      this.loading.set(false);
    }
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    void this.load(false);
  }

  nextPage() {
    if (!this.pageInfo()?.hasNextPage) return;
    this.page.set(this.page() + 1);
    void this.load(false);
  }

  absUrl(url: string | null | undefined) {
    return absUrl(url);
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  async uploadPhoto() {
    if (!this.selectedFile) return;
    this.uploading.set(true);
    this.uploadErr.set(null);
    try {
      const fd = new FormData();
      fd.append("file", this.selectedFile);
      const token = tokenStorage.getAccessToken();
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${apiBase()}/upload/profile`, fd, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
      );
      const url = String(res?.url ?? "").trim();
      if (!url) throw new Error("Upload failed");
      await this.gql.request(`mutation U($input: UpdateMyAccountInput!){ updateMyAccount(input:$input){ id profilePhoto } }`, { input: { profilePhoto: url } });
      await this.load(true);
    } catch (e: any) {
      this.uploadErr.set(String(e?.message ?? e));
    } finally {
      this.uploading.set(false);
    }
  }
}
