
'use client';

import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Game, SortOption } from '@/lib/types';
import { Search, ListFilter, ArrowDownUp, Star } from 'lucide-react';

interface ServerFiltersProps {
  games: Game[];
  onSearchChange: (term: string) => void;
  onGameFilterChange: (game: string) => void;
  onSortChange: (sortBy: SortOption) => void;
  searchTerm: string;
  gameFilter: string;
  sortBy: SortOption;
}

export function ServerFilters({
  games,
  onSearchChange,
  onGameFilterChange,
  onSortChange,
  searchTerm,
  gameFilter,
  sortBy
}: ServerFiltersProps) {
  return (
    <div className="mb-8 p-6 bg-card rounded-lg shadow-md">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">
            <Search className="inline-block w-4 h-4 mr-1" />
            Search Servers
          </label>
          <Input
            id="search"
            type="text"
            placeholder="Name, IP, or game..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="bg-background"
          />
        </div>
        <div>
          <label htmlFor="game-filter" className="block text-sm font-medium text-foreground mb-1">
            <ListFilter className="inline-block w-4 h-4 mr-1" />
            Filter by Game
          </label>
          <Select value={gameFilter} onValueChange={onGameFilterChange}>
            <SelectTrigger id="game-filter" className="bg-background">
              <SelectValue placeholder="All Games" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Games</SelectItem>
              {games.map((game) => (
                <SelectItem key={game.id} value={game.name}>
                  {game.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor="sort-by" className="block text-sm font-medium text-foreground mb-1">
            <ArrowDownUp className="inline-block w-4 h-4 mr-1" />
            Sort By
          </label>
          <Select value={sortBy} onValueChange={(value) => onSortChange(value as SortOption)}>
            <SelectTrigger id="sort-by" className="bg-background">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="featured">
                <div className="flex items-center">
                  <Star className="w-4 h-4 mr-2 text-yellow-500 fill-yellow-500" /> Featured
                </div>
              </SelectItem>
              <SelectItem value="votes">Votes</SelectItem>
              <SelectItem value="playerCount">Player Count</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="submittedAt">Recently Added</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
