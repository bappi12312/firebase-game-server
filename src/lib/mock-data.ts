import type { Server, Game } from './types';

let servers: Server[] = [
  {
    id: '1',
    name: 'Epic Minecraft Realm',
    ipAddress: 'play.epicmc.com',
    port: 25565,
    bannerUrl: 'https://picsum.photos/800/200?random=1',
    logoUrl: 'https://picsum.photos/100/100?random=11',
    game: 'Minecraft',
    description: 'A fun and engaging Minecraft server with multiple game modes, active community, and frequent events. Join us for an adventure!',
    tags: ['PvP', 'Survival', 'Minigames'],
    playerCount: 127,
    maxPlayers: 200,
    isOnline: true,
    votes: 1502,
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
  },
  {
    id: '2',
    name: 'Valheim Vikings',
    ipAddress: 'valheim.vikings.gg',
    port: 2456,
    bannerUrl: 'https://picsum.photos/800/200?random=2',
    logoUrl: 'https://picsum.photos/100/100?random=12',
    game: 'Valheim',
    description: 'Explore the mystical world of Valheim with fellow Vikings. Build, fight, and conquer together in this immersive survival game.',
    tags: ['Co-op', 'Building', 'Exploration'],
    playerCount: 8,
    maxPlayers: 10,
    isOnline: true,
    votes: 875,
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
  },
  {
    id: '3',
    name: 'CS:GO Pro Arena',
    ipAddress: 'csgo.proarena.net',
    port: 27015,
    logoUrl: 'https://picsum.photos/100/100?random=13',
    game: 'Counter-Strike: GO',
    description: 'Competitive CS:GO server with 128-tick rates, custom maps, and a fair ranking system. Test your skills against the best!',
    tags: ['Competitive', '5v5', '128-tick'],
    playerCount: 10,
    maxPlayers: 10,
    isOnline: false,
    votes: 1230,
    submittedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(), // 10 days ago
  },
  {
    id: '4',
    name: 'Rust Raiders Clan',
    ipAddress: 'rust.raiders.org',
    port: 28015,
    bannerUrl: 'https://picsum.photos/800/200?random=4',
    game: 'Rust',
    description: 'A hardcore Rust experience. Form clans, raid bases, and survive the harsh environment. Monthly wipes and active admins.',
    tags: ['PvP', 'Raiding', 'Survival'],
    playerCount: 45,
    maxPlayers: 100,
    isOnline: true,
    votes: 990,
    submittedAt: new Date().toISOString(), // today
  },
];

export const games: Game[] = [
  { id: 'mc', name: 'Minecraft' },
  { id: 'val', name: 'Valheim' },
  { id: 'csgo', name: 'Counter-Strike: GO' },
  { id: 'rust', name: 'Rust' },
  { id: 'ark', name: 'ARK: Survival Evolved' },
];

// Simulate fetching server stats (like from Steam Query)
export async function fetchMockServerStats(ipAddress: string, port: number): Promise<Partial<Server>> {
  // In a real app, this would query the server.
  // For now, return some random-ish data.
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
  const isOnline = Math.random() > 0.2; // 80% chance of being online
  return {
    isOnline,
    playerCount: isOnline ? Math.floor(Math.random() * 50) : 0,
    maxPlayers: 50 + Math.floor(Math.random() * 50), // Max players between 50-100
    // name: `Queried Server ${ipAddress}:${port}`, // Could also update name if query provides it
  };
}


export async function getServers(): Promise<Server[]> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return [...servers];
}

export async function getServerById(id: string): Promise<Server | undefined> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return servers.find(server => server.id === id);
}

export async function addServer(serverData: Omit<Server, 'id' | 'votes' | 'submittedAt' | 'playerCount' | 'maxPlayers' | 'isOnline'>): Promise<Server> {
  await new Promise(resolve => setTimeout(resolve, 500));
  const newId = String(Date.now());
  const initialStats = await fetchMockServerStats(serverData.ipAddress, serverData.port);
  const newServer: Server = {
    ...serverData,
    id: newId,
    votes: 0,
    submittedAt: new Date().toISOString(),
    playerCount: initialStats.playerCount ?? 0,
    maxPlayers: initialStats.maxPlayers ?? 50,
    isOnline: initialStats.isOnline ?? false,
  };
  servers.unshift(newServer); // Add to the beginning of the list
  return newServer;
}

export async function voteForServer(id: string): Promise<Server | undefined> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const serverIndex = servers.findIndex(server => server.id === id);
  if (serverIndex !== -1) {
    servers[serverIndex].votes += 1;
    servers[serverIndex].lastVotedAt = new Date().toISOString();
    // Simulate a player count update after voting too, as if it re-queried
    if (servers[serverIndex].isOnline) {
        servers[serverIndex].playerCount = Math.min(servers[serverIndex].maxPlayers, servers[serverIndex].playerCount + Math.floor(Math.random() * 3) -1); // +/- 1 player
        if (servers[serverIndex].playerCount < 0) servers[serverIndex].playerCount = 0;
    }
    return { ...servers[serverIndex] };
  }
  return undefined;
}

export async function getGames(): Promise<Game[]> {
  await new Promise(resolve => setTimeout(resolve, 100));
  return [...games];
}
