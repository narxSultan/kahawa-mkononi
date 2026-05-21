import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";
import { APP_CONFIG } from "../../core/config";
import { TranslatePipe } from "../../shared/translate.pipe";

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
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Create Order" | t }}</h2>
          <div class="muted">{{ "Choose a product and place an order" | t }}</div>
        </div>
        <div class="right">
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
        <div class="field">
          <label>{{ "Service centre" | t }}</label>
          <select [(ngModel)]="selectedCentreId">
            <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ "Search product" | t }}</label>
          <input [(ngModel)]="search" placeholder="{{ 'Hot Coffee' | t }}..." (keyup.enter)="load()" />
        </div>
        <div class="grid list">
          <div class="card item" *ngFor="let p of products()">
            <div class="thumb" *ngIf="p.imageUrl"><img [src]="abs(p.imageUrl)" alt="" /></div>
            <div class="name">{{ p.name }}</div>
            <div class="sub">{{ p.description || "—" }}</div>
            <div class="price">{{ p.price }} {{ p.currency }}</div>
            <div class="actions">
              <input type="number" min="1" class="qty" [(ngModel)]="quantities[p.id]" />
              <button class="btn primary" (click)="order(p)">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2Zm10 0c-1.1 0-1.99.9-1.99 2S15.9 22 17 22s2-.9 2-2-.9-2-2-2ZM7.16 14h9.93c.75 0 1.4-.41 1.74-1.03L22 6H6.21L5.27 4H2v2h2l3.6 7.59-1.35 2.45A2 2 0 0 0 8 17h12v-2H8l1.16-1Z"/></svg>
                {{ "Order" | t }}
              </button>
            </div>
          </div>
          <div class="muted" *ngIf="!products().length" style="padding:10px 2px">{{ "No products" | t }}</div>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px" *ngIf="success()">
        <div class="ok">{{ "Order created" | t }}</div>
        <button class="btn primary" (click)="goOrders()">
          <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-2 16H7v-2h10v2Zm0-4H7v-2h10v2Zm0-4H7V9h10v2Z"/></svg>
          {{ "View my orders" | t }}
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted);margin-top:-6px}
      .pad{padding:14px}
      .grid.list{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      @media (max-width:860px){.grid.list{grid-template-columns:1fr}}
      .item{padding:14px}
      .thumb{width:100%;height:140px;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:rgba(245,239,230,.55);margin-bottom:10px}
      .thumb img{width:100%;height:100%;object-fit:cover;display:block}
      .name{font-weight:900;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted);margin-top:4px}
      .price{margin-top:10px;font-weight:900;color:var(--coffee)}
      .actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px}
      .qty{width:90px;padding:10px 12px;border:1px solid var(--border);border-radius:12px}
      .ok{color:var(--success);font-weight:900;margin-bottom:10px}
    `
  ]
})
export class CustomerProductsPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  products = signal<any[]>([]);
  centres = signal<any[]>([]);
  selectedCentreId = "";
  success = signal(false);
  search = "";
  quantities: Record<string, number> = {};
  abs = absUrl;

  ngOnInit() {
    void this.auth.init().then(() => this.bootstrap());
  }

  async bootstrap() {
    await this.loadCentres();
    await this.load();
  }

  async loadCentres() {
    const data = await this.gql.request<{ serviceCentres: { nodes: any[] } }>(
      `query Centres {
        serviceCentres(pagination:{page:1,pageSize:50}, status: ACTIVE) {
          nodes { id centreName status }
        }
      }`
    );
    this.centres.set((data.serviceCentres.nodes ?? []).filter((c) => c.status === "ACTIVE"));
    if (!this.selectedCentreId) this.selectedCentreId = this.centres()[0]?.id ?? "";
  }

  async load() {
    this.loading.set(true);
    this.success.set(false);
    try {
      const data = await this.gql.request<{ products: { nodes: any[] } }>(
        `query Products($search: String){
          products(pagination:{page:1,pageSize:50}, search:$search, onlyActive:true){
            nodes{ id name description price currency imageUrl }
          }
        }`,
        { search: this.search.trim() || null }
      );
      this.products.set(data.products.nodes ?? []);
      for (const p of this.products()) if (!this.quantities[p.id]) this.quantities[p.id] = 1;
    } finally {
      this.loading.set(false);
    }
  }

  async order(p: any) {
    const qty = Math.max(1, Number(this.quantities[p.id] ?? 1) || 1);
    await this.gql.request(
      `mutation Order($input: CreateOrderInput!){
        createOrder(input:$input){ id status }
      }`,
      { input: { productId: p.id, quantity: qty, serviceCentreId: this.selectedCentreId || null } }
    );
    this.success.set(true);
  }

  goOrders() {
    void this.router.navigateByUrl("/customer/orders");
  }
}
