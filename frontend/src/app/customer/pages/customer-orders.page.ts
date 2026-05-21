import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>My Orders</h2>
          <div class="muted">Pending orders and completed orders</div>
        </div>
        <div class="right">
          <select class="sel" [(ngModel)]="status" (change)="load()">
            <option value="">All</option>
            <option value="PENDING">PENDING</option>
            <option value="STAFF_COMPLETED">READY</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
          <button class="btn" (click)="load()" [disabled]="loading()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px">
        <table class="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Items</th>
              <th>Total</th>
              <th>Created</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of orders()">
              <td>
                <span class="badge" [class.warning]="o.status==='PENDING'" [class.success]="o.status==='COMPLETED'" [class.warning]="o.status==='STAFF_COMPLETED'">
                  {{ label(o.status) }}
                </span>
              </td>
              <td>
                <div *ngFor="let it of o.items" style="font-size:13px">
                  {{ it.product?.name }} × {{ it.quantity }}
                </div>
              </td>
              <td>{{ o.totalAmount }} {{ o.currency }}</td>
              <td>{{ (o.createdAt || '').slice(0,16).replace('T',' ') }}</td>
              <td>
                <span class="muted" *ngIf="o.staffMessageText">{{ o.staffMessageText }}</span>
                <span class="muted" *ngIf="!o.staffMessageText">—</span>
              </td>
              <td>
                <button class="btn" *ngIf="o.status==='PENDING'" (click)="openEdit(o)" [disabled]="loading() || saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm2.92 2.83H5v-.92l9.06-9.06.92.92L5.92 20.08ZM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.82 1.82 3.75 3.75 1.82-1.82Z"/></svg>
                  Edit
                </button>
                <button class="btn danger" *ngIf="o.status==='PENDING'" (click)="openCancel(o)" [disabled]="loading() || saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
                  Cancel
                </button>
                <span class="muted" *ngIf="o.status==='STAFF_COMPLETED'">Awaiting your confirmation…</span>
              </td>
            </tr>
            <tr *ngIf="!orders().length">
              <td colspan="6" class="muted" style="padding:14px">No orders</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="overlay" *ngIf="editOrder() as o">
        <div class="dialog card">
          <div class="title">Edit order</div>
          <div class="sub">You can edit or cancel only while order is pending.</div>
          <div class="grid">
            <label class="lbl">Service centre</label>
            <select class="sel2" [(ngModel)]="editCentreId">
              <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
            </select>

            <label class="lbl">Product</label>
            <select class="sel2" [(ngModel)]="editProductId">
              <option *ngFor="let p of products()" [value]="p.id">{{ p.name }} ({{ p.price }} {{ p.currency }})</option>
            </select>

            <label class="lbl">Quantity</label>
            <input class="inp" type="number" min="1" max="1000" [(ngModel)]="editQty" />
          </div>
          <div class="actions">
            <button class="btn" (click)="closeEdit()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Close
            </button>
            <button class="btn primary" (click)="saveEdit(o)" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM6 8V5h9v3H6Z"/></svg>
              Save
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="cancelOrder() as o">
        <div class="dialog card">
          <div class="title">Cancel order?</div>
          <div class="sub">Confirm to cancel this pending order.</div>
          <div class="mini">
            <div><b>Order:</b> {{ o.id }}</div>
            <div><b>Total:</b> {{ o.totalAmount }} {{ o.currency }}</div>
          </div>
          <div class="actions">
            <button class="btn" (click)="closeCancel()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              No
            </button>
            <button class="btn danger" (click)="confirmCancel(o)" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
              Yes, cancel
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
      .muted{color:var(--muted);margin-top:-6px}
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
      .dialog{width:100%;max-width:420px;padding:18px}
      .title{font-weight:900;color:var(--dark);letter-spacing:.2px}
      .sub{font-size:12px;color:var(--muted);margin-top:6px}
      .mini{margin-top:10px;text-align:left;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
      .grid{display:grid;grid-template-columns:1fr;gap:8px;margin-top:12px}
      .lbl{font-size:12px;color:var(--muted);text-align:left}
      .sel2,.inp{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
    `
  ]
})
export class CustomerOrdersPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
  status = "";
  orders = signal<any[]>([]);
  products = signal<any[]>([]);
  centres = signal<any[]>([]);
  editOrder = signal<any | null>(null);
  cancelOrder = signal<any | null>(null);
  editProductId = "";
  editCentreId = "";
  editQty = 1;

  ngOnInit() {
    void this.auth.init().then(() => Promise.all([this.loadLookups(), this.load()]));
  }

  label(s: string) {
    if (s === "STAFF_COMPLETED") return "READY";
    return s;
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{ myOrders: { nodes: any[] } }>(
        `query MyOrders($status: OrderStatus){
          myOrders(pagination:{page:1,pageSize:50}, status:$status){
            nodes{ id status createdAt totalAmount currency staffMessageText serviceCentre{ id centreName } items{ id quantity product{ id name price currency } } }
          }
        }`,
        { status: this.status || null }
      );
      this.orders.set(data.myOrders.nodes ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadLookups() {
    const [p, c] = await Promise.all([
      this.gql.request<{ products: { nodes: any[] } }>(`query P{ products(pagination:{page:1,pageSize:200}){ nodes{ id name price currency } } }`),
      this.gql.request<{ serviceCentres: { nodes: any[] } }>(`query C{ serviceCentres(pagination:{page:1,pageSize:200}, status: ACTIVE){ nodes{ id centreName } } }`)
    ]);
    this.products.set(p.products.nodes ?? []);
    this.centres.set(c.serviceCentres.nodes ?? []);
  }

  openEdit(o: any) {
    this.editOrder.set(o);
    this.editCentreId = o.serviceCentre?.id || "";
    this.editProductId = o.items?.[0]?.product?.id || "";
    this.editQty = o.items?.[0]?.quantity || 1;
  }

  closeEdit() {
    this.editOrder.set(null);
  }

  async saveEdit(o: any) {
    if (!o?.id) return;
    this.saving.set(true);
    try {
      await this.gql.request(
        `mutation U($orderId: ID!, $input: UpdateMyOrderInput!){
          updateMyOrder(orderId:$orderId, input:$input){ id status }
        }`,
        { orderId: o.id, input: { productId: this.editProductId, quantity: Number(this.editQty), serviceCentreId: this.editCentreId } }
      );
      this.closeEdit();
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  openCancel(o: any) {
    if (!o?.id) return;
    this.cancelOrder.set(o);
  }

  closeCancel() {
    this.cancelOrder.set(null);
  }

  async confirmCancel(o: any) {
    if (!o?.id) return;
    this.saving.set(true);
    try {
      await this.gql.request(`mutation C($orderId: ID!){ cancelMyOrder(orderId:$orderId){ id status } }`, { orderId: o.id });
      this.closeCancel();
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
