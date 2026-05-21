import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Service Centres" | t }}</h2>
          <div class="muted">{{ "Add, edit, suspend, or review service centres" | t }}</div>
	        </div>
	        <div class="right">
		          <input class="search" [(ngModel)]="search" placeholder="{{ 'Search name / location' | t }}" (input)="onSearchInput()" />
	          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
              />
            </svg>
            {{ "Search" | t }}
          </button>
          <button class="btn primary" *ngIf="isAdmin()" (click)="toggleCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ "New Centre" | t }}
          </button>
        </div>
      </div>

      <div class="card pad" *ngIf="showCreate() && isAdmin()">
	        <h3 style="margin:0 0 10px 0">{{ "Create service centre" | t }}</h3>
	        <div class="grid form">
	          <div class="field"><label>{{ "Centre name" | t }}</label><input [(ngModel)]="form.centreName" /></div>
	          <div class="field"><label>{{ "Location name" | t }}</label><input [(ngModel)]="form.locationName" /></div>
	          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="form.phone" /></div>
	          <div class="field"><label>{{ "Manager name" | t }}</label><input [(ngModel)]="form.managerName" /></div>
	          <div class="field">
	            <label>{{ "Status" | t }}</label>
	            <select [(ngModel)]="form.status">
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </select>
          </div>
        </div>
        <div class="actions">
          <button class="btn" (click)="toggleCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
            </svg>
            {{ "Cancel" | t }}
          </button>
          <button class="btn primary" (click)="create()" [disabled]="saving()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
            </svg>
            {{ "Create" | t }}
          </button>
        </div>
      </div>

	      <div class="card pad" style="margin-top:12px">
	        <div class="table-wrap">
	          <table class="table">
            <thead>
              <tr>
                <th>{{ "Centre" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th>{{ "Location" | t }}</th>
                <th>{{ "Phone" | t }}</th>
                <th>{{ "Manager" | t }}</th>
                <th>{{ "Created" | t }}</th>
                <th *ngIf="isAdmin()"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of centres()">
                <td>{{ c.centreName }}</td>
                <td>
                  <span class="badge" [class.success]="c.status==='ACTIVE'" [class.warning]="c.status==='SUSPENDED'">
                    {{ c.status }}
                  </span>
                </td>
                <td>{{ c.locationName || "—" }}</td>
                <td>{{ c.phone || "—" }}</td>
                <td>{{ c.managerName || "—" }}</td>
                <td>{{ (c.createdAt || "").slice(0, 10) }}</td>
                <td *ngIf="isAdmin()">
                  <div class="act">
                    <button class="btn" (click)="openEdit(c)">
                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z"
                        />
	                    </svg>
	                      {{ "Edit" | t }}
	                    </button>
                    <button class="btn" *ngIf="c.status==='ACTIVE'" (click)="setStatus(c.id,'SUSPENDED')" [disabled]="saving()">
                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 5h4v14H6V5Zm8 0h4v14h-4V5Z" />
	                      </svg>
	                      {{ "Suspend" | t }}
	                    </button>
                    <button class="btn" *ngIf="c.status==='SUSPENDED'" (click)="setStatus(c.id,'ACTIVE')" [disabled]="saving()">
                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
	                      </svg>
	                      {{ "Activate" | t }}
	                    </button>
                  </div>
                </td>
              </tr>
	              <tr *ngIf="!centres().length">
	                <td colspan="7" class="muted" style="padding:14px">{{ "No centres found" | t }}</td>
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

      <div class="card pad" style="margin-top:12px" *ngIf="editing() as e">
	        <h3 style="margin:0 0 10px 0">{{ "Edit service centre" | t }}</h3>
	        <div class="grid form">
	          <div class="field"><label>{{ "Centre name" | t }}</label><input [(ngModel)]="e.centreName" /></div>
	          <div class="field"><label>{{ "Location name" | t }}</label><input [(ngModel)]="e.locationName" /></div>
	          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="e.phone" /></div>
	          <div class="field"><label>{{ "Manager name" | t }}</label><input [(ngModel)]="e.managerName" /></div>
	        </div>
        <div class="actions">
          <button class="btn" (click)="editing.set(null)">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
            </svg>
	            {{ "Cancel" | t }}
	          </button>
          <button class="btn primary" (click)="saveEdit()" [disabled]="saving()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
            </svg>
	            {{ "Save" | t }}
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
      .search{padding:10px 12px;border:1px solid var(--border);border-radius:12px;min-width:260px}
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}.search{min-width:100%}}
	      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
	      .act{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	    `
	  ]
})
export class ServiceCentresPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  search = "";
  loading = signal(false);
  saving = signal(false);
  centres = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
  private searchTimer: any = null;
  showCreate = signal(false);
  editing = signal<any | null>(null);
  isAdmin = computed(() => this.auth.role() === "ADMIN");

  form: any = { centreName: "", locationName: "", phone: "", managerName: "", status: "ACTIVE" };

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  toggleCreate() {
    this.showCreate.set(!this.showCreate());
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{ serviceCentres: { nodes: any[]; pageInfo: any } }>(
        `query Centres($search: String, $page: Int!, $pageSize: Int!) {
          serviceCentres(pagination:{page:$page,pageSize:$pageSize}, search:$search) { nodes { id centreName status locationName phone managerName createdAt } pageInfo { page pageSize total hasNextPage } }
        }`,
        { search: this.search.trim() || null, page: this.page(), pageSize: this.pageSize }
      );
      this.centres.set(data.serviceCentres.nodes);
      this.pageInfo.set(data.serviceCentres.pageInfo);
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput() {
    try {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    } catch {
      // ignore
    }
    this.searchTimer = setTimeout(() => {
      this.page.set(1);
      void this.load();
    }, 250);
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

  async create() {
    this.saving.set(true);
    try {
      const input: any = {
        centreName: this.form.centreName.trim(),
        locationName: this.form.locationName?.trim() || null,
        phone: this.form.phone?.trim() || null,
        managerName: this.form.managerName?.trim() || null,
        status: this.form.status || "ACTIVE"
      };
      await this.gql.request(`mutation CreateCentre($input: CreateServiceCentreInput!) { createServiceCentre(input:$input){ id } }`, { input });
      this.showCreate.set(false);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  openEdit(c: any) {
    this.editing.set({ ...c });
  }

  async saveEdit() {
    const e = this.editing();
    if (!e) return;
    this.saving.set(true);
    try {
      const input = {
        centreName: e.centreName?.trim() || null,
        locationName: e.locationName?.trim() || null,
        phone: e.phone?.trim() || null,
        managerName: e.managerName?.trim() || null
      };
      await this.gql.request(`mutation UpdateCentre($id: ID!, $input: UpdateServiceCentreInput!){ updateServiceCentre(id:$id,input:$input){ id } }`, { id: e.id, input });
      this.editing.set(null);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async setStatus(id: string, status: "ACTIVE" | "SUSPENDED") {
    this.saving.set(true);
    try {
      await this.gql.request(`mutation Status($id: ID!, $status: CentreStatus!){ setServiceCentreStatus(id:$id,status:$status){ id } }`, { id, status });
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
