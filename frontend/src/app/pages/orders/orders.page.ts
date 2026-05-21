import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>Orders <span class="muted2" *ngIf="totalCount()">{{ totalCount() }}</span></h2>
          <div class="muted">Complete customer orders (Phase 2 ready)</div>
	        </div>
	        <div class="right">
	          <select class="sel" [(ngModel)]="status" (change)="resetAndLoad()">
	            <option value="PENDING">PENDING</option>
	            <option value="STAFF_COMPLETED">READY (waiting customer)</option>
	            <option value="CUSTOMER_REJECTED">CUSTOMER REJECTED</option>
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
              <th>Customer</th>
              <th>Items</th>
              <th>Total</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let o of orders()">
              <td>
                <span class="badge" [class.warning]="o.status==='PENDING' || o.status==='STAFF_COMPLETED'" [class.success]="o.status==='COMPLETED'">
                  {{ o.status }}
                </span>
                <div class="muted2" *ngIf="o.status==='CUSTOMER_REJECTED'">Reason: {{ o.customerRejectionReason }}</div>
              </td>
              <td>{{ o.customer?.fullName }}<div class="muted2">{{ o.customer?.phone }}</div></td>
              <td>
                <div *ngFor="let it of o.items" style="font-size:13px">
                  {{ it.product?.name }} × {{ it.quantity }}
                </div>
              </td>
              <td>{{ o.totalAmount }} {{ o.currency }}</td>
              <td>{{ (o.createdAt || '').slice(0,16).replace('T',' ') }}</td>
              <td>
                <button class="btn primary" *ngIf="o.status==='PENDING'" (click)="openConfirm(o)" [disabled]="saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                  Mark Complete
                </button>
                <button class="btn" *ngIf="o.status==='PENDING'" (click)="openMessage(o)" [disabled]="saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 6h-2v9H7l-4 4V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Zm-4 2H7v2h10V8Zm0 4H7v2h10v-2Z"/></svg>
                  Message
                </button>
                <button class="btn" *ngIf="o.status==='CUSTOMER_REJECTED'" (click)="openRespond(o)" [disabled]="saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 6h-2v9H7l-4 4V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Zm-4 2H7v2h10V8Zm0 4H7v2h10v-2Z"/></svg>
                  Reply
                </button>
                <button class="btn danger" *ngIf="canDelete(o)" (click)="openDelete(o)" [disabled]="saving()">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
                  Clear
                </button>
              </td>
            </tr>
            <tr *ngIf="!orders().length">
              <td colspan="6" class="muted" style="padding:14px">No orders</td>
            </tr>
	          </tbody>
	        </table>
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

      <div class="overlay" *ngIf="confirmOrder() as o">
        <div class="dialog card">
          <div class="title">Confirm completion</div>
          <div class="sub">This will mark the order as ready. Customer must acknowledge to finalize.</div>
          <div class="mini">
            <div><b>Customer:</b> {{ o.customer?.fullName || "—" }}</div>
            <div><b>Total:</b> {{ o.totalAmount }} {{ o.currency }}</div>
          </div>
          <div class="actions">
            <button class="btn" (click)="closeConfirm()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn primary" (click)="confirmComplete(o)" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
              Yes, mark complete
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="respondOrder() as o">
        <div class="dialog card">
          <div class="title">Customer not completed</div>
          <div class="sub">Customer reason: {{ o.customerRejectionReason }}</div>
          <textarea rows="4" class="ta" [ngModel]="respondText()" (ngModelChange)="respondText.set($event)" placeholder="Write reply..."></textarea>
          <div class="err" *ngIf="respondError()">{{ respondError() }}</div>
          <div class="actions">
            <button class="btn" (click)="closeRespond()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn primary" (click)="sendRespond(o)" [disabled]="saving() || !respondText().trim()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z"/></svg>
              Send & mark ready
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="messageOrder() as o">
        <div class="dialog card">
          <div class="title">Message customer</div>
          <div class="sub">Send a message if the order is delayed. Customer will see a notification.</div>
          <textarea rows="4" class="ta" [ngModel]="messageText()" (ngModelChange)="messageText.set($event)" placeholder="Write message..."></textarea>
          <div class="err" *ngIf="messageError()">{{ messageError() }}</div>
          <div class="actions">
            <button class="btn" (click)="closeMessage()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn primary" (click)="sendMessage(o)" [disabled]="saving() || !messageText().trim()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z"/></svg>
              Send
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="deleteOrder() as o">
        <div class="dialog card">
          <div class="title">Clear order?</div>
          <div class="sub">This will permanently delete the order record and its items.</div>
          <div class="mini">
            <div><b>Order:</b> {{ o.id }}</div>
            <div><b>Status:</b> {{ o.status }}</div>
          </div>
          <div class="actions">
            <button class="btn" (click)="closeDelete()" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn danger" (click)="confirmDelete(o)" [disabled]="saving()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
              Delete
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
      .muted2{color:var(--muted);font-size:12px;margin-top:2px}
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
      .dialog{width:100%;max-width:420px;padding:18px}
      .title{font-weight:900;color:var(--dark);letter-spacing:.2px}
      .sub{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.4}
      .mini{margin-top:10px;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
	      .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
	      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
	      .ta{width:100%;margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white);resize:none}
	      .err{margin-top:10px;color:var(--danger);font-size:12px}
	      @media (max-width: 480px){.actions{justify-content:stretch}.actions .btn{flex:1}}
	    `
  ]
})
export class OrdersPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  saving = signal(false);
	  status = "PENDING";
	  orders = signal<any[]>([]);
	  totalCount = signal(0);
	  page = signal(1);
	  readonly pageSize = 10;
	  pageInfo = signal<any | null>(null);
	  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));
  confirmOrder = signal<any | null>(null);
  respondOrder = signal<any | null>(null);
  respondText = signal("");
  respondError = signal<string | null>(null);
  messageOrder = signal<any | null>(null);
  messageText = signal("");
  messageError = signal<string | null>(null);
  deleteOrder = signal<any | null>(null);

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  canDelete(o: any) {
    const role = this.auth.role();
    if (role !== "ADMIN") return false;
    const s = String(o?.status ?? "");
    return s === "COMPLETED" || s === "CANCELLED" || s === "CUSTOMER_REJECTED";
  }

	  async load() {
	    this.loading.set(true);
	    try {
	      const data = await this.gql.request<{ orders: { nodes: any[]; pageInfo: any } }>(
	        `query Orders($status: OrderStatus, $page: Int!, $pageSize: Int!){
	          orders(pagination:{page:$page,pageSize:$pageSize}, status:$status){
	            pageInfo { page pageSize total hasNextPage }
	            nodes{
	              id status createdAt totalAmount currency
	              customerRejectionReason
	              customer { id fullName phone }
	              items { id quantity product { id name } }
	            }
	          }
	        }`,
	        { status: this.status || null, page: this.page(), pageSize: this.pageSize }
	      );
	      this.orders.set(data.orders.nodes ?? []);
	      this.totalCount.set(data.orders.pageInfo?.total ?? 0);
	      this.pageInfo.set(data.orders.pageInfo);
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

  openConfirm(o: any) {
    if (!o?.id) return;
    this.confirmOrder.set(o);
  }

  closeConfirm() {
    this.confirmOrder.set(null);
  }

  openRespond(o: any) {
    if (!o?.id) return;
    this.respondText.set("");
    this.respondError.set(null);
    this.respondOrder.set(o);
  }

  closeRespond() {
    this.respondOrder.set(null);
    this.respondText.set("");
    this.respondError.set(null);
  }

  async confirmComplete(o: any) {
    if (!o?.id) return;
    this.saving.set(true);
    try {
      await this.gql.request(`mutation Done($orderId: ID!){ staffCompleteOrder(orderId:$orderId){ id status } }`, { orderId: o.id });
      this.confirmOrder.set(null);
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }

  async sendRespond(o: any) {
    if (!o?.id) return;
    const msg = this.respondText().trim();
    if (!msg) return;
    this.saving.set(true);
    this.respondError.set(null);
    try {
      await this.gql.request(
        `mutation Resp($orderId: ID!, $message: String!){
          staffRespondOrderRejection(orderId:$orderId, message:$message){ id status }
        }`,
        { orderId: o.id, message: msg }
      );
      this.closeRespond();
      await this.load();
    } catch (e: any) {
      this.respondError.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  openMessage(o: any) {
    if (!o?.id) return;
    this.messageText.set("");
    this.messageError.set(null);
    this.messageOrder.set(o);
  }

  closeMessage() {
    this.messageOrder.set(null);
    this.messageText.set("");
    this.messageError.set(null);
  }

  async sendMessage(o: any) {
    if (!o?.id) return;
    const msg = this.messageText().trim();
    if (!msg) return;
    this.saving.set(true);
    this.messageError.set(null);
    try {
      await this.gql.request(`mutation Msg($orderId: ID!, $message: String!){ staffMessageOrder(orderId:$orderId, message:$message){ id } }`, {
        orderId: o.id,
        message: msg
      });
      this.closeMessage();
    } catch (e: any) {
      this.messageError.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  openDelete(o: any) {
    if (!o?.id) return;
    this.deleteOrder.set(o);
  }

  closeDelete() {
    this.deleteOrder.set(null);
  }

  async confirmDelete(o: any) {
    if (!o?.id) return;
    this.saving.set(true);
    try {
      await this.gql.request(`mutation Del($orderId: ID!){ deleteOrder(orderId:$orderId) }`, { orderId: o.id });
      this.closeDelete();
      await this.load();
    } finally {
      this.saving.set(false);
    }
  }
}
