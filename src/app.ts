import fastify from "fastify";
import websocket from "@fastify/websocket";
import { orderRoutes, activeConnections } from "./routes/orderRoutes";
import { setBroadcastCallback, initWorker } from "./services/OrderQueue";
import { OrderStatus } from "./models/Order";

export const buildApp = async () => {
  const app = fastify({ logger: true });

  // Register WebSocket support
  await app.register(websocket);

  // Register Routes
  await app.register(orderRoutes, { prefix: "/api/orders" });

  // Setup Broadcast Callback
  setBroadcastCallback((orderId: string, status: OrderStatus, data?: any) => {
    console.log(`[Broadcast] Attempting to broadcast status ${status} for order ${orderId}`);
    const connections = activeConnections.get(orderId);
    if (connections) {
      console.log(`[Broadcast] Found ${connections.size} active connection(s) for order ${orderId}`);
      const message = JSON.stringify({ orderId, status, ...data });
      for (const connection of connections) {
        connection.send(message);
        console.log(`[Broadcast] Sent message to connection:`, message);
      }
    } else {
      console.log(`[Broadcast] No active connections found for order ${orderId}`);
    }
  });

  // Initialize Worker
  initWorker();

  return app;
};
