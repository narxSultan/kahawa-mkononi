import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

@Component({
  standalone: true,
  selector: "app-footer",
  imports: [CommonModule],
  template: `
    <footer class="footer">
      <div class="inner">
        <div class="left">© {{ year }} Kahawa Mkononi</div>
        <div class="right">Coffee Service Management</div>
      </div>
    </footer>
  `,
  styles: [
    `
      .footer {
        border-top: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(8px);
      }
      .inner {
        max-width: 1200px;
        margin: 0 auto;
        padding: 12px 16px;
        padding-bottom: calc(12px + env(safe-area-inset-bottom));
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.3;
      }
      .right {
        text-align: right;
        white-space: nowrap;
      }
      @media (max-width: 900px) {
        .inner {
          flex-direction: column;
          align-items: flex-start;
        }
        .right {
          text-align: left;
          white-space: normal;
        }
      }
    `
  ]
})
export class FooterComponent {
  year = new Date().getFullYear();
}
