/**
 * withTermuxDaemon.js — Android-only Expo config plugin
 *
 * Wires the NasTech background Python daemon into the Android APK.
 * iOS is completely untouched — no Python, no bootstrap, no service.
 *
 * What this does on Android:
 *   - Adds foreground-service permissions to AndroidManifest.xml
 *   - Registers DaemonService + BootReceiver in the manifest
 *   - Writes Java source files (DaemonService, NativeDaemonModule, etc.)
 *   - Copies Termux bootstrap zips + Python agent zip into APK assets
 *   - Registers DaemonPackage with React Native so JS can call NativeDaemon
 */

const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Java: DaemonService ──────────────────────────────────────────────────────
const DAEMON_SERVICE_JAVA = `package ai.nastech.daemon;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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

    private static final String BOOTSTRAP_VERSION = "bootstrap-2026.06.14-r1+apt.android-7";
    private static final String BOOTSTRAP_BASE_URL =
        "https://github.com/termux/termux-packages/releases/download/" + BOOTSTRAP_VERSION + "/";

    static String status = "stopped";
    static int setupProgress = 0;

    private Process daemonProcess = null;
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
        startForeground(NOTIFICATION_ID, buildNotification("NasTech AI starting\u2026"));
        running = true;
        new Thread(() -> {
            try {
                ensureBootstrapAndDaemon();
            } catch (Exception e) {
                Log.e(TAG, "Daemon error: " + e.getMessage(), e);
                status = "error";
                updateNotification("NasTech AI: Error \u2014 tap to open");
            }
        }).start();
        return START_STICKY;
    }

    private void ensureBootstrapAndDaemon() throws Exception {
        File prefix = new File(getFilesDir(), "usr");
        File flagFile = new File(getFilesDir(), ".nastech_setup_done");

        if (!flagFile.exists()) {
            status = "setting_up";
            setupProgress = 5;
            updateNotification("NasTech: Setting up environment\u2026");

            extractBootstrap(prefix);
            setupProgress = 40;

            updateNotification("NasTech: Installing Python\u2026");
            runCmd(prefix, new String[]{"bin/pkg", "install", "-y", "python", "python-pip", "proot"});
            setupProgress = 70;

            updateNotification("NasTech: Installing AI agent\u2026");
            extractNasTechAgent();
            setupProgress = 80;

            updateNotification("NasTech: Installing dependencies\u2026");
            File agentDir = new File(getFilesDir(), "nastech");
            runCmd(prefix, new String[]{
                "bin/pip3", "install", "--no-build-isolation",
                "-c", agentDir + "/constraints-termux.txt",
                "-e", agentDir.getAbsolutePath() + "[termux]"
            });

            flagFile.createNewFile();
            setupProgress = 100;
        }

        status = "running";
        startPythonDaemon(prefix);
    }

    private void extractBootstrap(File prefix) throws IOException {
        String abi = getPreferredAbi();
        String assetName = "bootstrap/bootstrap-" + abi + ".zip";
        InputStream stream;
        try {
            stream = getAssets().open(assetName);
        } catch (IOException e) {
            Log.i(TAG, "Bootstrap not bundled, downloading: " + abi);
            stream = downloadBootstrap(abi);
        }
        prefix.mkdirs();
        extractZipWithSymlinks(stream, prefix);
        stream.close();
        chmodR(prefix);
        Log.i(TAG, "Bootstrap ready at " + prefix);
    }

    private InputStream downloadBootstrap(String abi) throws IOException {
        String arch = abiToArch(abi);
        String url = BOOTSTRAP_BASE_URL + "bootstrap-" + arch + ".zip";
        updateNotification("NasTech: Downloading bootstrap (" + arch + ")\u2026");
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(true);
        c.connect();
        if (c.getResponseCode() != 200)
            throw new IOException("HTTP " + c.getResponseCode() + " for " + url);
        return c.getInputStream();
    }

    private void extractZipWithSymlinks(InputStream zipStream, File dest) throws IOException {
        ZipInputStream zis = new ZipInputStream(zipStream);
        ZipEntry entry;
        File symlinkFile = null;
        while ((entry = zis.getNextEntry()) != null) {
            File out = new File(dest, entry.getName());
            if (entry.isDirectory()) { out.mkdirs(); }
            else {
                out.getParentFile().mkdirs();
                writeStream(zis, out);
                if (entry.getName().equals("SYMLINKS.txt")) symlinkFile = out;
            }
            zis.closeEntry();
        }
        zis.close();
        if (symlinkFile != null) processSymlinks(symlinkFile, dest);
    }

    private void processSymlinks(File f, File base) throws IOException {
        BufferedReader r = new BufferedReader(new java.io.FileInputStream(f) {{}} {
            @Override public int read(byte[] b, int o, int l) throws IOException { return super.read(b, o, l); }
        });
        // Simpler: use FileInputStream directly
        r = new BufferedReader(new InputStreamReader(new java.io.FileInputStream(f)));
        String line;
        while ((line = r.readLine()) != null) {
            String[] p = line.split("\u2190");
            if (p.length == 2) {
                File link = new File(base, p[1].trim());
                link.getParentFile().mkdirs();
                try { java.nio.file.Files.createSymbolicLink(link.toPath(), java.nio.file.Paths.get(p[0].trim())); }
                catch (Exception ignored) {}
            }
        }
        r.close();
    }

    private void extractNasTechAgent() throws IOException {
        File agentDir = new File(getFilesDir(), "nastech");
        agentDir.mkdirs();
        InputStream s;
        try { s = getAssets().open("nastech-agent.zip"); }
        catch (IOException e) { Log.w(TAG, "nastech-agent.zip not bundled"); return; }
        ZipInputStream zis = new ZipInputStream(s);
        ZipEntry e;
        while ((e = zis.getNextEntry()) != null) {
            File out = new File(agentDir, e.getName());
            if (e.isDirectory()) out.mkdirs();
            else { out.getParentFile().mkdirs(); writeStream(zis, out); }
            zis.closeEntry();
        }
        zis.close(); s.close();
        Log.i(TAG, "Agent extracted to " + agentDir);
    }

    private void runCmd(File prefix, String[] args) {
        try {
            String[] full = new String[args.length];
            full[0] = prefix.getAbsolutePath() + "/" + args[0];
            System.arraycopy(args, 1, full, 1, args.length - 1);
            ProcessBuilder pb = new ProcessBuilder(full);
            pb.environment().put("PREFIX", prefix.getAbsolutePath());
            pb.environment().put("HOME", getFilesDir().getAbsolutePath());
            pb.environment().put("PATH", prefix + "/bin:" + System.getenv("PATH"));
            pb.environment().put("LD_LIBRARY_PATH", prefix + "/lib");
            pb.redirectErrorStream(true);
            Process p = pb.start();
            BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()));
            String l; while ((l = br.readLine()) != null) Log.d(TAG, l);
            p.waitFor();
        } catch (Exception e) { Log.e(TAG, "cmd failed: " + e.getMessage()); }
    }

    private void startPythonDaemon(File prefix) throws Exception {
        File agentDir = new File(getFilesDir(), "nastech");
        String py = prefix + "/bin/python3";
        while (running) {
            try {
                updateNotification("NasTech AI is running");
                status = "running";
                ProcessBuilder pb = new ProcessBuilder(py, "-m", "nastech_cli.main", "gateway", "start", "--foreground");
                pb.directory(agentDir);
                pb.environment().put("PREFIX", prefix.getAbsolutePath());
                pb.environment().put("HOME", getFilesDir().getAbsolutePath());
                pb.environment().put("NASTECH_HOME", getFilesDir() + "/.nastech");
                pb.environment().put("PATH", prefix + "/bin:" + System.getenv("PATH"));
                pb.environment().put("LD_LIBRARY_PATH", prefix + "/lib");
                pb.environment().put("PYTHONPATH", agentDir.getAbsolutePath());
                pb.environment().put("NASTECH_PORT", "9119");
                pb.environment().put("NASTECH_HOST", "127.0.0.1");
                pb.redirectErrorStream(true);
                daemonProcess = pb.start();
                final Process proc = daemonProcess;
                new Thread(() -> {
                    try {
                        BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()));
                        String l; while ((l = br.readLine()) != null) Log.d(TAG, "[py] " + l);
                    } catch (IOException ignored) {}
                }).start();
                int code = daemonProcess.waitFor();
                Log.w(TAG, "Daemon exited: " + code);
            } catch (Exception e) { Log.e(TAG, e.getMessage()); }
            if (!running) break;
            status = "restarting";
            updateNotification("NasTech AI: Restarting\u2026");
            Thread.sleep(3000);
        }
    }

    private void stopDaemon() {
        running = false; status = "stopped";
        if (daemonProcess != null) { daemonProcess.destroy(); daemonProcess = null; }
    }

    private String getPreferredAbi() {
        for (String a : Build.SUPPORTED_ABIS) if (a.equals("arm64-v8a")) return "arm64-v8a";
        for (String a : Build.SUPPORTED_ABIS) if (a.equals("armeabi-v7a")) return "armeabi-v7a";
        return Build.SUPPORTED_ABIS[0];
    }

    private String abiToArch(String abi) {
        switch (abi) {
            case "arm64-v8a": return "aarch64";
            case "armeabi-v7a": return "arm";
            case "x86_64": return "x86_64";
            default: return "aarch64";
        }
    }

    private void chmodR(File dir) {
        try { Runtime.getRuntime().exec(new String[]{"chmod", "-R", "700", dir.getAbsolutePath()}).waitFor(); }
        catch (Exception ignored) {}
    }

    private void writeStream(InputStream is, File dest) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(dest)) {
            byte[] buf = new byte[8192]; int n;
            while ((n = is.read(buf)) != -1) fos.write(buf, 0, n);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "NasTech Daemon", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("NasTech AI background service");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private Notification buildNotification(String text) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
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

    @Nullable @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() { stopDaemon(); super.onDestroy(); }
}
`;

// ─── Java: BootReceiver ───────────────────────────────────────────────────────
const BOOT_RECEIVER_JAVA = `package ai.nastech.daemon;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(intent.getAction())) {
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

// ─── Java: NativeDaemonModule ─────────────────────────────────────────────────
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
    public NativeDaemonModule(ReactApplicationContext ctx) { super(ctx); }

    @NonNull @Override
    public String getName() { return "NasTechDaemon"; }

    @ReactMethod
    public void startDaemon(Promise p) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent i = new Intent(ctx, DaemonService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i);
            else ctx.startService(i);
            p.resolve(true);
        } catch (Exception e) { p.reject("START_FAILED", e.getMessage()); }
    }

    @ReactMethod
    public void stopDaemon(Promise p) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent i = new Intent(ctx, DaemonService.class);
            i.setAction("STOP");
            ctx.startService(i);
            p.resolve(true);
        } catch (Exception e) { p.reject("STOP_FAILED", e.getMessage()); }
    }

    @ReactMethod
    public void getStatus(Promise p) {
        WritableMap m = Arguments.createMap();
        m.putString("status", DaemonService.status);
        m.putInt("setupProgress", DaemonService.setupProgress);
        p.resolve(m);
    }
}
`;

// ─── Java: DaemonPackage ──────────────────────────────────────────────────────
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
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        List<NativeModule> mods = new ArrayList<>();
        mods.add(new NativeDaemonModule(ctx));
        return mods;
    }
    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.emptyList();
    }
}
`;

// ─── Plugin ───────────────────────────────────────────────────────────────────

function withTermuxDaemon(config) {
    // 1. Android manifest — add permissions + service + receiver
    config = withAndroidManifest(config, (mod) => {
        const manifest = mod.modResults;
        const app = manifest.manifest.application[0];

        if (!manifest.manifest['uses-permission']) manifest.manifest['uses-permission'] = [];
        const existing = manifest.manifest['uses-permission'].map(p => p.$['android:name']);
        const needed = [
            'android.permission.FOREGROUND_SERVICE',
            'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
            'android.permission.RECEIVE_BOOT_COMPLETED',
            'android.permission.WAKE_LOCK',
            'android.permission.INTERNET',
            'android.permission.ACCESS_NETWORK_STATE',
            'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
        ];
        for (const p of needed) {
            if (!existing.includes(p)) manifest.manifest['uses-permission'].push({ $: { 'android:name': p } });
        }

        if (!app.service) app.service = [];
        if (!app.service.some(s => s.$['android:name'] === 'ai.nastech.daemon.DaemonService')) {
            app.service.push({
                $: {
                    'android:name': 'ai.nastech.daemon.DaemonService',
                    'android:enabled': 'true',
                    'android:exported': 'false',
                    'android:foregroundServiceType': 'dataSync',
                },
            });
        }

        if (!app.receiver) app.receiver = [];
        if (!app.receiver.some(r => r.$['android:name'] === 'ai.nastech.daemon.BootReceiver')) {
            app.receiver.push({
                $: {
                    'android:name': 'ai.nastech.daemon.BootReceiver',
                    'android:enabled': 'true',
                    'android:exported': 'true',
                },
                'intent-filter': [{
                    action: [
                        { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                        { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
                    ],
                }],
            });
        }
        return mod;
    });

    // 2. Write Java source files + copy assets (Android only)
    config = withDangerousMod(config, [
        'android',
        async (mod) => {
            const projectRoot = mod.modRequest.projectRoot;
            const androidRoot = path.join(projectRoot, 'android');
            const javaDir = path.join(androidRoot, 'app', 'src', 'main', 'java', 'ai', 'nastech', 'daemon');
            const assetsDir = path.join(androidRoot, 'app', 'src', 'main', 'assets', 'bootstrap');

            fs.mkdirSync(javaDir, { recursive: true });
            fs.mkdirSync(assetsDir, { recursive: true });

            fs.writeFileSync(path.join(javaDir, 'DaemonService.java'), DAEMON_SERVICE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'BootReceiver.java'), BOOT_RECEIVER_JAVA);
            fs.writeFileSync(path.join(javaDir, 'NativeDaemonModule.java'), NATIVE_DAEMON_MODULE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'DaemonPackage.java'), DAEMON_PACKAGE_JAVA);

            // Copy bundled bootstrap zips if present
            const bootstrapSrc = path.join(projectRoot, 'assets', 'bootstrap');
            if (fs.existsSync(bootstrapSrc)) {
                for (const zip of fs.readdirSync(bootstrapSrc).filter(f => f.endsWith('.zip'))) {
                    fs.copyFileSync(path.join(bootstrapSrc, zip), path.join(assetsDir, zip));
                }
            }

            // Copy Python agent zip if present
            const agentZip = path.join(projectRoot, 'assets', 'nastech-agent.zip');
            if (fs.existsSync(agentZip)) {
                fs.copyFileSync(agentZip, path.join(androidRoot, 'app', 'src', 'main', 'assets', 'nastech-agent.zip'));
            }

            return mod;
        },
    ]);

    // 3. Register DaemonPackage in MainApplication (Android only)
    config = withMainApplication(config, (mod) => {
        let c = mod.modResults.contents;
        if (!c.includes('import ai.nastech.daemon.DaemonPackage')) {
            c = c.replace(
                /import com\.facebook\.react\.ReactApplication;/,
                'import com.facebook.react.ReactApplication;\nimport ai.nastech.daemon.DaemonPackage;'
            );
        }
        if (!c.includes('new DaemonPackage()') && !c.includes('DaemonPackage()')) {
            // Java style
            c = c.replace(
                /packages\.add\(new MainReactPackage\(\)\);/,
                'packages.add(new MainReactPackage());\n      packages.add(new DaemonPackage());'
            );
            // Kotlin style
            c = c.replace(
                /add\(MainReactPackage\(\)\)/,
                'add(MainReactPackage())\n      add(DaemonPackage())'
            );
        }
        mod.modResults.contents = c;
        return mod;
    });

    return config;
}

module.exports = withTermuxDaemon;
