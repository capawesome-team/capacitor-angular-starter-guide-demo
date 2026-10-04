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
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonSpinner,
  IonLoading,
  IonLabel,
  IonModal,
  IonDatetime,
  IonDatetimeButton,
  IonChip,
  IonIcon,
  ActionSheetController,
  ToastController
} from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Capacitor } from '@capacitor/core';
import { CURRENCIES } from '../../../core/constants/currencies';
import { randomTripColor } from '../../../core/constants/trip-colors';
import { TripCoverImage } from '../../../core/models/trip.model';
import { TripsRepository } from '../../../core/services/trips.repository';
import { StorageService } from '../../../core/services/storage.service';

interface CoverPreview {
  uri: string;
  fileName: string;
  mimeType: string;
  storagePath?: string;
}

type TripFormModel = {
  name: FormControl<string>;
  description: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  currency: FormControl<string>;
  budget: FormControl<number | null>;
};

@Component({
  selector: 'app-trip-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonModal,
    IonDatetime,
    IonDatetimeButton,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonButtons,
    IonBackButton,
    IonButton,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonSpinner,
    IonLoading,
    IonLabel,
    IonChip,
    IonIcon
  ],
  templateUrl: './trip-form.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./trip-form.page.scss']
})
export class TripFormPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsRepo = inject(TripsRepository);
  private readonly storageService = inject(StorageService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);

  currencies = CURRENCIES;
  isEdit = signal(false);
  saving = signal(false);
  coverImage = signal<CoverPreview | null>(null);
  @ViewChild(IonLoading) private savingLoader?: IonLoading;

  form: FormGroup<TripFormModel> = this.fb.group({
    name: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(100)
    ]),
    description: this.fb.nonNullable.control(''),
    startDate: this.fb.nonNullable.control('', Validators.required),
    endDate: this.fb.nonNullable.control('', Validators.required),
    currency: this.fb.nonNullable.control('USD', Validators.required),
    budget: this.fb.control<number | null>(null)
  });

  private tripId = '';
  private initialCoverStoragePath: string | null = null;

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('tripId') ?? '';
    if (this.tripId) {
      this.isEdit.set(true);
      await this.loadTrip();
    } else {
      const today = new Date().toISOString().split('T')[0];
      this.form.patchValue({ startDate: today, endDate: today });
    }
  }

  private async loadTrip(): Promise<void> {
    const trip = await this.tripsRepo.getTripById(this.tripId);
    if (trip) {
      this.form.patchValue({
        name: trip.name,
        description: trip.description ?? '',
        startDate: trip.startDate,
        endDate: trip.endDate,
        currency: trip.currency,
        budget: trip.budget ?? null
      });
      if (trip.coverImage?.downloadUrl) {
        this.coverImage.set({
          uri: trip.coverImage.downloadUrl,
          fileName: trip.coverImage.fileName,
          mimeType: trip.coverImage.mimeType,
          storagePath: trip.coverImage.storagePath
        });
        this.initialCoverStoragePath = trip.coverImage.storagePath;
      }
    }
  }

  onStartDateChange(): void {
    const { startDate, endDate } = this.form.controls;
    if (startDate.value > endDate.value) {
      endDate.setValue(startDate.value);
    }
  }

  async attachCoverImage(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Trip Cover',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera-outline',
          handler: () => this.takeCoverPhoto()
        },
        {
          text: 'Choose from Files',
          icon: 'image-outline',
          handler: () => this.pickCoverImage()
        },
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
      ]
    });
    await actionSheet.present();
  }

  removeCoverImage(): void {
    this.coverImage.set(null);
  }

  private async takeCoverPhoto(): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera
      });

      if (!photo.webPath) return;

      const formatExt = photo.format || 'jpeg';
      const fileName = `trip_cover_${Date.now()}.${formatExt}`;
      this.coverImage.set({
        uri: Capacitor.isNativePlatform()
          ? (photo.path ?? photo.webPath)
          : photo.webPath,
        fileName,
        mimeType: `image/${formatExt}`
      });
    } catch (err) {
      console.error('Camera error', err);
    }
  }

  private async pickCoverImage(): Promise<void> {
    try {
      const result = await FilePicker.pickFiles({
        types: ['image/*'],
        limit: 1
      });
      const file = result.files[0];
      if (!file) return;

      const uri =
        file.path ?? (file.blob ? URL.createObjectURL(file.blob) : '');
      if (!uri) return;

      this.coverImage.set({
        uri,
        fileName: file.name,
        mimeType: file.mimeType
      });
    } catch (err) {
      console.error('Image pick error', err);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    try {
      const val = this.form.getRawValue();
      const selectedCover = this.coverImage();
      const shouldUploadCover =
        !!selectedCover && !selectedCover.uri.startsWith('http');
      let uploadedCoverStoragePath: string | null = null;
      let uploadedCoverData: TripCoverImage | undefined;

      if (this.isEdit()) {
        if (shouldUploadCover && selectedCover) {
          const uploadedCover = await this.storageService.uploadTripCover(
            this.tripId,
            selectedCover.uri,
            selectedCover.fileName,
            { mimeType: selectedCover.mimeType }
          );
          uploadedCoverStoragePath = uploadedCover.storagePath;
          uploadedCoverData = {
            fileName: uploadedCover.fileName,
            storagePath: uploadedCover.storagePath,
            downloadUrl: uploadedCover.downloadUrl,
            mimeType: uploadedCover.mimeType,
            size: uploadedCover.size
          };
        }

        const updateTripData: {
          name: string;
          description?: string;
          startDate: string;
          endDate: string;
          currency: string;
          budget?: number;
          coverImage?: TripCoverImage | null;
        } = {
          name: val.name,
          description: val.description || undefined,
          startDate: val.startDate,
          endDate: val.endDate,
          currency: val.currency,
          budget: val.budget || undefined
        };

        if (!selectedCover) {
          updateTripData.coverImage = null;
        } else if (uploadedCoverData) {
          updateTripData.coverImage = uploadedCoverData;
        }

        await this.tripsRepo.updateTrip(this.tripId, {
          ...updateTripData
        });

        if (!selectedCover && this.initialCoverStoragePath) {
          await this.storageService.deleteFile(this.initialCoverStoragePath);
          this.initialCoverStoragePath = null;
        } else if (
          uploadedCoverStoragePath &&
          this.initialCoverStoragePath &&
          this.initialCoverStoragePath !== uploadedCoverStoragePath
        ) {
          await this.storageService.deleteFile(this.initialCoverStoragePath);
          this.initialCoverStoragePath = uploadedCoverStoragePath;
        }

        this.router.navigate(['/trips', this.tripId], { replaceUrl: true });
      } else {
        const id = await this.tripsRepo.createTrip({
          name: val.name,
          description: val.description || undefined,
          startDate: val.startDate,
          endDate: val.endDate,
          currency: val.currency,
          budget: val.budget || undefined,
          coverColor: randomTripColor()
        });

        if (shouldUploadCover && selectedCover) {
          const uploadedCover = await this.storageService.uploadTripCover(
            id,
            selectedCover.uri,
            selectedCover.fileName,
            { mimeType: selectedCover.mimeType }
          );
          await this.tripsRepo.updateTrip(id, {
            coverImage: {
              fileName: uploadedCover.fileName,
              storagePath: uploadedCover.storagePath,
              downloadUrl: uploadedCover.downloadUrl,
              mimeType: uploadedCover.mimeType,
              size: uploadedCover.size
            }
          });
        }

        this.router.navigate(['/trips', id], { replaceUrl: true });
      }
    } catch (err) {
      console.error('Failed to save trip', err);
      const toast = await this.toastCtrl.create({
        message: 'Failed to save trip. Please try again.',
        duration: 2500,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
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
}
