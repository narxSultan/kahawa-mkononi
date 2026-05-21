import { CommonModule } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { GraphqlClient } from "../../core/graphql.client";
import { TranslatePipe } from "../../shared/translate.pipe";

type DutyStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  template: `
    <div class="container">
      <div class="row">
        <div>
          <h2>{{ "My Duties" | t }}</h2>
          <div class="muted">{{ "Update your task progress" | t }}</div>
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
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ "Title" | t }}</th>
                <th>{{ "Priority" | t }}</th>
                <th>{{ "Status" | t }}</th>
                <th>{{ "Due" | t }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let d of duties()">
                <td style="font-weight:800">{{ d.title }}</td>
                <td><span class="badge">{{ d.priority }}</span></td>
                <td>
                  <select class="sel" [(ngModel)]="d.status" (change)="updateStatus(d.id, d.status)">
                    <option value="PENDING">PENDING</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </td>
                <td>{{ d.dueDate ? (d.dueDate||'').slice(0,10) : "—" }}</td>
                <td style="text-align:right">
                  <button class="btn" (click)="addComment(d.id)">
                    <svg class="ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7l-3 3V6a2 2 0 0 1 2-2Z" />
                    </svg>
                    {{ "Comment" | t }}
                  </button>
                </td>
              </tr>
              <tr *ngIf="!duties().length">
                <td colspan="5" class="muted" style="padding:14px">{{ "No duties assigned" | t }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="pager" *ngIf="pageInfo()">
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
    </div>
  `,
  styles: [
    `
      .row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;flex-wrap:wrap}
      .right{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .muted{color:var(--muted)}
      .pad{padding:14px}
      .sel{padding:10px 12px;border:1px solid var(--border);border-radius:12px;background:var(--white)}
      .pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:10px;flex-wrap:wrap}
    `
  ]
})
export class MyDutiesPageComponent {
  private gql = inject(GraphqlClient);

  loading = signal(false);
  duties = signal<any[]>([]);
  page = signal(1);
  readonly pageSize = 10;
  pageInfo = signal<any | null>(null);
  totalPages = computed(() => Math.max(1, Math.ceil(Number(this.pageInfo()?.total ?? 0) / this.pageSize)));

  ngOnInit() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{ myDuties: { nodes: any[]; pageInfo: any } }>(
        `query MyDuties($page: Int!, $pageSize: Int!) {
          myDuties(pagination:{page:$page,pageSize:$pageSize}){
            nodes{ id title priority status dueDate }
            pageInfo { page pageSize total hasNextPage }
          }
        }`,
        { page: this.page(), pageSize: this.pageSize }
      );
      this.duties.set(data.myDuties.nodes ?? []);
      this.pageInfo.set(data.myDuties.pageInfo ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(id: string, status: DutyStatus) {
    await this.gql.request(`mutation Update($id: ID!, $input: UpdateDutyInput!){ updateDuty(id:$id,input:$input){ id } }`, { id, input: { status } });
    await this.load();
  }

  async addComment(dutyId: string) {
    const msg = prompt("Comment");
    if (!msg?.trim()) return;
    await this.gql.request(`mutation Comment($input: AddDutyCommentInput!){ addDutyComment(input:$input){ id } }`, { input: { dutyId, message: msg.trim() } });
    await this.load();
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
}
