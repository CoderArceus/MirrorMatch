/**
 * Seque Server - Entry Point
 * Proper PvP Server MVP
 */

import { createServer } from './server.js';
import { log } from './logger.js';

const PORT = parseInt(process.env.PORT || '8080', 10);

// Start server
const server = createServer(PORT);

console.log(`Seque PvP Server running on port ${PORT}`);

// Graceful shutdown
process.on('SIGINT', () => {
  log('room_created', { event: 'server_shutdown', reason: 'SIGINT' });
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  log('room_created', { event: 'server_shutdown', reason: 'SIGTERM' });
  server.close(() => {
    console.log('Server shut down gracefully');
    process.exit(0);
  });
});
