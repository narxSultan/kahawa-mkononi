import { CommonModule } from "@angular/common";
import { HttpClient } from "@angular/common/http";
import { Component, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { GraphqlClient } from "../../core/graphql.client";
import { APP_CONFIG } from "../../core/config";
import { TranslatePipe } from "../../shared/translate.pipe";
import { BrandingService } from "../../core/branding.service";
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

function fmtBytes(n: number) {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const d = i === 0 ? 0 : i === 1 ? 0 : 1;
  return `${v.toFixed(d)} ${units[i]}`;
}

@Component({
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    <div class="container">
      <h2>{{ "Branding" | t }}</h2>
      <div class="muted">{{ "Upload and set the system logo" | t }}</div>

      <div class="grid two" style="margin-top:12px">
        <div class="card pad">
          <div class="title">{{ "Logo" | t }}</div>
          <div class="sub">{{ "This logo is used on web and app splash screens" | t }}</div>

          <div class="preview" *ngIf="logoUrl(); else noLogo">
            <img [src]="absUrl(logoUrl())" alt="Logo preview" />
          </div>
          <ng-template #noLogo>
            <div class="preview empty">
              <div class="ph">☕</div>
              <div class="sub">{{ "No logo set" | t }}</div>
            </div>
          </ng-template>

          <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap">
            <input type="file" accept="image/*" (change)="onFile($event)" />
            <button class="btn primary" (click)="uploadAndSet()" [disabled]="saving() || !selectedFile">
              {{ saving() ? ("Saving..." | t) : ("Upload & Set" | t) }}
            </button>
            <button class="btn" (click)="clearLogo()" [disabled]="saving() || !logoUrl()">{{ "Clear" | t }}</button>
            <button class="btn" (click)="load()" [disabled]="saving()">{{ "Reload" | t }}</button>
          </div>

          <div class="spec">
            <div class="k">{{ "Logo spec" | t }}</div>
            <ul>
              <li>{{ "Formats" | t }}: JPEG, PNG, WEBP, GIF</li>
              <li>{{ "Max size" | t }}: 3 MB</li>
              <li>{{ "Recommended" | t }}: 512×512 (square), transparent background (PNG/WebP)</li>
              <li>{{ "Tip" | t }}: {{ "Use a high-contrast logo for visibility" | t }}</li>
            </ul>
          </div>

          <div class="selected" *ngIf="selectedFile">
            <div class="k">{{ "Selected file" | t }}</div>
            <div class="row" style="justify-content:space-between;gap:10px;flex-wrap:wrap">
              <div class="sub">
                {{ selectedFile.name }} • {{ selectedFile.type || "unknown" }} • {{ fmtBytes(selectedFile.size) }}
              </div>
              <button class="btn" (click)="clearSelected()" [disabled]="saving()">{{ "Remove" | t }}</button>
            </div>
            <div class="preview" style="min-height:120px;margin-top:10px">
              <img [src]="selectedPreviewUrl()" alt="Selected logo preview" />
            </div>
          </div>

          <div class="err" *ngIf="err()">{{ err() }}</div>
          <div class="ok" *ngIf="ok()">{{ "Saved" | t }}</div>
        </div>

        <div class="card pad">
          <div class="title">{{ "Preview" | t }}</div>
          <div class="sub">{{ "Watermark background (low opacity)" | t }}</div>
          <div class="watermark">
            <div class="wm" *ngIf="logoUrl()" [style.backgroundImage]="'url(' + absUrl(logoUrl()) + ')'"></div>
            <div class="demo">
              <div class="big">{{ "KAHAWA MKONONI" | t }}</div>
              <div class="muted">{{ "Example screen content" | t }}</div>
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
      .title{font-weight:800;color:var(--dark)}
      .sub{font-size:12px;color:var(--muted)}
      .preview{margin-top:10px;border:1px solid var(--border);border-radius:14px;min-height:160px;display:flex;align-items:center;justify-content:center;background:rgba(245,239,230,.45);overflow:hidden}
      .preview img{max-width:100%;max-height:220px;object-fit:contain;padding:18px}
      .preview.empty{flex-direction:column;gap:8px}
      .ph{font-size:40px}
      .err{margin-top:10px;color:var(--danger);font-weight:700}
      .ok{margin-top:10px;color:var(--success);font-weight:800}
      .spec{margin-top:12px;border:1px dashed var(--border);border-radius:14px;padding:12px;background:rgba(245,239,230,.25)}
      .spec .k{font-weight:900;color:var(--dark);margin-bottom:6px}
      .spec ul{margin:0;padding-left:18px}
      .spec li{font-size:12px;color:var(--muted);margin:4px 0}
      .selected{margin-top:12px}
      .selected .k{font-weight:900;color:var(--dark)}
      .watermark{margin-top:10px;position:relative;border:1px solid var(--border);border-radius:14px;min-height:260px;overflow:hidden;background:#fff}
      .wm{position:absolute;inset:-30px;opacity:.08;background-size:contain;background-repeat:no-repeat;background-position:center;filter:grayscale(1)}
      .demo{position:relative;padding:18px}
      .big{font-weight:900;font-size:22px}
    `
  ]
})
export class BrandingPageComponent {
  private gql = inject(GraphqlClient);
  private http = inject(HttpClient);
  private branding = inject(BrandingService);

  logoUrl = signal<string | null>(null);
  saving = signal(false);
  ok = signal(false);
  err = signal<string | null>(null);
  selectedPreviewUrl = signal<string>("");
  selectedFile: File | null = null;

  ngOnInit() {
    void this.load();
  }

  absUrl(url: string | null | undefined) {
    return absUrl(url);
  }

  async load() {
    this.ok.set(false);
    this.err.set(null);
    const data = await this.gql.request<{ appBranding: { logoUrl?: string | null } }>(`query Branding { appBranding { logoUrl } }`);
    this.logoUrl.set(data.appBranding?.logoUrl ?? null);
    await this.branding.load();
  }

  onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
    this.ok.set(false);
    this.err.set(null);
    if (this.selectedFile) {
      const url = URL.createObjectURL(this.selectedFile);
      this.selectedPreviewUrl.set(url);
    } else {
      this.selectedPreviewUrl.set("");
    }
  }

  clearSelected() {
    const url = this.selectedPreviewUrl();
    if (url) URL.revokeObjectURL(url);
    this.selectedPreviewUrl.set("");
    this.selectedFile = null;
  }

  async uploadAndSet() {
    if (!this.selectedFile) return;
    this.saving.set(true);
    this.ok.set(false);
    this.err.set(null);
    try {
      const fd = new FormData();
      fd.append("file", this.selectedFile);
      const token = tokenStorage.getAccessToken();
      const up = await firstValueFrom(
        this.http.post<{ url: string }>(`${apiBase()}/upload`, fd, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        })
      );
      const url = String(up?.url ?? "").trim();
      if (!url) throw new Error("Upload failed");
      const data = await this.gql.request<{ setAppBranding: { logoUrl?: string | null } }>(
        `mutation SetLogo($logoUrl: String) { setAppBranding(logoUrl:$logoUrl) { logoUrl } }`,
        { logoUrl: url }
      );
      this.logoUrl.set(data.setAppBranding?.logoUrl ?? null);
      this.ok.set(true);
      this.clearSelected();
      await this.branding.load();
    } catch (e: any) {
      this.err.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  async clearLogo() {
    this.saving.set(true);
    this.ok.set(false);
    this.err.set(null);
    try {
      const data = await this.gql.request<{ setAppBranding: { logoUrl?: string | null } }>(
        `mutation Clear { setAppBranding(logoUrl:null) { logoUrl } }`
      );
      this.logoUrl.set(data.setAppBranding?.logoUrl ?? null);
      this.ok.set(true);
      await this.branding.load();
    } catch (e: any) {
      this.err.set(String(e?.message ?? e));
    } finally {
      this.saving.set(false);
    }
  }

  fmtBytes(n: number) {
    return fmtBytes(n);
  }
}
