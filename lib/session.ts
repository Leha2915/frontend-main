import { v4 as uuidv4 } from 'uuid';

export function generateSessionId(): string {
    return uuidv4();
}

// Holt oder erstellt eine projektspezifische Session-ID
export function getSessionId(projectSlug: string): string {
    if (typeof window === 'undefined') {
        return generateSessionId(); // Server-side fallback
    }

    // Verwende projektspezifischen Schlüssel für localStorage
    const storageKey = `interview_session_${projectSlug}`;

    // Prüfe auf vorhandene Session ID im localStorage
    const storedId = localStorage.getItem(storageKey);
    if (storedId) return storedId;

    // Erstelle neue Session ID für dieses Projekt
    const newId = generateSessionId();
    localStorage.setItem(storageKey, newId);
    return newId;
}

// Cookie-Hilfsfunktionen
export function getCookieName(projectSlug: string): string {
    return `interview_session_${projectSlug}`;
}

export function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;

    const cookies = document.cookie.split('; ').reduce((acc, cookie) => {
        const [cookieName, cookieValue] = cookie.split('=');
        acc[cookieName] = cookieValue;
        return acc;
    }, {} as Record<string, string>);

    return cookies[name] || null;
}

export function setCookie(name: string, value: string): void {
    if (typeof document === 'undefined') return;

    document.cookie = `${name}=${value}; path=/; max-age=86400; SameSite=Lax`;
}