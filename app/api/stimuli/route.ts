import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const backendUrl = process.env.NEXT_PUBLIC_API_URL

  try {
    const authHeader = request.headers.get("authorization")
    const res = await fetch(`${backendUrl}/stimuli/suggest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    })

    const contentType = res.headers.get("content-type")
    const data = contentType?.includes("application/json") ? await res.json() : await res.text()
    if (!res.ok) {
      return NextResponse.json(
        typeof data === "string" ? { error: data } : data,
        { status: res.status }
      )
    }
    return NextResponse.json(data)
  } catch (err: any) {
    console.error("Stimuli proxy failed:", err)
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 })
  }
}
