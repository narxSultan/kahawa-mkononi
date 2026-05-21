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
          <h2>{{ "Sales & Cup Counter" | t }}</h2>
          <div class="muted">{{ "Record sales per customer, centre, and service type" | t }}</div>
        </div>
        <div class="right">
          <button class="btn primary" (click)="toggleCreate()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2Z" />
            </svg>
            {{ "Add Sale" | t }}
          </button>
          <button class="btn" (click)="refreshAll()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
        </div>
      </div>

      <div class="grid kpis" style="margin-top:12px" *ngIf="totals() as t">
        <div class="card kpi"><div class="label">{{ "Sales Today" | t }}</div><div class="value">{{ t.day }}</div></div>
        <div class="card kpi"><div class="label">{{ "Sales This Week" | t }}</div><div class="value">{{ t.week }}</div></div>
        <div class="card kpi"><div class="label">{{ "Sales This Month" | t }}</div><div class="value">{{ t.month }}</div></div>
      </div>

      <div class="card pad" *ngIf="showCreate()">
        <h3 style="margin:0 0 10px 0">{{ "Create sale" | t }}</h3>
        <div class="grid form">
	          <div class="field" *ngIf="isAdmin()">
	            <label>{{ "Service centre" | t }}</label>
	            <select [(ngModel)]="form.serviceCentreId">
	              <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
	            </select>
	          </div>
	          <div class="field" *ngIf="!isAdmin()">
	            <label>{{ "Service centre" | t }}</label>
	            <input [ngModel]="centreName" disabled />
	          </div>
		          <div class="field" style="grid-column:1/-1">
		            <label>{{ "Customer search" | t }}</label>
		            <div style="display:flex;gap:8px;flex-wrap:wrap">
		              <input style="flex:1;min-width:220px" [(ngModel)]="customerSearch" placeholder="{{ 'Search name or phone' | t }}" (input)="onCustomerSearchInput()" />
		              <button class="btn" (click)="searchCustomers()" [disabled]="saving()">
	                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M10 2a8 8 0 1 0 4.9 14.3l4.4 4.4 1.4-1.4-4.4-4.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
                  />
                </svg>
                {{ "Search" | t }}
              </button>
            </div>
          </div>
	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Customer" | t }}</label>
	            <select [(ngModel)]="form.customerId">
	              <option value="">{{ "Select..." | t }}</option>
	              <option *ngFor="let c of customers()" [value]="c.id">{{ c.fullName }} ({{ c.phone }})</option>
	            </select>
	          </div>
	          <div class="field">
	            <label>{{ "Service" | t }}</label>
	            <select [(ngModel)]="form.serviceId">
	              <option value="">{{ "(custom)" | t }}</option>
	              <option *ngFor="let s of services()" [value]="s.id">{{ s.name }}</option>
	            </select>
	          </div>
	          <div class="field"><label>{{ "Custom service" | t }}</label><input [(ngModel)]="form.serviceCustom" /></div>
	          <div class="field"><label>{{ "Cups sold" | t }}</label><input type="number" [(ngModel)]="form.cupsSold" /></div>
	          <div class="field"><label>{{ "Takeaway cups used" | t }}</label><input type="number" [(ngModel)]="form.takeawayCupsUsed" /></div>
	          <div class="field"><label>{{ "Amount (TZS)" | t }}</label><input [(ngModel)]="form.amount" placeholder="15000" /></div>
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
            {{ "Save" | t }}
          </button>
        </div>
        <div class="error" *ngIf="error()">{{ error() }}</div>
      </div>

	      <div class="card pad" style="margin-top:12px">
	        <div class="table-wrap">
	          <table class="table">
            <thead>
              <tr>
                <th>{{ "Customer" | t }}</th>
                <th>{{ "Centre" | t }}</th>
                <th>{{ "Service" | t }}</th>
                <th>{{ "Cups" | t }}</th>
                <th>{{ "Takeaway" | t }}</th>
                <th>{{ "Amount" | t }}</th>
                <th>{{ "At" | t }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of sales()">
                <td>{{ s.customer?.fullName || "—" }}</td>
                <td>{{ s.serviceCentre?.centreName }}</td>
                <td>{{ s.service?.name || s.serviceCustom || "—" }}</td>
                <td>{{ s.cupsSold }}</td>
                <td>{{ s.takeawayCupsUsed }}</td>
                <td>{{ s.amount }} {{ s.currency }}</td>
                <td>{{ (s.happenedAt || "").slice(0, 16).replace('T',' ') }}</td>
              </tr>
              <tr *ngIf="!sales().length">
                <td colspan="7" class="muted" style="padding:14px">{{ "No sales found" | t }}</td>
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
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
	      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
	      .error{margin-top:10px;color:var(--danger);white-space:pre-line}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	    `
	  ]
})
export class SalesPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  showCreate = signal(false);
  loading = signal(false);
  saving = signal(false);
  sales = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
  private customerSearchTimer: any = null;
  centres = signal<any[]>([]);
  services = signal<any[]>([]);
  customers = signal<any[]>([]);
  totals = signal<{ day: string; week: string; month: string } | null>(null);
  customerSearch = "";
  error = signal<string | null>(null);

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  get centreId() {
    return this.auth.user()?.serviceCentre?.id ?? null;
  }
  get centreName() {
    return this.auth.user()?.serviceCentre?.centreName ?? "—";
  }

  form: any = { serviceCentreId: "", customerId: "", serviceId: "", serviceCustom: "", cupsSold: 0, takeawayCupsUsed: 0, amount: "" };

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    await Promise.all([this.loadCentres(), this.loadServices()]);
    const centre = this.isAdmin() ? this.centres()[0]?.id : this.centreId;
    this.form.serviceCentreId = centre ?? "";
    await Promise.all([this.load(), this.loadTotals(), this.searchCustomers()]);
  }

  toggleCreate() {
    this.showCreate.set(!this.showCreate());
  }

  async loadCentres() {
    const data = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
      `query Centres { serviceCentres(pagination:{page:1,pageSize:50}){ nodes{ id centreName } } }`
    );
    this.centres.set(data.serviceCentres.nodes);
  }

  async loadServices() {
    const data = await this.gql.request<{ services: any[] }>(`query Services { services { id name } }`);
    this.services.set(data.services);
  }

  async load() {
    this.loading.set(true);
    try {
      const centreId = this.isAdmin() ? this.form.serviceCentreId || null : this.centreId;
      const data = await this.gql.request<{ sales: { nodes: any[]; pageInfo: any } }>(
        `query Sales($serviceCentreId: ID, $page: Int!, $pageSize: Int!) {
          sales(pagination:{page:$page,pageSize:$pageSize}, serviceCentreId:$serviceCentreId) {
            nodes { id cupsSold takeawayCupsUsed amount currency happenedAt customer{ id fullName phone } serviceCentre { id centreName } service { name } serviceCustom }
            pageInfo { page pageSize total hasNextPage }
          }
        }`,
        { serviceCentreId: centreId, page: this.page(), pageSize: this.pageSize }
      );
      this.sales.set(data.sales.nodes);
      this.pageInfo.set(data.sales.pageInfo);
    } finally {
      this.loading.set(false);
    }
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

  async refreshAll() {
    await Promise.all([this.load(), this.loadTotals()]);
  }

  async loadTotals() {
    const centreId = this.isAdmin() ? this.form.serviceCentreId || null : this.centreId;
    const data = await this.gql.request<{ salesTotals: { day: string; week: string; month: string } }>(
      `query Totals($serviceCentreId: ID){ salesTotals(serviceCentreId:$serviceCentreId){ day week month } }`,
      { serviceCentreId: centreId }
    );
    this.totals.set(data.salesTotals);
  }

  async searchCustomers() {
    const data = await this.gql.request<{ customers: { nodes: any[] } }>(
      `query Customers($search: String){
        customers(pagination:{page:1,pageSize:20}, search:$search){ nodes{ id fullName phone } }
      }`,
      { search: this.customerSearch.trim() || null }
    );
    this.customers.set(data.customers.nodes);
  }

  onCustomerSearchInput() {
    try {
      if (this.customerSearchTimer) clearTimeout(this.customerSearchTimer);
    } catch {
      // ignore
    }
    this.customerSearchTimer = setTimeout(() => void this.searchCustomers(), 250);
  }

  async create() {
    this.saving.set(true);
    try {
      this.error.set(null);
      const centreId = this.isAdmin() ? this.form.serviceCentreId : this.centreId;
      if (!centreId) throw new Error("Service centre is required");
      if (!this.form.customerId) throw new Error("Customer is required");
      const input: any = {
        serviceCentreId: centreId,
        customerId: this.form.customerId,
        serviceId: this.form.serviceId || null,
        serviceCustom: this.form.serviceCustom?.trim() || null,
        cupsSold: Number(this.form.cupsSold) || 0,
        takeawayCupsUsed: Number(this.form.takeawayCupsUsed) || 0,
        amount: String(this.form.amount || "0"),
        currency: "TZS"
      };
      await this.gql.request(`mutation CreateSale($input: CreateSaleInput!){ createSale(input:$input){ id } }`, { input });
      this.showCreate.set(false);
      this.form = { ...this.form, customerId: "", serviceId: "", serviceCustom: "", cupsSold: 0, takeawayCupsUsed: 0, amount: "" };
      await Promise.all([this.load(), this.loadTotals()]);
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }
}
