import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AuthService, type RoleName } from "../../core/auth.service";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type NotificationType = "INFO" | "WARNING" | "TASK" | "SYSTEM";

type SendMode = "ONE" | "CENTRE" | "ROLE" | "ALL";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "Send Message" | t }}</h2>
          <div class="muted">{{ "Send notifications to users" | t }}</div>
        </div>
        <div class="right">
          <button class="btn" (click)="loadOptions()" [disabled]="loading()">
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
	        <div class="grid form">
	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Send mode" | t }}</label>
	            <div class="modes">
	              <label><input type="radio" name="mode" [(ngModel)]="mode" value="ONE" /> {{ "One user" | t }}</label>
	              <label><input type="radio" name="mode" [(ngModel)]="mode" value="CENTRE" /> {{ "Service centre" | t }}</label>
	              <label *ngIf="isAdmin()"><input type="radio" name="mode" [(ngModel)]="mode" value="ROLE" /> {{ "Role" | t }}</label>
	              <label *ngIf="isAdmin()"><input type="radio" name="mode" [(ngModel)]="mode" value="ALL" /> {{ "All users" | t }}</label>
	            </div>
	          </div>

	          <div class="field" *ngIf="mode==='ONE'">
	            <label>{{ "Receiver" | t }}</label>
	            <select [(ngModel)]="receiverId">
	              <option value="">{{ "Select..." | t }}</option>
	              <option *ngFor="let u of users()" [value]="u.id">{{ u.fullName }} · {{ u.email }}</option>
	            </select>
	          </div>

	          <div class="field" *ngIf="mode==='CENTRE'">
	            <label>{{ "Service centre" | t }}</label>
	            <select [(ngModel)]="serviceCentreId" [disabled]="!isAdmin()">
	              <option value="">{{ "Select..." | t }}</option>
	              <option *ngFor="let c of centres()" [value]="c.id">{{ c.centreName }}</option>
	            </select>
	            <div class="muted" *ngIf="!isAdmin()">{{ "Managers can only message their own centre." | t }}</div>
	          </div>

	          <div class="field" *ngIf="mode==='ROLE' && isAdmin()">
	            <label>{{ "Target role" | t }}</label>
	            <select [(ngModel)]="targetRole">
	              <option value="">{{ "Select..." | t }}</option>
	              <option value="ADMIN">ADMIN</option>
	              <option value="MANAGER">MANAGER</option>
	              <option value="STAFF">STAFF</option>
	              <option value="CALL_CENTRE_AGENT">CALL_CENTRE_AGENT</option>
	            </select>
	          </div>

	          <div class="field">
	            <label>{{ "Type" | t }}</label>
	            <select [(ngModel)]="type">
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="TASK">TASK</option>
              <option value="SYSTEM">SYSTEM</option>
            </select>
          </div>

	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Title" | t }}</label>
	            <input [(ngModel)]="title" placeholder="{{ 'Short title' | t }}" />
	          </div>

	          <div class="field" style="grid-column:1/-1">
	            <label>{{ "Message" | t }}</label>
	            <textarea rows="4" [(ngModel)]="message" placeholder="{{ 'Write your message...' | t }}"></textarea>
	          </div>
        </div>

        <div class="actions">
          <button class="btn primary" (click)="send()" [disabled]="sending() || !canSend()">
            <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 21 23 12 2 3v7l15 2-15 2v7Z" />
            </svg>
            {{ sending() ? ("Sending..." | t) : ("Send" | t) }}
          </button>
        </div>

        <div class="error" *ngIf="error()">{{ error() }}</div>
	        <div class="muted" *ngIf="sent()">{{ "Message sent." | t }}</div>
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
      .modes{display:flex;gap:12px;flex-wrap:wrap}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
      .error{margin-top:10px;color:var(--danger);white-space:pre-line}
    `
  ]
})
export class SendMessagePageComponent {
  private gql = inject(GraphqlClient);
  private auth = inject(AuthService);

  loading = signal(false);
  sending = signal(false);
  error = signal<string | null>(null);
  sent = signal(false);

  mode: SendMode = "ONE";
  receiverId = "";
  serviceCentreId = "";
  targetRole: RoleName | "" = "";
  type: NotificationType = "INFO";
  title = "";
  message = "";

  users = signal<any[]>([]);
  centres = signal<any[]>([]);

  isAdmin = computed(() => this.auth.role() === "ADMIN");
  isManager = computed(() => this.auth.role() === "MANAGER");

  ngOnInit() {
    void this.auth.init().then(() => this.loadOptions());
  }

  canSend(): boolean {
    if (!this.title.trim() || !this.message.trim()) return false;
    if (this.mode === "ONE") return Boolean(this.receiverId);
    if (this.mode === "CENTRE") return Boolean(this.serviceCentreId);
    if (this.mode === "ROLE") return this.isAdmin() && Boolean(this.targetRole);
    if (this.mode === "ALL") return this.isAdmin();
    return false;
  }

  async loadOptions() {
    this.loading.set(true);
    try {
      if (this.isAdmin()) {
        const [centres, users] = await Promise.all([
          this.gql.request<{ serviceCentres: { nodes: any[] } }>(`query Centres { serviceCentres(pagination:{page:1,pageSize:50}){ nodes{ id centreName } } }`),
          this.gql.request<{ users: { nodes: any[] } }>(`query Users { users(pagination:{page:1,pageSize:50}){ nodes{ id fullName email } } }`)
        ]);
        this.centres.set(centres.serviceCentres.nodes);
        this.users.set(users.users.nodes);
      } else if (this.isManager()) {
        const users = await this.gql.request<{ users: { nodes: any[] } }>(`query Users { users(pagination:{page:1,pageSize:100}){ nodes{ id fullName email } } }`);
        this.users.set(users.users.nodes);
        this.serviceCentreId = this.auth.user()?.serviceCentre?.id ?? "";
        // Manager messaging is centre-scoped; default to centre mode.
        this.mode = "CENTRE";
      }
    } finally {
      this.loading.set(false);
    }
  }

  async send() {
    this.error.set(null);
    this.sent.set(false);
    this.sending.set(true);
    try {
      const input: any = {
        title: this.title.trim(),
        message: this.message.trim(),
        type: this.type
      };
      if (this.mode === "ONE") input.receiverId = this.receiverId;
      if (this.mode === "CENTRE") input.serviceCentreId = this.serviceCentreId;
      if (this.mode === "ROLE") input.targetRole = this.targetRole;
      if (this.mode === "ALL") input.sendToAll = true;

      await this.gql.request(`mutation Send($input: SendNotificationInput!){ sendNotification(input:$input) }`, { input });
      this.sent.set(true);
      this.title = "";
      this.message = "";
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    } finally {
      this.sending.set(false);
    }
  }
}
