import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type HandoverStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

const PERMISSIONS = [
  { code: "MANAGE_USERS", label: "Manage users" },
  { code: "SEND_NOTIFICATIONS", label: "Send notifications" },
  { code: "ASSIGN_DUTIES", label: "Assign duties" },
  { code: "VIEW_REPORTS", label: "View reports" }
] as const;

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Responsibility Handover" | t }}</h2>
          <div class="muted">{{ "Delegate selected manager tasks to staff during leave" | t }}</div>
        </div>
        <div class="right">
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

      <div class="card pad" style="margin-top:12px">
        <h3 style="margin:0 0 10px 0">{{ editingId() ? ("Edit handover" | t) : ("Create handover" | t) }}</h3>
        <div class="muted" *ngIf="editingId()">{{ "Editing handover" | t }}: <b>{{ editingId()?.slice(0,6) }}</b></div>
        <div class="grid form">
	          <div class="field">
	            <label>{{ "Assign to staff" | t }}</label>
	            <select [ngModel]="assignedStaffId()" (ngModelChange)="assignedStaffId.set($event)">
	              <option value="">{{ "Select..." | t }}</option>
	              <option *ngFor="let u of staff()" [value]="u.id">{{ u.fullName }} · {{ u.email }}</option>
	            </select>
	          </div>
	          <div class="field"><label>{{ "Reason" | t }}</label><input [ngModel]="reason()" (ngModelChange)="reason.set($event)" placeholder="{{ 'Leave / travel / other' | t }}" /></div>
	          <div class="field"><label>{{ "Start date" | t }}</label><input type="date" [ngModel]="startDate()" (ngModelChange)="startDate.set($event)" /></div>
	          <div class="field"><label>{{ "End date" | t }}</label><input type="date" [ngModel]="endDate()" (ngModelChange)="endDate.set($event)" /></div>
	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Notes" | t }}</label>
	            <textarea rows="2" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
	          </div>
	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Permissions" | t }}</label>
	            <div class="perms">
	              <label *ngFor="let p of permissions">
	                <input type="checkbox" [checked]="selected().has(p.code)" (change)="toggle(p.code, $event.target.checked)" />
	                {{ p.label | t }}
	              </label>
	            </div>
	          </div>
        </div>
        <div class="actions">
          <button class="btn primary" (click)="save()" [disabled]="saving() || !canCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ editingId() ? ("Save changes" | t) : ("Create handover" | t) }}
          </button>
          <button class="btn" *ngIf="editingId()" (click)="cancelEdit()" [disabled]="saving()">{{ "Cancel" | t }}</button>
        </div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>

      <div class="card pad" style="margin-top:12px">
        <div class="head">
          <div>
            <div class="title">Handovers</div>
            <div class="sub">Latest records</div>
          </div>
        </div>

        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ "Staff" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th>{{ "Start" | t }}</th>
                <th>{{ "End" | t }}</th>
                <th>{{ "Permissions" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let h of handovers()">
                <td>{{ h.assignedStaff?.fullName }}</td>
                <td>
                  <span class="badge" [class.success]="h.status==='ACTIVE'" [class.warning]="h.status==='CANCELLED'">{{ h.status }}</span>
                </td>
                <td>{{ (h.startDate||'').slice(0,10) }}</td>
                <td>{{ (h.endDate||'').slice(0,10) }}</td>
                <td>{{ (h.permissions || []).map(p=>p.code).join(', ') || '—' }}</td>
                <td style="text-align:right">
                  <button class="btn" *ngIf="h.status==='ACTIVE'" (click)="setStatus(h.id,'COMPLETED')">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
                    </svg>
                    Complete
                  </button>
                  <button class="btn danger" *ngIf="h.status==='ACTIVE'" (click)="setStatus(h.id,'CANCELLED')">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
                    </svg>
                    Cancel
                  </button>
                  <button class="btn" *ngIf="h.status==='ACTIVE'" (click)="edit(h)">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-2.17Z"/>
                    </svg>
                    {{ "Edit" | t }}
                  </button>
                  <button class="btn danger" *ngIf="h.status!=='ACTIVE'" (click)="remove(h)">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/>
                    </svg>
                    {{ "Delete" | t }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="!handovers().length">
                <td colspan="6" class="muted" style="padding:14px">{{ "No handovers" | t }}</td>
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

      <div class="overlay" *ngIf="deleteTarget() as h">
        <div class="dialog card">
          <div class="title">{{ "Delete this handover?" | t }}</div>
          <div class="sub">{{ "This will permanently remove the record." | t }}</div>
          <div class="mini">
            <div><b>{{ "Staff" | t }}:</b> {{ h.assignedStaff?.fullName || "—" }}</div>
            <div><b>{{ "Status" | t }}:</b> {{ h.status }}</div>
            <div><b>{{ "Start" | t }}:</b> {{ (h.startDate||'').slice(0,10) }}</div>
            <div><b>{{ "End" | t }}:</b> {{ (h.endDate||'').slice(0,10) }}</div>
          </div>
          <div class="actions">
            <button class="btn" (click)="closeDelete()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              {{ "Cancel" | t }}
            </button>
            <button class="btn danger" (click)="confirmDelete()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
              {{ "Delete" | t }}
            </button>
          </div>
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
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .perms{display:flex;gap:12px;flex-wrap:wrap}
      .error{margin-top:10px;color:var(--danger);white-space:pre-line}
      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
      .dialog{width:100%;max-width:420px;padding:18px}
      .mini{margin-top:10px;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
      @media (max-width: 480px){.actions{justify-content:stretch}.actions .btn{flex:1}}
    `
  ]
})
export class HandoverPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  error = signal<string | null>(null);

  staff = signal<any[]>([]);
  handovers = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));

  permissions = PERMISSIONS;
  selected = signal(new Set<string>(["VIEW_REPORTS"]));

  assignedStaffId = signal("");
  reason = signal("");
  notes = signal("");
  startDate = signal("");
  endDate = signal("");
  editingId = signal<string | null>(null);
  deleteTarget = signal<any | null>(null);

  canCreate = computed(
    () => Boolean(this.assignedStaffId().trim() && this.startDate().trim() && this.endDate().trim() && this.selected().size)
  );

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [users] = await Promise.all([
        this.gql.request<{ users: { nodes: any[] } }>(`query Staff { users(pagination:{page:1,pageSize:200}, role:STAFF){ nodes{ id fullName email } } }`),
        this.loadHandovers()
      ]);
      this.staff.set(users.users.nodes);
    } finally {
      this.loading.set(false);
    }
  }

  async loadHandovers() {
    const data = await this.gql.request<{ handovers: { nodes: any[]; pageInfo: any } }>(
      `query Handovers($page: Int!, $pageSize: Int!) {
        handovers(pagination:{page:$page,pageSize:$pageSize}){
          nodes{ id status reason notes startDate endDate assignedStaff{ id fullName } permissions{ code } }
          pageInfo { page pageSize total hasNextPage }
        }
      }`,
      { page: this.page(), pageSize: this.pageSize }
    );
    this.handovers.set(data.handovers.nodes ?? []);
    this.pageInfo.set(data.handovers.pageInfo ?? null);
  }

  private async reloadHandovers() {
    this.loading.set(true);
    try {
      await this.loadHandovers();
    } finally {
      this.loading.set(false);
    }
  }

  toggle(code: string, checked: boolean) {
    const next = new Set(this.selected());
    if (checked) next.add(code);
    else next.delete(code);
    this.selected.set(next);
  }

  cancelEdit() {
    this.editingId.set(null);
    this.assignedStaffId.set("");
    this.reason.set("");
    this.notes.set("");
    this.startDate.set("");
    this.endDate.set("");
    this.selected.set(new Set<string>(["VIEW_REPORTS"]));
  }

  edit(h: any) {
    this.editingId.set(String(h.id));
    this.assignedStaffId.set(String(h.assignedStaff?.id ?? ""));
    this.reason.set(String(h.reason ?? ""));
    this.notes.set(String(h.notes ?? ""));
    this.startDate.set(String(h.startDate ?? "").slice(0, 10));
    this.endDate.set(String(h.endDate ?? "").slice(0, 10));
    const perms = new Set<string>((h.permissions ?? []).map((p: any) => String(p.code)).filter(Boolean));
    this.selected.set(perms.size ? perms : new Set<string>(["VIEW_REPORTS"]));
  }

  async save() {
    this.saving.set(true);
    this.error.set(null);
    try {
      const toIsoLocalBoundary = (ymd: string, boundary: "start" | "end") => {
        const [yy, mm, dd] = String(ymd || "")
          .split("-")
          .map((x) => Number(x));
        if (!yy || !mm || !dd) throw new Error("INVALID_INPUT");
        return new Date(yy, mm - 1, dd, boundary === "start" ? 0 : 23, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 59, boundary === "start" ? 0 : 999).toISOString();
      };

      const base: any = {
        assignedStaffId: this.assignedStaffId(),
        reason: this.reason().trim() || null,
        notes: this.notes().trim() || null,
        startDate: toIsoLocalBoundary(this.startDate(), "start"),
        endDate: toIsoLocalBoundary(this.endDate(), "end"),
        permissions: [...this.selected()]
      };

      const id = this.editingId();
      if (id) {
        await this.gql.request(`mutation Update($input: UpdateHandoverInput!){ updateHandover(input:$input){ id } }`, { input: { id, ...base } });
      } else {
        await this.gql.request(`mutation Create($input: CreateHandoverInput!){ createHandover(input:$input){ id } }`, { input: base });
      }

      this.cancelEdit();
      this.page.set(1);
      await this.bootstrap();
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  closeDelete() {
    this.deleteTarget.set(null);
  }

  remove(h: any) {
    if (h?.status === "ACTIVE") {
      this.error.set("Cancel this handover first, then delete it.");
      return;
    }
    this.deleteTarget.set(h);
  }

  async confirmDelete() {
    const h = this.deleteTarget();
    if (!h) return;
    const id = String(h.id);
    this.saving.set(true);
    try {
      await this.gql.request(`mutation Del($id: ID!){ deleteHandover(id:$id) }`, { id });
      this.closeDelete();
      await this.bootstrap();
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
      this.closeDelete();
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(id: string, status: HandoverStatus) {
    await this.gql.request(`mutation Status($input: SetHandoverStatusInput!){ setHandoverStatus(input:$input){ id } }`, { input: { id, status } });
    await this.bootstrap();
  }

  prevPage() {
    if (this.page() <= 1) return;
    this.page.set(this.page() - 1);
    void this.reloadHandovers();
  }

  nextPage() {
    if (!this.pageInfo()?.hasNextPage) return;
    this.page.set(this.page() + 1);
    void this.reloadHandovers();
  }
}
