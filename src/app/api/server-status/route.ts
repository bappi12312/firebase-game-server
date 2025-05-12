// src/app/api/server-status/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { GameDig } from 'gamedig';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamic

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ipAddress = searchParams.get('ip');
  const port = searchParams.get('port');
  // Default to 'rust' as this project primarily targets Rust servers.
  // Allow override via query param if other game types need specific handling in the future.
  const gameType = searchParams.get('gameType') || 'rust'; 

  if (!ipAddress || !port) {
    return NextResponse.json({ error: 'Missing ip or port query parameter' }, { status: 400 });
  }

  const portNumber = parseInt(port, 10);
  if (isNaN(portNumber)) {
    return NextResponse.json({ error: 'Invalid port number' }, { status: 400 });
  }

  const timeout = 5000; // 5 seconds timeout

  try {
    const state = await GameDig.query({
      type: gameType as any, // Use 'any' to allow different game types, but default is 'rust'
      host: ipAddress,
      port: portNumber,
      socketTimeout: timeout,
      givenPortOnly: true, // Often helps with Rust and other games
    });

    return NextResponse.json({
      isOnline: true,
      playerCount: state.players ? state.players.length : 0,
      maxPlayers: state.maxplayers ?? 0,
      name: state.name,
      map: state.map,
    });

  } catch (error: any) {
    // console.error(`API: Failed to query server status for ${ipAddress}:${portNumber} (Type: ${gameType}):`, error);
    return NextResponse.json({
      isOnline: false,
      playerCount: 0,
      maxPlayers: 0,
      error: `Failed to query server: ${error.message}`,
    });
  }
}
