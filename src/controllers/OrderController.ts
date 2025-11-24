import { FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { AppDataSource } from "../config/database";
import { Order, OrderType, OrderSide, OrderStatus } from "../models/Order";
import { orderQueue } from "../services/OrderQueue";

const executeOrderSchema = z.object({
  orderId: z.string().uuid().optional(), // Optional: for testing with pre-connected WebSocket
  type: z.nativeEnum(OrderType).optional(), // Default Market
  side: z.nativeEnum(OrderSide),
  amount: z.number().positive(),
  inputToken: z.string(),
  outputToken: z.string(),
});

export class OrderController {
  static async execute(req: FastifyRequest, reply: FastifyReply) {
    try {
      const body = executeOrderSchema.parse(req.body);

      const orderRepo = AppDataSource.getRepository(Order);
      
      const order = new Order();
      // Allow custom orderId for testing (e.g., pre-connected WebSocket)
      if (body.orderId) {
        order.id = body.orderId;
      }
      order.type = body.type || OrderType.MARKET;
      order.side = body.side;
      order.amount = body.amount;
      order.inputToken = body.inputToken;
      order.outputToken = body.outputToken;
      order.status = OrderStatus.PENDING;

      await orderRepo.save(order);

      // Add to Queue
      await orderQueue.add("execute-order", { orderId: order.id }, {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      });

      return reply.code(201).send({
        success: true,
        orderId: order.id,
        status: order.status,
        message: "Order queued successfully",
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: "Validation Error", details: error.issues });
      }
      console.error("Error executing order:", error);
      return reply.code(500).send({ error: "Internal Server Error" });
    }
  }
}
