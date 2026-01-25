/**
 * WebSocket Client - Singleton for multiplayer connection
 * Handles connect, disconnect, send, reconnect with automatic retry
 */

import type { ClientMessage, ServerMessage, ConnectionState } from './types';

// ============================================================================
// Types
// ============================================================================

type MessageHandler = (message: ServerMessage) => void;
type ConnectionHandler = (state: ConnectionState) => void;

interface ReconnectInfo {
  roomCode: string;
  playerId: string;
}

// ============================================================================
// WebSocket Client Singleton
// ============================================================================

class WSClient {
  private socket: WebSocket | null = null;
  private url: string = '';
  private state: ConnectionState = 'disconnected';
  
  // Handlers
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  
  // Reconnect
  private reconnectInfo: ReconnectInfo | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  // ══════════════════════════════════════════════════════════════════════════
  // Connection Management
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Connect to WebSocket server
   */
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }
      
      this.url = url;
      this.setState('connecting');
      
      try {
        this.socket = new WebSocket(url);
        
        this.socket.onopen = () => {
          console.log('[WS] Connected to', url);
          this.setState('connected');
          this.reconnectAttempts = 0;
          
          // If we have reconnect info, send RECONNECT message
          if (this.reconnectInfo) {
            this.send({
              type: 'RECONNECT',
              roomCode: this.reconnectInfo.roomCode,
              playerId: this.reconnectInfo.playerId,
            });
          }
          
          resolve();
        };
        
        this.socket.onclose = (event) => {
          console.log('[WS] Disconnected:', event.code, event.reason);
          this.setState('disconnected');
          
          // Attempt reconnect if we were in a game
          if (this.reconnectInfo && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          console.error('[WS] Error:', error);
          if (this.state === 'connecting') {
            reject(new Error('Failed to connect to server'));
          }
        };
        
        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ServerMessage;
            console.log('[WS] Received:', message.type, message);
            this.notifyMessageHandlers(message);
          } catch (err) {
            console.error('[WS] Failed to parse message:', err);
          }
        };
        
      } catch (err) {
        this.setState('disconnected');
        reject(err);
      }
    });
  }
  
  /**
   * Disconnect from server
   */
  disconnect(): void {
    this.clearReconnectTimer();
    this.reconnectInfo = null;
    this.reconnectAttempts = 0;
    
    if (this.socket) {
      this.socket.onclose = null; // Prevent reconnect attempt
      this.socket.close();
      this.socket = null;
    }
    
    this.setState('disconnected');
  }
  
  /**
   * Send message to server
   */
  send(message: ClientMessage): void {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[WS] Cannot send - not connected:', message.type);
      return;
    }
    
    console.log('[WS] Sending:', message.type, message);
    this.socket.send(JSON.stringify(message));
  }
  
  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Reconnect Management
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Store reconnect info for automatic reconnection
   */
  setReconnectInfo(roomCode: string, playerId: string): void {
    this.reconnectInfo = { roomCode, playerId };
  }
  
  /**
   * Clear reconnect info (e.g., when leaving a room)
   */
  clearReconnectInfo(): void {
    this.reconnectInfo = null;
    this.reconnectAttempts = 0;
  }
  
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    console.log(`[WS] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts++;
      this.connect(this.url).catch((err) => {
        console.error('[WS] Reconnect failed:', err);
      });
    }, delay);
  }
  
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  // ══════════════════════════════════════════════════════════════════════════
  // Event Handlers
  // ══════════════════════════════════════════════════════════════════════════
  
  /**
   * Subscribe to incoming messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }
  
  /**
   * Subscribe to connection state changes
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    // Immediately notify of current state
    handler(this.state);
    return () => this.connectionHandlers.delete(handler);
  }
  
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.connectionHandlers.forEach(handler => handler(state));
    }
  }
  
  private notifyMessageHandlers(message: ServerMessage): void {
    this.messageHandlers.forEach(handler => handler(message));
  }
}

// Export singleton instance
export const wsClient = new WSClient();

// Export default server URL (can be overridden via environment variable)
// In production, VITE_WS_URL should point to the Railway-hosted server
// In development, falls back to localhost:8080
export const DEFAULT_WS_URL = 
  import.meta.env.VITE_WS_URL || 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? `ws://${window.location.hostname}:8080`
    : `wss://${window.location.hostname}:8080`);
