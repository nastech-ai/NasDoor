/**
 * NativeDaemon.ts
 *
 * TypeScript bridge to the Android NativeDaemonModule (DaemonService.java).
 * On iOS this is a no-op — iOS users connect to an external NasTech server.
 */
import { NativeModules, Platform } from 'react-native';

export interface DaemonStatus {
    status: 'stopped' | 'setting_up' | 'running' | 'restarting' | 'error';
    setupProgress: number;
}

const { NasTechDaemon } = NativeModules;

const isAndroid = Platform.OS === 'android';

export const NativeDaemon = {
    isSupported(): boolean {
        return isAndroid && !!NasTechDaemon;
    },

    async start(): Promise<boolean> {
        if (!isAndroid || !NasTechDaemon) return false;
        try {
            await NasTechDaemon.startDaemon();
            return true;
        } catch (e) {
            console.warn('[NativeDaemon] start failed:', e);
            return false;
        }
    },

    async stop(): Promise<boolean> {
        if (!isAndroid || !NasTechDaemon) return false;
        try {
            await NasTechDaemon.stopDaemon();
            return true;
        } catch (e) {
            console.warn('[NativeDaemon] stop failed:', e);
            return false;
        }
    },

    async getStatus(): Promise<DaemonStatus> {
        if (!isAndroid || !NasTechDaemon) {
            return { status: 'stopped', setupProgress: 0 };
        }
        try {
            return await NasTechDaemon.getStatus();
        } catch (e) {
            return { status: 'error', setupProgress: 0 };
        }
    },
};
