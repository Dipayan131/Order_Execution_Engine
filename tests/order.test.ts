import request from "supertest";
import WebSocket from "ws";
import { buildApp } from "../src/app";
import { AppDataSource } from "../src/config/database";
import { OrderStatus } from "../src/models/Order";

let app: any;
let server: any;
const PORT = 3001;

beforeAll(async () => {
  await AppDataSource.initialize();
  app = await buildApp();
  await app.listen({ port: PORT, host: "0.0.0.0" });
  server = app.server;
});

afterAll(async () => {
  await app.close();
  await AppDataSource.destroy();
});

describe("Order Execution Engine", () => {
  it("should execute an order and stream updates via WebSocket", async () => {
    // 1. Submit Order
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "buy",
        amount: 10,
        inputToken: "SOL",
        outputToken: "USDC",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    const orderId = response.body.orderId;
    expect(orderId).toBeDefined();

    // 2. Connect to WebSocket
    const ws: any = new WebSocket(`ws://localhost:${PORT}/api/orders/${orderId}/ws`);

    const statuses: string[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => {
        console.log("WS Connected");
      });

      ws.on("message", (data: any) => {
        const message = JSON.parse(data.toString());
        console.log("WS Message:", message);
        
        if (message.status) {
            statuses.push(message.status);
        }

        if (message.status === OrderStatus.CONFIRMED || message.status === OrderStatus.FAILED) {
          ws.close();
          resolve();
        }
      });

      ws.on("error", (err: Error) => {
        reject(err);
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
          ws.close();
          reject(new Error("Timeout waiting for completion"));
      }, 10000);
    });

    // 3. Verify Status Updates
    expect(statuses).toContain(OrderStatus.ROUTING);
    expect(statuses).toContain(OrderStatus.BUILDING);
    expect(statuses).toContain(OrderStatus.SUBMITTED);
    expect(statuses).toContain(OrderStatus.CONFIRMED);
  }, 15000);
  it("should fail validation if inputToken is missing", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "buy",
        amount: 10,
        outputToken: "USDC",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("should fail validation if amount is negative", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "buy",
        amount: -10,
        inputToken: "SOL",
        outputToken: "USDC",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("should fail validation if side is invalid", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "invalid_side",
        amount: 10,
        inputToken: "SOL",
        outputToken: "USDC",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("should fail validation if type is invalid", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        type: "INVALID_TYPE",
        side: "buy",
        amount: 10,
        inputToken: "SOL",
        outputToken: "USDC",
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("Validation Error");
  });

  it("should handle multiple concurrent orders correctly", async () => {
    const orders = Array(5).fill(null).map(() => 
      request(server)
        .post("/api/orders/execute")
        .send({
          side: "sell",
          amount: 5,
          inputToken: "USDC",
          outputToken: "SOL",
        })
    );

    const responses = await Promise.all(orders);
    
    responses.forEach(res => {
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.orderId).toBeDefined();
    });
  });

  it("should persist order in database", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "buy",
        amount: 100,
        inputToken: "BTC",
        outputToken: "USDC",
      });

    const orderId = response.body.orderId;
    const orderRepo = AppDataSource.getRepository("Order"); // Using string name to avoid import cycle if any
    const order = await orderRepo.findOneBy({ id: orderId });

    expect(order).toBeDefined();
    expect(order?.amount).toBe("100.000000000"); // Decimal type returns string
    expect(order?.status).toBe(OrderStatus.PENDING); // Initially pending
  });

  it("should accept websocket connection even for non-existent orderId", async () => {
    // WebSocket connections are accepted for any orderId - the routing just won't send updates
    const ws: any = new WebSocket(`ws://localhost:${PORT}/api/orders/invalid-uuid/ws`);
    
    await new Promise<void>((resolve, reject) => {
        ws.on("message", (data: any) => {
            const msg = JSON.parse(data.toString());
            if (msg.type === "connection_ack") {
                ws.close();
                resolve();
            }
        });
        ws.on("error", (err: Error) => {
             reject(err);
        });
        setTimeout(() => {
            ws.close();
            reject(new Error("No connection ack received"));
        }, 3000);
    });
  });
  
  it("should acknowledge websocket connection", async () => {
      const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "buy",
        amount: 1,
        inputToken: "SOL",
        outputToken: "USDC",
      });
      
      const orderId = response.body.orderId;
      const ws: any = new WebSocket(`ws://localhost:${PORT}/api/orders/${orderId}/ws`);
      
      await new Promise<void>((resolve, reject) => {
          ws.on("message", (data: any) => {
              const msg = JSON.parse(data.toString());
              if (msg.type === "connection_ack" && msg.orderId === orderId) {
                  ws.close();
                  resolve();
              }
          });
          
          setTimeout(() => reject(new Error("No ack received")), 5000);
      });
  });

  it("should support sell orders", async () => {
    const response = await request(server)
      .post("/api/orders/execute")
      .send({
        side: "sell",
        amount: 50,
        inputToken: "ETH",
        outputToken: "USDC",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });

  it("should support limit orders (mock validation as optional)", async () => {
      // Even though we implemented Market, the schema allows optional type.
      // If we pass LIMIT, it should still be accepted by the controller but processed as per logic (or just stored).
      // Our controller defaults to MARKET if not provided, but if provided it stores it.
      const response = await request(server)
      .post("/api/orders/execute")
      .send({
        type: "LIMIT",
        side: "buy",
        amount: 10,
        inputToken: "SOL",
        outputToken: "USDC",
      });

    expect(response.status).toBe(201);
    const orderRepo = AppDataSource.getRepository("Order");
    const order = await orderRepo.findOneBy({ id: response.body.orderId });
    expect(order?.type).toBe("LIMIT");
  });

});
