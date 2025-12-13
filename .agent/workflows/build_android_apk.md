---
description: Build the Android APK using the command line
---
1. Build the web application to generate the `dist` folder:
   ```powershell
   npm run build
   ```

2. Sync the web assets and plugins to the Android platform:
   ```powershell
   npx cap sync android
   ```

3. Navigate to the android directory:
   ```powershell
   cd android
   ```

4. Define JAVA_HOME (Necessary if "JAVA_HOME is not set" error occurs). 
   *Note: Check your specific Android Studio path if this doesn't work.*
   ```powershell
   $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
   ```

5. Build the Debug APK using Gradle:
   ```powershell
   ./gradlew assembleDebug
   ```

6. The APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
