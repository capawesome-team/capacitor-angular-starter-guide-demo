import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonSkeletonText,
  AlertController,
  ToastController
} from '@ionic/angular';
import { Expense } from '../../../core/models/expense.model';
import { getCategoryById } from '../../../core/constants/categories';
import { ExpensesRepository } from '../../../core/services/expenses.repository';
import { TripsRepository } from '../../../core/services/trips.repository';
import { StorageService } from '../../../core/services/storage.service';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';

@Component({
  selector: 'app-expense-detail',
  standalone: true,
  imports: [
    DatePipe,
    CurrencyFormatPipe,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonList,
    IonItem,
    IonLabel,
    IonSkeletonText
  ],
  templateUrl: './expense-detail.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./expense-detail.page.scss']
})
export class ExpenseDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly expensesRepo = inject(ExpensesRepository);
  private readonly tripsRepo = inject(TripsRepository);
  private readonly storageService = inject(StorageService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  expense = signal<Expense | null>(null);
  loading = signal(true);
  category = computed(() =>
    getCategoryById(this.expense()?.category ?? 'other')
  );

  tripId = '';
  private expenseId = '';

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('tripId') ?? '';
    this.expenseId = this.route.snapshot.paramMap.get('expenseId') ?? '';
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.expenseId) {
      await this.loadExpense();
    }
  }

  private async loadExpense(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.expensesRepo.getExpenseByIdResult(
        this.tripId,
        this.expenseId
      );
      if (result.status === 'error') {
        throw result.error ?? new Error('Failed to load expense.');
      }
      this.expense.set(result.data);
      if (result.status === 'not-found') {
        await this.presentToast('Expense not found.', 'danger');
      }
    } catch (err) {
      console.error('Failed to load expense', err);
      await this.presentToast('Failed to load expense.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  getCategory() {
    return this.category();
  }

  editExpense(): void {
    this.router.navigate([
      '/trips',
      this.tripId,
      'expenses',
      this.expenseId,
      'edit'
    ]);
  }

  async deleteExpense(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Expense',
      message: 'Are you sure you want to delete this expense?',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const exp = this.expense();
              if (exp?.attachment?.storagePath) {
                await this.storageService.deleteFile(
                  exp.attachment.storagePath
                );
              }
              await this.expensesRepo.deleteExpense(
                this.tripId,
                this.expenseId
              );
              await this.tripsRepo.recalculateTotalSpent(this.tripId);
              await this.presentToast('Expense deleted.', 'primary');
              this.router.navigate(['/trips', this.tripId], {
                replaceUrl: true
              });
            } catch (err) {
              console.error('Failed to delete expense', err);
              await this.presentToast('Failed to delete expense.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  openAttachment(): void {
    const att = this.expense()?.attachment;
    if (att?.downloadUrl) {
      window.open(att.downloadUrl, '_blank');
    }
  }

  private async presentToast(
    message: string,
    color: 'primary' | 'danger'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration: 1800,
      position: 'bottom'
    });
    await toast.present();
  }
}
