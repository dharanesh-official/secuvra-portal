# How to Build the Mobile App (APK)

Since your environment does not have the Java/Android SDKs configured for command-line builds, you will need to use **Android Studio** to generate the APK.

## Prerequisites
- [Download and Install Android Studio](https://developer.android.com/studio) (if you haven't already).

## Steps to Build APK

1.  **Open Android Studio**.
2.  Click **Open** (or File > Open).
3.  Navigate to and select this folder:
    `d:\Projects\Secuvra\web\android`
    (Click OK).
4.  **Wait for Gradle Sync**:
    - Android Studio will take a few minutes to download necessary tools and sync the project.
    - You will see progress bars at the bottom right.
5.  **Build the APK**:
    - Go to the top menu: **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
6.  **Locate the APK**:
    - Once the build finishes, a popup will appear at the bottom right: "APK(s) generated successfully".
    - Click **locate** in that popup.
    - It will typically be in: `web\android\app\build\outputs\apk\debug\app-debug.apk`.

## Testing on Phone
-   Transfer this `.apk` file to your Android phone via USB, Google Drive, or WhatsApp.
-   Tap to install (you may need to allow installing unknown apps).

## Updating the App
If you make changes to the React code (`src/`):
1.  Run `npm run build` in the `web` folder.
2.  Run `npx cap sync` in the `web` folder.
3.  Re-build the APK in Android Studio.
