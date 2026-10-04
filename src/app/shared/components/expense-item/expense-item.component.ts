import {
  Component,
  computed,
  input,
  output,
  ChangeDetectionStrategy
} from '@angular/core';
import { DatePipe } from '@angular/common';
import {
  IonItem,
  IonLabel,
  IonIcon,
  IonItemSliding,
  IonItemOptions,
  IonItemOption
} from '@ionic/angular/standalone';
import { Expense } from '../../../core/models/expense.model';
import { getCategoryById } from '../../../core/constants/categories';
import { CurrencyFormatPipe } from '../../pipes/currency-format.pipe';

@Component({
  selector: 'app-expense-item',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyFormatPipe,
    IonItem,
    IonLabel,
    IonIcon,
    IonItemSliding,
    IonItemOptions,
    IonItemOption
  ],
  template: `
    <ion-item-sliding>
      <ion-item
        [button]="true"
        (click)="tap.emit(expense())"
        [detail]="true"
        lines="full"
      >
        <div
          class="category-icon"
          [style.background]="getCategory().color"
          slot="start"
        >
          <ion-icon [name]="getCategory().icon"></ion-icon>
        </div>
        <ion-label>
          <h2>{{ getCategory().label }}</h2>
          <p>
            {{ expense().date | date: 'mediumDate' }}
            @if (expense().notes) {
              ·
              {{ expense().notes }}
            }
          </p>
        </ion-label>
        <div class="expense-amount" slot="end">
          <strong>{{
            expense().amount | currencyFormat: expense().currency
          }}</strong>
        </div>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" (click)="delete.emit(expense())">
          <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
        </ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
  `,
  changeDetection: ChangeDetectionStrategy.Eager,
  styles: [
    `
      ion-item {
        --background: var(--ion-card-background);
        --border-color: var(--ion-border-color);
        --inner-padding-top: 8px;
        --inner-padding-bottom: 8px;
      }

      .category-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 18px;
      }

      ion-label h2 {
        font-weight: 600;
        font-size: 15px;
      }

      ion-label p {
        font-size: 13px;
        margin-top: 2px;
      }

      .expense-amount {
        display: flex;
        align-items: center;
        gap: 6px;

        strong {
          font-size: 16px;
          font-weight: 700;
          color: var(--ion-text-color);
        }
      }
    `
  ]
})
export class ExpenseItemComponent {
  expense = input.required<Expense>();
  tap = output<Expense>();
  delete = output<Expense>();
  category = computed(() => getCategoryById(this.expense().category));

  getCategory() {
    return this.category();
  }
}
