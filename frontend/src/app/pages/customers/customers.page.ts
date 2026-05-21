import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Customers" | t }}</h2>
          <div class="muted">{{ "Create, search, and manage customer contacts" | t }}</div>
        </div>
        <div class="right">
          <input class="search" [(ngModel)]="search" placeholder="{{ 'Search name or phone' | t }}" (input)="onSearchInput()" />
          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
              />
            </svg>
            {{ "Search" | t }}
          </button>
          <button class="btn primary" (click)="toggleCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ "New Customer" | t }}
          </button>
        </div>
      </div>

      <div class="card pad" *ngIf="showCreate()">
        <h3 style="margin:0 0 10px 0">{{ "Create customer" | t }}</h3>
        <div class="grid form">
          <div class="field"><label>{{ "Full name" | t }}</label><input [(ngModel)]="form.fullName" /></div>
          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="form.phone" placeholder="+255..." /></div>
          <div class="field"><label>{{ "Email" | t }}</label><input [(ngModel)]="form.email" placeholder="{{ 'optional' | t }}" /></div>
          <div class="field"><label>{{ "Address" | t }}</label><input [(ngModel)]="form.address" /></div>
          <div class="field"><label>{{ "Customer type" | t }}</label><input [(ngModel)]="form.customerType" placeholder="{{ 'Individual / Office / Event' | t }}" /></div>
          <div class="field" style="grid-column:1/-1"><label>{{ "Notes" | t }}</label><textarea rows="2" [(ngModel)]="form.notes"></textarea></div>
        </div>
        <div class="actions">
          <button class="btn" (click)="toggleCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
            </svg>
            {{ "Cancel" | t }}
          </button>
          <button class="btn primary" [disabled]="saving()" (click)="create()">
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
                <th>{{ "Name" | t }}</th>
                <th>{{ "Phone" | t }}</th>
                <th>{{ "Address" | t }}</th>
                <th>{{ "Type" | t }}</th>
                <th>{{ "Email" | t }}</th>
                <th>{{ "Created" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of customers()">
                <td>{{ c.fullName }}</td>
                <td>{{ c.phone }}</td>
                <td>{{ c.address || "—" }}</td>
                <td>{{ c.customerType || "—" }}</td>
                <td>{{ c.email || "—" }}</td>
                <td>{{ (c.createdAt || "").slice(0, 10) }}</td>
                <td>
                  <div class="act">
                    <button class="btn" (click)="openEdit(c)">
                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm18.71-11.04a1 1 0 0 0 0-1.41l-2.5-2.5a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.99-1.67Z"
                        />
                      </svg>
                      {{ "Edit" | t }}
                    </button>
                    <button class="btn danger" *ngIf="isAdmin()" (click)="remove(c)">
                      <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
                        />
                      </svg>
                      {{ "Delete" | t }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="!customers().length">
                <td colspan="7" class="muted" style="padding:14px">{{ "No customers found" | t }}</td>
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
        <h3 style="margin:0 0 10px 0">{{ "Edit customer" | t }}</h3>
        <div class="grid form">
          <div class="field"><label>{{ "Full name" | t }}</label><input [(ngModel)]="e.fullName" /></div>
          <div class="field"><label>{{ "Phone" | t }}</label><input [(ngModel)]="e.phone" /></div>
          <div class="field"><label>{{ "Email" | t }}</label><input [(ngModel)]="e.email" /></div>
          <div class="field"><label>{{ "Address" | t }}</label><input [(ngModel)]="e.address" /></div>
          <div class="field"><label>{{ "Customer type" | t }}</label><input [(ngModel)]="e.customerType" /></div>
          <div class="field" style="grid-column:1/-1"><label>{{ "Notes" | t }}</label><textarea rows="2" [(ngModel)]="e.notes"></textarea></div>
        </div>
        <div class="actions">
          <button class="btn" (click)="editing.set(null)">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
            </svg>
            Cancel
          </button>
          <button class="btn primary" (click)="saveEdit()" [disabled]="saving()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" />
            </svg>
            Save
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
export class CustomersPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  search = "";
  loading = signal(false);
  saving = signal(false);
  customers = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
  showCreate = signal(false);
  editing = signal<any | null>(null);

  isAdmin = () => this.auth.role() === "ADMIN";
  private searchTimer: any = null;

  form: any = {
    fullName: "",
    phone: "",
    address: "",
    email: "",
    customerType: "",
    notes: ""
  };

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  toggleCreate() {
    this.showCreate.set(!this.showCreate());
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{ customers: { nodes: any[]; pageInfo: any } }>(
        `query Customers($search: String, $page: Int!, $pageSize: Int!) {
          customers(pagination:{page:$page,pageSize:$pageSize}, search:$search) { nodes { id fullName phone email address customerType notes createdAt } pageInfo { page pageSize total hasNextPage } }
        }`,
        { search: this.search.trim() || null, page: this.page(), pageSize: this.pageSize }
      );
      this.customers.set(data.customers.nodes);
      this.pageInfo.set(data.customers.pageInfo);
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
        fullName: this.form.fullName.trim(),
        phone: this.form.phone.trim(),
        address: this.form.address?.trim() || null,
        email: this.form.email?.trim() || null,
        customerType: this.form.customerType?.trim() || null,
        notes: this.form.notes?.trim() || null
      };
      await this.gql.request<{ createCustomer: any }>(
        `mutation CreateCustomer($input: CreateCustomerInput!) { createCustomer(input:$input){ id } }`,
        { input }
      );
      this.showCreate.set(false);
      this.form = { fullName: "", phone: "", email: "", address: "", customerType: "", notes: "" };
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
      const input: any = {
        fullName: e.fullName?.trim() || null,
        phone: e.phone?.trim() || null,
        email: e.email?.trim() || null,
        address: e.address?.trim() || null,
        customerType: e.customerType?.trim() || null,
        notes: e.notes?.trim() || null
      };
      await this.gql.request(`mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!){ updateCustomer(id:$id,input:$input){ id } }`, {
        id: e.id,
        input
      });
      this.editing.set(null);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async remove(c: any) {
    if (!c?.id) return;
    if (!confirm(`Delete customer ${c.fullName}?`)) return;
    this.saving.set(true);
    try {
      await this.gql.request(`mutation DeleteCustomer($id: ID!){ deleteCustomer(id:$id) }`, { id: c.id });
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
