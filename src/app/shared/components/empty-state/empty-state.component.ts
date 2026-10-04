import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [IonIcon],
  template: `
    <div class="empty-state">
      <ion-icon [name]="icon()" class="empty-state__icon"></ion-icon>
      <h3 class="empty-state__title">{{ title() }}</h3>
      <p class="empty-state__message">{{ message() }}</p>
      <ng-content></ng-content>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;

        &__icon {
          font-size: 64px;
          color: var(--ion-color-secondary);
          margin-bottom: 16px;
          opacity: 0.75;
        }

        &__title {
          font-size: 18px;
          font-weight: 600;
          color: var(--ion-text-color);
          margin: 0 0 8px;
        }

        &__message {
          font-size: 14px;
          color: var(--ion-color-medium);
          margin: 0 0 24px;
          max-width: 280px;
          line-height: 1.5;
        }
      }
    `
  ]
})
export class EmptyStateComponent {
  icon = input.required<string>();
  title = input.required<string>();
  message = input.required<string>();
}
