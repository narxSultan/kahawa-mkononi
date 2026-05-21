import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";
import { SalesChartComponent } from "../../shared/sales-chart.component";
import { TranslatePipe } from "../../shared/translate.pipe";

@Component({
  standalone: true,
  imports: [CommonModule, SalesChartComponent, TranslatePipe],
  template: `
    <div class="container">
      <h2>{{ "Dashboard" | t }}</h2>
      <div class="muted">{{ "Phase 1 MVP overview" | t }}</div>

      <div class="grid kpis" style="margin-top:12px">
        <div class="card kpi">
          <div class="label">{{ "Total Customers" | t }}</div>
          <div class="value">{{ kpis()?.totalCustomers ?? "—" }}</div>
        </div>
        <div class="card kpi">
          <div class="label">{{ "Total Service Centres" | t }}</div>
          <div class="value">{{ kpis()?.totalServiceCentres ?? "—" }}</div>
        </div>
        <div class="card kpi">
          <div class="label">{{ "Cups Sold (Today)" | t }}</div>
          <div class="value">{{ kpis()?.cupsSoldToday ?? "—" }}</div>
        </div>
        <div class="card kpi">
          <div class="label">{{ "Takeaway Cups (Today)" | t }}</div>
          <div class="value">{{ kpis()?.takeawayCupsToday ?? "—" }}</div>
        </div>
        <div class="card kpi">
          <div class="label">{{ "Sales (Today)" | t }}</div>
          <div class="value">{{ kpis()?.salesToday ?? "—" }}</div>
        </div>
        <div class="card kpi">
          <div class="label">{{ "Low Stock Items" | t }}</div>
          <div class="value">{{ kpis()?.lowStockItems ?? "—" }}</div>
        </div>
      </div>

      <div class="grid two" style="margin-top:12px">
        <app-sales-chart [serviceCentreId]="centreId" [rangeDays]="30"></app-sales-chart>

        <div class="card pad">
          <div class="head">
            <div>
              <div class="title">{{ "Recent Sales" | t }}</div>
              <div class="sub">{{ "Latest 10 records" | t }}</div>
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

          <div class="table-wrap">
            <table class="table">
	              <thead>
	                <tr>
	                  <th>{{ "Centre" | t }}</th>
	                  <th>{{ "Service" | t }}</th>
	                  <th>{{ "Cups" | t }}</th>
	                  <th>{{ "Takeaway" | t }}</th>
	                  <th>{{ "Amount" | t }}</th>
	                  <th>{{ "At" | t }}</th>
	                </tr>
	              </thead>
              <tbody>
                <tr *ngFor="let s of recentSales()">
                  <td>{{ s.serviceCentre?.centreName }}</td>
                  <td>{{ s.service?.name || s.serviceCustom || "—" }}</td>
                  <td>{{ s.cupsSold }}</td>
                  <td>{{ s.takeawayCupsUsed }}</td>
                  <td>{{ s.amount }} {{ s.currency }}</td>
                  <td>{{ (s.happenedAt || "").slice(0, 16).replace('T',' ') }}</td>
                </tr>
                <tr *ngIf="!recentSales().length">
                  <td colspan="6" class="muted" style="padding:14px">{{ "No sales yet" | t }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card pad" style="margin-top:12px">
            <div class="title">{{ "Stock Summary" | t }}</div>
            <div class="sub">{{ "Low stock highlights for selected centre" | t }}</div>
            <div class="muted" *ngIf="!lowStock().length" style="margin-top:8px">{{ "No low stock items" | t }}</div>
            <div class="list" *ngIf="lowStock().length">
              <div class="item" *ngFor="let i of lowStock()">
                <div class="name">{{ i.name }}</div>
                <div class="sub">{{ "Balance" | t }}: {{ i.balance }} {{ i.unit }} · {{ "Threshold" | t }}: {{ i.lowStockThreshold }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .muted{color:var(--muted);margin-top:-6px}
      .pad{padding:14px}
      .grid.two{grid-template-columns:1fr 1fr}
      @media (max-width: 900px){.grid.two{grid-template-columns:1fr}}
      .head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .list{margin-top:10px;display:flex;flex-direction:column;gap:10px}
      .item{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:rgba(245,239,230,.45)}
      .name{font-weight:800;color:var(--dark)}
      .item .sub{margin-top:4px}
    `
  ]
})
export class DashboardPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  kpis = signal<any | null>(null);
  recentSales = signal<any[]>([]);
  lowStock = signal<any[]>([]);

  get centreId() {
    const role = this.auth.role();
    if (role === "MANAGER" || role === "STAFF") return this.auth.user()?.serviceCentre?.id ?? null;
    return null;
  }

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{ dashboard: any }>(
        `query Dashboard($serviceCentreId: ID) {
          dashboard(serviceCentreId:$serviceCentreId) {
            kpis { totalCustomers totalServiceCentres cupsSoldToday takeawayCupsToday salesToday lowStockItems }
            recentSales { id cupsSold takeawayCupsUsed amount currency happenedAt serviceCentre { centreName } service { name } serviceCustom }
            lowStockItems { id name unit balance lowStockThreshold }
          }
        }`,
        { serviceCentreId: this.centreId }
      );
      this.kpis.set(data.dashboard.kpis);
      this.recentSales.set(data.dashboard.recentSales);
      this.lowStock.set(data.dashboard.lowStockItems);
    } finally {
      this.loading.set(false);
    }
  }
}
