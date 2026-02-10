import { NextRequest, NextResponse } from 'next/server'
import { Message } from '@/lib/types'
import { getSessionId, getCookieName } from '@/lib/session';


export async function POST(request: NextRequest) {
  // Request-Body extrahieren
  const body = await request.json();
  const { messages, topic, stimulus, projectSlug, session_id } = body;

  // Session-ID mit Projektbezug holen
  let sessionId = session_id;
  if (!sessionId) {
    // Projektspezifischen Cookie-Namen verwenden
    const cookieName = getCookieName(projectSlug);
    const cookieSessionId = request.cookies.get(cookieName)?.value;

    if (cookieSessionId) {
      sessionId = cookieSessionId;
      console.log(`Found existing session ID for project ${projectSlug}:`, sessionId);
    } else {
      // Neue Session-ID für dieses Projekt generieren
      sessionId = getSessionId(projectSlug);
      console.log(`Generated new session ID for project ${projectSlug}:`, sessionId);
    }
  }

  const formattedMessages = (messages as Message[]).map(({ isUserMessage, text }) => ({
    role: isUserMessage ? 'user' : 'assistant',
    content: text,
  }))

  const lastMessage = (messages as Message[]).at(-1)?.text || '';

  // Grundlegendes Payload mit garantierten Feldern
  const backendPayload: any = {
    template_name: 'queue_laddering',
    template_vars: { topic, stimulus },
    projectSlug,
    session_id: sessionId,
    stimulus: stimulus,
    message: lastMessage
  };

  // Debugging-Ausgabe
  console.log("Full backend payload:", {
    ...backendPayload
  });

  // Backend-URL festlegen
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;

  console.log("Using backend URL:", backendUrl);

  try {
    const backendRes = await fetch(`${backendUrl}/interview/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendPayload),
      credentials: 'include'
    })

    const data = await backendRes.json()

    if (!backendRes.ok) {
      console.error('Backend returned error:', data)
      return NextResponse.json(data, { status: backendRes.status })
    }

    // Session-ID in projektspezifischem Cookie speichern
    const response = NextResponse.json(data);
    if (data?.Next?.session_id) {
      const cookieName = getCookieName(projectSlug);
      response.cookies.set(cookieName, data.Next.session_id, {
        maxAge: 60 * 60 * 24, // 1 Tag
        path: '/',
        httpOnly: false
      });
    }

    return response
    // Im catch-Block:
  } catch (err: any) {
    console.error('Fetch failed:', err);

    // Versuche die vollständige Fehlermeldung zu extrahieren
    const errorMessage = err.message || String(err);

    return NextResponse.json(
      { error: errorMessage, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
      { status: 500 }
    );
  }
}


