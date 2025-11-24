import { FastifyInstance } from "fastify";
import { OrderController } from "../controllers/OrderController";
// import { SocketStream } from "@fastify/websocket";

// Map to store active websocket connections: orderId -> Set<SocketStream>
export const activeConnections = new Map<string, Set<any>>();

export async function orderRoutes(fastify: FastifyInstance) {
  
  // HTTP POST /execute
  fastify.post("/execute", OrderController.execute);

  // WebSocket /:orderId/ws
  fastify.get("/:orderId/ws", { websocket: true }, (connection: any, req: any) => {
    const { orderId } = req.params as { orderId: string };
    
    console.log(`[WebSocket] Client connected for order ${orderId}`);
    console.log("Connection keys:", Object.keys(connection));
    console.log("Connection socket:", connection.socket);

    if (!activeConnections.has(orderId)) {
      activeConnections.set(orderId, new Set());
    }
    activeConnections.get(orderId)!.add(connection);

    // Send initial confirmation
    connection.send(JSON.stringify({ type: "connection_ack", orderId }));

    connection.on("close", () => {
      console.log(`[WebSocket] Client disconnected for order ${orderId}`);
      const connections = activeConnections.get(orderId);
      if (connections) {
        connections.delete(connection);
        if (connections.size === 0) {
          activeConnections.delete(orderId);
        }
      }
    });
  });
}
