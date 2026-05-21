import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { firstValueFrom } from "rxjs";
import { GraphqlClient } from "../../core/graphql.client";
import { AuthService } from "../../core/auth.service";
import { APP_CONFIG } from "../../core/config";
import { tokenStorage } from "../../core/token.storage";

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
  imports: [CommonModule, FormsModule],
  template: `
    <div class="container">
      <h2>My Profile</h2>
      <div class="muted">Update your details</div>

      <div class="card pad" style="margin-top:12px" *ngIf="profile() as p">
        <div class="accountHead">
          <div class="avatar">
            <img *ngIf="auth.user()?.profilePhoto; else ph" [src]="absUrl(auth.user()?.profilePhoto)" alt="Profile photo" />
            <ng-template #ph><div class="ph">👤</div></ng-template>
          </div>
          <div class="who">
            <div style="font-weight:800">{{ auth.user()?.fullName || p.fullName }}</div>
            <div class="muted2">{{ auth.user()?.email }}</div>
          </div>
          <div class="uploadRow">
            <input type="file" accept="image/*" (change)="onFile($event)" />
            <button class="btn" (click)="uploadPhoto()" [disabled]="!selectedFile || uploading()">Upload photo</button>
          </div>
        </div>
        <div class="err" *ngIf="uploadErr()">{{ uploadErr() }}</div>

        <div class="grid form">
          <div class="field"><label>Full name</label><input [(ngModel)]="p.fullName" /></div>
          <div class="field"><label>Phone</label><input [(ngModel)]="p.phone" /></div>
          <div class="field"><label>Address</label><input [(ngModel)]="p.address" /></div>
          <div class="field"><label>Customer type</label><input [(ngModel)]="p.customerType" placeholder="Individual / Office / Event" /></div>
          <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea rows="3" [(ngModel)]="p.notes"></textarea></div>
        </div>
        <div class="actions">
          <button class="btn" (click)="load()" [disabled]="saving()">Reload</button>
          <button class="btn primary" (click)="save()" [disabled]="saving()">Save</button>
        </div>
        <div class="ok" *ngIf="saved()">Saved</div>
      </div>
    </div>
  `,
  styles: [
    `
      .muted{color:var(--muted);margin-top:-6px}
      .muted2{color:var(--muted);font-size:12px}
      .pad{padding:14px}
      .grid.form{grid-template-columns:repeat(2,minmax(0,1fr))}
      @media (max-width:720px){.grid.form{grid-template-columns:1fr}}
      .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
      .ok{margin-top:10px;color:var(--success);font-weight:700}
      .avatar{width:56px;height:56px;border-radius:999px;overflow:hidden;border:1px solid var(--border);background:rgba(245,239,230,.45);display:flex;align-items:center;justify-content:center}
      .avatar img{width:100%;height:100%;object-fit:cover}
      .ph{font-size:26px}
      .err{margin:8px 0;color:var(--danger);font-weight:700}
      .accountHead{display:flex;flex-direction:column;align-items:center;gap:10px;margin-bottom:10px;text-align:center}
      .who{display:flex;flex-direction:column;align-items:center}
      .uploadRow{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
    `
  ]
})
export class CustomerProfilePageComponent {
  private gql = inject(GraphqlClient);
  auth = inject(AuthService);
  private http = inject(HttpClient);
  profile = signal<any | null>(null);
  saving = signal(false);
  saved = signal(false);
  uploading = signal(false);
  uploadErr = signal<string | null>(null);
  selectedFile: File | null = null;

  ngOnInit() {
    void this.auth.init().then(() => this.load());
  }

  async load() {
    this.saved.set(false);
    const data = await this.gql.request<{ myCustomerProfile: any }>(
      `query Me { myCustomerProfile { id fullName phone address customerType notes } }`
    );
    this.profile.set({ ...(data.myCustomerProfile ?? {}) });
  }

  async save() {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.saved.set(false);
    try {
      const data = await this.gql.request<{ updateMyProfile: any }>(
        `mutation Save($input: UpdateMyProfileInput!) {
          updateMyProfile(input:$input){ id fullName phone address customerType notes }
        }`,
        { input: { fullName: p.fullName, phone: p.phone, address: p.address, customerType: p.customerType, notes: p.notes } }
      );
      this.profile.set({ ...(data.updateMyProfile ?? {}) });
      this.saved.set(true);
      await this.auth.init();
    } finally {
      this.saving.set(false);
    }
  }

  absUrl(url: string | null | undefined) {
    return absUrl(url);
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  async uploadPhoto() {
    if (!this.selectedFile) return;
    this.uploading.set(true);
    this.uploadErr.set(null);
    try {
      const fd = new FormData();
      fd.append("file", this.selectedFile);
      const token = tokenStorage.getAccessToken();
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(`${apiBase()}/upload/profile`, fd, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
      );
      const url = String(res?.url ?? "").trim();
      if (!url) throw new Error("Upload failed");
      await this.gql.request(`mutation U($input: UpdateMyAccountInput!){ updateMyAccount(input:$input){ id profilePhoto } }`, { input: { profilePhoto: url } });
      await this.auth.init();
    } catch (e: any) {
      this.uploadErr.set(String(e?.message ?? e));
    } finally {
      this.uploading.set(false);
    }
  }
}
