import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type DutyPriority = "LOW" | "MEDIUM" | "HIGH";
type DutyStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Duty Assignment" | t }}</h2>
          <div class="muted">{{ "Assign duties to staff under a service centre" | t }}</div>
        </div>
        <div class="right">
          <select class="sel" *ngIf="isAdmin()" [(ngModel)]="serviceCentreId" (change)="onCentreChange()">
            <option value="">{{ "Select centre..." | t }}</option>
            <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
          </select>
          <button class="btn" (click)="bootstrap()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
        </div>
      </div>

	      <div class="card pad" style="margin-top:12px" *ngIf="canShowForm()">
	        <h3 style="margin:0 0 10px 0">{{ "Assign new duty" | t }}</h3>
	        <div class="grid form">
	          <div class="field" style="grid-column:1/-1"><label>{{ "Title" | t }}</label><input [(ngModel)]="form.title" /></div>
	          <div class="field" style="grid-column:1/-1"><label>{{ "Description" | t }}</label><textarea rows="2" [(ngModel)]="form.description"></textarea></div>

	          <div class="field">
	            <label>{{ "Assign to" | t }}</label>
	            <select [(ngModel)]="form.assignedToUserId">
	              <option value="">{{ "Select..." | t }}</option>
	              <option *ngFor="let u of staff()" [value]="u.id">{{ u.fullName }}</option>
	            </select>
	          </div>
	          <div class="field">
	            <label>{{ "Priority" | t }}</label>
	            <select [(ngModel)]="form.priority">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
	          <div class="field">
	            <label>{{ "Due date" | t }}</label>
	            <input type="date" [(ngModel)]="form.dueDate" />
	          </div>
	        </div>
        <div class="actions">
          <button class="btn primary" (click)="create()" [disabled]="saving() || !canCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm-1 14-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z" />
            </svg>
            {{ "Assign" | t }}
          </button>
        </div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>

      <div class="card pad" style="margin-top:12px" *ngIf="serviceCentreId || !isAdmin()">
        <div class="head">
          <div>
            <div class="title">Centre duties</div>
            <div class="sub">Track progress</div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ "Title" | t }}</th>
                <th>{{ "Assigned to" | t }}</th>
                <th>{{ "Priority" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th>{{ "Due" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of duties()">
                <td style="font-weight:800">{{ d.title }}</td>
                <td>{{ d.assignedToUser?.fullName }}</td>
                <td><span class="badge">{{ d.priority }}</span></td>
                <td>
                  <select class="sel" [(ngModel)]="d.status" (change)="updateStatus(d.id, d.status)">
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </td>
                <td>{{ d.dueDate ? (d.dueDate||'').slice(0,10) : "—" }}</td>
                <td style="text-align:right">
                  <button class="btn" (click)="addComment(d.id)">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-3 3V6a2 2 0 0 1 2-2Z" />
                    </svg>
                    Comment
                  </button>
                </td>
              </tr>
              <tr *ngIf="!duties().length">
                <td colspan="6" class="muted" style="padding:14px">{{ "No duties" | t }}</td>
              </tr>
            </tbody>
          </table>
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
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .error{margin-top:10px;color:var(--danger);white-space:pre-line}
      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
    `
  ]
})
export class DutiesPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  centres = signal<any[]>([]);
  staff = signal<any[]>([]);
  duties = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));

  serviceCentreId = "";

  isAdmin = computed(() => this.auth.role() === "ADMIN");

  form: any = {
    title: "",
    description: "",
    assignedToUserId: "",
    priority: "MEDIUM" as DutyPriority,
    dueDate: ""
  };

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  canShowForm = computed(() => (this.isAdmin() ? Boolean(this.serviceCentreId) : true));
  canCreate = computed(() => Boolean(this.form.title?.trim() && this.form.assignedToUserId));

  onCentreChange() {
    this.page.set(1);
    void this.bootstrap();
  }

  async bootstrap() {
    this.loading.set(true);
    this.error.set(null);
    try {
      if (this.isAdmin()) {
        const centres = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
          `query Centres { serviceCentres(pagination:{page:1,pageSize:200}){ nodes{ id centreName } } }`
        );
        this.centres.set(centres.serviceCentres.nodes);
      } else {
        this.serviceCentreId = this.auth.user()?.serviceCentre?.id ?? "";
      }

      if (!this.serviceCentreId && this.isAdmin()) {
        this.staff.set([]);
        this.duties.set([]);
        this.pageInfo.set(null);
        return;
      }

      await Promise.all([this.loadStaff(), this.loadDuties()]);
    } finally {
      this.loading.set(false);
    }
  }

  async loadStaff() {
    if (!this.serviceCentreId && this.isAdmin()) return;
    const data = await this.gql.request<{ users: { nodes: any[] } }>(
      `query Staff($serviceCentreId: ID, $role: RoleName) {
        users(pagination:{page:1,pageSize:200}, serviceCentreId:$serviceCentreId, role:$role) { nodes{ id fullName email } }
      }`,
      { serviceCentreId: this.isAdmin() ? this.serviceCentreId : null, role: "STAFF" }
    );
    this.staff.set(data.users.nodes);
  }

  async loadDuties() {
    const data = await this.gql.request<{ duties: { nodes: any[]; pageInfo: any } }>(
      `query Duties($serviceCentreId: ID, $page: Int!, $pageSize: Int!) {
        duties(pagination:{page:$page,pageSize:$pageSize}, serviceCentreId:$serviceCentreId) {
          nodes { id title priority status dueDate assignedToUser { fullName } }
          pageInfo { page pageSize total hasNextPage }
        }
      }`,
      { serviceCentreId: this.isAdmin() ? this.serviceCentreId : null, page: this.page(), pageSize: this.pageSize }
    );
    this.duties.set(data.duties.nodes ?? []);
    this.pageInfo.set(data.duties.pageInfo ?? null);
  }

  private async reloadDuties() {
    this.loading.set(true);
    try {
      await this.loadDuties();
    } finally {
      this.loading.set(false);
    }
  }

  async create() {
    this.error.set(null);
    this.saving.set(true);
    try {
      const input: any = {
        title: this.form.title.trim(),
        description: this.form.description?.trim() || null,
        assignedToUserId: this.form.assignedToUserId,
        priority: this.form.priority,
        dueDate: this.form.dueDate ? new Date(this.form.dueDate).toISOString() : null
      };
      await this.gql.request(`mutation Create($input: CreateDutyInput!){ createDuty(input:$input){ id } }`, { input });
      this.form = { title: "", description: "", assignedToUserId: "", priority: "MEDIUM", dueDate: "" };
      this.page.set(1);
      await this.loadDuties();
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  async updateStatus(id: string, status: DutyStatus) {
    await this.gql.request(`mutation Update($id: ID!, $input: UpdateDutyInput!){ updateDuty(id:$id,input:$input){ id } }`, { id, input: { status } });
  }

  async addComment(dutyId: string) {
    const msg = prompt("Comment");
    if (!msg?.trim()) return;
    await this.gql.request(`mutation Comment($input: AddDutyCommentInput!){ addDutyComment(input:$input){ id } }`, { input: { dutyId, message: msg.trim() } });
    await this.loadDuties();
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    void this.reloadDuties();
  }

  nextPage() {
    if (!this.pageInfo()?.hasNextPage) return;
    this.page.set(this.page() + 1);
    void this.reloadDuties();
  }
}
