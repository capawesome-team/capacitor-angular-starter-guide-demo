import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonItem,
  IonList,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  AlertController,
  ToastController
} from '@ionic/angular';
import { Trip } from '../../../core/models/trip.model';
import { Expense } from '../../../core/models/expense.model';
import { TripsRepository } from '../../../core/services/trips.repository';
import { ExpensesRepository } from '../../../core/services/expenses.repository';
import { StorageService } from '../../../core/services/storage.service';
import { CurrencyFormatPipe } from '../../../shared/pipes/currency-format.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ExpenseItemComponent } from '../../../shared/components/expense-item/expense-item.component';
import {
  formatTripDateRange,
  getTripBudgetColor,
  getTripBudgetProgress,
  getTripRemainingBudget
} from '../trip-view.utils';

@Component({
  selector: 'app-trip-detail',
  standalone: true,
  imports: [
    CurrencyFormatPipe,
    EmptyStateComponent,
    ExpenseItemComponent,
    IonHeader,
    IonToolbar,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonItem,
    IonList,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonSkeletonText
  ],
  templateUrl: './trip-detail.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./trip-detail.page.scss']
})
export class TripDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsRepo = inject(TripsRepository);
  private readonly expensesRepo = inject(ExpensesRepository);
  private readonly storageService = inject(StorageService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  trip = signal<Trip | null>(null);
  expenses = signal<Expense[]>([]);
  loading = signal(true);
  budgetProgress = computed(() => {
    return getTripBudgetProgress(this.trip());
  });
  budgetColor = computed(() => getTripBudgetColor(this.trip()));
  remainingBudget = computed(() => getTripRemainingBudget(this.trip()));
  budgetPercent = computed(() => Math.round(this.budgetProgress() * 100));

  private tripId = '';

  ngOnInit(): void {
    this.tripId = this.route.snapshot.paramMap.get('tripId') ?? '';
  }

  async ionViewWillEnter(): Promise<void> {
    if (this.tripId) {
      await this.loadData();
    }
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      const [tripResult, expenses] = await Promise.all([
        this.tripsRepo.getTripByIdResult(this.tripId),
        this.expensesRepo.getExpenses(this.tripId)
      ]);
      if (tripResult.status === 'error') {
        throw tripResult.error ?? new Error('Failed to load trip.');
      }
      this.trip.set(tripResult.data);
      this.expenses.set(expenses);
      if (tripResult.status === 'not-found') {
        await this.presentToast('Trip not found.', 'danger');
      }
    } catch (err) {
      console.error('Failed to load trip data', err);
      await this.presentToast('Failed to load trip data.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: Event): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  editTrip(): void {
    this.router.navigate(['/trips', this.tripId, 'edit']);
  }

  addExpense(): void {
    this.router.navigate(['/trips', this.tripId, 'expenses', 'new']);
  }

  openExpense(expense: Expense): void {
    this.router.navigate(['/trips', this.tripId, 'expenses', expense.id]);
  }

  async deleteExpense(expense: Expense): Promise<void> {
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
              if (expense.attachment?.storagePath) {
                await this.storageService.deleteFile(
                  expense.attachment.storagePath
                );
              }
              await this.expensesRepo.deleteExpense(this.tripId, expense.id);
              await this.tripsRepo.recalculateTotalSpent(this.tripId);
              await this.loadData();
              await this.presentToast('Expense deleted.', 'primary');
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

  async deleteTrip(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Trip',
      message:
        'This will delete the trip and all its expenses. This action cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              const expenses = this.expenses();
              const currentTrip = this.trip();
              for (const exp of expenses) {
                if (exp.attachment?.storagePath) {
                  await this.storageService.deleteFile(
                    exp.attachment.storagePath
                  );
                }
                await this.expensesRepo.deleteExpense(this.tripId, exp.id);
              }
              if (currentTrip?.coverImage?.storagePath) {
                await this.storageService.deleteFile(
                  currentTrip.coverImage.storagePath
                );
              }
              await this.tripsRepo.deleteTrip(this.tripId);
              await this.presentToast('Trip deleted.', 'primary');
              this.router.navigate(['/trips'], { replaceUrl: true });
            } catch (err) {
              console.error('Failed to delete trip', err);
              await this.presentToast('Failed to delete trip.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  formatDateRange(): string {
    return formatTripDateRange(this.trip());
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
