# Capacitor Angular Starter App

This repo is the demo app we build in our Capacitor Angular Starter guide to wrap an existing Angular web app into a native iOS and Android app using Capacitor, Ionic, and Firebase.

[Check the demo](https://youtube.com/shorts/cr3i03LNmG4)

[Read the guide](https://capawesome.io/blog/how-to-wrap-an-angular-app-with-capacitor-and-firebase)

## Built with

- Angular 22
- Ionic 9
- Capacitor 8.5
- Firebase (Firestore + Storage)

## Getting started

Install dependencies and run:

```bash
npm install
npm start
```

To run on native platforms:

```bash
npm run build
npx cap sync
npx cap open android # or ios
```

## Firebase Configuration

Firebase app configuration is stored in:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Native Firebase config files (required for device builds):

- `android/app/google-services.json`
- `ios/App/App/GoogleService-Info.plist`

Note: In this repo, these native files are intentionally ignored by git, so each developer can use their own Firebase project configuration. For your own project make sure to remove this from the `.gitignore`.
