// Fail the build before a release APK can embed a development-only API origin.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const release = profile === 'production' || profile === 'preview' || process.env.SEE_RELEASE_BUILD === '1';
  const origin = process.env.EXPO_PUBLIC_API_URL;
  if (release) {
    if (!origin) throw new Error('Set EXPO_PUBLIC_API_URL in the EAS build environment.');
    const url = new URL(origin);
    const privateHost = /^(localhost$|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|\[::1\]$)/.test(url.hostname);
    if (url.protocol !== 'https:' || privateHost || !url.pathname.endsWith('/api/v1')) {
      throw new Error('Release EXPO_PUBLIC_API_URL must be a public HTTPS URL ending in /api/v1.');
    }
  }
  const localGoogleServices = path.join(process.cwd(), 'google-services.json');
  let googleServicesFile;
  const googleServicesConfigured = process.env.GOOGLE_SERVICES_JSON;
  if (fs.existsSync(localGoogleServices)) {
    googleServicesFile = './google-services.json';
  } else if (googleServicesConfigured) {
    const value = googleServicesConfigured.trim();
    if (value.startsWith('{')) {
      // A content-type secret: EAS file secrets substitute a path instead,
      // this covers the mistake of uploading the JSON as a plain string.
      fs.writeFileSync(localGoogleServices, value);
      googleServicesFile = './google-services.json';
    } else {
      // EAS materializes file-type secrets to a temp path on the builder.
      googleServicesFile = value;
    }
  }
  if (release && !googleServicesFile) {
    console.warn('[see] google-services.json is missing: remote push cannot be delivered in this Android build. Local notifications still work.');
  }
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) }
  };
};
