import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { AuthService, type RoleName } from "../core/auth.service";
import { FooterComponent } from "./footer.component";
import { GraphqlClient } from "../core/graphql.client";
import { I18nService, type Lang } from "../core/i18n.service";

type NavItem = { path: string; label: string; icon: string; roles?: RoleName[]; delegatedCode?: string };
type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "TASK" | "SYSTEM";
  isRead: boolean;
  createdAt: string;
  sender?: { id: string; fullName: string; email: string } | null;
};
type ThreadMessage = {
  id: string;
  title: string;
  message: string;
  type: "INFO" | "WARNING" | "TASK" | "SYSTEM";
  createdAt: string;
  isRead?: boolean;
  sender?: { id: string; fullName: string; email?: string | null } | null;
  receiver?: { id: string; fullName: string; email?: string | null } | null;
};

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, FooterComponent],
  template: `
    <div class="shell">
      <header class="topbar">
        <div class="brand" (click)="goHome()">
          <div class="logo"></div>
	          <div class="title">
	            <div class="name">KAHAWA MKONONI</div>
	            <div class="tag">{{ t("Coffee Service Management") }}</div>
	          </div>
	        </div>

        <div class="user" *ngIf="user() as u">
          <div class="meta">
            <div class="who">{{ u.fullName }}</div>
            <div class="role">{{ u.role.name }}<span *ngIf="u.serviceCentre"> · {{ u.serviceCentre?.centreName }}</span></div>
          </div>
          <select class="lang" [ngModel]="lang()" (ngModelChange)="setLang($event)" aria-label="Language">
            <option value="sw">🇹🇿 Kiswahili</option>
            <option value="en">🇬🇧 English</option>
          </select>
          <button class="icon-btn" (click)="toggleBell()" aria-label="Notifications">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-5-6.71V3a2 2 0 1 0-4 0v1.29A7 7 0 0 0 5 11v5l-1.6 1.6A1 1 0 0 0 4.1 19h15.8a1 1 0 0 0 .7-1.7L19 16Z"
              />
            </svg>
            <span class="count" *ngIf="unreadCount() > 0">{{ unreadCount() }}</span>
          </button>
	          <button class="btn" (click)="logout()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10 17v-2h4v-6h-4V7l-5 5 5 5Zm9-14H11v2h8v14h-8v2h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Z" />
            </svg>
	            {{ t("Logout") }}
	          </button>
	        </div>
	      </header>

      <div class="scrim" *ngIf="bellOpen()" (click)="closeBell()"></div>
      <div class="bell" *ngIf="bellOpen()">
	        <div class="bell-head">
	          <div>
	            <div class="bell-title">{{ t("Notifications") }}</div>
	            <div class="bell-sub">{{ t("Unread") }}: {{ unreadCount() }}</div>
	          </div>
	          <div class="bell-actions">
            <button class="btn" (click)="openInbox()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h4l3 3 3-3h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 15h-4.17L12 20.83 9.17 18H5V5h14v13Z" />
              </svg>
	              {{ t("Inbox") }}
	            </button>
            <button class="btn" *ngIf="canSeeOrders()" (click)="openOrders()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-2 16H7v-2h10v2Zm0-4H7v-2h10v2Zm0-4H7V9h10v2Z"/>
              </svg>
              Orders <span *ngIf="orderCount() > 0">({{ orderCount() }})</span>
            </button>
            <button class="btn" (click)="refreshBell()" [disabled]="bellLoading()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
                />
              </svg>
	              {{ t("Refresh") }}
	            </button>
	          </div>
	        </div>

	        <div class="bell-empty muted" *ngIf="!bellLoading() && !bellItems().length">{{ t("No unread notifications") }}</div>
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
	              <span class="from">{{ n.sender?.fullName || t("System") }}</span>
              <span class="at">{{ (n.createdAt || "").slice(0, 16).replace("T", " ") }}</span>
            </div>
          </button>
        </div>
      </div>

      <div class="dialog-scrim" *ngIf="chatOpen()" (click)="closeChat()"></div>
      <div class="dialog" *ngIf="chatOpen()">
        <div class="dialog-card" (click)="$event.stopPropagation()">
          <div class="dialog-head">
            <div>
	              <div class="dialog-title">{{ chatPartner()?.fullName || t("Inbox") }}</div>
	              <div class="dialog-sub">{{ chatPartner()?.email || t("All notifications") }}</div>
            </div>
            <div class="dialog-actions">
              <button class="btn" (click)="refreshChat()" [disabled]="chatLoading()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M17.65 6.35A7.95 7.95 0 0 0 12 4V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 13.65-6.65Z"
                  />
                </svg>
	                {{ t("Refresh") }}
	              </button>
	              <button class="btn" (click)="closeChat()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z" />
                </svg>
	                {{ t("Close") }}
	              </button>
            </div>
          </div>

          <div class="dialog-body">
            <div class="inbox-switch" *ngIf="!chatPartner()">
	              <button class="btn" [class.primary]="inboxFilter()==='UNREAD'" (click)="inboxFilter.set('UNREAD'); refreshInbox()">{{ t("Unread") }}</button>
	              <button class="btn" [class.primary]="inboxFilter()==='READ'" (click)="inboxFilter.set('READ'); refreshInbox()">{{ t("Read") }}</button>
	              <button class="btn" [class.primary]="inboxFilter()==='ALL'" (click)="inboxFilter.set('ALL'); refreshInbox()">{{ t("All") }}</button>
	            </div>
            <div class="msg-list" *ngIf="chatThread().length">
              <div
                class="msg"
                *ngFor="let m of chatThread()"
                [class.me]="m.sender?.id === (user()?.id || '')"
                (click)="openThreadFromMessage(m)"
              >
                <div class="bubble">
                  <div class="meta">
                    <span class="who">{{ m.sender?.id === (user()?.id || '') ? "Me" : (m.sender?.fullName || "System") }}</span>
                    <span class="at">{{ (m.createdAt || "").slice(0, 16).replace("T", " ") }}</span>
                    <button class="mini-btn" type="button" (click)="deleteMessage(m, $event)" aria-label="Delete">
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"
                        />
                      </svg>
                    </button>
                  </div>
                  <div class="text">{{ m.message }}</div>
                </div>
              </div>
            </div>
	            <div class="muted" *ngIf="!chatLoading() && !chatThread().length">{{ t("No messages") }}</div>
          </div>

          <div class="dialog-foot">
            <textarea
              rows="3"
              [ngModel]="replyText()"
              (ngModelChange)="replyText.set($event)"
	              [placeholder]="t('Type a reply...')"
	            ></textarea>
            <div class="send-row">
              <button class="btn primary" (click)="sendReply()" [disabled]="sending() || !replyText().trim()">
                <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 21 23 12 2 3v7l15 2-15 2v7Z" />
                </svg>
	                {{ t("Send") }}
	              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="body">
        <aside class="sidebar">
          <nav class="menu">
            <ng-container *ngFor="let item of visibleNav()">
              <button
                *ngIf="item.path === '/notifications'; else navLink"
                type="button"
                class="menu-item"
                (click)="openBellFromMenu()"
              >
                <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
                  <path [attr.d]="iconPath(item.icon)"></path>
                </svg>
                <span>{{ navLabel(item) }}</span>
                <span class="mini-count" *ngIf="unreadCount() > 0">{{ unreadCount() }}</span>
              </button>

              <ng-template #navLink>
                <a [routerLink]="item.path" routerLinkActive="active" class="menu-item">
                  <svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true">
                    <path [attr.d]="iconPath(item.icon)"></path>
                  </svg>
                  <span>{{ navLabel(item) }}</span>
                  <span class="mini-count" *ngIf="item.path === '/orders' && orderCount() > 0">{{ orderCount() }}</span>
                </a>
              </ng-template>
            </ng-container>
          </nav>
        </aside>
        <main class="content">
          <router-outlet />
        </main>
      </div>

      <app-footer />
    </div>
  `,
  styles: [
    `
      .shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        position: relative;
      }
      .shell::before{
        content:"";
        position: fixed;
        inset: 0;
        pointer-events: none;
        background-image: var(--brand-logo, none);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 62vmin;
        opacity: .06;
        filter: grayscale(1);
        z-index: 0;
      }
      .muted{color:var(--muted)}
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        background: var(--white);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 10;
        gap: 12px;
        position: relative;
        z-index: 1;
      }
      .body{position:relative;z-index:1}
      app-footer{position:relative;z-index:1}
      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        user-select: none;
      }
      .logo {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: linear-gradient(135deg, var(--coffee), var(--dark));
        background-image: var(--brand-logo, none);
        background-size: contain;
        background-repeat: no-repeat;
        background-position: center;
        box-shadow: var(--shadow);
      }
      .name {
        font-weight: 800;
        color: var(--dark);
        letter-spacing: 0.4px;
      }
      .tag {
        font-size: 12px;
        color: var(--muted);
      }
      .user {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .lang{
        padding: 10px 10px;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: var(--white);
        color: var(--dark);
        font-weight: 900;
        cursor: pointer;
      }
      .icon-btn {
        width: 42px;
        height: 42px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: var(--white);
        color: var(--dark);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        flex: 0 0 auto;
      }
      .icon-btn svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
      }
      .count {
        position: absolute;
        top: -6px;
        right: -6px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--warning);
        color: #3e2723;
        font-size: 11px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 2px solid var(--white);
      }
      .meta {
        text-align: right;
        line-height: 1.2;
      }
      .who {
        font-weight: 700;
      }
      .role {
        font-size: 12px;
        color: var(--muted);
      }
      .body {
        display: grid;
        grid-template-columns: 280px 1fr;
        flex: 1;
      }
      .sidebar {
        padding: 16px;
      }
      .menu {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .menu-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid transparent;
        color: var(--dark);
        background: transparent;
        cursor: pointer;
        text-align: left;
      }
      .menu-item .nav-ico {
        width: 18px;
        height: 18px;
        flex: 0 0 auto;
      }
      .menu-item .nav-ico path {
        fill: rgba(62, 39, 35, 0.55);
      }
      .menu-item.active {
        background: rgba(111, 78, 55, 0.1);
        border-color: rgba(111, 78, 55, 0.25);
      }
      .menu-item.active .nav-ico path {
        fill: var(--coffee);
      }
      .mini-count {
        margin-left: auto;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 999px;
        background: var(--warning);
        color: #3e2723;
        font-size: 11px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .content {
        padding: 16px;
      }

      .scrim {
        position: fixed;
        inset: 0;
        background: transparent;
        z-index: 40;
      }
      .bell {
        position: fixed;
        top: 64px;
        right: 12px;
        width: min(420px, calc(100vw - 24px));
        max-height: min(520px, calc(100vh - 96px));
        overflow-x: hidden;
        overflow-y: auto;
        background: var(--white);
        border: 1px solid var(--border);
        border-radius: 16px;
        box-shadow: var(--shadow);
        z-index: 50;
      }
      .bell-head {
        padding: 12px;
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        background: var(--white);
      }
      .bell-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        justify-content: flex-end;
        flex-wrap: wrap;
      }
      .bell-title {
        font-weight: 900;
        color: var(--dark);
      }
      .bell-sub {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
      }
      .bell-empty {
        padding: 14px 12px;
      }
      .bell-list {
        display: flex;
        flex-direction: column;
      }
      .bell-item {
        background: transparent;
        border: 0;
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid rgba(62, 39, 35, 0.08);
        cursor: pointer;
      }
      .bell-item:hover {
        background: rgba(245, 239, 230, 0.5);
      }
      .bell-item .row1 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .bell-item .t {
        font-weight: 900;
        color: var(--dark);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .bell-item .row2 {
        margin-top: 6px;
      }
      .bell-item .m {
        color: var(--text);
        font-size: 13px;
        overflow-wrap: anywhere;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .bell-item .row3 {
        margin-top: 8px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        font-size: 12px;
        color: var(--muted);
        flex-wrap: wrap;
      }
      .badge.task {
        background: rgba(111, 78, 55, 0.1);
        border-color: rgba(111, 78, 55, 0.25);
        color: var(--coffee);
      }

      .dialog-scrim {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.35);
        z-index: 60;
      }
      .dialog {
        position: fixed;
        inset: 0;
        z-index: 70;
        display: grid;
        place-items: center;
        padding: 12px;
      }
      .dialog-card {
        width: min(880px, 100%);
        height: min(680px, calc(100vh - 24px));
        background: var(--white);
        border: 1px solid var(--border);
        border-radius: 18px;
        box-shadow: var(--shadow);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .dialog-head {
        padding: 12px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        background: var(--white);
      }
      .dialog-title {
        font-weight: 900;
        color: var(--dark);
      }
      .dialog-sub {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
      }
      .dialog-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .dialog-body {
        padding: 12px;
        background: rgba(245, 239, 230, 0.45);
        flex: 1;
        overflow: auto;
      }
      .inbox-switch{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
      .msg-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .msg {
        display: flex;
        justify-content: flex-start;
      }
      .msg.me {
        justify-content: flex-end;
      }
      .bubble {
        max-width: min(640px, 92%);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 10px 12px;
        background: var(--white);
      }
      .msg.me .bubble {
        background: rgba(111, 78, 55, 0.08);
        border-color: rgba(111, 78, 55, 0.2);
      }
      .bubble .meta {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        font-size: 11px;
        color: var(--muted);
        margin-bottom: 6px;
      }
      .mini-btn{
        border: 0;
        background: transparent;
        color: var(--danger);
        font: inherit;
        cursor: pointer;
        padding: 0;
      }
      .mini-btn svg{width:16px;height:16px;fill:currentColor}
      .mini-btn:hover{opacity: .85}
      .bubble .text {
        font-size: 13px;
        color: var(--text);
        white-space: pre-wrap;
      }
      .dialog-foot {
        padding: 12px;
        border-top: 1px solid var(--border);
        background: var(--white);
      }
      .dialog-foot textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 12px;
        resize: vertical;
        font: inherit;
        background: var(--white);
      }
      .send-row {
        display: flex;
        justify-content: flex-end;
        margin-top: 10px;
      }
      @media (max-width: 900px) {
        .body {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: static;
          background: var(--cream);
          border-bottom: 1px solid var(--border);
          z-index: 5;
          padding: 10px 12px;
        }
        .menu {
          flex-direction: row;
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .menu::-webkit-scrollbar {
          display: none;
        }
        .menu-item {
          flex: 0 0 auto;
          white-space: nowrap;
        }
      }

      @media (max-width: 640px) {
        .topbar {
          padding: 12px;
          flex-wrap: wrap;
          align-items: flex-start;
        }
        .brand {
          flex: 1 1 auto;
          min-width: 0;
        }
        .logo {
          width: 34px;
          height: 34px;
          border-radius: 10px;
        }
        .tag {
          display: none;
        }
        .user {
          min-width: 0;
          flex: 1 1 100%;
          justify-content: space-between;
        }
        .icon-btn {
          width: 40px;
          height: 40px;
        }
        .meta {
          flex: 1 1 auto;
          min-width: 0;
          text-align: left;
        }
        .who,
        .role {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .content {
          padding: 12px;
        }
        .bell {
          top: 56px;
          right: 8px;
          width: calc(100vw - 16px);
          max-height: calc(100vh - 72px);
        }
        .dialog {
          padding: 8px;
        }
        .dialog-card {
          height: calc(100vh - 16px);
          border-radius: 16px;
        }
      }
    `
  ]
})
export class ShellComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  private gql = inject(GraphqlClient);
  private i18n = inject(I18nService);

  user = this.auth.user;
  lang = this.i18n.lang;
  unreadCount = signal(0);
  orderCount = signal(0);
  bellOpen = signal(false);
  bellLoading = signal(false);
  bellItems = signal<NotificationItem[]>([]);
  chatOpen = signal(false);
  chatLoading = signal(false);
  chatPartner = signal<{ id: string; fullName: string; email: string } | null>(null);
  chatThread = signal<ThreadMessage[]>([]);
  inboxFilter = signal<"UNREAD" | "READ" | "ALL">("UNREAD");
  replyText = signal("");
  sending = signal(false);
  private unreadInterval: number | null = null;
  private lastUnreadAt = 0;

  private iconPaths: Record<string, string> = {
    dashboard: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
    customers: "M16 11c1.66 0 3-1.34 3-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h7v-2.5C24 14.17 19.33 13 16 13Z",
    sales: "M3 17h3v4H3v-4Zm5-6h3v10H8V11Zm5 3h3v7h-3v-7Zm5-9h3v16h-3V5Z",
    stock: "M21 7.5 12 2 3 7.5V21h18V7.5Zm-2 2.1V19H5V9.6l7-4.1 7 4.1ZM7 11h10v2H7v-2Zm0 4h10v2H7v-2Z",
    centres: "M12 7V3H2v18h20V7H12Zm-2 12H4v-2h6v2Zm0-4H4v-2h6v2Zm0-4H4V5h6v6Zm10 8h-8V9h8v10Zm-2-6h-4v2h4v-2Z",
    users: "M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z",
    notifications: "M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2Z",
    send: "M2 21 23 12 2 3v7l15 2-15 2v7Z",
    duties: "M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm5 16H7v-2h10v2Zm0-4H7v-2h10v2Zm0-4H7V9h10v2Z",
    myDuties: "M19 3H14.82C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2Zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1Zm-1 14-4-4 1.41-1.41L11 14.17l5.59-5.59L18 10l-7 7Z",
    handover: "M7 7h11V4l4 4-4 4V9H7V7Zm10 10H6v3l-4-4 4-4v3h11v2Z",
    reports: "M3 3h18v2H3V3Zm2 6h3v10H5V9Zm5 4h3v6h-3v-6Zm5-8h3v14h-3V5Z",
    activity: "M4 4h16v2H4V4Zm0 7h16v2H4v-2Zm0 7h16v2H4v-2Z",
    profile: "M12 12c2.21 0 4-1.79 4-4S14.21 4 12 4 8 5.79 8 8s1.79 4 4 4Zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4Z",
    products: "M20 6H4V4h16v2ZM4 20h16v-8H4v8Zm0-10h16V8H4v2Zm2 4h4v4H6v-4Z"
  };

  iconPath(key: string) {
    return this.iconPaths[key] ?? this.iconPaths["dashboard"];
  }

  setLang(v: Lang) {
    this.i18n.setLang(v);
  }

  t(key: string) {
    return this.i18n.t(key);
  }

  canSeeOrders() {
    const role = this.auth.role();
    return Boolean(role && ["ADMIN", "MANAGER", "STAFF"].includes(role));
  }

  navLabel(item: NavItem) {
    return this.t(item.label);
  }

  private nav: NavItem[] = [
    { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { path: "/customers", label: "Customers", icon: "customers", roles: ["ADMIN", "MANAGER", "STAFF", "CALL_CENTRE_AGENT"] },
    { path: "/orders", label: "Orders", icon: "duties", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/products", label: "Products", icon: "products", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/sales", label: "Sales", icon: "sales", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/stock", label: "Stock", icon: "stock", roles: ["ADMIN", "MANAGER", "STAFF"] },
    { path: "/service-centres", label: "Service Centres", icon: "centres", roles: ["ADMIN", "MANAGER"] },

    { path: "/users", label: "Users", icon: "users", roles: ["ADMIN", "MANAGER"], delegatedCode: "MANAGE_USERS" },
    { path: "/notifications", label: "Notifications", icon: "notifications", roles: ["ADMIN", "MANAGER", "STAFF", "CALL_CENTRE_AGENT"] },
    { path: "/messages/send", label: "Send Message", icon: "send", roles: ["ADMIN", "MANAGER"], delegatedCode: "SEND_NOTIFICATIONS" },
    { path: "/duties", label: "Duty Assignment", icon: "duties", roles: ["ADMIN", "MANAGER"], delegatedCode: "ASSIGN_DUTIES" },
    { path: "/my-duties", label: "My Duties", icon: "myDuties", roles: ["STAFF"] },
    { path: "/handover", label: "Handover", icon: "handover", roles: ["MANAGER"] },
    { path: "/reports", label: "Reports", icon: "reports", roles: ["ADMIN", "MANAGER"], delegatedCode: "VIEW_REPORTS" },
    { path: "/activity-logs", label: "Activity Logs", icon: "activity", roles: ["ADMIN", "MANAGER"] },
    { path: "/branding", label: "Branding", icon: "products", roles: ["ADMIN"] },
    { path: "/profile", label: "My Profile", icon: "profile", roles: ["ADMIN", "MANAGER", "STAFF", "CALL_CENTRE_AGENT"] }
  ];

  visibleNav = computed(() => {
    const role = this.auth.role();
    const delegated = this.auth.delegatedPermissions();
    return this.nav.filter((n) => {
      if (!n.roles) return true;
      if (role && n.roles.includes(role)) return true;
      if (role === "STAFF" && n.delegatedCode && delegated.includes(n.delegatedCode)) return true;
      return false;
    });
  });

  ngOnInit() {
    void this.auth.init().then(() => this.refreshUnread());
    this.unreadInterval = window.setInterval(() => void this.refreshUnread(), 60000);
  }

  ngOnDestroy() {
    if (this.unreadInterval) window.clearInterval(this.unreadInterval);
  }

  async refreshUnread() {
    if (!this.auth.user()) return;
    const now = Date.now();
    if (now - this.lastUnreadAt < 15000) return;
    this.lastUnreadAt = now;
    try {
      const data = await this.gql.request<{ unreadNotificationCount: number }>(`query Unread { unreadNotificationCount }`);
      this.unreadCount.set(data.unreadNotificationCount ?? 0);
      await this.refreshOrderCount();
    } catch {
      // ignore
    }
  }

  async refreshOrderCount() {
    const role = this.auth.role();
    if (!role || !["ADMIN", "MANAGER", "STAFF"].includes(role)) return;
    try {
      const data = await this.gql.request<{ orders: { pageInfo: { total: number } } }>(
        `query PendingOrdersCount {
          orders(pagination:{page:1,pageSize:1}, status: PENDING) { pageInfo { total } }
        }`
      );
      this.orderCount.set(data.orders.pageInfo?.total ?? 0);
    } catch {
      // ignore
    }
  }

  goHome() {
    void this.router.navigateByUrl("/dashboard");
  }

  toggleBell() {
    this.bellOpen.set(!this.bellOpen());
    if (this.bellOpen()) void this.refreshBell();
  }

  closeBell() {
    this.bellOpen.set(false);
  }

  openBellFromMenu() {
    this.bellOpen.set(true);
    void this.refreshBell();
  }

  async refreshBell() {
    if (!this.auth.user()) return;
    this.bellLoading.set(true);
    try {
      const data = await this.gql.request<{ unreadNotificationCount: number; notifications: { nodes: NotificationItem[] } }>(
        `query Bell {
          unreadNotificationCount
          notifications(pagination:{page:1,pageSize:20}, onlyUnread:true) {
            nodes { id title message type isRead createdAt sender { id fullName email } }
          }
        }`
      );
      this.unreadCount.set(data.unreadNotificationCount ?? 0);
      this.bellItems.set(data.notifications.nodes ?? []);
      await this.refreshOrderCount();
    } finally {
      this.bellLoading.set(false);
    }
  }

  openInbox() {
    this.closeBell();
    this.chatPartner.set(null);
    this.chatOpen.set(true);
    this.chatThread.set([]);
    this.inboxFilter.set("UNREAD");
    void this.refreshInbox();
  }

  openOrders() {
    this.closeBell();
    void this.router.navigateByUrl("/orders");
  }

  async refreshInbox() {
    if (!this.auth.user()) return;
    this.chatLoading.set(true);
    try {
      const filter = this.inboxFilter();
      const isRead = filter === "READ" ? true : filter === "UNREAD" ? false : null;
      const base = `notifications(pagination:{page:1,pageSize:50}`;
      const query = isRead === null ? `${base})` : `${base}, isRead:${isRead ? "true" : "false"})`;
      const data = await this.gql.request<{ notifications: { nodes: ThreadMessage[] } }>(
        `query Inbox {
          ${query} {
            nodes { id title message type isRead createdAt sender { id fullName email } receiver { id fullName email } }
          }
        }`
      );
      this.chatThread.set((data.notifications.nodes ?? []).slice().reverse());
    } finally {
      this.chatLoading.set(false);
    }
  }

  openThreadFromMessage(m: ThreadMessage) {
    if (this.chatPartner()) return;
    const sender = m.sender ?? null;
    const me = this.user()?.id ?? "";
    if (!sender?.id || sender.id === me) return;
    if (m?.id && m.isRead === false) {
      void this.gql.request(`mutation Read($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: m.id }).then(() => void this.refreshUnread()).catch(() => {});
    }
    this.chatPartner.set({ id: sender.id, fullName: sender.fullName, email: sender.email ?? "" });
    this.chatThread.set([]);
    void this.refreshChat();
  }

  async deleteMessage(m: ThreadMessage, ev?: Event) {
    ev?.stopPropagation();
    if (!m?.id) return;
    try {
      await this.gql.request(`mutation Del($id: ID!){ deleteNotification(id:$id) }`, { id: m.id });
      await this.refreshChat();
      void this.refreshUnread();
    } catch {
      // ignore
    }
  }

  async openFromBell(n: NotificationItem) {
    this.closeBell();
    if (!n.isRead) {
      try {
        await this.gql.request(`mutation Read($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: n.id });
        this.unreadCount.set(Math.max(0, this.unreadCount() - 1));
      } catch {
        // ignore
      }
    }

    this.bellItems.set(this.bellItems().filter((x) => x.id !== n.id));

    const sender = n.sender ?? null;
    this.chatPartner.set(sender);
    this.chatOpen.set(true);
    this.chatThread.set([]);
    if (sender?.id) {
      await this.refreshChat();
    } else {
      // system notification: show as single message bubble
      this.chatThread.set([
        {
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type,
          createdAt: n.createdAt,
          sender: null,
          receiver: { id: this.user()?.id ?? "", fullName: this.user()?.fullName ?? "Me" }
        }
      ]);
    }
  }

  closeChat() {
    this.chatOpen.set(false);
    this.chatPartner.set(null);
    this.chatThread.set([]);
    this.replyText.set("");
  }

  async refreshChat() {
    const partnerId = this.chatPartner()?.id;
    if (!partnerId) return this.refreshInbox();
    this.chatLoading.set(true);
    try {
      const data = await this.gql.request<{ directMessages: { nodes: ThreadMessage[] } }>(
        `query Thread($withUserId: ID!) {
          directMessages(withUserId:$withUserId, pagination:{page:1,pageSize:50}) {
            nodes { id title message type createdAt sender { id fullName } receiver { id fullName } }
          }
        }`,
        { withUserId: partnerId }
      );
      this.chatThread.set((data.directMessages.nodes ?? []).slice().reverse());
    } finally {
      this.chatLoading.set(false);
    }
  }

  async sendReply() {
    const partnerId = this.chatPartner()?.id;
    if (!partnerId) return;
    const msg = String(this.replyText() ?? "").trim();
    if (!msg) return;
    this.sending.set(true);
    try {
      const input: any = { title: "Message", message: msg, type: "INFO", receiverId: partnerId };
      await this.gql.request(`mutation Send($input: SendNotificationInput!){ sendNotification(input:$input) }`, { input });
      this.replyText.set("");
      await this.refreshChat();
      void this.refreshUnread();
    } finally {
      this.sending.set(false);
    }
  }

  logout() {
    this.auth.logout();
    void this.router.navigateByUrl("/login");
  }
}
