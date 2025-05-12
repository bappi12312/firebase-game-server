// src/app/api/server-status/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { GameDig } from 'gamedig';

export const dynamic = 'force-dynamic'; // Ensure this route is always dynamic

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ipAddress = searchParams.get('ip');
  const port = searchParams.get('port');
  const gameType = searchParams.get('gameType') || 'steam'; // Default to steam, allow overrides if needed

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
      // TODO: Consider mapping game names to appropriate gamedig types if 'steam' isn't always correct
      type: gameType as any, // Use 'any' for now, refine if game types vary significantly
      host: ipAddress,
      port: portNumber,
      socketTimeout: timeout,
      // givenPortOnly: true, // Might be needed for some games
    });

    return NextResponse.json({
      isOnline: true,
      playerCount: state.players ? state.players.length : 0,
      maxPlayers: state.maxplayers ?? 0,
      name: state.name, // Include server name from query if available
      map: state.map, // Include map if available
      // Add other relevant fields from 'state' if needed
    });

  } catch (error: any) {
    // console.error(`API: Failed to query server status for ${ipAddress}:${portNumber}:`, error.message);
    // Return offline status clearly
    return NextResponse.json({
      isOnline: false,
      playerCount: 0,
      maxPlayers: 0,
      error: `Failed to query server: ${error.message}`,
    });
  }
}
