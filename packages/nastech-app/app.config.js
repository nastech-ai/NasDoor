const { execFileSync } = require('node:child_process');

const variant = process.env.APP_ENV || 'development';
const name = {
    development: "NasTech (dev)",
    preview:     "NasTech (preview)",
    production:  "NasTech"
}[variant];

// iOS bundle identifier (matches GoogleService-Info.plist BUNDLE_ID)
const iosBundleId = {
    development: "ai.nastech.ba.dev",
    preview:     "ai.nastech.ba.preview",
    production:  "ai.nastech.ba"
}[variant];

// Android package name (matches google-services.json package_name)
const androidPackage = {
    development: "ba.nastech.ai.dev",
    preview:     "ba.nastech.ai.preview",
    production:  "ba.nastech.ai"
}[variant];

const elevenLabsAgentId   = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID || null;
const livekitUrl          = process.env.EXPO_PUBLIC_LIVEKIT_URL          || null;
const consoleLoggingDefault = {
    development: true,
    preview:     true,
    production:  false,
}[variant];

function git(args) {
    try {
        return execFileSync('git', args, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim() || undefined;
    } catch {
        return undefined;
    }
}

function loadBuildMetadata() {
    const commitSha =
        process.env.NASTECH_BUILD_COMMIT_SHA ||
        process.env.EAS_BUILD_GIT_COMMIT_HASH ||
        process.env.GITHUB_SHA ||
        git(['rev-parse', 'HEAD']);
    const commitTimestamp =
        process.env.NASTECH_BUILD_COMMIT_TIMESTAMP ||
        (commitSha
            ? git(['show', '-s', '--format=%cI', commitSha])
            : git(['show', '-s', '--format=%cI', 'HEAD']));
    return { commitSha, commitTimestamp };
}

const buildMetadata = loadBuildMetadata();

// EAS project ID — nasdoor/nastech-agent (created 2026-06-16 via GraphQL API)
const easProjectId = process.env.EAS_PROJECT_ID || "e4301585-50e3-440d-b7f3-c1d7df1f7916";

module.exports = {
    expo: {
        name,
        slug:    "nastech-agent",
        version: "1.0.0",
        runtimeVersion: { policy: "appVersion" },
        orientation: "default",
        icon: './sources/assets/images/icon.png',
        scheme: "nastech",
        userInterfaceStyle: "automatic",
        ios: {
            supportsTablet: true,
            bundleIdentifier: iosBundleId,
            googleServicesFile: "./GoogleService-Info.plist",
            config: { usesNonExemptEncryption: false },
            infoPlist: {
                NSMicrophoneUsageDescription: "Allow NasTech to access your microphone for voice conversations with AI.",
                NSLocalNetworkUsageDescription: "Allow NasTech to find and connect to local NasTech Agent instances.",
                NSBonjourServices: ["_http._tcp", "_https._tcp"],
                NSAppTransportSecurity: variant === 'production'
                    ? { NSAllowsLocalNetworking: true }
                    : { NSAllowsLocalNetworking: true, NSAllowsArbitraryLoads: true }
            },
            associatedDomains: []
        },
        android: {
            // Target Android 14+ (API 34+): 8 GB RAM, 30 GB storage minimum
            minSdkVersion: 34,
            compileSdkVersion: 35,
            targetSdkVersion: 35,
            adaptiveIcon: {
                foregroundImage: './sources/assets/images/icon-adaptive.png',
                monochromeImage: './sources/assets/images/icon-monochrome.png',
                backgroundColor: "#000000"
            },
            permissions: [
                "android.permission.RECORD_AUDIO",
                "android.permission.MODIFY_AUDIO_SETTINGS",
                "android.permission.ACCESS_NETWORK_STATE",
                "android.permission.INTERNET",
                "android.permission.POST_NOTIFICATIONS",
                "android.permission.FOREGROUND_SERVICE",
                "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
                "android.permission.RECEIVE_BOOT_COMPLETED",
                "android.permission.WAKE_LOCK",
                "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS"
            ],
            blockedPermissions: [
                "android.permission.ACTIVITY_RECOGNITION",
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE",
                "android.permission.READ_MEDIA_IMAGES",
                "android.permission.READ_MEDIA_VIDEO",
            ],
            package: androidPackage,
            googleServicesFile: "./google-services.json",
        },
        web: {
            bundler: "metro",
            output:  "single",
            favicon: './sources/assets/images/favicon.png'
        },
        plugins: [
            require("./plugins/withEinkCompatibility.js"),
            require("./plugins/withTermuxDaemon.js"),
            ["expo-router", { root: "./sources/app" }],
            "expo-updates",
            "expo-asset",
            "expo-localization",
            "expo-mail-composer",
            "expo-secure-store",
            "expo-web-browser",
            "react-native-vision-camera",
            "@more-tech/react-native-libsodium",
            "react-native-audio-api",
            "@livekit/react-native-expo-plugin",
            "@config-plugins/react-native-webrtc",
            ["expo-audio",    { microphonePermission: "Allow NasTech to access your microphone for voice conversations." }],
            ["expo-location", {
                locationAlwaysAndWhenInUsePermission: "Allow NasTech to improve AI quality by using your location.",
                locationAlwaysPermission:             "Allow NasTech to improve AI quality by using your location.",
                locationWhenInUsePermission:          "Allow NasTech to improve AI quality by using your location."
            }],
            ["expo-calendar", { calendarPermission: "Allow NasTech to access your calendar to improve AI quality." }],
            ["expo-camera",   {
                cameraPermission:     "Allow NasTech to access your camera to scan QR codes and share photos with AI.",
                microphonePermission: "Allow NasTech to access your microphone for voice conversations.",
                recordAudioAndroid:   true
            }],
            ["expo-notifications", {
                enableBackgroundRemoteNotifications: true,
                icon: './sources/assets/images/icon-notification.png'
            }],
            ["expo-splash-screen", {
                ios: {
                    backgroundColor: "#000000",
                    dark: { backgroundColor: "#000000" }
                },
                android: {
                    image:           './sources/assets/images/splash-android-light.png',
                    backgroundColor: "#000000",
                    dark: { image: './sources/assets/images/splash-android-dark.png', backgroundColor: "#000000" }
                }
            }]
        ],
        updates: {
            url: easProjectId
                ? `https://u.expo.dev/${easProjectId}`
                : "https://u.expo.dev/placeholder",
            fallbackToCacheTimeout: 0,
            checkAutomatically: "ON_LOAD"
        },
        experiments: { typedRoutes: true },
        extra: {
            router: { root: "./sources/app" },
            eas: {
                projectId: easProjectId || undefined
            },
            app: {
                elevenLabsAgentId,
                livekitUrl,
                consoleLoggingDefault,
                buildCommitSha:       buildMetadata.commitSha,
                buildCommitTimestamp: buildMetadata.commitTimestamp,
            }
        },
        owner: "nasdoor"
    }
};
