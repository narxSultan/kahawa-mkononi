import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";
import { I18nService } from "../../core/i18n.service";

function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function escapeCsvCell(v: any) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers: string[], rows: any[][]) {
  const lines = [headers.map(escapeCsvCell).join(",")];
  for (const r of rows) lines.push(r.map(escapeCsvCell).join(","));
  return lines.join("\n");
}

function openPrintView(args: { title: string; subtitle?: string; html: string }) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) return;
  const subtitle = args.subtitle ? `<div class="sub">${args.subtitle}</div>` : "";
  w.document.open();
  w.document.write(`
    <html>
      <head>
        <title>${args.title}</title>
        <style>
          body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial; padding:24px; color:#111}
          h1{margin:0 0 4px 0; font-size:20px}
          .sub{color:#555; font-size:12px; margin-bottom:16px}
          table{width:100%; border-collapse:collapse; font-size:12px}
          th,td{border:1px solid #ddd; padding:8px; text-align:left; vertical-align:top}
          th{background:#f6f6f6}
          .kpis{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-bottom:14px}
          .kpi{border:1px solid #ddd; border-radius:10px; padding:10px}
          .k{font-size:11px; color:#555}
          .v{font-size:18px; font-weight:800; margin-top:4px}
          @media print { body{padding:0} }
        </style>
      </head>
      <body>
        <h1>${args.title}</h1>
        ${subtitle}
        ${args.html}
        <script>setTimeout(()=>{ try{ window.print(); } catch(e){} }, 200);</script>
      </body>
    </html>
  `);
  w.document.close();
  w.focus();
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Reports" | t }}</h2>
          <div class="muted">{{ "Admin & manager reporting dashboard" | t }}</div>
        </div>
        <div class="right">
          <select class="sel" *ngIf="isAdmin()" [(ngModel)]="serviceCentreId" (change)="load()">
            <option value="">{{ "All centres" | t }}</option>
            <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
          </select>
          <select class="sel" [(ngModel)]="orderRange" (change)="load()">
            <option value="TODAY">Orders: Today</option>
            <option value="WEEK">Orders: 7 days</option>
            <option value="MONTH">Orders: 30 days</option>
          </select>
          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            {{ "Refresh" | t }}
          </button>
          <button class="btn" (click)="exportUserReportCsv()" [disabled]="!userReport()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
            </svg>
            {{ "Users CSV" | t }}
          </button>
          <button class="btn" (click)="exportUserReportPdf()" [disabled]="!userReport()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
            </svg>
            {{ "Users PDF" | t }}
          </button>
        </div>
      </div>

      <div class="grid kpis" style="margin-top:12px" *ngIf="userReport() as r">
        <div class="card kpi"><div class="label">{{ "Total Users" | t }}</div><div class="value">{{ r.totalUsers }}</div></div>
        <div class="card kpi"><div class="label">{{ "Active" | t }}</div><div class="value" style="color:var(--success)">{{ r.activeUsers }}</div></div>
        <div class="card kpi"><div class="label">{{ "Suspended" | t }}</div><div class="value" style="color:#7a4b00">{{ r.suspendedUsers }}</div></div>
        <div class="card kpi"><div class="label">{{ "Deleted" | t }}</div><div class="value" style="color:var(--danger)">{{ r.deletedUsers }}</div></div>
        <div class="card kpi"><div class="label">Pending Orders</div><div class="value">{{ orderCount("PENDING") }}</div></div>
        <div class="card kpi"><div class="label">Ready (Wait Customer)</div><div class="value" style="color:#7a4b00">{{ orderCount("STAFF_COMPLETED") }}</div></div>
        <div class="card kpi"><div class="label">Rejected</div><div class="value" style="color:var(--danger)">{{ orderCount("CUSTOMER_REJECTED") }}</div></div>
        <div class="card kpi"><div class="label">Completed Orders</div><div class="value" style="color:var(--success)">{{ orderCount("COMPLETED") }}</div></div>
        <div class="card kpi"><div class="label">{{ "Sales Today" | t }}</div><div class="value">{{ salesTotals()?.day ?? "—" }}</div></div>
        <div class="card kpi"><div class="label">{{ "Sales This Week" | t }}</div><div class="value">{{ salesTotals()?.week ?? "—" }}</div></div>
        <div class="card kpi"><div class="label">{{ "Stock IN (30d)" | t }}</div><div class="value">{{ stockInOut()?.inTotal ?? "—" }}</div></div>
        <div class="card kpi"><div class="label">{{ "Stock OUT (30d)" | t }}</div><div class="value">{{ stockInOut()?.outTotal ?? "—" }}</div></div>
      </div>

      <div class="grid two" style="margin-top:12px" *ngIf="userReport() as r">
        <div class="card pad">
          <div class="row">
            <div>
              <div class="title">{{ "Users by role" | t }}</div>
              <div class="sub">{{ "Counts excluding deleted" | t }}</div>
            </div>
            <div class="right">
              <button class="btn" (click)="exportUsersByRoleCsv()" [disabled]="!userReport()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
                </svg>
                {{ "CSV" | t }}
              </button>
              <button class="btn" (click)="exportUsersByRolePdf()" [disabled]="!userReport()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
                </svg>
                {{ "PDF" | t }}
              </button>
            </div>
          </div>
          <div class="list" style="margin-top:10px">
            <div class="item" *ngFor="let p of r.usersByRole">
              <div style="font-weight:800">{{ p.role }}</div>
              <div class="muted">{{ p.total }}</div>
            </div>
          </div>
        </div>

        <div class="card pad">
          <div class="row">
            <div>
              <div class="title">{{ "Users by service centre" | t }}</div>
              <div class="sub">{{ "Counts excluding deleted" | t }}</div>
            </div>
            <div class="right">
              <button class="btn" (click)="exportUsersByCentreCsv()" [disabled]="!userReport()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
                </svg>
                {{ "CSV" | t }}
              </button>
              <button class="btn" (click)="exportUsersByCentrePdf()" [disabled]="!userReport()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
                </svg>
                {{ "PDF" | t }}
              </button>
            </div>
          </div>
        <div class="table-wrap" style="margin-top:10px">
          <table class="table">
            <thead><tr><th>{{ "Centre" | t }}</th><th>{{ "Total" | t }}</th></tr></thead>
            <tbody>
                <tr *ngFor="let p of usersByServiceCentrePaged()">
                  <td>{{ p.serviceCentre?.centreName }}</td>
                  <td>{{ p.total }}</td>
                </tr>
	                <tr *ngIf="!r.usersByServiceCentre?.length">
	                  <td colspan="2" class="muted" style="padding:14px">{{ "No data" | t }}</td>
	                </tr>
              </tbody>
            </table>
          </div>
          <div class="pager" *ngIf="(r.usersByServiceCentre?.length || 0) > tablePageSize">
            <button class="btn" (click)="prevUsersByCentrePage()" [disabled]="usersByCentrePage()<=1">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Prev
            </button>
            <div class="muted2">Page {{ usersByCentrePage() }} / {{ usersByCentreTotalPages() }}</div>
            <button class="btn" (click)="nextUsersByCentrePage()" [disabled]="usersByCentrePage()>=usersByCentreTotalPages()">
              Next
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="grid two" style="margin-top:12px">
        <div class="card pad">
          <div class="row">
            <div>
              <div class="title">{{ "Stocks by service centre" | t }}</div>
              <div class="sub">{{ "Active items, low stock, total balance" | t }}</div>
            </div>
            <div class="right">
              <button class="btn" (click)="exportCentreStocksCsv()" [disabled]="!centreStocks().length">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
                </svg>
                {{ "CSV" | t }}
              </button>
              <button class="btn" (click)="exportCentreStocksPdf()" [disabled]="!centreStocks().length">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
                </svg>
                {{ "PDF" | t }}
              </button>
            </div>
          </div>
          <div class="table-wrap" style="margin-top:10px">
            <table class="table">
              <thead><tr><th>{{ "Centre" | t }}</th><th>{{ "Items" | t }}</th><th>{{ "Low stock" | t }}</th><th>{{ "Total balance" | t }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of centreStocksPaged()">
                  <td>{{ p.serviceCentre?.centreName }}</td>
                  <td>{{ p.stockItems }}</td>
                  <td>{{ p.lowStockItems }}</td>
                  <td>{{ p.totalBalance }}</td>
                </tr>
	                <tr *ngIf="!centreStocks().length">
	                  <td colspan="4" class="muted" style="padding:14px">{{ "No data" | t }}</td>
	                </tr>
              </tbody>
            </table>
          </div>
          <div class="pager" *ngIf="centreStocks().length > tablePageSize">
            <button class="btn" (click)="prevCentreStocksPage()" [disabled]="centreStocksPage()<=1">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Prev
            </button>
            <div class="muted2">Page {{ centreStocksPage() }} / {{ centreStocksTotalPages() }}</div>
            <button class="btn" (click)="nextCentreStocksPage()" [disabled]="centreStocksPage()>=centreStocksTotalPages()">
              Next
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            </button>
          </div>
        </div>

        <div class="card pad">
          <div class="row">
            <div>
              <div class="title">{{ "Top customers (30 days)" | t }}</div>
              <div class="sub">{{ "Most frequent visits" | t }}</div>
            </div>
            <div class="right">
              <button class="btn" (click)="exportTopCustomersCsv()" [disabled]="!topCustomers().length">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
                </svg>
                {{ "CSV" | t }}
              </button>
              <button class="btn" (click)="exportTopCustomersPdf()" [disabled]="!topCustomers().length">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
                </svg>
                {{ "PDF" | t }}
              </button>
            </div>
          </div>
          <div class="table-wrap" style="margin-top:10px">
            <table class="table">
              <thead><tr><th>{{ "Customer" | t }}</th><th>{{ "Phone" | t }}</th><th>{{ "Visits" | t }}</th></tr></thead>
              <tbody>
                <tr *ngFor="let p of topCustomersPaged()">
                  <td>{{ p.customer?.fullName }}</td>
                  <td>{{ p.customer?.phone }}</td>
                  <td>{{ p.visits }}</td>
                </tr>
	                <tr *ngIf="!topCustomers().length">
	                  <td colspan="3" class="muted" style="padding:14px">{{ "No data" | t }}</td>
	                </tr>
              </tbody>
            </table>
          </div>
          <div class="pager" *ngIf="topCustomers().length > tablePageSize">
            <button class="btn" (click)="prevTopCustomersPage()" [disabled]="topCustomersPage()<=1">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
              Prev
            </button>
            <div class="muted2">Page {{ topCustomersPage() }} / {{ topCustomersTotalPages() }}</div>
            <button class="btn" (click)="nextTopCustomersPage()" [disabled]="topCustomersPage()>=topCustomersTotalPages()">
              Next
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
            </button>
          </div>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px" *ngIf="stockBalances().length">
        <div class="row">
          <div>
            <div class="title">{{ "Stock balances" | t }}</div>
            <div class="sub">{{ "Per item (selected centre)" | t }}</div>
          </div>
          <div class="right">
            <button class="btn" (click)="exportStockBalancesCsv()" [disabled]="!stockBalances().length">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h10v2H7v-2Z" />
              </svg>
              {{ "CSV" | t }}
            </button>
            <button class="btn" (click)="exportStockBalancesPdf()" [disabled]="!stockBalances().length">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
              </svg>
              {{ "PDF" | t }}
            </button>
          </div>
        </div>
        <div class="table-wrap" style="margin-top:10px">
          <table class="table">
            <thead><tr><th>{{ "Item" | t }}</th><th>{{ "Unit" | t }}</th><th>{{ "Balance" | t }}</th><th>{{ "Low threshold" | t }}</th></tr></thead>
            <tbody>
              <tr *ngFor="let i of stockBalancesPaged()">
                <td>{{ i.name }}</td>
                <td>{{ i.unit }}</td>
                <td><span class="badge" [class.danger]="i.balance <= i.lowStockThreshold">{{ i.balance }}</span></td>
                <td>{{ i.lowStockThreshold }}</td>
              </tr>
	              <tr *ngIf="!stockBalances().length">
	                <td colspan="4" class="muted" style="padding:14px">{{ "No data" | t }}</td>
	              </tr>
            </tbody>
          </table>
        </div>
        <div class="pager" *ngIf="stockBalances().length > tablePageSize">
          <button class="btn" (click)="prevStockBalancesPage()" [disabled]="stockBalancesPage()<=1">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            Prev
          </button>
          <div class="muted2">Page {{ stockBalancesPage() }} / {{ stockBalancesTotalPages() }}</div>
          <button class="btn" (click)="nextStockBalancesPage()" [disabled]="stockBalancesPage()>=stockBalancesTotalPages()">
            Next
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="m8.59 16.59 1.41 1.41 6-6-6-6-1.41 1.41L13.17 12z"/></svg>
          </button>
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
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .grid.two{grid-template-columns:1fr 1fr}
      @media (max-width: 900px){.grid.two{grid-template-columns:1fr}}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .list{display:flex;flex-direction:column;gap:10px}
      .item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(245,239,230,.45)}
      .error{margin-top:12px;color:var(--danger);white-space:pre-line}
      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
    `
  ]
})
export class ReportsPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private i18n = inject(I18nService);

  loading = signal(false);
  error = signal<string | null>(null);

  centres = signal<any[]>([]);
  serviceCentreId = "";

  userReport = signal<any | null>(null);
  salesTotals = signal<any | null>(null);
  stockInOut = signal<any | null>(null);
  centreStocks = signal<any[]>([]);
  stockBalances = signal<any[]>([]);
  topCustomers = signal<any[]>([]);
  orderReport = signal<any | null>(null);
  orderRange: "TODAY" | "WEEK" | "MONTH" = "MONTH";
  readonly tablePageSize = 10;
  usersByCentrePage = signal(1);
  centreStocksPage = signal(1);
  topCustomersPage = signal(1);
  stockBalancesPage = signal(1);

  usersByServiceCentrePaged = computed(() => {
    const list = (this.userReport()?.usersByServiceCentre ?? []) as any[];
    const start = (this.usersByCentrePage() - 1) * this.tablePageSize;
    return list.slice(start, start + this.tablePageSize);
  });
  usersByCentreTotalPages = computed(() => {
    const total = Number((this.userReport()?.usersByServiceCentre ?? []).length ?? 0);
    return Math.max(1, Math.ceil(total / this.tablePageSize));
  });

  centreStocksPaged = computed(() => {
    const list = this.centreStocks() ?? [];
    const start = (this.centreStocksPage() - 1) * this.tablePageSize;
    return list.slice(start, start + this.tablePageSize);
  });
  centreStocksTotalPages = computed(() => Math.max(1, Math.ceil(Number(this.centreStocks().length ?? 0) / this.tablePageSize)));

  topCustomersPaged = computed(() => {
    const list = this.topCustomers() ?? [];
    const start = (this.topCustomersPage() - 1) * this.tablePageSize;
    return list.slice(start, start + this.tablePageSize);
  });
  topCustomersTotalPages = computed(() => Math.max(1, Math.ceil(Number(this.topCustomers().length ?? 0) / this.tablePageSize)));

  stockBalancesPaged = computed(() => {
    const list = this.stockBalances() ?? [];
    const start = (this.stockBalancesPage() - 1) * this.tablePageSize;
    return list.slice(start, start + this.tablePageSize);
  });
  stockBalancesTotalPages = computed(() => Math.max(1, Math.ceil(Number(this.stockBalances().length ?? 0) / this.tablePageSize)));

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  isManager = computed(() => this.auth.role() === "MANAGER");

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    if (this.isAdmin()) {
      const centres = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
        `query Centres { serviceCentres(pagination:{page:1,pageSize:200}){ nodes{ id centreName } } }`
      );
      this.centres.set(centres.serviceCentres.nodes);
    }
    await this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.usersByCentrePage.set(1);
      this.centreStocksPage.set(1);
      this.topCustomersPage.set(1);
      this.stockBalancesPage.set(1);
      const serviceCentreId = this.isAdmin() ? this.serviceCentreId || null : null;
      const stockCentreId = this.isAdmin() ? this.serviceCentreId || null : this.auth.user()?.serviceCentre?.id ?? null;
      const includeStockCentre = Boolean(stockCentreId);
      const range = this.buildOrderRange();

      const data = await this.gql.request<{
        userReport: any;
        salesTotals: any;
        stockInOutReport: any;
        serviceCentreStocksReport: any[];
        stockBalances?: any[];
        topCustomers: any[];
        orderStatusReport: any;
      }>(
        `query Reports($serviceCentreId: ID, $stockCentreId: ID!, $includeStockCentre: Boolean!, $range: ReportRangeInput) {
          userReport(serviceCentreId:$serviceCentreId){
            totalUsers activeUsers suspendedUsers deletedUsers
            usersByRole{ role total }
            usersByServiceCentre{ total serviceCentre{ id centreName } }
          }
          orderStatusReport(serviceCentreId:$serviceCentreId, range:$range){ total byStatus{ status total } }
          salesTotals(serviceCentreId:$serviceCentreId){ day week month }
          stockInOutReport(serviceCentreId:$serviceCentreId){ inTotal outTotal net }
          serviceCentreStocksReport { serviceCentre { id centreName } stockItems lowStockItems totalBalance }
          stockBalances(serviceCentreId:$stockCentreId) @include(if: $includeStockCentre) { id name unit lowStockThreshold balance }
          topCustomers(serviceCentreId:$serviceCentreId, limit:10) { visits customer { id fullName phone } }
        }`,
        { serviceCentreId, stockCentreId: stockCentreId || "", includeStockCentre, range }
      );
      this.userReport.set(data.userReport);
      this.orderReport.set(data.orderStatusReport);
      this.salesTotals.set(data.salesTotals);
      this.stockInOut.set(data.stockInOutReport);
      this.centreStocks.set(data.serviceCentreStocksReport ?? []);
      this.stockBalances.set((data.stockBalances ?? []) as any[]);
      this.topCustomers.set(data.topCustomers ?? []);
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.loading.set(false);
    }
  }

  prevUsersByCentrePage() {
    if (this.usersByCentrePage() <= 1) return;
    this.usersByCentrePage.set(this.usersByCentrePage() - 1);
  }

  nextUsersByCentrePage() {
    if (this.usersByCentrePage() >= this.usersByCentreTotalPages()) return;
    this.usersByCentrePage.set(this.usersByCentrePage() + 1);
  }

  prevCentreStocksPage() {
    if (this.centreStocksPage() <= 1) return;
    this.centreStocksPage.set(this.centreStocksPage() - 1);
  }

  nextCentreStocksPage() {
    if (this.centreStocksPage() >= this.centreStocksTotalPages()) return;
    this.centreStocksPage.set(this.centreStocksPage() + 1);
  }

  prevTopCustomersPage() {
    if (this.topCustomersPage() <= 1) return;
    this.topCustomersPage.set(this.topCustomersPage() - 1);
  }

  nextTopCustomersPage() {
    if (this.topCustomersPage() >= this.topCustomersTotalPages()) return;
    this.topCustomersPage.set(this.topCustomersPage() + 1);
  }

  prevStockBalancesPage() {
    if (this.stockBalancesPage() <= 1) return;
    this.stockBalancesPage.set(this.stockBalancesPage() - 1);
  }

  nextStockBalancesPage() {
    if (this.stockBalancesPage() >= this.stockBalancesTotalPages()) return;
    this.stockBalancesPage.set(this.stockBalancesPage() + 1);
  }

  private buildOrderRange() {
    const now = new Date();
    const to = now.toISOString();
    const start = new Date(now);
    const preset = this.orderRange;
    if (preset === "TODAY") start.setHours(0, 0, 0, 0);
    else if (preset === "WEEK") start.setDate(start.getDate() - 7);
    else start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
    return { from: start.toISOString(), to };
  }

  orderCount(status: string) {
    const r = this.orderReport();
    const list = r?.byStatus ?? [];
    return list.find((x: any) => x.status === status)?.total ?? 0;
  }

  private reportContextLabel() {
    const centre = this.serviceCentreId ? this.centres().find((c) => c.id === this.serviceCentreId)?.centreName : null;
    return centre ? `${this.i18n.t("Service centre")}: ${centre}` : this.i18n.t("All centres");
  }

  exportUserReportCsv() {
    const r = this.userReport();
    if (!r) return;
    const csv = toCsv(
      ["metric", "value"],
      [
        ["totalUsers", r.totalUsers],
        ["activeUsers", r.activeUsers],
        ["suspendedUsers", r.suspendedUsers],
        ["deletedUsers", r.deletedUsers],
        ["salesToday", this.salesTotals()?.day ?? ""],
        ["salesWeek", this.salesTotals()?.week ?? ""],
        ["stockIn30d", this.stockInOut()?.inTotal ?? ""],
        ["stockOut30d", this.stockInOut()?.outTotal ?? ""]
      ]
    );
    downloadText(`users-report-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  }

  exportUserReportPdf() {
    const r = this.userReport();
    if (!r) return;
    openPrintView({
      title: this.i18n.t("Users Report"),
      subtitle: `${this.reportContextLabel()} · ${new Date().toISOString().slice(0, 10)}`,
      html: `
        <div class="kpis">
          <div class="kpi"><div class="k">${this.i18n.t("Total")}</div><div class="v">${r.totalUsers}</div></div>
          <div class="kpi"><div class="k">${this.i18n.t("Active")}</div><div class="v">${r.activeUsers}</div></div>
          <div class="kpi"><div class="k">${this.i18n.t("Suspended")}</div><div class="v">${r.suspendedUsers}</div></div>
          <div class="kpi"><div class="k">${this.i18n.t("Deleted")}</div><div class="v">${r.deletedUsers}</div></div>
          <div class="kpi"><div class="k">${this.i18n.t("Sales Today")}</div><div class="v">${this.salesTotals()?.day ?? "—"}</div></div>
          <div class="kpi"><div class="k">${this.i18n.t("Sales This Week")}</div><div class="v">${this.salesTotals()?.week ?? "—"}</div></div>
        </div>
      `
    });
  }

  exportUsersByRoleCsv() {
    const r = this.userReport();
    if (!r) return;
    const rows = (r.usersByRole ?? []).map((x: any) => [x.role, x.total]);
    downloadText(`users-by-role-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["role", "total"], rows), "text/csv");
  }

  exportUsersByRolePdf() {
    const r = this.userReport();
    if (!r) return;
    const rows = (r.usersByRole ?? [])
      .map((x: any) => `<tr><td>${x.role}</td><td>${x.total}</td></tr>`)
      .join("");
    openPrintView({
      title: this.i18n.t("Users by Role"),
      subtitle: `${this.reportContextLabel()} · ${new Date().toISOString().slice(0, 10)}`,
      html: `<table><thead><tr><th>${this.i18n.t("Role")}</th><th>${this.i18n.t("Total")}</th></tr></thead><tbody>${rows}</tbody></table>`
    });
  }

  exportUsersByCentreCsv() {
    const r = this.userReport();
    if (!r) return;
    const rows = (r.usersByServiceCentre ?? []).map((x: any) => [x.serviceCentre?.centreName ?? "", x.total]);
    downloadText(`users-by-centre-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["centre", "total"], rows), "text/csv");
  }

  exportUsersByCentrePdf() {
    const r = this.userReport();
    if (!r) return;
    const rows = (r.usersByServiceCentre ?? [])
      .map((x: any) => `<tr><td>${x.serviceCentre?.centreName ?? ""}</td><td>${x.total}</td></tr>`)
      .join("");
    openPrintView({
      title: this.i18n.t("Users by Service Centre"),
      subtitle: `${this.reportContextLabel()} · ${new Date().toISOString().slice(0, 10)}`,
      html: `<table><thead><tr><th>${this.i18n.t("Centre")}</th><th>${this.i18n.t("Total")}</th></tr></thead><tbody>${rows}</tbody></table>`
    });
  }

  exportCentreStocksCsv() {
    const rows = this.centreStocks().map((x: any) => [x.serviceCentre?.centreName ?? "", x.stockItems, x.lowStockItems, x.totalBalance]);
    downloadText(`stocks-by-centre-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["centre", "items", "lowStockItems", "totalBalance"], rows), "text/csv");
  }

  exportCentreStocksPdf() {
    const rows = this.centreStocks()
      .map((x: any) => `<tr><td>${x.serviceCentre?.centreName ?? ""}</td><td>${x.stockItems}</td><td>${x.lowStockItems}</td><td>${x.totalBalance}</td></tr>`)
      .join("");
    openPrintView({
      title: this.i18n.t("Stocks by Service Centre"),
      subtitle: `${new Date().toISOString().slice(0, 10)}`,
      html: `<table><thead><tr><th>${this.i18n.t("Centre")}</th><th>${this.i18n.t("Items")}</th><th>${this.i18n.t("Low stock")}</th><th>${this.i18n.t("Total balance")}</th></tr></thead><tbody>${rows}</tbody></table>`
    });
  }

  exportTopCustomersCsv() {
    const rows = this.topCustomers().map((x: any) => [x.customer?.fullName ?? "", x.customer?.phone ?? "", x.visits]);
    downloadText(`top-customers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["customer", "phone", "visits"], rows), "text/csv");
  }

  exportTopCustomersPdf() {
    const rows = this.topCustomers()
      .map((x: any) => `<tr><td>${x.customer?.fullName ?? ""}</td><td>${x.customer?.phone ?? ""}</td><td>${x.visits}</td></tr>`)
      .join("");
    openPrintView({
      title: this.i18n.t("Top Customers (Frequent Visits)"),
      subtitle: `${this.reportContextLabel()} · Last 30 days · ${new Date().toISOString().slice(0, 10)}`,
      html: `<table><thead><tr><th>${this.i18n.t("Customer")}</th><th>${this.i18n.t("Phone")}</th><th>${this.i18n.t("Visits")}</th></tr></thead><tbody>${rows}</tbody></table>`
    });
  }

  exportStockBalancesCsv() {
    const rows = this.stockBalances().map((x: any) => [x.name, x.unit, x.balance, x.lowStockThreshold]);
    downloadText(`stock-balances-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["item", "unit", "balance", "lowStockThreshold"], rows), "text/csv");
  }

  exportStockBalancesPdf() {
    const rows = this.stockBalances()
      .map((x: any) => `<tr><td>${x.name}</td><td>${x.unit}</td><td>${x.balance}</td><td>${x.lowStockThreshold}</td></tr>`)
      .join("");
    openPrintView({
      title: this.i18n.t("Stock Balances"),
      subtitle: `${this.reportContextLabel()} · ${new Date().toISOString().slice(0, 10)}`,
      html: `<table><thead><tr><th>${this.i18n.t("Item")}</th><th>${this.i18n.t("Unit")}</th><th>${this.i18n.t("Balance")}</th><th>${this.i18n.t("Low threshold")}</th></tr></thead><tbody>${rows}</tbody></table>`
    });
  }
}
