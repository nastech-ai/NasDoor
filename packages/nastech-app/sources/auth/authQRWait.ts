/** Auth disabled — stubs for compatibility. */
import { QRAuthKeyPair } from './authQRStart';
import { AuthCredentials } from './tokenStorage';

export type { AuthCredentials };

export async function authQRWait(
    _keypair: QRAuthKeyPair,
    _onProgress?: (dots: number) => void,
    _shouldCancel?: () => boolean,
): Promise<AuthCredentials | null> {
    return null;
}
