/** Auth disabled — stubs for compatibility. */

export interface QRAuthKeyPair {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

export function generateAuthKeyPair(): QRAuthKeyPair {
    return {
        publicKey: new Uint8Array(32),
        privateKey: new Uint8Array(64),
    };
}

export async function authQRStart(_keypair: QRAuthKeyPair): Promise<boolean> {
    return false;
}
