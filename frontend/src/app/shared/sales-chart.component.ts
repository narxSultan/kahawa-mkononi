import { CommonModule } from "@angular/common";
import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, inject, signal } from "@angular/core";
import { Chart, type ChartConfiguration, registerables } from "chart.js";
import { GraphqlClient } from "../core/graphql.client";

let chartJsRegistered = false;
function ensureChartJsRegistered() {
  if (chartJsRegistered) return;
  Chart.register(...registerables);
  chartJsRegistered = true;
}

@Component({
  selector: "app-sales-chart",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card wrap">
      <div class="head">
        <div>
          <div class="title">Sales Trend</div>
          <div class="sub">Last {{ rangeDays }} days</div>
        </div>
        <button class="btn" (click)="reload()" [disabled]="loading()">Refresh</button>
      </div>
      <div class="canvas">
        <canvas #canvas></canvas>
      </div>
    </div>
  `,
  styles: [
    `
      .wrap {
        padding: 14px;
      }
      .head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 10px;
      }
      .title {
        font-weight: 800;
        color: var(--dark);
      }
      .sub {
        font-size: 12px;
        color: var(--muted);
      }
      .canvas {
        height: 260px;
      }
      canvas {
        width: 100% !important;
        height: 260px !important;
      }
    `
  ]
})
export class SalesChartComponent implements AfterViewInit, OnDestroy {
  private gql = inject(GraphqlClient);

  @Input() serviceCentreId: string | null = null;
  @Input() rangeDays = 30;

  @ViewChild("canvas", { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  loading = signal(false);
  private chart: Chart | null = null;

  ngAfterViewInit() {
    ensureChartJsRegistered();
    void this.reload();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  async reload() {
    this.loading.set(true);
    try {
      const data = await this.gql.request<{
        salesChart: { points: Array<{ date: string; amount: string }> };
      }>(
        `query SalesChart($serviceCentreId: ID, $rangeDays: Int!) {
          salesChart(serviceCentreId: $serviceCentreId, rangeDays: $rangeDays) {
            points { date amount }
          }
        }`,
        { serviceCentreId: this.serviceCentreId, rangeDays: this.rangeDays }
      );

      const labels = data.salesChart.points.map((p) => p.date);
      const values = data.salesChart.points.map((p) => Number(p.amount));

      const cfg: ChartConfiguration<"line"> = {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Sales",
              data: values,
              borderColor: "#6F4E37",
              backgroundColor: "rgba(111, 78, 55, 0.12)",
              tension: 0.35,
              fill: true,
              pointRadius: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { maxTicksLimit: 8 } },
            y: { ticks: { maxTicksLimit: 6 } }
          }
        }
      };

      this.chart?.destroy();
      this.chart = new Chart(this.canvas.nativeElement, cfg);
    } finally {
      this.loading.set(false);
    }
  }
}
