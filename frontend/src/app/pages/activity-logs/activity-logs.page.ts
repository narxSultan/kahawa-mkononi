import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Activity Logs" | t }}</h2>
          <div class="muted">{{ "Audit trail of important actions" | t }}</div>
        </div>
        <div class="right">
	          <select class="sel" [(ngModel)]="module" (change)="resetAndLoad()">
            <option value="">{{ "All modules" | t }}</option>
            <option value="USER_MANAGEMENT">{{ "User management" | t }}</option>
            <option value="NOTIFICATIONS">{{ "Notifications module" | t }}</option>
            <option value="DUTIES">{{ "Duties module" | t }}</option>
            <option value="HANDOVER">{{ "Handover module" | t }}</option>
          </select>
          <button class="btn" (click)="load()" [disabled]="loading()">
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
	        <div class="table-wrap">
	          <table class="table">
            <thead>
              <tr>
                <th>{{ "At" | t }}</th>
                <th>{{ "User" | t }}</th>
                <th>{{ "Module" | t }}</th>
                <th>{{ "Action" | t }}</th>
                <th>{{ "Description" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of logs()">
                <td>{{ (a.createdAt||'').slice(0,16).replace('T',' ') }}</td>
                <td>{{ a.user?.fullName || "—" }}</td>
                <td><span class="badge">{{ moduleLabel(a.module) | t }}</span></td>
                <td style="font-weight:800">{{ a.action }}</td>
                <td class="msg">{{ a.description }}</td>
                <td style="text-align:right">
                  <button class="btn danger icon" (click)="remove(a.id)" [disabled]="deletingId()===a.id" aria-label="Delete">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
              <tr *ngIf="!logs().length">
                <td colspan="6" class="muted" style="padding:14px">{{ "No activity logs" | t }}</td>
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
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .msg{max-width:520px}
	      .btn.icon{width:40px;height:40px;padding:0;display:inline-flex;align-items:center;justify-content:center}
	      .btn.icon svg{width:18px;height:18px;fill:currentColor}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	      @media (max-width: 720px){.msg{max-width:260px}}
	    `
	  ]
})
export class ActivityLogsPageComponent {
  private gql = inject(GraphqlClient);

	  loading = signal(false);
	  deletingId = signal<string | null>(null);
	  module = "";
	  logs = signal<any[]>([]);
	  page = signal(1);
	  readonly pageSize = 10;
	  pageInfo = signal<any | null>(null);
	  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));

  moduleLabel(v: string): string {
    if (v === "USER_MANAGEMENT") return "User management";
    if (v === "NOTIFICATIONS") return "Notifications module";
    if (v === "DUTIES") return "Duties module";
    if (v === "HANDOVER") return "Handover module";
    return v;
  }

  ngOnInit() {
    void this.load();
  }

	  async load() {
	    this.loading.set(true);
	    try {
	      const data = await this.gql.request<{ activityLogs: { nodes: any[]; pageInfo: any } }>(
	        `query Logs($module: String, $page: Int!, $pageSize: Int!) {
	          activityLogs(pagination:{page:$page,pageSize:$pageSize}, module:$module) {
	            nodes { id action module description createdAt user { fullName } }
	            pageInfo { page pageSize total hasNextPage }
	          }
	        }`,
	        { module: this.module || null, page: this.page(), pageSize: this.pageSize }
	      );
	      this.logs.set(data.activityLogs.nodes);
	      this.pageInfo.set(data.activityLogs.pageInfo);
	    } finally {
	      this.loading.set(false);
	    }
	  }

	  resetAndLoad() {
	    this.page.set(1);
	    void this.load();
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

  async remove(id: string) {
    if (!id) return;
    this.deletingId.set(id);
    try {
      await this.gql.request(`mutation Del($id: ID!){ deleteActivityLog(id:$id) }`, { id });
      this.logs.set(this.logs().filter((x) => x.id !== id));
    } finally {
      this.deletingId.set(null);
    }
  }
}
