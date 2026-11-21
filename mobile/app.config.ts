import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Dynamic layer over app.json. Store builds must point at a real HTTPS API: the build fails
 * here instead of shipping an app that talks to a developer laptop.
 *
 * EAS sets EAS_BUILD_PROFILE; EXPO_PUBLIC_API_URL comes from the EAS environment of that profile
 * (`eas env:create --environment production --name EXPO_PUBLIC_API_URL --value https://…`).
 */
const RELEASE_PROFILES = new Set(['preview', 'production']);

export default ({ config }: ConfigContext): ExpoConfig => {
  const profile = process.env.EAS_BUILD_PROFILE;
  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  if (profile && RELEASE_PROFILES.has(profile) && !apiUrl?.startsWith('https://')) {
    throw new Error(
      `EXPO_PUBLIC_API_URL must be an https:// URL for the "${profile}" build (got "${apiUrl ?? ''}").`,
    );
  }

  return {
    ...(config as ExpoConfig),
    ios: {
      ...config.ios,
      infoPlist: {
        ...config.ios?.infoPlist,
        // Only standard HTTPS/TLS is used, which is exempt from export documentation.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
  };
};
