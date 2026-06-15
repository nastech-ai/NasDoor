/** Auth disabled — stub for compatibility. */
export function authChallenge(_secret: Uint8Array): { challenge: Uint8Array; signature: Uint8Array; publicKey: Uint8Array } {
    return {
        challenge: new Uint8Array(32),
        signature: new Uint8Array(64),
        publicKey: new Uint8Array(32),
    };
}
