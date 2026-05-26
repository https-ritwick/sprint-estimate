// Shared types mirroring the backend's `to_public()` shapes.

export type Priority = 'Low' | 'Medium' | 'High' | 'Critical';
export type StoryStatus = 'pending' | 'active' | 'estimated';
export type DeckType = 'fibonacci' | 'modified_fibonacci' | 'tshirt' | 'powers_of_two';

export interface DeckOption {
  type: DeckType;
  label: string;
  preview: string[];
}

// Client-side catalogue of decks (kept in sync with backend DECKS).
export const DECKS: Record<DeckType, string[]> = {
  fibonacci: ['0', '1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?', 'Pass'],
  modified_fibonacci: ['0', '0.5', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', 'Pass'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', 'Pass'],
  powers_of_two: ['0', '1', '2', '4', '8', '16', '32', '64', '?', 'Pass'],
};

export const DECK_OPTIONS: DeckOption[] = [
  { type: 'fibonacci', label: 'Fibonacci', preview: ['1', '2', '3', '5', '8'] },
  { type: 'modified_fibonacci', label: 'Modified Fibonacci', preview: ['0.5', '1', '2', '3', '5'] },
  { type: 'tshirt', label: 'T-Shirt Sizes', preview: ['S', 'M', 'L', 'XL'] },
  { type: 'powers_of_two', label: 'Powers of 2', preview: ['1', '2', '4', '8', '16'] },
];

export const NON_NUMERIC_CARDS = new Set(['?', 'Pass', 'Coffee']);

export interface User {
  id: string;
  name: string;
  isAdmin: boolean;
  team: string;
  corporateId: string;
  isConnected: boolean;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  priority: Priority;
  jiraId: string;
  status: StoryStatus;
  finalEstimate: string | null;
  revealed: boolean;
  votedUserIds: string[];
  votes: Record<string, string>; // populated only after reveal
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  durationSeconds: number;
  remainingSeconds: number | null;
  autoReveal: boolean;
}

export interface SessionConfig {
  projectName: string;
  sprintName: string;
  deckType: DeckType;
  adminVotes: boolean;
  velocity: number | null;
  shareVelocity: boolean;
  effortPointing: boolean;
  autoReveal: boolean;
  allowChangeAfterReveal: boolean;
  autoCalculate: boolean;
  enableTimer: boolean;
}

export interface ActivityEntry {
  id: string;
  ts: number;
  kind: string;
  message: string;
  userName: string;
  corporateId: string;
}

export interface HistoryEntry {
  storyId: string;
  title: string;
  jiraId: string;
  priority: Priority;
  finalEstimate: string;
  votes: Record<string, string>;
}

export interface Room {
  id: string;
  name: string;
  createdAt: number;
  config: SessionConfig;
  users: User[];
  stories: Story[];
  activeStoryId: string | null;
  timer: TimerState;
  history: HistoryEntry[];
  activity: ActivityEntry[];
  cardDeck: string[];
  adminCorporateId: string;
  adminName: string;
  ended: boolean;
}

export interface VoteDetail {
  userId: string;
  userName: string;
  team: string;
  corporateId: string;
  card: string;
}

export interface Results {
  votes: VoteDetail[];
  totalVotes: number;
  numericVoteCount: number;
  distribution: Record<string, number>;
  specialCounts: Record<string, number>;
  average: number | null;
  averageLabel: number | string | null;
  median: number | string | null;
  min: number | string | null;
  max: number | string | null;
  consensus: boolean;
  agreementPct: number;
  suggestedEstimate: string | null;
}

export interface CreateRoomResponse {
  room: Room;
  user: User;
}

export interface JoinRoomResponse {
  room: Room;
  user: User;
}

// Payload sent to POST /api/rooms.
export interface CreateRoomBody {
  roomName: string;
  adminName: string;
  adminCorporateId?: string;
  team?: string;
  config: SessionConfig;
}

export interface StoryInput {
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  priority?: Priority;
  jiraId?: string;
}

// Persisted (in sessionStorage) identity so a refresh keeps you in the room.
export interface Session {
  roomId: string;
  user: User;
}

// Locally saved default session settings (localStorage).
export interface SavedDefaults {
  deckType: DeckType;
  adminVotes: boolean;
  shareVelocity: boolean;
  effortPointing: boolean;
  autoReveal: boolean;
  allowChangeAfterReveal: boolean;
  autoCalculate: boolean;
  enableTimer: boolean;
  team: string;
  adminCorporateId: string;
}

export function defaultConfig(): SessionConfig {
  return {
    projectName: '',
    sprintName: '',
    deckType: 'fibonacci',
    adminVotes: false,
    velocity: null,
    shareVelocity: true,
    effortPointing: true,
    autoReveal: false,
    allowChangeAfterReveal: false,
    autoCalculate: true,
    enableTimer: true,
  };
}
