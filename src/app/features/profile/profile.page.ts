import {
  Component,
  inject,
  OnInit,
  signal,
  ViewChild,
  ChangeDetectionStrategy
} from '@angular/core';
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
  IonList,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonSpinner,
  IonLoading,
  IonSkeletonText,
  ActionSheetController,
  ToastController
} from '@ionic/angular';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { CURRENCIES } from '../../core/constants/currencies';
import { ProfileAvatarImage } from '../../core/models/profile.model';
import { ProfileRepository } from '../../core/services/profile.repository';
import { StorageService } from '../../core/services/storage.service';

interface AvatarPreview {
  uri: string;
  fileName: string;
  mimeType: string;
  storagePath?: string;
  previewUri?: string;
}

type ProfileFormModel = {
  displayName: FormControl<string>;
  email: FormControl<string>;
  defaultCurrency: FormControl<string>;
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonSpinner,
    IonLoading,
    IonSkeletonText
  ],
  templateUrl: './profile.page.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly profileRepo = inject(ProfileRepository);
  private readonly storageService = inject(StorageService);
  private readonly actionSheetCtrl = inject(ActionSheetController);
  private readonly toastCtrl = inject(ToastController);

  currencies = CURRENCIES;
  loading = signal(true);
  saving = signal(false);
  avatar = signal<AvatarPreview | null>(null);
  @ViewChild(IonLoading) private savingLoader?: IonLoading;
  private initialAvatarStoragePath: string | null = null;

  form: FormGroup<ProfileFormModel> = this.fb.group({
    displayName: this.fb.nonNullable.control('', [
      Validators.required,
      Validators.maxLength(50)
    ]),
    email: this.fb.nonNullable.control('', Validators.email),
    defaultCurrency: this.fb.nonNullable.control('USD', Validators.required)
  });

  async ngOnInit(): Promise<void> {
    await this.loadProfile();
  }

  private async loadProfile(): Promise<void> {
    this.loading.set(true);
    try {
      const profile = await this.profileRepo.getProfile();
      if (profile) {
        this.form.patchValue({
          displayName: profile.displayName,
          email: profile.email,
          defaultCurrency: profile.defaultCurrency
        });

        if (profile.avatar?.downloadUrl) {
          this.avatar.set({
            uri: profile.avatar.downloadUrl,
            fileName: profile.avatar.fileName,
            mimeType: profile.avatar.mimeType,
            storagePath: profile.avatar.storagePath
          });
          this.initialAvatarStoragePath = profile.avatar.storagePath;
        } else if (profile.avatarUrl) {
          this.avatar.set({
            uri: profile.avatarUrl,
            fileName: 'profile_avatar.jpg',
            mimeType: 'image/jpeg'
          });
        }
      }
    } catch (err) {
      console.error('Failed to load profile', err);
      await this.presentToast('Failed to load profile.', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    try {
      const val = this.form.getRawValue();
      const selectedAvatar = this.avatar();
      const shouldUploadAvatar =
        !!selectedAvatar && !selectedAvatar.uri.startsWith('http');
      let uploadedAvatarStoragePath: string | null = null;
      let uploadedAvatarData: ProfileAvatarImage | undefined;

      if (shouldUploadAvatar && selectedAvatar) {
        const uploadedAvatar = await this.storageService.uploadProfileAvatar(
          selectedAvatar.uri,
          selectedAvatar.fileName,
          { mimeType: selectedAvatar.mimeType }
        );
        uploadedAvatarStoragePath = uploadedAvatar.storagePath;
        uploadedAvatarData = {
          fileName: uploadedAvatar.fileName,
          storagePath: uploadedAvatar.storagePath,
          downloadUrl: uploadedAvatar.downloadUrl,
          mimeType: uploadedAvatar.mimeType,
          size: uploadedAvatar.size
        };
      }

      const profileUpdate: {
        displayName: string;
        email?: string;
        defaultCurrency: string;
        avatar?: ProfileAvatarImage | null;
        avatarUrl?: string;
      } = {
        displayName: val.displayName,
        email: val.email,
        defaultCurrency: val.defaultCurrency
      };

      if (!selectedAvatar) {
        profileUpdate.avatar = null;
      } else if (uploadedAvatarData) {
        profileUpdate.avatar = uploadedAvatarData;
        profileUpdate.avatarUrl = uploadedAvatarData.downloadUrl;
      }

      await this.profileRepo.saveProfile(profileUpdate);

      if (!selectedAvatar && this.initialAvatarStoragePath) {
        await this.storageService.deleteFile(this.initialAvatarStoragePath);
        this.initialAvatarStoragePath = null;
      } else if (
        uploadedAvatarStoragePath &&
        this.initialAvatarStoragePath &&
        this.initialAvatarStoragePath !== uploadedAvatarStoragePath
      ) {
        await this.storageService.deleteFile(this.initialAvatarStoragePath);
        this.initialAvatarStoragePath = uploadedAvatarStoragePath;
      }

      const toast = await this.toastCtrl.create({
        message: 'Profile saved',
        duration: 1500,
        color: 'primary',
        position: 'bottom'
      });
      await toast.present();
    } catch (err) {
      console.error('Failed to save profile', err);
      await this.presentToast('Failed to save profile.', 'danger');
    } finally {
      this.saving.set(false);
      await this.dismissSavingLoader();
    }
  }

  async changeAvatar(): Promise<void> {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Profile Photo',
      buttons: [
        {
          text: 'Take Photo',
          icon: 'camera-outline',
          handler: () => this.selectAvatarFromCamera(CameraSource.Camera)
        },
        {
          text: 'Choose from Gallery',
          icon: 'images-outline',
          handler: () => this.selectAvatarFromCamera(CameraSource.Photos)
        },
        ...(this.avatar()
          ? [
              {
                text: 'Remove Photo',
                role: 'destructive' as const,
                icon: 'trash-outline',
                handler: () => this.removeAvatar()
              }
            ]
          : []),
        { text: 'Cancel', role: 'cancel', icon: 'close-outline' }
      ]
    });

    await actionSheet.present();
  }

  private async selectAvatarFromCamera(source: CameraSource): Promise<void> {
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: true,
        resultType: CameraResultType.Uri,
        source
      });

      const sourceUri = photo.path ?? photo.webPath;
      if (!sourceUri) return;

      const formatExt = photo.format || 'jpeg';
      const mimeType = `image/${formatExt}`;
      const fileName = `profile_avatar_${Date.now()}.${formatExt}`;
      const previewUri =
        photo.webPath ??
        (photo.path ? Capacitor.convertFileSrc(photo.path) : sourceUri);
      this.avatar.set({
        uri: sourceUri,
        previewUri,
        fileName,
        mimeType
      });
    } catch (err) {
      console.error('Avatar selection error', err);
    }
  }

  removeAvatar(): void {
    this.avatar.set(null);
  }

  avatarUrl(): string | null {
    const avatar = this.avatar();
    if (!avatar) return null;
    if (avatar.previewUri) return avatar.previewUri;
    if (!Capacitor.isNativePlatform()) return avatar.uri;
    if (
      avatar.uri.startsWith('http://') ||
      avatar.uri.startsWith('https://') ||
      avatar.uri.startsWith('data:')
    ) {
      return avatar.uri;
    }
    return Capacitor.convertFileSrc(avatar.uri);
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

  private async dismissSavingLoader(): Promise<void> {
    try {
      await this.savingLoader?.dismiss();
    } catch {
      // Loader might already be dismissed by state change.
    }
  }

  getInitials(): string {
    const name = this.form.controls.displayName.value || 'T';
    return name.charAt(0).toUpperCase();
  }
}
