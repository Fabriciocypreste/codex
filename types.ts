
export interface Media {
  id: string;
  tmdb_id?: number;
  title: string;
  type: 'movie' | 'series';
  description?: string;
  rating?: number | string; // Adjusted to allow string or number as per usage
  year?: number;
  release_date?: string; // Added
  first_air_date?: string; // Added for series
  duration?: string;
  genre?: string[];
  genre_ids?: number[]; // Added
  backdrop?: string;
  poster?: string;
  logo_url?: string;
  stream_url?: string;
  trailer_url?: string;
  use_trailer?: boolean;
  platform?: string; // Netflix, Prime, Disney, etc.
  status?: 'published' | 'draft';
  stars?: string[];
  director?: string;
  seasons?: number;
}

export interface Channel {
  nome: string;
  logo: string;
  genero: string;
  url: string;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar?: string;
  isKids: boolean;
  language?: string;
}

export enum Page {
  LOGIN = 'LOGIN',
  PROFILES = 'PROFILES',
  HOME = 'HOME',
  MOVIES = 'MOVIES',
  SERIES = 'SERIES',
  LIVE = 'LIVE',
  MY_LIST = 'MY_LIST',
  KIDS = 'KIDS',
  DETAILS = 'DETAILS',
  PLAYER = 'PLAYER',
  SEARCH = 'SEARCH',
  ADMIN = 'ADMIN',
  SETTINGS = 'SETTINGS'
}

// Interfaces adicionadas para o novo design VisionStream
export interface SeriesDetail {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  first_air_date: string;
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  original_language: string;
  genres: { id: number; name: string }[];
  tagline?: string;
  popularity: number;
  adult: boolean;
  runtime?: number; // Para filmes
  title?: string; // Para filmes
  release_date?: string; // Para filmes
  seasons?: Season[];
  // Campos opcionais para compatibilidade com Media
  [key: string]: any;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profile_path: string | null;
}

export interface Episode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  episode_number: number;
  season_number: number;
  air_date: string;
  vote_average: number;
  stream_url?: string; // Do nosso DB
  title?: string; // Alias
  thumbnail?: string; // Alias
  description?: string; // Alias
}

export interface Season {
  id: string; // Pode ser UUID do DB ou ID do TMDB
  name: string;
  season_number: number;
  poster_path?: string | null;
  episode_count?: number;
  title?: string; // Alias
}

export interface SimilarSeries {
  id: number;
  name: string;
  title?: string; // Para filmes
  poster_path: string | null;
  vote_average: number;
  first_air_date?: string;
  media_type?: string;
}

export interface Video {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface PersonDetail {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
}
