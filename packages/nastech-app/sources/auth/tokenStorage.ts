/**
 * Auth is disabled — NasTech runs in open (no-auth) mode.
 * This stub keeps existing imports compiling without changes.
 */

export interface AuthCredentials {
    token: string;
    secret: string;
}

export const TokenStorage = {
    async getCredentials(): Promise<AuthCredentials | null> {
        return { token: 'nastech-local', secret: 'nastech-local' };
    },

    async setCredentials(_credentials: AuthCredentials): Promise<boolean> {
        return true;
    },

    async removeCredentials(): Promise<boolean> {
        return true;
    },

    getCredentialsSync(): AuthCredentials | null {
        return { token: 'nastech-local', secret: 'nastech-local' };
    },
};
