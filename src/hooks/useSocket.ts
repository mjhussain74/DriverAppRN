import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getBaseUrl } from '../services/api';

export type SocketEvent =
  | { type: 'route-dispatched'; route: import('../types').Route }
  | { type: 'stop-completed'; routeId: number; stopId: number }
  | { type: 'route-completed'; routeId: number }
  | { type: 'location-update'; driverId: number; lat: number; lng: number };

type EventHandler = (event: SocketEvent) => void;

export function useSocket(driverId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const handlers = useRef<Set<EventHandler>>(new Set());

  useEffect(() => {
    if (!driverId) return;

    let socket: Socket;

    getBaseUrl().then((base) => {
      if (!base) return;

      socket = io(base, {
        transports: ['websocket'],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        socket.emit('driver-connect', { driverId });
      });

      socket.on('disconnect', () => setConnected(false));

      const forward = (type: string) => (data: unknown) => {
        const event = { type, ...(data as object) } as SocketEvent;
        handlers.current.forEach((h) => h(event));
      };

      socket.on('route-dispatched', forward('route-dispatched'));
      socket.on('stop-completed', forward('stop-completed'));
      socket.on('route-completed', forward('route-completed'));
      socket.on('location-update', forward('location-update'));
    });

    return () => {
      socket?.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [driverId]);

  function addHandler(fn: EventHandler) {
    handlers.current.add(fn);
    return () => handlers.current.delete(fn);
  }

  function emit(event: string, data?: unknown) {
    socketRef.current?.emit(event, data);
  }

  return { connected, addHandler, emit, socket: socketRef.current };
}
