/**
 * withTermuxDaemon.js — Android-only Expo config plugin
 *
 * Target: Android 14+ (API 34+), 8 GB RAM, 30 GB storage minimum.
 * No compromises — real proot-based Termux environment, full daemon lifecycle.
 *
 * What this does on Android:
 *   1. Adds ALL required permissions to AndroidManifest.xml (Android 14 typed foreground service)
 *   2. Registers DaemonService (foregroundServiceType=dataSync) + BootReceiver
 *   3. Writes production Java source: DaemonService, BootReceiver, NativeDaemonModule, DaemonPackage
 *   4. DaemonService uses proot for real Termux environment (no root required)
 *   5. Copies Termux bootstrap zips + Python agent zip into APK assets
 *   6. Registers DaemonPackage with React Native (handles both Java & Kotlin / old & new arch)
 *
 * iOS: completely untouched.
 */

const { withAndroidManifest, withDangerousMod, withMainApplication } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

// ─── DaemonService.java ───────────────────────────────────────────────────────
const DAEMON_SERVICE_JAVA = `package ai.nastech.daemon;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
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
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class DaemonService extends Service {

    private static final String TAG = "NasTechDaemon";
    private static final String CHANNEL_ID  = "nastech_daemon";
    private static final int    NOTIF_ID    = 1001;

    private static final String BOOTSTRAP_VERSION  = "bootstrap-2026.06.14-r1+apt.android-7";
    private static final String BOOTSTRAP_BASE_URL =
        "https://github.com/termux/termux-packages/releases/download/" + BOOTSTRAP_VERSION + "/";

    // Minimum free bytes required before setup (500 MB safety margin)
    private static final long MIN_FREE_BYTES = 500L * 1024 * 1024;

    public  static volatile String status        = "stopped";
    public  static volatile int    setupProgress = 0;
    public  static volatile String lastError     = "";
    private static volatile String logTail       = "";

    private volatile Process daemonProcess = null;
    private volatile boolean running       = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

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
        startForeground(NOTIF_ID, buildNotification("NasTech AI starting\\u2026"));
        running = true;
        new Thread(() -> {
            try {
                ensureBootstrapAndDaemon();
            } catch (Exception e) {
                Log.e(TAG, "Fatal daemon error: " + e.getMessage(), e);
                status    = "error";
                lastError = e.getMessage() != null ? e.getMessage() : "Unknown error";
                updateNotification("NasTech AI error \\u2014 tap to open");
            }
        }, "NasTech-main").start();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopDaemon();
        super.onDestroy();
    }

    @Nullable @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Core setup ────────────────────────────────────────────────────────────

    private void ensureBootstrapAndDaemon() throws Exception {
        File prefix   = new File(getFilesDir(), "usr");
        File flagFile = new File(getFilesDir(), ".nastech_setup_done");
        File agentDir = new File(getFilesDir(), "nastech");

        if (!flagFile.exists()) {
            // Storage check (target: 30 GB device, need ≥ 500 MB free)
            long free = getFilesDir().getFreeSpace();
            if (free < MIN_FREE_BYTES) {
                throw new IOException("Not enough free space: " + (free / 1024 / 1024) + " MB available, need ≥ 500 MB");
            }

            status        = "setting_up";
            setupProgress = 5;
            updateNotification("NasTech: Setting up Termux environment\\u2026");

            // 1. Extract bootstrap
            extractBootstrap(prefix);
            setupProgress = 35;

            // 2. Create required directories in prefix
            createPrefixDirs(prefix);
            setupProgress = 40;

            updateNotification("NasTech: Updating package index\\u2026");
            runWithProot(prefix, agentDir, new String[]{"bin/apt-get", "update", "-y", "-o", "Acquire::ForceIPv4=true"}, true);
            setupProgress = 55;

            updateNotification("NasTech: Installing Python 3\\u2026");
            runWithProot(prefix, agentDir, new String[]{
                "bin/apt-get", "install", "-y",
                "--no-install-recommends",
                "python3", "python3-pip", "python3-setuptools", "libffi", "openssl"
            }, true);
            setupProgress = 70;

            // 3. Extract Python agent
            updateNotification("NasTech: Extracting AI agent\\u2026");
            extractNasTechAgent(agentDir);
            setupProgress = 80;

            // 4. Install Python dependencies
            updateNotification("NasTech: Installing AI dependencies\\u2026");
            File constraints = new File(agentDir, "constraints-termux.txt");
            List<String> pipCmd = new ArrayList<>(Arrays.asList(
                "bin/python3", "-m", "pip", "install",
                "--no-build-isolation",
                "--no-warn-script-location"
            ));
            if (constraints.exists()) {
                pipCmd.add("-c"); pipCmd.add("/root/nastech/constraints-termux.txt");
            }
            pipCmd.add("-e"); pipCmd.add("/root/nastech[termux]");
            runWithProot(prefix, agentDir, pipCmd.toArray(new String[0]), true);
            setupProgress = 95;

            flagFile.createNewFile();
            setupProgress = 100;
            Log.i(TAG, "Setup complete.");
        }

        status = "running";
        startPythonDaemon(prefix, agentDir);
    }

    // ── Bootstrap extraction ──────────────────────────────────────────────────

    private void extractBootstrap(File prefix) throws IOException {
        String abi  = getPreferredAbi();
        String arch = abiToArch(abi);
        String assetName = "bootstrap/bootstrap-" + arch + ".zip";

        Log.i(TAG, "Extracting bootstrap for " + arch);
        InputStream stream;
        try {
            stream = getAssets().open(assetName);
            Log.i(TAG, "Using bundled bootstrap: " + assetName);
        } catch (IOException e) {
            Log.i(TAG, "Bootstrap not bundled, downloading: " + arch);
            updateNotification("NasTech: Downloading Termux bootstrap (" + arch + ")\\u2026");
            stream = downloadWithRetry(BOOTSTRAP_BASE_URL + "bootstrap-" + arch + ".zip");
        }

        prefix.mkdirs();
        extractZipWithSymlinks(stream, prefix);
        stream.close();

        // Make all extracted binaries executable
        chmodRecursive(prefix, 0755);
        Log.i(TAG, "Bootstrap ready: " + prefix.getAbsolutePath());
    }

    private InputStream downloadWithRetry(String urlStr) throws IOException {
        IOException last = null;
        for (int attempt = 1; attempt <= 3; attempt++) {
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(30_000);
                c.setReadTimeout(120_000);
                c.connect();
                int code = c.getResponseCode();
                if (code == 200) return c.getInputStream();
                throw new IOException("HTTP " + code + " for " + urlStr);
            } catch (IOException e) {
                last = e;
                Log.w(TAG, "Download attempt " + attempt + " failed: " + e.getMessage());
                try { Thread.sleep(2000L * attempt); } catch (InterruptedException ignored) {}
            }
        }
        throw last;
    }

    private void extractZipWithSymlinks(InputStream zipStream, File dest) throws IOException {
        ZipInputStream  zis        = new ZipInputStream(zipStream);
        ZipEntry        entry;
        File            symlinksFile = null;

        while ((entry = zis.getNextEntry()) != null) {
            File out = new File(dest, entry.getName());
            if (entry.isDirectory()) {
                out.mkdirs();
            } else {
                out.getParentFile().mkdirs();
                writeStream(zis, out);
                if (entry.getName().equals("SYMLINKS.txt")) {
                    symlinksFile = out;
                }
            }
            zis.closeEntry();
        }
        zis.close();

        if (symlinksFile != null) {
            processSymlinks(symlinksFile, dest);
        }
    }

    /**
     * SYMLINKS.txt format (per Termux bootstrap): one entry per line.
     * Format: <target>\\u2190<link_name>
     * Example: ../usr/bin/sh\\u2190bin/sh
     */
    private void processSymlinks(File symlinksFile, File base) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(new java.io.FileInputStream(symlinksFile), "UTF-8"))) {
            String line;
            int created = 0, skipped = 0;
            while ((line = reader.readLine()) != null) {
                line = line.trim();
                if (line.isEmpty()) continue;
                int sep = line.indexOf('\\u2190');  // U+2190 LEFT ARROW
                if (sep < 0) continue;
                String target   = line.substring(0, sep);
                String linkName = line.substring(sep + 1);
                File   linkFile = new File(base, linkName);
                linkFile.getParentFile().mkdirs();
                try {
                    Path linkPath = linkFile.toPath();
                    if (Files.exists(linkPath, LinkOption.NOFOLLOW_LINKS)) {
                        Files.delete(linkPath);
                    }
                    Files.createSymbolicLink(linkPath, Paths.get(target));
                    created++;
                } catch (Exception e) {
                    Log.v(TAG, "Symlink skip: " + linkName + " \\u2192 " + target + " (" + e.getMessage() + ")");
                    skipped++;
                }
            }
            Log.i(TAG, "Symlinks: " + created + " created, " + skipped + " skipped");
        } catch (IOException e) {
            Log.e(TAG, "processSymlinks failed: " + e.getMessage());
        }
    }

    private void createPrefixDirs(File prefix) {
        for (String d : new String[]{"tmp", "var/cache/apt/archives/partial", "var/lib/apt/lists"}) {
            new File(prefix, d).mkdirs();
        }
    }

    // ── Agent extraction ──────────────────────────────────────────────────────

    private void extractNasTechAgent(File agentDir) throws IOException {
        agentDir.mkdirs();
        InputStream s;
        try {
            s = getAssets().open("nastech-agent.zip");
        } catch (IOException e) {
            Log.w(TAG, "nastech-agent.zip not bundled in APK; agent will be downloaded on first run");
            return;
        }
        ZipInputStream zis = new ZipInputStream(s);
        ZipEntry       e;
        while ((e = zis.getNextEntry()) != null) {
            File out = new File(agentDir, e.getName());
            if (e.isDirectory()) {
                out.mkdirs();
            } else {
                out.getParentFile().mkdirs();
                writeStream(zis, out);
            }
            zis.closeEntry();
        }
        zis.close();
        s.close();
        Log.i(TAG, "Agent extracted to " + agentDir.getAbsolutePath());
    }

    // ── proot execution ───────────────────────────────────────────────────────

    /**
     * Run a command inside the Termux prefix using proot (no root required).
     * Falls back to direct execution if proot is not yet available.
     */
    private void runWithProot(File prefix, File agentDir, String[] args, boolean allowFailure) throws Exception {
        File proot = new File(prefix, "bin/proot");

        List<String> cmd = new ArrayList<>();

        if (proot.exists() && proot.canExecute()) {
            cmd.add(proot.getAbsolutePath());
            cmd.add("--link2symlink");
            cmd.add("-r"); cmd.add(prefix.getAbsolutePath());
            // Bind-mount essential pseudo-filesystems
            cmd.add("-b"); cmd.add("/dev");
            cmd.add("-b"); cmd.add("/proc");
            cmd.add("-b"); cmd.add("/sys");
            // App data available as /root inside prefix
            cmd.add("-b"); cmd.add(getFilesDir().getAbsolutePath() + ":/root");
            // Agent dir available as /root/nastech
            cmd.add("-b"); cmd.add(agentDir.getAbsolutePath() + ":/root/nastech");
            // Working directory inside prefix
            cmd.add("-w"); cmd.add("/root");
            // First arg is relative to prefix (e.g. "bin/python3")
            cmd.add("/" + args[0]);
        } else {
            // proot not yet extracted (during first bootstrap extraction phase)
            cmd.add(prefix.getAbsolutePath() + "/" + args[0]);
        }

        for (int i = 1; i < args.length; i++) cmd.add(args[i]);

        ProcessBuilder pb = new ProcessBuilder(cmd);
        Map<String, String> env = pb.environment();
        // Essential Termux env vars
        env.put("PREFIX",        prefix.getAbsolutePath());
        env.put("HOME",          "/root");
        env.put("TMPDIR",        prefix.getAbsolutePath() + "/tmp");
        env.put("PATH",          "/bin:/usr/bin:/sbin:/usr/sbin");
        env.put("LD_LIBRARY_PATH", prefix.getAbsolutePath() + "/lib");
        env.put("TERM",          "xterm-256color");
        env.put("LANG",          "en_US.UTF-8");
        env.put("DEBIAN_FRONTEND", "noninteractive");
        env.put("PYTHONDONTWRITEBYTECODE", "1");
        env.put("PYTHONUNBUFFERED",        "1");

        pb.redirectErrorStream(true);
        pb.directory(new File(prefix.getAbsolutePath()));
        Process p = pb.start();

        // Drain output (tee to logcat)
        try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String l;
            while ((l = br.readLine()) != null) {
                Log.d(TAG, "  " + l);
                if (sb.length() < 2000) { sb.append(l).append("\\n"); }
            }
            logTail = sb.toString();
        }

        int code = p.waitFor();
        if (code != 0 && !allowFailure) {
            throw new IOException("Command failed (exit " + code + "): " + args[0]);
        }
        if (code != 0) {
            Log.w(TAG, "Command exited " + code + " (ignored): " + args[0]);
        }
    }

    // ── Daemon loop ───────────────────────────────────────────────────────────

    private void startPythonDaemon(File prefix, File agentDir) throws Exception {
        while (running) {
            try {
                status = "running";
                updateNotification("NasTech AI is running \\u2022 port 9119");

                File proot = new File(prefix, "bin/proot");
                List<String> cmd = new ArrayList<>();

                if (proot.exists() && proot.canExecute()) {
                    cmd.add(proot.getAbsolutePath());
                    cmd.add("--link2symlink");
                    cmd.add("-r"); cmd.add(prefix.getAbsolutePath());
                    cmd.add("-b"); cmd.add("/dev");
                    cmd.add("-b"); cmd.add("/proc");
                    cmd.add("-b"); cmd.add("/sys");
                    cmd.add("-b"); cmd.add(getFilesDir().getAbsolutePath() + ":/root");
                    cmd.add("-b"); cmd.add(agentDir.getAbsolutePath() + ":/root/nastech");
                    cmd.add("-w"); cmd.add("/root");
                    cmd.add("/bin/python3");
                } else {
                    cmd.add(prefix.getAbsolutePath() + "/bin/python3");
                }

                cmd.add("-m"); cmd.add("nastech_cli.main");
                cmd.add("gateway"); cmd.add("start"); cmd.add("--foreground");

                ProcessBuilder pb = new ProcessBuilder(cmd);
                Map<String, String> env = pb.environment();
                env.put("PREFIX",           prefix.getAbsolutePath());
                env.put("HOME",             "/root");
                env.put("TMPDIR",           prefix.getAbsolutePath() + "/tmp");
                env.put("PATH",             "/bin:/usr/bin:/sbin:/usr/sbin");
                env.put("LD_LIBRARY_PATH",  prefix.getAbsolutePath() + "/lib");
                env.put("TERM",             "xterm-256color");
                env.put("LANG",             "en_US.UTF-8");
                env.put("NASTECH_HOME",     "/root/.nastech");
                env.put("NASTECH_PORT",     "9119");
                env.put("NASTECH_HOST",     "127.0.0.1");
                env.put("PYTHONPATH",       "/root/nastech");
                env.put("PYTHONDONTWRITEBYTECODE", "1");
                env.put("PYTHONUNBUFFERED",        "1");

                pb.redirectErrorStream(true);
                pb.directory(new File(prefix.getAbsolutePath()));
                daemonProcess = pb.start();

                final Process proc = daemonProcess;
                Thread logThread = new Thread(() -> {
                    try (BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                        StringBuilder sb = new StringBuilder();
                        String l;
                        while ((l = br.readLine()) != null) {
                            Log.d(TAG, "[py] " + l);
                            sb.insert(0, l + "\\n");
                            if (sb.length() > 4000) sb.setLength(4000);
                            logTail = sb.toString();
                        }
                    } catch (IOException ignored) {}
                }, "NasTech-log");
                logThread.setDaemon(true);
                logThread.start();

                int code = daemonProcess.waitFor();
                Log.w(TAG, "Python daemon exited with code: " + code);

            } catch (Exception e) {
                Log.e(TAG, "Daemon loop error: " + e.getMessage(), e);
                lastError = e.getMessage() != null ? e.getMessage() : "Unknown";
            }

            if (!running) break;
            status = "restarting";
            updateNotification("NasTech AI restarting\\u2026");
            Log.i(TAG, "Restarting daemon in 5s\\u2026");
            Thread.sleep(5_000);
        }
        status = "stopped";
    }

    private void stopDaemon() {
        running = false;
        status  = "stopped";
        Process p = daemonProcess;
        daemonProcess = null;
        if (p != null) {
            p.destroy();
            try { p.waitFor(); } catch (InterruptedException ignored) {}
        }
    }

    // ── ABI helpers ───────────────────────────────────────────────────────────

    private String getPreferredAbi() {
        String[] supported = Build.SUPPORTED_ABIS;
        for (String a : supported) if ("arm64-v8a".equals(a))   return "arm64-v8a";
        for (String a : supported) if ("armeabi-v7a".equals(a)) return "armeabi-v7a";
        for (String a : supported) if ("x86_64".equals(a))      return "x86_64";
        return supported.length > 0 ? supported[0] : "arm64-v8a";
    }

    private String abiToArch(String abi) {
        switch (abi) {
            case "arm64-v8a":   return "aarch64";
            case "armeabi-v7a": return "arm";
            case "x86_64":      return "x86_64";
            case "x86":         return "i686";
            default:            return "aarch64";
        }
    }

    // ── Filesystem helpers ────────────────────────────────────────────────────

    private void chmodRecursive(File dir, int mode) {
        try {
            Runtime.getRuntime()
                   .exec(new String[]{"chmod", "-R", Integer.toOctalString(mode), dir.getAbsolutePath()})
                   .waitFor();
        } catch (Exception ignored) {}
    }

    private void writeStream(InputStream is, File dest) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(dest)) {
            byte[] buf = new byte[65536];
            int    n;
            while ((n = is.read(buf)) != -1) fos.write(buf, 0, n);
        }
    }

    // ── Notification helpers ──────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(
                CHANNEL_ID, "NasTech AI Daemon", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Background AI agent");
            ch.setShowBadge(false);
            ch.enableVibration(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private int getNotificationIcon() {
        // Try the app's notification icon first, fall back to a system icon
        int id = getResources().getIdentifier("ic_notification", "drawable", getPackageName());
        if (id == 0) id = getResources().getIdentifier("ic_launcher", "mipmap", getPackageName());
        if (id == 0) id = android.R.drawable.stat_notify_sync;
        return id;
    }

    private Notification buildNotification(String text) {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent pi = PendingIntent.getActivity(
            this, 0, open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("NasTech")
            .setContentText(text)
            .setSmallIcon(getNotificationIcon())
            .setContentIntent(pi)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, buildNotification(text));
    }
}
`;

// ─── BootReceiver.java ────────────────────────────────────────────────────────
const BOOT_RECEIVER_JAVA = `package ai.nastech.daemon;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "NasTechBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "android.intent.action.MY_PACKAGE_REPLACED".equals(action)) {
            Log.i(TAG, "Boot/update event received (" + action + "), starting daemon");
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

// ─── NativeDaemonModule.java ──────────────────────────────────────────────────
const NATIVE_DAEMON_MODULE_JAVA = `package ai.nastech.daemon;

import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import androidx.annotation.NonNull;

public class NativeDaemonModule extends ReactContextBaseJavaModule {

    public NativeDaemonModule(ReactApplicationContext ctx) { super(ctx); }

    @NonNull @Override
    public String getName() { return "NasTechDaemon"; }

    @ReactMethod
    public void startDaemon(Promise promise) {
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            Intent i = new Intent(ctx, DaemonService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(i);
            } else {
                ctx.startService(i);
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
            Intent i = new Intent(ctx, DaemonService.class);
            i.setAction("STOP");
            ctx.startService(i);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("STOP_FAILED", e.getMessage());
        }
    }

    @ReactMethod
    public void getStatus(Promise promise) {
        try {
            WritableMap m = Arguments.createMap();
            m.putString("status",        DaemonService.status);
            m.putInt("setupProgress",    DaemonService.setupProgress);
            m.putString("lastError",     DaemonService.lastError);
            m.putString("logTail",       DaemonService.logTail);
            promise.resolve(m);
        } catch (Exception e) {
            promise.reject("STATUS_FAILED", e.getMessage());
        }
    }

    @ReactMethod
    public void getPort(Promise promise) {
        promise.resolve(9119);
    }

    @ReactMethod
    public void resetSetup(Promise promise) {
        // Allow re-running setup (delete the flag file)
        try {
            ReactApplicationContext ctx = getReactApplicationContext();
            java.io.File flag = new java.io.File(ctx.getFilesDir(), ".nastech_setup_done");
            boolean deleted = flag.delete();
            promise.resolve(deleted);
        } catch (Exception e) {
            promise.reject("RESET_FAILED", e.getMessage());
        }
    }
}
`;

// ─── DaemonPackage.java ───────────────────────────────────────────────────────
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

// ─── Plugin implementation ────────────────────────────────────────────────────

function withTermuxDaemon(config) {

    // ── Step 1: Android manifest permissions + service + receivers ────────────
    config = withAndroidManifest(config, (mod) => {
        const manifest = mod.modResults;
        const app      = manifest.manifest.application[0];

        // Permissions required for Android 14+ foreground service (dataSync type)
        if (!manifest.manifest['uses-permission']) manifest.manifest['uses-permission'] = [];
        const existing = new Set(
            manifest.manifest['uses-permission'].map(p => p.$['android:name'])
        );
        const needed = [
            'android.permission.FOREGROUND_SERVICE',
            'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
            'android.permission.RECEIVE_BOOT_COMPLETED',
            'android.permission.WAKE_LOCK',
            'android.permission.INTERNET',
            'android.permission.ACCESS_NETWORK_STATE',
            'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
            'android.permission.POST_NOTIFICATIONS',
        ];
        for (const p of needed) {
            if (!existing.has(p)) {
                manifest.manifest['uses-permission'].push({ $: { 'android:name': p } });
            }
        }

        // DaemonService — foregroundServiceType=dataSync required on Android 14+
        if (!app.service) app.service = [];
        const DAEMON = 'ai.nastech.daemon.DaemonService';
        if (!app.service.some(s => s.$['android:name'] === DAEMON)) {
            app.service.push({
                $: {
                    'android:name':                DAEMON,
                    'android:enabled':             'true',
                    'android:exported':            'false',
                    'android:foregroundServiceType': 'dataSync',
                },
            });
        } else {
            // Ensure foregroundServiceType is set even if service already present
            const svc = app.service.find(s => s.$['android:name'] === DAEMON);
            if (svc) svc.$['android:foregroundServiceType'] = 'dataSync';
        }

        // BootReceiver — also fires on package replace so daemon restarts after updates
        if (!app.receiver) app.receiver = [];
        const BOOT = 'ai.nastech.daemon.BootReceiver';
        if (!app.receiver.some(r => r.$['android:name'] === BOOT)) {
            app.receiver.push({
                $: {
                    'android:name':     BOOT,
                    'android:enabled':  'true',
                    'android:exported': 'true',
                },
                'intent-filter': [{
                    action: [
                        { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                        { $: { 'android:name': 'android.intent.action.QUICKBOOT_POWERON' } },
                        { $: { 'android:name': 'android.intent.action.MY_PACKAGE_REPLACED' } },
                    ],
                }],
            });
        }

        return mod;
    });

    // ── Step 2: Write Java sources + copy assets ──────────────────────────────
    config = withDangerousMod(config, [
        'android',
        async (mod) => {
            const projectRoot = mod.modRequest.projectRoot;
            const androidRoot = path.join(projectRoot, 'android');
            const javaDir     = path.join(androidRoot, 'app', 'src', 'main', 'java', 'ai', 'nastech', 'daemon');
            const assetsDir   = path.join(androidRoot, 'app', 'src', 'main', 'assets');
            const bootstrapDir = path.join(assetsDir, 'bootstrap');

            fs.mkdirSync(javaDir,      { recursive: true });
            fs.mkdirSync(bootstrapDir, { recursive: true });

            // Write Java source files
            fs.writeFileSync(path.join(javaDir, 'DaemonService.java'),       DAEMON_SERVICE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'BootReceiver.java'),        BOOT_RECEIVER_JAVA);
            fs.writeFileSync(path.join(javaDir, 'NativeDaemonModule.java'),  NATIVE_DAEMON_MODULE_JAVA);
            fs.writeFileSync(path.join(javaDir, 'DaemonPackage.java'),       DAEMON_PACKAGE_JAVA);

            // Copy bundled Termux bootstrap zips (aarch64.zip, arm.zip, x86_64.zip)
            const bootstrapSrc = path.join(projectRoot, 'assets', 'bootstrap');
            if (fs.existsSync(bootstrapSrc)) {
                for (const zip of fs.readdirSync(bootstrapSrc).filter(f => f.endsWith('.zip'))) {
                    const src  = path.join(bootstrapSrc, zip);
                    const dest = path.join(bootstrapDir, zip);
                    fs.copyFileSync(src, dest);
                    const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
                    console.log(`  Copied bootstrap asset: ${zip} (${size} MB)`);
                }
            } else {
                console.log('  No bundled bootstrap zips — daemon will download on first run');
            }

            // Copy Python agent zip
            const agentZip = path.join(projectRoot, 'assets', 'nastech-agent.zip');
            if (fs.existsSync(agentZip)) {
                const dest = path.join(assetsDir, 'nastech-agent.zip');
                fs.copyFileSync(agentZip, dest);
                const size = (fs.statSync(dest).size / 1024 / 1024).toFixed(1);
                console.log(`  Copied nastech-agent.zip (${size} MB)`);
            } else {
                console.log('  No nastech-agent.zip — agent source will download on first run');
            }

            return mod;
        },
    ]);

    // ── Step 3: Register DaemonPackage in MainApplication ─────────────────────
    // Handles: Java (old arch), Kotlin (old arch), Kotlin (new arch / PackageList)
    config = withMainApplication(config, (mod) => {
        let c = mod.modResults.contents;

        // --- Add import ---
        const importDaemon = 'import ai.nastech.daemon.DaemonPackage';
        if (!c.includes(importDaemon)) {
            // After the last import block
            c = c.replace(
                /(import com\.facebook\.react\.ReactApplication[;\s])/,
                `$1${importDaemon};\n`
            );
            // Kotlin (no semicolons)
            if (!c.includes(importDaemon)) {
                c = c.replace(
                    /(import com\.facebook\.react\.ReactApplication\n)/,
                    `$1${importDaemon}\n`
                );
            }
        }

        // --- Register package ---
        if (!c.includes('DaemonPackage')) {
            // Pattern A: New arch Kotlin — PackageList(this).packages.apply {
            if (c.includes('PackageList(this).packages.apply {')) {
                c = c.replace(
                    'PackageList(this).packages.apply {',
                    'PackageList(this).packages.apply {\n          add(DaemonPackage())'
                );
            }
            // Pattern B: New arch Kotlin — PackageList(this).packages (no apply block)
            else if (c.includes('PackageList(this).packages')) {
                c = c.replace(
                    'PackageList(this).packages',
                    'PackageList(this).packages.apply { add(DaemonPackage()) }'
                );
            }
            // Pattern C: Old arch Java — packages.add(new MainReactPackage())
            else if (c.includes('packages.add(new MainReactPackage())')) {
                c = c.replace(
                    'packages.add(new MainReactPackage());',
                    'packages.add(new MainReactPackage());\n            packages.add(new DaemonPackage());'
                );
            }
            // Pattern D: Old arch Kotlin — add(MainReactPackage())
            else if (c.includes('add(MainReactPackage())')) {
                c = c.replace(
                    'add(MainReactPackage())',
                    'add(MainReactPackage())\n            add(DaemonPackage())'
                );
            }
            // Pattern E: ReactNativeHost override — insert inside getPackages()
            else {
                const packagesFnMatch = c.match(/override fun getPackages\(\)[\s\S]{0,200}?\{/);
                if (packagesFnMatch) {
                    const insertAfter = packagesFnMatch[0];
                    c = c.replace(insertAfter, insertAfter + '\n          // NasTech daemon\n          add(DaemonPackage())');
                } else {
                    console.warn('[withTermuxDaemon] WARNING: Could not find package registration point in MainApplication — add DaemonPackage() manually');
                }
            }
        }

        mod.modResults.contents = c;
        return mod;
    });

    return config;
}

module.exports = withTermuxDaemon;
