import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { session_id, projectSlug } = await request.json();
    
    if (!session_id || !projectSlug) {
      return NextResponse.json(
        { error: 'Missing session_id or projectSlug' }, 
        { status: 400 }
      );
    }

    const api_url = process.env.NEXT_PUBLIC_API_URL;
    if (!api_url) {
      return NextResponse.json(
        { error: 'API URL not configured' }, 
        { status: 500 }
      );
    }
    
    const payload = { 
      session_id, 
      projectSlug 
    };
    
    const response = await fetch(`${api_url}/interview/all_chat_messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend API error: ${response.status} - ${errorText}`);
      return NextResponse.json(
        { error: 'Failed to fetch chat messages from backend' }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
