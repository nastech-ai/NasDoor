/**
 * Android hardware feature names that can be marked as optional
 */
const OPTIONAL_HARDWARE_FEATURES = [
  // Display features - important for e-ink devices that may not support touch
  'android.hardware.touchscreen',
  'android.hardware.touchscreen.multitouch',
  'android.hardware.touchscreen.multitouch.distinct',
  'android.hardware.faketouch',
  'android.hardware.screen.portrait',
  'android.hardware.screen.landscape',

  // Camera features (app uses camera for QR codes but should work without)
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.camera.front',
  'android.hardware.camera.flash',
  'android.hardware.camera.any',

  // Communication features - not all e-ink devices have these
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',
  'android.hardware.telephony',
  'android.hardware.telephony.gsm',
  'android.hardware.telephony.cdma',
  'android.hardware.wifi',
  'android.hardware.wifi.direct',

  // Location features - many e-ink readers don't have GPS
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',

  // Sensors - e-ink devices often lack these sensors
  'android.hardware.sensor.accelerometer',
  'android.hardware.sensor.barometer',
  'android.hardware.sensor.compass',
  'android.hardware.sensor.gyroscope',
  'android.hardware.sensor.light',
  'android.hardware.sensor.proximity',
  'android.hardware.sensor.stepcounter',
  'android.hardware.sensor.stepdetector',

  // Audio - some e-ink devices don't have speakers/microphones
  'android.hardware.microphone',
  'android.hardware.audio.output',
  'android.hardware.audio.low_latency',
  'android.hardware.audio.pro',

  // Other hardware features
  'android.hardware.nfc',
  'android.hardware.usb.host',
  'android.hardware.usb.accessory',
  'android.hardware.vulkan.level',
  'android.hardware.vulkan.compute',
  'android.hardware.vulkan.version',
  'android.hardware.opengles.aep',
  'android.hardware.gamepad',
  'android.hardware.ram.low',
  'android.hardware.ram.normal',
];

/**
 * Input configuration attributes for flexible input methods
 */
const INPUT_CONFIGURATION_ATTRIBUTES = [
  { name: 'android:reqFiveWayNav', value: 'false' },
  { name: 'android:reqHardKeyboard', value: 'false' },
  { name: 'android:reqKeyboardType', value: 'undefined' },
  { name: 'android:reqNavigation', value: 'undefined' },
  { name: 'android:reqTouchScreen', value: 'undefined' },
];

/**
 * Config plugin to make the app compatible with e-ink readers and other devices
 * by marking hardware features as optional instead of required.
 *
 * This prevents Google Play Store from filtering out the app on devices
 * that don't have certain hardware features like cameras, touchscreens, etc.
 *
 * NOTE: require('expo/config-plugins') is intentionally lazy (inside the function)
 * so that EAS build workers can evaluate app.config.js before pnpm install runs.
 */
const withEinkCompatibility = (config, options = {}) => {
  const { withAndroidManifest } = require('expo/config-plugins');
  const { additionalFeatures = [], verbose = true } = options;

  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;

    if (!manifest['uses-feature']) {
      manifest['uses-feature'] = [];
    }

    const allFeatures = [...OPTIONAL_HARDWARE_FEATURES, ...additionalFeatures];

    let addedCount = 0;
    allFeatures.forEach((featureName) => {
      const existingFeature = manifest['uses-feature']?.find(
        (f) => f.$?.['android:name'] === featureName
      );

      if (!existingFeature) {
        manifest['uses-feature'].push({
          $: {
            'android:name': featureName,
            'android:required': 'false',
          },
        });
        addedCount++;
      } else if (existingFeature.$?.['android:required'] !== 'false') {
        existingFeature.$['android:required'] = 'false';
      }
    });

    if (!manifest['supports-screens']) {
      manifest['supports-screens'] = [];
    }
    manifest['supports-screens'] = [{
      $: {
        'android:smallScreens': 'true',
        'android:normalScreens': 'true',
        'android:largeScreens': 'true',
        'android:xlargeScreens': 'true',
        'android:anyDensity': 'true',
        'android:resizeable': 'true',
      },
    }];

    if (!manifest['uses-configuration']) {
      manifest['uses-configuration'] = [];
    }

    let configCount = 0;
    INPUT_CONFIGURATION_ATTRIBUTES.forEach(({ name, value }) => {
      const exists = manifest['uses-configuration']?.find(
        (c) => c.$?.[name] !== undefined
      );
      if (!exists) {
        manifest['uses-configuration'].push({ $: { [name]: value } });
        configCount++;
      }
    });

    if (verbose) {
      console.log('✅ E-ink compatibility plugin applied successfully');
      console.log(`   Added ${addedCount} optional hardware features`);
      console.log('   Added comprehensive screen size support');
      console.log(`   Added ${configCount} flexible input method configurations`);
    }

    return manifestConfig;
  });
};

module.exports = withEinkCompatibility;
