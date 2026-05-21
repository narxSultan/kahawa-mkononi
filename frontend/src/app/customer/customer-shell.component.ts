import { CommonModule } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../core/auth.service";
import { GraphqlClient } from "../core/graphql.client";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand" (click)="goHome()">
          <div class="logo"></div>
          <div>
            <div class="name">KAHAWA MKONONI</div>
            <div class="tag">Customer Portal</div>
          </div>
        </div>
        <div class="user" *ngIf="user() as u">
          <div class="meta">
            <div class="who">{{ u.fullName }}</div>
            <div class="sub">{{ u.email }}</div>
          </div>
          <button class="icon-btn" (click)="toggleBell()" aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5-6.71V3a2 2 0 1 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.6 1.6A1 1 0 0 0 4.1 19h15.8a1 1 0 0 0 .7-1.7L19 16Z"
              />
            </svg>
            <span class="count" *ngIf="unread() > 0">{{ unread() }}</span>
          </button>
          <button class="btn" (click)="logout()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17v-2h4v-6h-4V7l-5 5 5 5Zm9-14H11v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            </svg>
            Logout
          </button>
        </div>
      </header>

      <div class="scrim" *ngIf="bellOpen()" (click)="closeBell()"></div>
      <div class="bell" *ngIf="bellOpen()">
        <div class="bell-head">
          <div>
            <div class="bell-title">Notifications</div>
            <div class="bell-sub">Unread: {{ unread() }}</div>
          </div>
          <div class="bell-actions">
            <button class="btn" (click)="openInbox()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4l3 3 3-3h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 15h-4.17L12 20.83 9.17 18H5V5h14v13Z" />
              </svg>
              Inbox
            </button>
            <button class="btn" (click)="refreshBell()" [disabled]="bellLoading()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        <div class="bell-empty muted" *ngIf="!bellLoading() && !bellItems().length">No unread notifications</div>
        <div class="bell-list" *ngIf="bellItems().length">
          <button class="bell-item" *ngFor="let n of bellItems()" (click)="openFromBell(n)">
            <div class="row1">
              <div class="t">{{ n.title }}</div>
              <span class="badge" [class.danger]="n.type==='WARNING'" [class.task]="n.type==='TASK'">{{ n.type }}</span>
            </div>
            <div class="row2">
              <div class="m">{{ n.message }}</div>
            </div>
            <div class="row3">
              <span class="from">{{ n.sender?.fullName || "System" }}</span>
              <span class="at">{{ (n.createdAt || "").slice(0, 16).replace("T", " ") }}</span>
            </div>
          </button>
        </div>
      </div>

      <nav class="nav">
        <a class="item" routerLink="/customer/order" routerLinkActive="active">New Order</a>
        <a class="item" routerLink="/customer/orders" routerLinkActive="active">My Orders</a>
        <a class="item" routerLink="/customer/inbox" routerLinkActive="active">Inbox<span class="pill" *ngIf="unread() > 0">{{ unread() }}</span></a>
        <a class="item" routerLink="/customer/profile" routerLinkActive="active">Profile</a>
      </nav>

      <main class="content">
        <router-outlet />
      </main>

      <ng-container *ngIf="confirmOrder() as o">
        <div class="overlay" *ngIf="!rejecting()">
          <div class="dialog card">
            <div class="tick">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M9.0 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" />
              </svg>
            </div>
            <div class="title">order complete</div>
            <div class="sub">Please confirm your order completion.</div>
            <div class="mini">
              <div><b>Order:</b> {{ o.id }}</div>
              <div><b>Centre:</b> {{ o.serviceCentre?.centreName || "—" }}</div>
              <div><b>Total:</b> {{ o.totalAmount }} {{ o.currency }}</div>
            </div>
            <div class="actions">
              <button class="btn danger" (click)="openReject()" [disabled]="deciding()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
                Not
              </button>
              <button class="btn primary" (click)="acknowledge(o)" [disabled]="deciding()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                OK
              </button>
            </div>
          </div>
        </div>

        <div class="overlay" *ngIf="rejecting()">
          <div class="dialog card">
            <div class="title">not completed</div>
            <div class="sub">Tell staff why the order is not complete.</div>
            <textarea rows="4" class="ta" [ngModel]="rejectReason()" (ngModelChange)="rejectReason.set($event)" placeholder="Write reason..."></textarea>
            <div class="actions">
              <button class="btn" (click)="backToConfirm()" [disabled]="deciding()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H19v-2Z"/></svg>
                Back
              </button>
              <button class="btn primary" (click)="reject(o)" [disabled]="deciding() || !rejectReason().trim()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z"/></svg>
                Send
              </button>
            </div>
          </div>
        </div>
      </ng-container>
    </div>
  `,
  styles: [
    `
      .shell{min-height:100vh;display:flex;flex-direction:column;position:relative}
      .shell::before{content:"";position:fixed;inset:0;pointer-events:none;background-image:var(--brand-logo, none);background-repeat:no-repeat;background-position:center;background-size:62vmin;opacity:.06;filter:grayscale(1);z-index:0}
      .topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--white);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:10}
      .brand{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}
      .logo{width:38px;height:38px;border-radius:12px;background:linear-gradient(135deg,var(--coffee),var(--dark));background-image:var(--brand-logo, none);background-size:contain;background-repeat:no-repeat;background-position:center;box-shadow:var(--shadow)}
      .name{font-weight:900;color:var(--dark);letter-spacing:.3px}
      .tag{font-size:12px;color:var(--muted)}
      .user{display:flex;align-items:center;gap:12px}
      .meta{text-align:right;line-height:1.2}
      .who{font-weight:800}
      .sub{font-size:12px;color:var(--muted)}
      .icon-btn{position:relative;width:42px;height:42px;border-radius:14px;border:1px solid var(--border);background:var(--white);display:inline-flex;align-items:center;justify-content:center}
      .icon-btn svg{width:22px;height:22px;fill:var(--dark)}
      .count{position:absolute;top:-6px;right:-6px;min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:var(--danger);color:#fff;font-size:11px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;border:2px solid var(--bg)}
      .nav{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--border);background:rgba(245,239,230,.55);position:relative;z-index:1}
      .item{padding:10px 12px;border-radius:12px;border:1px solid transparent}
      .item.active{background:rgba(111,78,55,.12);border-color:rgba(111,78,55,.25)}
      .pill{display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 6px;border-radius:999px;background:rgba(198,40,40,.12);border:1px solid rgba(198,40,40,.25);color:var(--danger);font-size:11px;margin-left:6px;font-weight:800}
      .content{padding:16px;position:relative;z-index:1}
      .scrim{position:fixed;inset:0;background:rgba(0,0,0,.15);z-index:50}
      .bell{position:fixed;right:16px;top:72px;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 96px);background:var(--white);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow);z-index:60;overflow-x:hidden;overflow-y:auto;display:flex;flex-direction:column}
      .bell-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 12px;border-bottom:1px solid var(--border);background:rgba(245,239,230,.55)}
      .bell-actions{display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
      .bell-title{font-weight:900;color:var(--dark)}
      .bell-sub{font-size:12px;color:var(--muted)}
      .bell-empty{padding:12px}
      .bell-list{overflow:auto}
      .bell-item{width:100%;text-align:left;padding:12px;border:0;border-bottom:1px solid rgba(0,0,0,.06);background:transparent;cursor:pointer}
      .bell-item:hover{background:rgba(111,78,55,.06)}
      .row1{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .t{font-weight:900;color:var(--dark);font-size:13px}
      .badge{font-size:11px;padding:4px 8px;border-radius:999px;border:1px solid rgba(0,0,0,.08);background:rgba(0,0,0,.04)}
      .badge.danger{background:rgba(198,40,40,.12);border-color:rgba(198,40,40,.25);color:var(--danger)}
      .badge.task{background:rgba(255,179,0,.18);border-color:rgba(255,179,0,.35);color:#7a4b00}
      .row2{margin-top:6px;color:var(--muted);font-size:12px;overflow-wrap:anywhere;word-break:break-word}
      .row3{margin-top:8px;display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:11px;flex-wrap:wrap}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:2000}
      .dialog{width:100%;max-width:380px;padding:18px;text-align:center}
      .tick{width:72px;height:72px;margin:0 auto 10px;border-radius:999px;background:rgba(46,125,50,.12);border:1px solid rgba(46,125,50,.25);display:grid;place-items:center}
      .tick svg{width:42px;height:42px;fill:var(--success)}
      .title{font-weight:900;color:var(--dark);text-transform:uppercase;letter-spacing:.6px}
      .sub{font-size:12px;color:var(--muted);margin-top:6px}
      .mini{margin-top:10px;text-align:left;font-size:13px;color:var(--dark);background:var(--bg);border:1px solid var(--border);border-radius:12px;padding:10px}
      .actions{display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap}
      .ta{width:100%;margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white);resize:none}
    `
  ]
})
export class CustomerShellComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private gql = inject(GraphqlClient);
  user = this.auth.user;

  confirmOrder = signal<any | null>(null);
  rejecting = signal(false);
  rejectReason = signal("");
  deciding = signal(false);
  unread = signal(0);
  bellOpen = signal(false);
  bellLoading = signal(false);
  bellItems = signal<any[]>([]);
  private pollId: number | null = null;

  ngOnInit() {
    void this.auth.init().then(() => this.checkReadyOrders());
    this.pollId = window.setInterval(() => void this.checkReadyOrders(), 15000);
    void this.refreshUnread();
  }

  ngOnDestroy() {
    if (this.pollId) window.clearInterval(this.pollId);
  }

  private async refreshUnread() {
    try {
      const data = await this.gql.request<{ unreadNotificationCount: number }>(`query U{ unreadNotificationCount }`);
      this.unread.set(data.unreadNotificationCount ?? 0);
    } catch {
      // ignore
    }
    window.setTimeout(() => void this.refreshUnread(), 30000);
  }

  toggleBell() {
    this.bellOpen.set(!this.bellOpen());
    if (this.bellOpen()) void this.refreshBell();
  }

  closeBell() {
    this.bellOpen.set(false);
  }

  async refreshBell() {
    this.bellLoading.set(true);
    try {
      const data = await this.gql.request<{ unreadNotificationCount: number; notifications: { nodes: any[] } }>(
        `query Bell {
          unreadNotificationCount
          notifications(pagination:{page:1,pageSize:20}, onlyUnread:true){
            nodes { id title message type isRead createdAt sender { id fullName } }
          }
        }`
      );
      this.unread.set(data.unreadNotificationCount ?? 0);
      this.bellItems.set(data.notifications.nodes ?? []);
    } finally {
      this.bellLoading.set(false);
    }
  }

  async openFromBell(n: any) {
    this.closeBell();
    if (n?.id && n.isRead === false) {
      try {
        await this.gql.request(`mutation Read($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: n.id });
        this.unread.set(Math.max(0, this.unread() - 1));
      } catch {
        // ignore
      }
    }
    void this.router.navigateByUrl("/customer/inbox");
  }

  openInbox() {
    this.closeBell();
    void this.router.navigateByUrl("/customer/inbox");
  }

  private async checkReadyOrders() {
    if (!this.user() || this.user()?.role.name !== "CUSTOMER") return;
    if (this.confirmOrder()) return; // already blocking
    try {
      const data = await this.gql.request<{ myOrders: { nodes: any[] } }>(
        `query ReadyOrders{
          myOrders(pagination:{page:1,pageSize:5}, status: STAFF_COMPLETED){
            nodes{ id status createdAt totalAmount currency serviceCentre{ id centreName } }
          }
        }`
      );
      const first = (data.myOrders.nodes ?? [])[0] ?? null;
      if (first) this.confirmOrder.set(first);
    } catch {
      // ignore
    }
  }

  goHome() {
    void this.router.navigateByUrl("/customer/order");
  }

  logout() {
    this.auth.logout();
    void this.router.navigateByUrl("/customer/login");
  }

  openReject() {
    this.rejecting.set(true);
    this.rejectReason.set("");
  }

  backToConfirm() {
    this.rejecting.set(false);
    this.rejectReason.set("");
  }

  async acknowledge(o: any) {
    if (!o?.id) return;
    this.deciding.set(true);
    try {
      await this.gql.request(`mutation Ack($orderId: ID!){ acknowledgeOrder(orderId:$orderId){ id status } }`, { orderId: o.id });
      this.confirmOrder.set(null);
      this.rejecting.set(false);
      await this.checkReadyOrders();
    } finally {
      this.deciding.set(false);
    }
  }

  async reject(o: any) {
    if (!o?.id) return;
    const reason = this.rejectReason().trim();
    if (!reason) return;
    this.deciding.set(true);
    try {
      await this.gql.request(
        `mutation Rej($orderId: ID!, $reason: String!){ rejectOrder(orderId:$orderId, reason:$reason){ id status } }`,
        { orderId: o.id, reason }
      );
      this.confirmOrder.set(null);
      this.rejecting.set(false);
      this.rejectReason.set("");
      await this.checkReadyOrders();
    } finally {
      this.deciding.set(false);
    }
  }
}
