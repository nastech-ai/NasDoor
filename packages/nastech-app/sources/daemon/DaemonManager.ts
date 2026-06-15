/**
 * DaemonManager.ts
 *
 * High-level manager for the NasTech background daemon.
 * - Automatically starts daemon on Android app launch
 * - Polls status and exposes a React hook
 * - On iOS, does nothing (user connects to external server)
 */
import { Platform, AppState, AppStateStatus } from 'react-native';
import { NativeDaemon, DaemonStatus } from './NativeDaemon';
import { create } from 'zustand';

interface DaemonStore {
    status: DaemonStatus;
    setStatus: (status: DaemonStatus) => void;
}

export const useDaemonStore = create<DaemonStore>((set) => ({
    status: { status: 'stopped', setupProgress: 0 },
    setStatus: (status) => set({ status }),
}));

let pollInterval: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let initialized = false;

async function pollStatus() {
    const status = await NativeDaemon.getStatus();
    useDaemonStore.getState().setStatus(status);
}

export async function initDaemon() {
    if (Platform.OS !== 'android') return;
    if (initialized) return;
    initialized = true;

    if (!NativeDaemon.isSupported()) {
        console.log('[DaemonManager] Native module not available (dev/web)');
        return;
    }

    // Start the daemon
    await NativeDaemon.start();
    await pollStatus();

    // Poll every 3 seconds
    pollInterval = setInterval(pollStatus, 3000);

    // Restart if needed when app comes to foreground
    appStateSubscription = AppState.addEventListener('change', async (state: AppStateStatus) => {
        if (state === 'active') {
            const current = await NativeDaemon.getStatus();
            if (current.status === 'stopped' || current.status === 'error') {
                await NativeDaemon.start();
            }
            await pollStatus();
        }
    });
}

export function teardownDaemon() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    if (appStateSubscription) {
        appStateSubscription.remove();
        appStateSubscription = null;
    }
    initialized = false;
}

/** React hook: get current daemon status */
export function useDaemonStatus(): DaemonStatus {
    return useDaemonStore((s) => s.status);
}

/** True when daemon is healthy and ready to serve requests */
export function isDaemonReady(status: DaemonStatus): boolean {
    return status.status === 'running';
}
