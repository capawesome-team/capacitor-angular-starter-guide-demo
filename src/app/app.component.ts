import {
  Component,
  inject,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  mapOutline,
  addCircleOutline,
  personOutline,
  add,
  addOutline,
  createOutline,
  trashOutline,
  receiptOutline,
  attachOutline,
  documentOutline,
  closeCircle,
  cameraOutline,
  imageOutline,
  closeOutline,
  cashOutline,
  timeOutline,
  openOutline,
  documentTextOutline,
  restaurantOutline,
  carOutline,
  bedOutline,
  ticketOutline,
  bagOutline,
  airplaneOutline,
  medkitOutline,
  callOutline,
  gameControllerOutline,
  ellipsisHorizontalOutline
} from 'ionicons/icons';
import { FirebaseService } from './core/services/firebase.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [IonApp, IonRouterOutlet],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <ion-app>
      <ion-router-outlet></ion-router-outlet>
    </ion-app>
  `
})
export class AppComponent implements OnInit {
  private readonly firebaseService = inject(FirebaseService);

  constructor() {
    addIcons({
      mapOutline,
      addCircleOutline,
      personOutline,
      add,
      addOutline,
      createOutline,
      trashOutline,
      receiptOutline,
      attachOutline,
      documentOutline,
      closeCircle,
      cameraOutline,
      imageOutline,
      closeOutline,
      cashOutline,
      timeOutline,
      openOutline,
      documentTextOutline,
      restaurantOutline,
      carOutline,
      bedOutline,
      ticketOutline,
      bagOutline,
      airplaneOutline,
      medkitOutline,
      callOutline,
      gameControllerOutline,
      ellipsisHorizontalOutline
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.firebaseService.initialize();
    } finally {
      if (Capacitor.isNativePlatform()) {
        await SplashScreen.hide();
      }
    }
  }
}
