/**
 * Seque Server - Structured Logging
 * All events logged as JSON
 */

export type LogEvent =
  | 'room_created'
  | 'room_joined'
  | 'room_expired'
  | 'player_ready'
  | 'game_started'
  | 'action_received'
  | 'action_rejected'
  | 'turn_timeout'
  | 'turn_resolved'
  | 'disconnect'
  | 'reconnect'
  | 'game_ended'
  | 'error';

interface LogEntry {
  timestamp: string;
  event: LogEvent;
  roomCode?: string;
  playerId?: string;
  data?: Record<string, unknown>;
}

export function log(event: LogEvent, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export function logError(message: string, error?: unknown, data?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    event: 'error',
    data: {
      message,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...data,
    },
  };
  console.error(JSON.stringify(entry));
}
