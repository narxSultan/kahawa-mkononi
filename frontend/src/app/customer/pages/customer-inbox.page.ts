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
          <h2>Inbox</h2>
          <div class="muted">Order updates and messages from staff</div>
        </div>
        <div class="right">
          <select class="sel" [(ngModel)]="filter" (change)="load()">
            <option value="UNREAD">Unread</option>
            <option value="ALL">All</option>
          </select>
          <button class="btn" (click)="load()" [disabled]="loading()">Refresh</button>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px">
        <table class="table">
          <thead>
            <tr>
              <th>At</th>
              <th>Title</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let n of items()">
              <td style="white-space:nowrap">{{ (n.createdAt || '').slice(0,16).replace('T',' ') }}</td>
              <td style="font-weight:800">{{ n.title }}</td>
              <td class="msg">{{ n.message }}</td>
              <td style="text-align:right">
                <button class="btn" *ngIf="isReceipt(n)" (click)="openReceipt(n)">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm1 7V3.5L19.5 9H15ZM7 12h10v2H7v-2Zm0 4h7v2H7v-2Z" />
                  </svg>
                  View
                </button>
                <button class="btn" *ngIf="n.sender?.id" (click)="openReply(n)">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 6h-2v9H7l-4 4V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2Zm-4 2H7v2h10V8Zm0 4H7v2h10v-2Z" />
                  </svg>
                  Reply
                </button>
                <button class="btn" *ngIf="n.isRead===false" (click)="markRead(n)" [disabled]="markingId()===n.id">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                  </svg>
                  Mark read
                </button>
                <button class="btn danger" (click)="openDelete(n)" [disabled]="deletingId()===n.id">
                  <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z" />
                  </svg>
                  Delete
                </button>
              </td>
            </tr>
            <tr *ngIf="!items().length">
              <td colspan="4" class="muted" style="padding:14px">No messages</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="overlay" *ngIf="replyTo() as n">
        <div class="dialog card">
          <div class="title">Reply to {{ n.sender?.fullName }}</div>
          <div class="sub">{{ n.title }}</div>
          <textarea rows="4" class="ta" [ngModel]="replyText()" (ngModelChange)="replyText.set($event)" placeholder="Write reply..."></textarea>
          <div class="err" *ngIf="error()">{{ error() }}</div>
          <div class="actions">
            <button class="btn" (click)="closeReply()" [disabled]="sending()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn primary" (click)="sendReply()" [disabled]="sending() || !replyText().trim()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 21 23 12 2 3v7l15 2-15 2v7Z"/></svg>
              Send
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="receipt() as r">
        <div class="dialog card">
          <div class="title">{{ r.title }}</div>
          <div class="sub">Receipt notification</div>
          <pre class="pre">{{ r.message }}</pre>
          <div class="actions">
            <button class="btn" (click)="closeReceipt()">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Close
            </button>
            <button class="btn" (click)="printReceipt(r)">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3Zm-3 11H8v-5h8v5Zm3-9a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM18 3H6v4h12V3Z"/></svg>
              Print
            </button>
            <button class="btn danger" (click)="openDelete(r)" [disabled]="deletingId()===r.id">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 7h2v9h-2v-9Zm4 0h2v9h-2v-9ZM7 10h2v9H7v-9ZM6 8h12l-1 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 8Z"/></svg>
              Delete
            </button>
          </div>
        </div>
      </div>

      <div class="overlay" *ngIf="deleteTarget() as d">
        <div class="dialog card">
          <div class="title">Delete notification?</div>
          <div class="sub">This will permanently remove it from your inbox.</div>
          <div class="actions">
            <button class="btn" (click)="closeDelete()" [disabled]="deletingId()===d.id">
              <svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M18.3 5.7 12 12l6.3 6.3-1.4 1.4L10.6 13.4 4.3 19.7 2.9 18.3 9.2 12 2.9 5.7 4.3 4.3l6.3 6.3 6.3-6.3 1.4 1.4Z"/></svg>
              Cancel
            </button>
            <button class="btn danger" (click)="confirmDelete()" [disabled]="deletingId()===d.id">
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
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .msg{max-width:520px}
      .overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:grid;place-items:center;z-index:1000}
      .dialog{width:100%;max-width:420px;padding:18px}
      .title{font-weight:900;color:var(--dark);letter-spacing:.2px}
      .sub{font-size:12px;color:var(--muted);margin-top:6px}
      .ta{width:100%;margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white);resize:none}
      .actions{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}
      .err{margin-top:10px;color:var(--danger);font-size:12px}
      .pre{margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:12px;background:rgba(245,239,230,.55);white-space:pre-wrap;word-break:break-word;text-align:left;max-height:55vh;overflow:auto;font-size:12px;line-height:1.4}
      @media (max-width: 720px){.msg{max-width:260px}}
    `
  ]
})
export class CustomerInboxPageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  markingId = signal<string | null>(null);
  sending = signal(false);
  error = signal<string | null>(null);
  items = signal<any[]>([]);
  filter: "UNREAD" | "ALL" = "UNREAD";
  replyTo = signal<any | null>(null);
  replyText = signal("");
  receipt = signal<any | null>(null);
  deletingId = signal<string | null>(null);
  deleteTarget = signal<any | null>(null);

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  async load() {
    this.loading.set(true);
    try {
      const onlyUnread = this.filter === "UNREAD";
      const data = await this.gql.request<{ notifications: { nodes: any[] } }>(
        `query Inbox($onlyUnread: Boolean!){
          notifications(pagination:{page:1,pageSize:50}, onlyUnread:$onlyUnread){
            nodes{ id title message type isRead createdAt sender{ id fullName } }
          }
        }`,
        { onlyUnread }
      );
      this.items.set(data.notifications.nodes ?? []);
    } finally {
      this.loading.set(false);
    }
  }

  isReceipt(n: any) {
    const t = String(n?.title ?? "");
    const m = String(n?.message ?? "");
    return t.startsWith("Receipt:") || m.startsWith("KAHAWA MKONONI RECEIPT");
  }

  async openReceipt(n: any) {
    if (!n?.id) return;
    if (n.isRead === false) {
      try {
        await this.gql.request(`mutation R($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: n.id });
        this.items.set(this.items().map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
      } catch {
        // ignore
      }
    }
    this.receipt.set({ ...n, isRead: true });
  }

  closeReceipt() {
    this.receipt.set(null);
  }

  printReceipt(n: any) {
    const title = String(n?.title ?? "Receipt");
    const message = String(n?.message ?? "");
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
    w.document.open();
    w.document.write(`
      <html>
        <head>
          <title>${esc(title)}</title>
          <style>
            body{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; padding:24px; color:#111}
            pre{white-space:pre-wrap; word-break:break-word; font-size:12px; line-height:1.4}
          </style>
        </head>
        <body>
          <pre>${esc(message)}</pre>
          <script>setTimeout(()=>{ try{ window.print(); } catch(e){} }, 200);</script>
        </body>
      </html>
    `);
    w.document.close();
    w.focus();
  }

  openDelete(n: any) {
    if (!n?.id) return;
    this.deleteTarget.set(n);
  }

  closeDelete() {
    this.deleteTarget.set(null);
  }

  async confirmDelete() {
    const n = this.deleteTarget();
    if (!n?.id) return;
    this.deletingId.set(n.id);
    try {
      await this.gql.request(`mutation Del($id: ID!){ deleteNotification(id:$id) }`, { id: n.id });
      this.items.set(this.items().filter((x) => x.id !== n.id));
      if (this.receipt()?.id === n.id) this.closeReceipt();
      if (this.replyTo()?.id === n.id) this.closeReply();
      this.closeDelete();
    } finally {
      this.deletingId.set(null);
    }
  }

  openReply(n: any) {
    if (!n?.sender?.id) return;
    this.error.set(null);
    this.replyText.set("");
    this.replyTo.set(n);
  }

  closeReply() {
    this.replyTo.set(null);
    this.replyText.set("");
    this.error.set(null);
  }

  async sendReply() {
    const n = this.replyTo();
    const receiverId = n?.sender?.id;
    const message = this.replyText().trim();
    if (!receiverId || !message) return;
    this.sending.set(true);
    this.error.set(null);
    try {
      await this.gql.request(
        `mutation Send($input: SendNotificationInput!){
          sendNotification(input:$input)
        }`,
        { input: { title: "Order reply", message, type: "INFO", receiverId } }
      );
      if (n?.id && n.isRead === false) {
        try {
          await this.gql.request(`mutation R($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: n.id });
        } catch {
          // ignore
        }
      }
      this.closeReply();
      await this.load();
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.sending.set(false);
    }
  }

  async markRead(n: any) {
    if (!n?.id) return;
    this.markingId.set(n.id);
    try {
      await this.gql.request(`mutation R($id: ID!){ markNotificationRead(id:$id){ id isRead } }`, { id: n.id });
      this.items.set(this.items().map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    } finally {
      this.markingId.set(null);
    }
  }
}
