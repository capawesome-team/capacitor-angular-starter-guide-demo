import {
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormControl,
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule
} from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonButton,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonIcon,
  IonSpinner,
  IonLoading,
  IonChip,
  ActionSheetController,
  ToastController
} from '@ionic/angular/standalone';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { EXPENSE_CATEGORIES } from '../../../core/constants/categories';
import { CURRENCIES } from '../../../core/constants/currencies';
import { Trip } from '../../../core/models/trip.model';
import { TripsRepository } from '../../../core/services/trips.repository';
import { ExpensesRepository } from '../../../core/services/expenses.repository';
import { StorageService } from '../../../core/services/storage.service';

interface AttachmentPreview {
  uri: string;
  fileName: string;
  mimeType: string;
}

type ExpenseFormModel = {
  tripId: FormControl<string>;
  amount: FormControl<number | null>;
  currency: FormControl<string>;
  category: FormControl<string>;
  date: FormControl<string>;
  notes: FormControl<string>;
};

@Component({
  selector: 'app-expense-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonIcon,
    IonSpinner,
    IonLoading,
    IonChip
  ],
  templateUrl: './expense-form.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./expense-form.page.scss']
})
export class ExpenseFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsRepo = inject(TripsRepository);
  private readonly expensesRepo = inject(ExpensesRepository);
  private readonly storageService = inject(StorageService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);

  categories = EXPENSE_CATEGORIES;
  currencies = CURRENCIES;
  trips = signal<Trip[]>([]);
  isEdit = signal(false);
  saving = signal(false);
  attachment = signal<AttachmentPreview | null>(null);

  /** Whether this page was opened from the "Add" tab (no trip context) */
  isQuickAdd = signal(false);
  @ViewChild(IonLoading) private savingLoader?: IonLoading;

  form: FormGroup<ExpenseFormModel> = this.fb.group({
    tripId: this.fb.nonNullable.control('', Validators.required),
    amount: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(0.01)
    ]),
    currency: this.fb.nonNullable.control('USD', Validators.required),
    category: this.fb.nonNullable.control('food', Validators.required),
    date: this.fb.nonNullable.control('', Validators.required),
    notes: this.fb.nonNullable.control('')
  });

  private tripId = '';
  private expenseId = '';

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('tripId') ?? '';
    this.expenseId = this.route.snapshot.paramMap.get('expenseId') ?? '';

    const today = new Date().toISOString().split('T')[0];
    this.form.patchValue({ date: today });

    if (this.tripId) {
      this.form.patchValue({ tripId: this.tripId });
    } else {
      this.isQuickAdd.set(true);
    }

    if (this.expenseId && this.tripId) {
      this.isEdit.set(true);
      await this.loadExpense();
    }

    await this.loadTrips();
  }

  private async loadTrips(): Promise<void> {
    try {
      const trips = await this.tripsRepo.getTrips();
      this.trips.set(trips);

      if (trips.length > 0 && !this.tripId) {
        this.form.patchValue({ tripId: trips[0].id });
      }

      const selectedTrip = trips.find(
        (t) => t.id === this.form.controls.tripId.value
      );
      if (selectedTrip) {
        this.form.patchValue({ currency: selectedTrip.currency });
      }
    } catch (err) {
      console.error('Failed to load trips', err);
    }
  }

  private async loadExpense(): Promise<void> {
    try {
      const expense = await this.expensesRepo.getExpenseById(
        this.tripId,
        this.expenseId
      );
      if (expense) {
        this.form.patchValue({
          tripId: expense.tripId,
          amount: expense.amount,
          currency: expense.currency,
          category: expense.category,
          date: expense.date,
          notes: expense.notes ?? ''
        });
        if (expense.attachment) {
          this.attachment.set({
            uri: expense.attachment.downloadUrl ?? '',
            fileName: expense.attachment.fileName,
            mimeType: expense.attachment.mimeType
          });
        }
      }
    } catch (err) {
      console.error('Failed to load expense', err);
    }
  }

  onTripChange(): void {
    const selectedTrip = this.trips().find(
      (t) => t.id === this.form.controls.tripId.value
    );
    if (selectedTrip) {
      this.form.patchValue({ currency: selectedTrip.currency });
    }
  }

  async attachReceipt(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Attach Receipt',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera-outline',
          handler: () => this.takePhoto()
        },
        {
          text: 'Choose from Files',
          icon: 'document-outline',
          handler: () => this.pickFile()
        },
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await actionSheet.present();
  }

  private async takePhoto(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });
      if (photo.webPath) {
        const fileName = `receipt_${Date.now()}.${photo.format}`;
        this.attachment.set({
          uri: Capacitor.isNativePlatform()
            ? (photo.path ?? photo.webPath)
            : photo.webPath,
          fileName,
          mimeType: `image/${photo.format}`
        });
      }
    } catch (err) {
      console.error('Camera error', err);
    }
  }

  private async pickFile(): Promise<void> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['image/*', 'application/pdf'],
        limit: 1
      });
      const file = result.files[0];
      if (file) {
        const uri =
          file.path ?? (file.blob ? URL.createObjectURL(file.blob) : '');
        this.attachment.set({
          uri,
          fileName: file.name,
          mimeType: file.mimeType
        });
      }
    } catch (err) {
      console.error('File pick error', err);
    }
  }

  removeAttachment(): void {
    this.attachment.set(null);
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    try {
      const val = this.form.getRawValue();
      const targetTripId = val.tripId;
      const amount = val.amount;
      if (!targetTripId || amount === null) {
        await this.presentErrorToast('Please complete required fields.');
        return;
      }

      if (this.isEdit()) {
        await this.expensesRepo.updateExpense(targetTripId, this.expenseId, {
          amount,
          currency: val.currency,
          category: val.category,
          date: val.date,
          notes: val.notes || undefined
        });

        const att = this.attachment();
        if (att && att.uri && !att.uri.startsWith('http')) {
          const uploadResult = await this.storageService.uploadFile(
            targetTripId,
            this.expenseId,
            att.uri,
            att.fileName,
            { mimeType: att.mimeType }
          );
          await this.expensesRepo.updateExpense(targetTripId, this.expenseId, {
            attachment: {
              fileName: uploadResult.fileName,
              storagePath: uploadResult.storagePath,
              downloadUrl: uploadResult.downloadUrl,
              mimeType: uploadResult.mimeType,
              size: uploadResult.size
            }
          });
        }

        await this.tripsRepo.recalculateTotalSpent(targetTripId);

        const toast = await this.toastCtrl.create({
          message: 'Expense updated',
          duration: 1500,
          color: 'primary',
          position: 'bottom'
        });
        await toast.present();
        this.router.navigate(['/trips', targetTripId], { replaceUrl: true });
      } else {
        const expenseId = await this.expensesRepo.createExpense({
          tripId: targetTripId,
          amount,
          currency: val.currency,
          category: val.category,
          date: val.date,
          notes: val.notes || undefined
        });

        const att = this.attachment();
        if (att && att.uri) {
          const uploadResult = await this.storageService.uploadFile(
            targetTripId,
            expenseId,
            att.uri,
            att.fileName,
            { mimeType: att.mimeType }
          );
          await this.expensesRepo.updateExpense(targetTripId, expenseId, {
            attachment: {
              fileName: uploadResult.fileName,
              storagePath: uploadResult.storagePath,
              downloadUrl: uploadResult.downloadUrl,
              mimeType: uploadResult.mimeType,
              size: uploadResult.size
            }
          });
        }

        await this.tripsRepo.recalculateTotalSpent(targetTripId);

        const toast = await this.toastCtrl.create({
          message: 'Expense added!',
          duration: 1500,
          color: 'primary',
          position: 'bottom'
        });
        await toast.present();

        if (this.isQuickAdd()) {
          this.form.patchValue({ amount: null, notes: '', category: 'food' });
          this.attachment.set(null);
        } else {
          this.router.navigate(['/trips', targetTripId], { replaceUrl: true });
        }
      }
    } catch (err) {
      console.error('Failed to save expense', err);
      await this.presentErrorToast('Failed to save expense. Please try again.');
    } finally {
      this.saving.set(false);
      await this.dismissSavingLoader();
    }
  }

  private async dismissSavingLoader(): Promise<void> {
    try {
      await this.savingLoader?.dismiss();
    } catch {
      // Loader might already be dismissed by state change.
    }
  }

  private async presentErrorToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color: 'danger',
      position: 'bottom'
    });
    await toast.present();
  }
}
