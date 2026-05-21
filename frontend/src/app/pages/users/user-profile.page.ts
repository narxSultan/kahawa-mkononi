import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "User Profile" | t }}</h2>
          <div class="muted">{{ "Account details, duties, and activity" | t }}</div>
        </div>
        <div class="right">
          <button class="btn" (click)="back()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 11H7.8l5.6-5.6L12 4 4 12l8 8 1.4-1.4L7.8 13H20v-2Z" />
            </svg>
            {{ "Back" | t }}
          </button>
          <button class="btn" (click)="edit()" *ngIf="canEdit()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z"
              />
            </svg>
            {{ "Edit" | t }}
          </button>
          <button class="btn" *ngIf="canSuspend()" (click)="suspend()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
            </svg>
            {{ "Suspend" | t }}
          </button>
          <button class="btn" *ngIf="canActivate()" (click)="activate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
            </svg>
            {{ "Activate" | t }}
          </button>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px" *ngIf="user() as u">
        <div class="grid">
          <div><div class="k">Full name</div><div class="v">{{ u.fullName }}</div></div>
          <div><div class="k">Email</div><div class="v">{{ u.email }}</div></div>
          <div><div class="k">Phone</div><div class="v">{{ u.phone || "—" }}</div></div>
          <div><div class="k">Username</div><div class="v">{{ u.username || "—" }}</div></div>
          <div><div class="k">Role</div><div class="v"><span class="badge">{{ u.role?.name }}</span></div></div>
          <div><div class="k">Service centre</div><div class="v">{{ u.serviceCentre?.centreName || "—" }}</div></div>
          <div><div class="k">Status</div>
            <div class="v">
              <span class="badge" [class.success]="u.status==='ACTIVE'" [class.warning]="u.status==='SUSPENDED'" [class.danger]="u.status==='DELETED'">
                {{ u.status }}
              </span>
            </div>
          </div>
          <div><div class="k">Joined</div><div class="v">{{ (u.createdAt||'').slice(0,10) }}</div></div>
        </div>
      </div>

      <div class="grid two" style="margin-top:12px">
        <div class="card pad">
          <div class="head">
            <div>
              <div class="title">Assigned Duties</div>
              <div class="sub">Latest tasks for this user</div>
            </div>
            <button class="btn" (click)="load()" [disabled]="loading()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
                />
              </svg>
              {{ "Refresh" | t }}
            </button>
          </div>

          <div class="muted" *ngIf="!duties().length">{{ "No duties" | t }}</div>
          <div class="list" *ngIf="duties().length">
            <div class="item" *ngFor="let d of duties()">
              <div class="name">{{ d.title }}</div>
              <div class="sub">{{ d.status }} · Priority: {{ d.priority }}<span *ngIf="d.dueDate"> · Due: {{ (d.dueDate||'').slice(0,10) }}</span></div>
            </div>
          </div>
        </div>

        <div class="card pad">
          <div class="head">
            <div>
              <div class="title">Recent Activities</div>
              <div class="sub">Last 20 logs</div>
            </div>
          </div>

          <div class="muted" *ngIf="!logs().length">{{ "No activity" | t }}</div>
          <div class="list" *ngIf="logs().length">
            <div class="item" *ngFor="let a of logs()">
              <div class="name">{{ a.action }}</div>
              <div class="sub">{{ a.module }} · {{ (a.createdAt||'').slice(0,16).replace('T',' ') }}</div>
              <div class="desc">{{ a.description }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="error" *ngIf="error()">{{ error() }}</div>
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      @media (max-width:720px){.grid{grid-template-columns:1fr}}
      .k{font-size:12px;color:var(--muted)}
      .v{font-weight:700}
      .grid.two{grid-template-columns:1fr 1fr}
      @media (max-width: 900px){.grid.two{grid-template-columns:1fr}}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .list{display:flex;flex-direction:column;gap:10px}
      .item{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(245,239,230,.45)}
      .name{font-weight:800;color:var(--dark)}
      .item .sub{margin-top:4px}
      .desc{margin-top:6px;font-size:12px;color:var(--text)}
      .error{margin-top:12px;color:var(--danger);white-space:pre-line}
    `
  ]
})
export class UserProfilePageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);

  user = signal<any | null>(null);
  duties = signal<any[]>([]);
  logs = signal<any[]>([]);

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  isManager = computed(() => this.auth.role() === "MANAGER");

  private get userId() {
    return String(this.route.snapshot.paramMap.get("id") || "");
  }

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  async load() {
    if (!this.userId) return;
    this.loading.set(true);
    this.error.set(null);
    try {
      const data = await this.gql.request<{ user: any; userDuties: { nodes: any[] }; activityLogs: { nodes: any[] } }>(
        `query Profile($id: ID!) {
          user(id:$id) { id fullName email phone username status createdAt role{ name } serviceCentre{ id centreName } }
          userDuties(userId:$id, pagination:{page:1,pageSize:10}) { nodes { id title priority status dueDate } }
          activityLogs(pagination:{page:1,pageSize:20}, userId:$id) { nodes { id action module description createdAt } }
        }`,
        { id: this.userId }
      );
      this.user.set(data.user);
      this.duties.set(data.userDuties.nodes);
      this.logs.set(data.activityLogs.nodes);
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    void this.router.navigateByUrl("/users");
  }
  edit() {
    void this.router.navigateByUrl(`/users/${this.userId}/edit`);
  }
  canEdit = computed(() => this.isAdmin() || this.isManager());

  canSuspend = computed(() => {
    const u = this.user();
    if (!u) return false;
    if (u.status !== "ACTIVE") return false;
    if (this.isAdmin()) return u.role?.name !== "ADMIN";
    if (this.isManager()) return u.role?.name === "STAFF";
    return false;
  });
  canActivate = computed(() => {
    const u = this.user();
    if (!u) return false;
    if (u.status !== "SUSPENDED") return false;
    if (this.isAdmin()) return u.role?.name !== "ADMIN";
    if (this.isManager()) return u.role?.name === "STAFF";
    return false;
  });

  async suspend() {
    if (!confirm("Suspend this user?")) return;
    await this.gql.request(`mutation Suspend($id: ID!){ suspendUser(id:$id){ id status } }`, { id: this.userId });
    await this.load();
  }
  async activate() {
    await this.gql.request(`mutation Activate($id: ID!){ activateUser(id:$id){ id status } }`, { id: this.userId });
    await this.load();
  }
}
