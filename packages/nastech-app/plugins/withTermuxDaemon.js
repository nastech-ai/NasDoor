/**
 * withTermuxDaemon.js
 *
 * Expo config plugin that wires the NasTech background daemon into the Android app.
 * - Adds permissions to AndroidManifest.xml
 * - Registers DaemonService (foreground service keeping Python agent alive)
 * - Registers BootReceiver (auto-start on device reboot)
 * - Writes Java source files into the Android project
 * - Copies bundled bootstrap assets
 *
 * The daemon is INVISIBLE to the user — it runs silently in the background.
 * All user interaction goes through the NasTech React Native UI.
 */

const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Java source: DaemonService ──────────────────────────────────────────────
const DAEMON_SERVICE_JAVA = `package ai.nastech.daemon;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class DaemonService extends Service {

    private static final String TAG = "NasTechDaemon";
    private static final String CHANNEL_ID = "nastech_daemon";
    private static final int NOTIFICATION_ID = 1001;

    // Termux bootstrap version to download if not bundled
    private static final String BOOTSTRAP_VERSION = "bootstrap-2026.06.14-r1+apt.android-7";
    private static final String BOOTSTRAP_BASE_URL =
        "https://github.com/termux/termux-packages/releases/download/" + BOOTSTRAP_VERSION + "/";

    static String status = "stopped";
    static int setupProgress = 0;

    private Process daemonProcess = null;
    private Handler handler = new Handler(Looper.getMainLooper());
    private boolean running = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;

        if ("STOP".equals(action)) {
            stopDaemon();
            stopSelf();
            return START_NOT_STICKY;
        }

        startForeground(NOTIFICATION_ID, buildNotification("NasTech AI starting..."));
        running = true;

        new Thread(() -> {
            try {
                ensureBootstrapAndDaemon();
            } catch (Exception e) {
                Log.e(TAG, "Daemon error: " + e.getMessage(), e);
                status = "error";
                updateNotification("NasTech AI: Error — tap to restart");
            }
        }).start();

        return START_STICKY;
    }

    private void ensureBootstrapAndDaemon() throws Exception {
        File prefix = new File(getFilesDir(), "usr");
        File python = new File(prefix, "bin/python3");
        File flagFile = new File(getFilesDir(), ".nastech_setup_done");

        if (!flagFile.exists()) {
            status = "setting_up";
            setupProgress = 5;
            updateNotification("NasTech: Setting up environment...");

            // Step 1: Extract bootstrap
            setupProgress = 10;
            extractBootstrap(prefix);

            // Step 2: Install Python via pkg (downloads from Termux repo)
            setupProgress = 40;
            updateNotification("NasTech: Installing Python...");
            runShellCommand(prefix, new String[]{"bin/pkg", "install", "-y", "python", "python-pip", "proot"});

            // Step 3: Extract NasTech agent
            setupProgress = 70;
            updateNotification("NasTech: Installing AI agent...");
            extractNasTechAgent();

            // Step 4: Install Python dependencies
            setupProgress = 80;
            updateNotification("NasTech: Installing dependencies...");
            File agentDir = new File(getFilesDir(), "nastech");
            runShellCommand(prefix, new String[]{
                "bin/pip3", "install", "--no-build-isolation",
                "-c", agentDir + "/constraints-termux.txt",
                "-e", agentDir.getAbsolutePath() + "[termux]"
            });

            // Mark setup complete
            flagFile.createNewFile();
            setupProgress = 100;
            Log.i(TAG, "Setup complete");
        }

        // Start the Python daemon
        status = "running";
        startPythonDaemon(prefix);
    }

    private void extractBootstrap(File prefix) throws IOException {
        String abi = getPreferredAbi();
        String assetName = "bootstrap/bootstrap-" + abi + ".zip";

        // Try bundled asset first
        InputStream assetStream = null;
        try {
            assetStream = getAssets().open(assetName);
            Log.i(TAG, "Using bundled bootstrap: " + assetName);
        } catch (IOException e) {
            Log.i(TAG, "Bootstrap not bundled, downloading: " + abi);
            assetStream = downloadBootstrap(abi);
        }

        prefix.mkdirs();
        extractZipWithSymlinks(assetStream, prefix);
        assetStream.close();

        // Make binaries executable
        chmod(prefix);
        Log.i(TAG, "Bootstrap extracted to: " + prefix.getAbsolutePath());
    }

    private InputStream downloadBootstrap(String abi) throws IOException {
        String archName = abiToArchName(abi);
        String url = BOOTSTRAP_BASE_URL + "bootstrap-" + archName + ".zip";
        updateNotification("NasTech: Downloading bootstrap (" + archName + ")...");
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.connect();
        if (conn.getResponseCode() != 200) {
            throw new IOException("Failed to download bootstrap: HTTP " + conn.getResponseCode());
        }
        return conn.getInputStream();
    }

    private void extractZipWithSymlinks(InputStream zipStream, File destDir) throws IOException {
        File symlinkFile = new File(destDir, "SYMLINKS.txt");
        ZipInputStream zis = new ZipInputStream(zipStream);
        ZipEntry entry;

        while ((entry = zis.getNextEntry()) != null) {
            File target = new File(destDir, entry.getName());
            if (entry.isDirectory()) {
                target.mkdirs();
            } else if (entry.getName().equals("SYMLINKS.txt")) {
                target.getParentFile().mkdirs();
                writeStreamToFile(zis, target);
            } else {
                target.getParentFile().mkdirs();
                writeStreamToFile(zis, target);
            }
            zis.closeEntry();
        }
        zis.close();

        // Process symlinks
        if (symlinkFile.exists()) {
            processSymlinks(symlinkFile, destDir);
        }
    }

    private void processSymlinks(File symlinkFile, File baseDir) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(new java.io.FileInputStream(symlinkFile)));
        String line;
        while ((line = reader.readLine()) != null) {
            String[] parts = line.split("←");
            if (parts.length == 2) {
                String target = parts[0].trim();
                String linkPath = parts[1].trim();
                File link = new File(baseDir, linkPath);
                link.getParentFile().mkdirs();
                try {
                    java.nio.file.Files.createSymbolicLink(link.toPath(), java.nio.file.Paths.get(target));
                } catch (Exception e) {
                    Log.w(TAG, "Symlink failed: " + linkPath + " -> " + target);
                }
            }
        }
        reader.close();
    }

    private void extractNasTechAgent() throws IOException {
        File agentDir = new File(getFilesDir(), "nastech");
        agentDir.mkdirs();

        InputStream assetStream;
        try {
            assetStream = getAssets().open("nastech-agent.zip");
        } catch (IOException e) {
            Log.w(TAG, "nastech-agent.zip not bundled, skipping extraction");
            return;
        }

        ZipInputStream zis = new ZipInputStream(assetStream);
        ZipEntry entry;
        while ((entry = zis.getNextEntry()) != null) {
            File target = new File(agentDir, entry.getName());
            if (entry.isDirectory()) {
                target.mkdirs();
            } else {
                target.getParentFile().mkdirs();
                writeStreamToFile(zis, target);
            }
            zis.closeEntry();
        }
        zis.close();
        assetStream.close();
        Log.i(TAG, "NasTech agent extracted to: " + agentDir.getAbsolutePath());
    }

    private void runShellCommand(File prefix, String[] args) {
        try {
            String[] fullArgs = new String[args.length + 1];
            fullArgs[0] = prefix.getAbsolutePath() + "/" + args[0];
            System.arraycopy(args, 1, fullArgs, 1, args.length - 1);

            ProcessBuilder pb = new ProcessBuilder(fullArgs);
            pb.environment().put("PREFIX", prefix.getAbsolutePath());
            pb.environment().put("HOME", getFilesDir().getAbsolutePath());
            pb.environment().put("PATH", prefix + "/bin:" + prefix + "/usr/bin:" + System.getenv("PATH"));
            pb.environment().put("LD_LIBRARY_PATH", prefix + "/lib:" + prefix + "/usr/lib");
            pb.redirectErrorStream(true);

            Process proc = pb.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(proc.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                Log.d(TAG, "[pkg] " + line);
            }
            proc.waitFor();
        } catch (Exception e) {
            Log.e(TAG, "Shell command failed: " + e.getMessage());
        }
    }

    private void startPythonDaemon(File prefix) throws Exception {
        File agentDir = new File(getFilesDir(), "nastech");
        File envFile = new File(getFilesDir(), ".nastech-env");

        // Write env file if needed
        if (!envFile.exists()) {
            try (FileOutputStream fos = new FileOutputStream(envFile)) {
                fos.write(("# NasTech configuration\\n" +
                    "NASTECH_PORT=9119\\n" +
                    "NASTECH_HOST=127.0.0.1\\n").getBytes());
            }
        }

        String python3 = prefix.getAbsolutePath() + "/bin/python3";

        while (running) {
            try {
                updateNotification("NasTech AI is running");
                status = "running";

                ProcessBuilder pb = new ProcessBuilder(
                    python3, "-m", "nastech_cli.main", "gateway", "start", "--foreground"
                );
                pb.directory(agentDir);
                pb.environment().put("PREFIX", prefix.getAbsolutePath());
                pb.environment().put("HOME", getFilesDir().getAbsolutePath());
                pb.environment().put("NASTECH_HOME", getFilesDir().getAbsolutePath() + "/.nastech");
                pb.environment().put("PATH", prefix + "/bin:" + prefix + "/usr/bin:" + System.getenv("PATH"));
                pb.environment().put("LD_LIBRARY_PATH", prefix + "/lib:" + prefix + "/usr/lib");
                pb.environment().put("PYTHONPATH", agentDir.getAbsolutePath());
                pb.environment().put("NASTECH_PORT", "9119");
                pb.environment().put("NASTECH_HOST", "127.0.0.1");
                pb.redirectErrorStream(true);

                daemonProcess = pb.start();

                // Stream logs (agent can read them too)
                final Process proc = daemonProcess;
                new Thread(() -> {
                    try {
                        BufferedReader reader = new BufferedReader(
                            new InputStreamReader(proc.getInputStream()));
                        String line;
                        while ((line = reader.readLine()) != null) {
                            Log.d(TAG, "[daemon] " + line);
                        }
                    } catch (IOException ignored) {}
                }).start();

                int exitCode = daemonProcess.waitFor();
                Log.w(TAG, "Daemon exited with code: " + exitCode);
            } catch (Exception e) {
                Log.e(TAG, "Daemon error: " + e.getMessage());
            }

            if (!running) break;
            status = "restarting";
            updateNotification("NasTech AI: Restarting...");
            Thread.sleep(3000);
        }
    }

    private void stopDaemon() {
        running = false;
        status = "stopped";
        if (daemonProcess != null) {
            daemonProcess.destroy();
            daemonProcess = null;
        }
    }

    private String getPreferredAbi() {
        String[] abis = Build.SUPPORTED_ABIS;
        for (String abi : abis) {
            if (abi.equals("arm64-v8a")) return "arm64-v8a";
        }
        for (String abi : abis) {
            if (abi.equals("armeabi-v7a")) return "armeabi-v7a";
        }
        return abis[0];
    }

    private String abiToArchName(String abi) {
        switch (abi) {
            case "arm64-v8a": return "aarch64";
            case "armeabi-v7a": return "arm";
            case "x86_64": return "x86_64";
            case "x86": return "i686";
            default: return "aarch64";
        }
    }

    private void chmod(File dir) {
        try {
            Runtime.getRuntime().exec(new String[]{"chmod", "-R", "700", dir.getAbsolutePath()}).waitFor();
        } catch (Exception ignored) {}
    }

    private void writeStreamToFile(InputStream is, File dest) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(dest)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) fos.write(buf, 0, n);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "NasTech Daemon", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("NasTech AI background service");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, openIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("NasTech")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(text));
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        stopDaemon();
        super.onDestroy();
    }
}
`;

// ─── Java source: BootReceiver ────────────────────────────────────────────────
const BOOT_RECEIVER_JAVA = `package ai.nastech.daemon;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
            Log.i("NasTechBoot", "Boot completed — starting NasTech daemon");
            Intent svc = new Intent(context, DaemonService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(svc);
            } else {
                context.startService(svc);
            }
        }
    }
}
`;

// ─── Java source: NativeDaemonModule ─────────────────────────────────────────
const NATIVE_DAEMON_MODULE_JAVA = `package ai.nastech.daemon;

import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import androidx.annotation.NonNull;

public class NativeDaemonModule extends ReactContextBaseJavaModule {

    public NativeDaemonModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return "NasTechDaemon";
    }

    @ReactMethod
    public void startDaemon(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, DaemonService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("START_FAILED", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDaemon(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, DaemonService.class);
            intent.setAction("STOP");
            ctx.startService(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_FAILED", e.getMessage());
        }
    }

    @ReactMethod
    public void getStatus(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putString("status", DaemonService.status);
        map.putInt("setupProgress", DaemonService.setupProgress);
        promise.resolve(map);
    }
}
`;

// ─── Java source: DaemonPackage ───────────────────────────────────────────────
const DAEMON_PACKAGE_JAVA = `package ai.nastech.daemon;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class DaemonPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new NativeDaemonModule(reactContext));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;

// ─── Plugin implementation ────────────────────────────────────────────────────

function withTermuxDaemon(config) {
    // 1. Add permissions + service + receiver to AndroidManifest
    config = withAndroidManifest(config, (mod) => {
        const manifest = mod.modResults;
        const app = manifest.manifest.application[0];

        // Add permissions to manifest root
        const existingPerms = (manifest.manifest['uses-permission'] || []).map(
            p => p.$['android:name']
        );
        const requiredPerms = [
            'android.permission.FOREGROUND_SERVICE',
            'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
            'android.permission.RECEIVE_BOOT_COMPLETED',
            'android.permission.WAKE_LOCK',
            'android.permission.INTERNET',
            'android.permission.ACCESS_NETWORK_STATE',
            'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        ];
        if (!manifest.manifest['uses-permission']) {
            manifest.manifest['uses-permission'] = [];
        }
        for (const perm of requiredPerms) {
            if (!existingPerms.includes(perm)) {
                manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
            }
        }

        // Add DaemonService
        if (!app.service) app.service = [];
        const hasService = app.service.some(s => s.$['android:name'] === 'ai.nastech.daemon.DaemonService');
        if (!hasService) {
            app.service.push({
                $: {
                    'android:name': 'ai.nastech.daemon.DaemonService',
                    'android:enabled': 'true',
                    'android:exported': 'false',
                    'android:foregroundServiceType': 'dataSync',
                },
            });
        }

        // Add BootReceiver
        if (!app.receiver) app.receiver = [];
        const hasReceiver = app.receiver.some(r => r.$['android:name'] === 'ai.nastech.daemon.BootReceiver');
        if (!hasReceiver) {
            app.receiver.push({
                $: {
                    'android:name': 'ai.nastech.daemon.BootReceiver',
                    'android:enabled': 'true',
                    'android:exported': 'true',
                },
                'intent-filter': [
                    {
                        action: [
                            { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                            { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
                        ],
                    },
                ],
            });
        }

        return mod;
    });

    // 2. Write Java source files
    config = withDangerousMod(config, [
        'android',
        async (mod) => {
            const projectRoot = mod.modRequest.projectRoot;
            const androidRoot = path.join(projectRoot, 'android');
            const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', 'ai', 'nastech', 'daemon');
            const assetsDir = path.join(androidRoot, 'app', 'src', 'main', 'assets', 'bootstrap');

            fs.mkdirSync(javaDir, { recursive: true });
            fs.mkdirSync(assetsDir, { recursive: true });

            // Write Java sources
            fs.writeFileSync(path.join(javaDir, 'DaemonService.java'), DAEMON_SERVICE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'BootReceiver.java'), BOOT_RECEIVER_JAVA);
            fs.writeFileSync(path.join(javaDir, 'NativeDaemonModule.java'), NATIVE_DAEMON_MODULE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'DaemonPackage.java'), DAEMON_PACKAGE_JAVA);

            // Copy bootstrap zips if they exist in the project
            const bootstrapSrc = path.join(projectRoot, 'assets', 'bootstrap');
            if (fs.existsSync(bootstrapSrc)) {
                const zips = fs.readdirSync(bootstrapSrc).filter(f => f.endsWith('.zip'));
                for (const zip of zips) {
                    fs.copyFileSync(path.join(bootstrapSrc, zip), path.join(assetsDir, zip));
                }
            }

            // Copy nastech-agent.zip if exists
            const agentZip = path.join(projectRoot, 'assets', 'nastech-agent.zip');
            if (fs.existsSync(agentZip)) {
                fs.copyFileSync(agentZip, path.join(androidRoot, 'app', 'src', 'main', 'assets', 'nastech-agent.zip'));
            }

            return mod;
        },
    ]);

    // 3. Register DaemonPackage in MainApplication
    config = withMainApplication(config, (mod) => {
        let contents = mod.modResults.contents;

        // Add import if missing
        if (!contents.includes('import ai.nastech.daemon.DaemonPackage')) {
            contents = contents.replace(
                /import com\.facebook\.react\.ReactApplication;/,
                'import com.facebook.react.ReactApplication;\nimport ai.nastech.daemon.DaemonPackage;'
            );
        }

        // Add package to getPackages() if missing
        if (!contents.includes('new DaemonPackage()')) {
            contents = contents.replace(
                /packages\.add\(new MainReactPackage\(\)\);/,
                'packages.add(new MainReactPackage());\n      packages.add(new DaemonPackage());'
            );
            // Kotlin version
            contents = contents.replace(
                /add\(MainReactPackage\(\)\)/,
                'add(MainReactPackage())\n      add(DaemonPackage())'
            );
        }

        mod.modResults.contents = contents;
        return mod;
    });

    return config;
}

module.exports = withTermuxDaemon;
