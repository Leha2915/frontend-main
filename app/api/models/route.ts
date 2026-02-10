import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { OPENAI_API_KEY, base_url } = body

  if (!base_url) {
    return NextResponse.json({ error: 'baseURL is required' }, { status: 400 })
  }

  const backendUrl = process.env.NEXT_PUBLIC_API_URL

  try {
    const res = await fetch(`${backendUrl}/models`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        OPENAI_API_KEY,
        base_url,
      }),
    })

    const contentType = res.headers.get('content-type')
    const data = contentType?.includes('application/json') ? await res.json() : null

    if (!res.ok) {
      console.error('Backend returned error:', data)
      return NextResponse.json(data ?? { error: 'Unknown error' }, {
        status: res.status,
      })
    }

    return NextResponse.json(data)
  } catch (err: any) {
    console.error('Fetch failed:', err)
    return NextResponse.json(
      { error: err?.message ?? String(err) },
      { status: 500 }
    )
  }
}
