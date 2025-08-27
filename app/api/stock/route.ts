// app/api/stock/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') || '20';
  const page = searchParams.get('page') || '0';

  try {
    const res = await fetch(
      `https://niuniuparts.com:6001/scm-product/v1/stock2?size=${size}&page=${page}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch data from API' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Something went wrong', details: String(error) },
      { status: 500 }
    );
  }
}
