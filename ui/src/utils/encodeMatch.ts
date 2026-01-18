/**
 * Match Encoding/Decoding for Async PvP
 * Encodes game state as URL-safe base64 for sharing
 */

import type { TurnActions } from '../../../engine/src';

/**
 * Match state for async PvP
 * Contains only seed and actions - state is reconstructed via replay
 */
export interface EncodedMatch {
  seed: number;
  actions: TurnActions[];
  currentPlayer: 'player1' | 'player2'; // Who should act next
  version: number; // For future compatibility
}

/**
 * Encode match state into URL-safe base64 string
 */
export function encodeMatch(match: EncodedMatch): string {
  const json = JSON.stringify(match);
  const base64 = btoa(json);
  // Make URL-safe: replace + with - and / with _
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Decode URL-safe base64 string back to match state
 * Returns null if invalid
 */
export function decodeMatch(encoded: string): EncodedMatch | null {
  try {
    // Restore standard base64: - to +, _ to /
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
    const json = atob(padded);
    const match = JSON.parse(json) as EncodedMatch;
    
    // Validate structure
    if (typeof match.seed !== 'number' || !Array.isArray(match.actions)) {
      return null;
    }
    
    return match;
  } catch {
    return null;
  }
}

/**
 * Create shareable URL for current match state
 */
export function createShareableURL(match: EncodedMatch): string {
  const encoded = encodeMatch(match);
  const baseURL = window.location.origin + window.location.pathname;
  return `${baseURL}?match=${encoded}`;
}

/**
 * Extract match from current URL
 * Returns null if no match in URL
 */
export function getMatchFromURL(): EncodedMatch | null {
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('match');
  
  if (!encoded) {
    return null;
  }
  
  return decodeMatch(encoded);
}
