# See App - Production Build Guide

## Overview

This guide covers building the See app for production iOS and Android using EAS (Expo Application Services).

**What is EAS?**
- Cloud build service from Expo
- Handles app signing, code signing, and store submission
- No need to set up Android Studio or Xcode locally
- Free tier: 30 build minutes/month

---

## Prerequisites

### 1. Install EAS CLI

```bash
npm install -g eas-cli@latest
```

### 2. Create Expo Account

```bash
# Sign up at https://expo.dev
# Or login if you already have account
eas login

# Verify you're logged in
eas whoami
```

### 3. Link Your Project to EAS

```bash
cd "/home/daniel/projects/see folder/see/see-app"

# Initialize EAS (this creates eas.json)
eas init

# Select project ID when prompted
# (Use existing: ed15e83e-514e-4a1a-b1b9-049653548bd4)
```

---

## Android Production Build

### Step 1: Generate Signing Key

**First time only:**

```bash
eas build-submit --platform android --latest --use-keystore-from-credentials

# Or use existing keystore:
eas credentials --platform android
# Select "Android Keystore"
# Choose "Create new Android Keystore"
```

This creates a signed APK that can be uploaded to Google Play.

### Step 2: Build APK

```bash
# Update .env.production with correct API URL
cp .env.production .env

# Build for production
eas build --platform android --profile production

# This will:
# 1. Upload your code to EAS
# 2. Build in cloud (takes ~10-15 minutes)
# 3. Generate signed APK
# 4. Provide download link
```

### Step 3: Test on Device/Emulator

```bash
# Download APK from link provided
# On Android device: Settings → Security → Unknown sources (enable)
# Install APK file
# Test app functionality

# Or use Android emulator
emulator -avd Pixel_5 -writable-system
# Install APK via: adb install app-release.apk
```

### Step 4: Submit to Google Play

```bash
# Create Google Play Developer Account ($25 one-time)
# Go to https://play.google.com/console

# Then submit:
eas submit --platform android --latest

# When prompted:
# - Select "Google Play"
# - Provide service account JSON (from Play Console)
# - Select release track (alpha, beta, production)
```

---

## iOS Production Build

### Step 1: Create Apple Developer Account

- Go to https://developer.apple.com
- Enroll in Apple Developer Program ($99/year)
- Create App ID in App Store Connect
- Create provisioning profile

### Step 2: Set Up Code Signing

```bash
# Let EAS manage certificates (easiest)
eas credentials --platform ios

# When prompted:
# 1. Select "Create new iOS Certificate"
# 2. Choose "Distribution Certificate"
# 3. Provide team ID (from Apple Developer account)
# 4. EAS will generate and store certificates
```

### Step 3: Build for Production

```bash
# Update .env.production with correct API URL
cp .env.production .env

# Build for production
eas build --platform ios --profile production

# This will take ~20-30 minutes
# iOS builds are slower than Android
```

### Step 4: Submit to App Store

```bash
eas submit --platform ios --latest

# When prompted:
# - Apple ID: your-apple-id@example.com
# - App password: (generate at appleid.apple.com)
# - App Store Connect Team ID: (from Apple Developer)
```

---

## Build Configuration Reference

### eas.json - Production Profile

```json
{
  "build": {
    "production": {
      "node": "20.9.0",
      "npm": "10.1.0",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      },
      "ios": {
        "buildType": "archive"
      }
    }
  }
}
```

### Environment Variables for Build

```bash
# Development (for testing)
eas build --platform android --profile preview

# Production (for store submission)
eas build --platform android --profile production
```

---

## Troubleshooting Common Issues

### Issue: "npm install failed"

**Cause:** Dependency conflicts (the issue you encountered earlier)

**Solution:**

```bash
# Method 1: Use --legacy-peer-deps in build
# Update eas.json:
{
  "build": {
    "production": {
      "env": {
        "npm_config_legacy_peer_deps": "true"
      }
    }
  }
}

# Method 2: Fix dependencies locally first
cd see-app
npm install --legacy-peer-deps

# Then build
eas build --platform android --profile production
```

### Issue: "Build failed - Gradle error"

**Cause:** Android SDK or Gradle version mismatch

**Solution:** Add to eas.json:
```json
{
  "build": {
    "production": {
      "android": {
        "ndk": "26.0.10792818"
      }
    }
  }
}
```

### Issue: "iOS build provisioning profile error"

**Cause:** Certificate/signing mismatch

**Solution:**
```bash
# Revoke old certificates and create new ones
eas credentials --platform ios --revoke

# Then rebuild
eas build --platform ios --profile production
```

### Issue: "App Store Connect credentials invalid"

**Cause:** Wrong Apple ID or app password

**Solution:**
```bash
# Generate new app password at:
# https://appleid.apple.com → Security → App Passwords
# (NOT your Apple ID password)

# Then re-submit:
eas submit --platform ios --latest
```

---

## Version Management

### Update Version for Production Release

```bash
# In app.json, increment version:
{
  "expo": {
    "version": "1.0.0"  # Change to 1.0.1, 1.1.0, etc.
  }
}

# Also update Android/iOS version codes:
{
  "android": {
    "versionCode": 2  # Increment by 1 each release
  }
}

# Commit and tag
git add app.json
git commit -m "Release v1.0.1"
git tag -a v1.0.1 -m "Production release v1.0.1"
git push origin v1.0.1

# Then build
eas build --platform android --profile production
```

---

## Pre-Build Checklist

- [ ] API URL updated in .env.production
- [ ] Supabase keys set correctly (production)
- [ ] Version number incremented in app.json
- [ ] All tests passing locally
- [ ] No console errors/warnings
- [ ] App icon set (splash.png)
- [ ] Privacy policy URL configured
- [ ] Terms of service URL configured
- [ ] All dependencies compatible with React Native 0.76.3
- [ ] EAS login verified (`eas whoami`)
- [ ] Git branch is clean (no uncommitted changes)

---

## CI/CD Integration

### GitHub Actions Build (Optional)

```yaml
# .github/workflows/build.yml
name: Build with EAS

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Login to EAS
        env:
          EAS_TOKEN: ${{ secrets.EAS_TOKEN }}
        run: npm install -g eas-cli && eas login --non-interactive
      - name: Build Android
        run: eas build --platform android --profile production --wait
      - name: Build iOS
        run: eas build --platform ios --profile production --wait
```

---

## Store Publishing Timeline

### Google Play
- Review time: 2-4 hours
- Initial upload: 1-2 hours
- Version rollout: Immediate to phased

### App Store
- Review time: 24-48 hours
- First submission: May need additional reviewer time
- Rejection common issues: Privacy policy, data collection disclosure

---

## Post-Build Monitoring

### After Launch
- Monitor crash reports in Firebase Crashlytics
- Check app ratings and reviews
- Monitor analytics for user drop-off
- Set up alerts for critical errors

### Common Issues to Watch
- Login failures (JWT token issues)
- API timeouts (database/backend slow)
- Crash on specific screens
- Network errors in certain regions

---

## Build Status Commands

```bash
# Check build status
eas build:list --platform android

# View build logs
eas build:log [BUILD_ID]

# Cancel running build
eas build:cancel [BUILD_ID]

# View submission status
eas submit:list --platform android
```

---

## Important Notes

⚠️ **DO NOT COMMIT:**
- `.env` files with real secrets
- Signing keys or certificates
- Google Play service account JSON
- Apple Developer credentials

✅ **DO COMMIT:**
- `eas.json` (build configuration)
- `app.json` (app metadata, version)
- `.env.example` and `.env.production` (templates only)

---

## Resources

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Router Documentation](https://docs.expo.dev/routing/introduction/)
- [Google Play Console](https://play.google.com/console)
- [App Store Connect](https://appstoreconnect.apple.com)
- [React Native Release Notes](https://github.com/facebook/react-native/releases)

---

## Next Steps

1. **Fix dependency issues:**
   ```bash
   npm install --legacy-peer-deps
   ```

2. **Test locally:**
   ```bash
   npm start
   # Or web: npm run web
   ```

3. **Create Expo account** and **link project with EAS**:
   ```bash
   eas login
   eas init
   ```

4. **Build preview (test build):**
   ```bash
   eas build --platform android --profile preview
   ```

5. **Once verified, build production:**
   ```bash
   eas build --platform android --profile production
   ```

6. **Submit to stores** (see steps above)
