/**
 * NasTech API client — connects this mobile app to a self-hosted NasTech Agent
 * backend (nastech_cli/web_server.py, default port 9119).
 *
 * No authentication required — the NasTech backend runs in open mode locally.
 */

import { getServerUrl } from './serverConfig';

// ---------------------------------------------------------------------------
// Plain fetch helper — no auth headers
// ---------------------------------------------------------------------------

export async function nastechFetch(
    path: string,
    options: RequestInit = {},
): Promise<Response> {
    const url = `${getServerUrl()}${path}`;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> | undefined),
    };
    return fetch(url, { ...options, headers });
}

// ---------------------------------------------------------------------------
// NasTech REST endpoints
// ---------------------------------------------------------------------------

export interface NasTechStatus {
    version: string;
    release_date: string;
    nastech_home: string;
    gateway_running: boolean;
    active_sessions: number;
}

export async function fetchNasTechStatus(): Promise<NasTechStatus> {
    const res = await nastechFetch('/api/status');
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
    return res.json();
}

export interface NasTechSession {
    id: string;
    created_at: string;
    title?: string;
    message_count?: number;
}

export async function fetchNasTechSessions(limit = 20, offset = 0): Promise<NasTechSession[]> {
    const res = await nastechFetch(`/api/sessions?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw new Error(`Sessions fetch failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.sessions ?? [];
}

export interface NasTechMessage {
    id: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    created_at?: string;
}

export async function fetchNasTechMessages(sessionId: string): Promise<NasTechMessage[]> {
    const res = await nastechFetch(`/api/sessions/${sessionId}/messages`);
    if (!res.ok) throw new Error(`Messages fetch failed: ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : data.messages ?? [];
}

export async function deleteNasTechSession(sessionId: string): Promise<void> {
    const res = await nastechFetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Delete session failed: ${res.status}`);
}

// ---------------------------------------------------------------------------
// NasTech WebSocket — real-time events from /api/events
// ---------------------------------------------------------------------------

export type NasTechEventCallback = (event: unknown) => void;

export function connectNasTechEvents(
    channel: string,
    onEvent: NasTechEventCallback,
    onStatusChange?: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void,
): () => void {
    const serverUrl = getServerUrl().replace(/^http/, 'ws');
    const wsUrl = `${serverUrl}/api/events?channel=${encodeURIComponent(channel)}`;

    let ws: WebSocket | null = null;
    let stopped = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    function connect() {
        if (stopped) return;
        onStatusChange?.('connecting');
        ws = new WebSocket(wsUrl);

        ws.onopen = () => onStatusChange?.('connected');
        ws.onmessage = (e) => {
            try {
                onEvent(JSON.parse(e.data));
            } catch {
                onEvent(e.data);
            }
        };
        ws.onerror = () => onStatusChange?.('error');
        ws.onclose = () => {
            if (!stopped) {
                onStatusChange?.('disconnected');
                retryTimeout = setTimeout(connect, 3000);
            }
        };
    }

    connect();

    return () => {
        stopped = true;
        if (retryTimeout) clearTimeout(retryTimeout);
        ws?.close();
    };
}
