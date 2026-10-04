import {
  Component,
  inject,
  signal,
  ChangeDetectionStrategy
} from '@angular/core';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonCard,
  IonCardContent,
  IonSkeletonText,
  ToastController
} from '@ionic/angular';
import { Trip } from '../../core/models/trip.model';
import { TripsRepository } from '../../core/services/trips.repository';
import { CurrencyFormatPipe } from '../../shared/pipes/currency-format.pipe';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  formatTripDateRange,
  getTripBudgetColor,
  getTripBudgetProgress
} from './trip-view.utils';

@Component({
  selector: 'app-trips',
  standalone: true,
  imports: [
    CurrencyFormatPipe,
    EmptyStateComponent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonProgressBar,
    IonRefresher,
    IonRefresherContent,
    IonCard,
    IonCardContent,
    IonSkeletonText
  ],
  templateUrl: './trips.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./trips.page.scss']
})
export class TripsPage {
  private readonly router = inject(Router);
  private readonly tripsRepo = inject(TripsRepository);
  private readonly toastCtrl = inject(ToastController);

  trips = signal<Trip[]>([]);
  loading = signal(true);

  ionViewWillEnter() {
    this.loadTrips();
  }

  async loadTrips(): Promise<void> {
    this.loading.set(true);
    try {
      const trips = await this.tripsRepo.getTrips();
      this.trips.set(trips);
    } catch (err) {
      console.error('Failed to load trips', err);
      await this.presentErrorToast('Failed to load trips.');
    } finally {
      this.loading.set(false);
    }
  }

  async handleRefresh(event: Event): Promise<void> {
    await this.loadTrips();
    (event.target as HTMLIonRefresherElement).complete();
  }

  openTrip(trip: Trip): void {
    this.router.navigate(['/trips', trip.id]);
  }

  createTrip(): void {
    this.router.navigate(['/trips/new']);
  }

  getBudgetProgress(trip: Trip): number {
    return getTripBudgetProgress(trip);
  }

  getBudgetColor(trip: Trip): string {
    return getTripBudgetColor(trip);
  }

  formatDateRange(trip: Trip): string {
    return formatTripDateRange(trip);
  }

  private async presentErrorToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      color: 'danger',
      duration: 2000,
      position: 'bottom'
    });
    await toast.present();
  }
}
