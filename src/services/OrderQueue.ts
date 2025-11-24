import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import { AppDataSource } from "../config/database";
import { Order, OrderStatus } from "../models/Order";
import { DexRouter } from "./DexRouter";
import dotenv from "dotenv";

dotenv.config();

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

export const orderQueue = new Queue("order-execution", { connection });

const dexRouter = new DexRouter();

// Placeholder for WebSocket broadcasting function
let broadcastStatus: (orderId: string, status: OrderStatus, data?: any) => void = () => {};

export const setBroadcastCallback = (fn: (orderId: string, status: OrderStatus, data?: any) => void) => {
  broadcastStatus = fn;
};

const processOrder = async (job: Job) => {
  const { orderId } = job.data;
  const orderRepo = AppDataSource.getRepository(Order);

  console.log(`[OrderQueue] Processing order ${orderId}`);

  try {
    const order = await orderRepo.findOneBy({ id: orderId });
    if (!order) {
      throw new Error("Order not found");
    }

    // 1. Routing
    order.status = OrderStatus.ROUTING;
    await orderRepo.save(order);
    broadcastStatus(orderId, OrderStatus.ROUTING);
    
    // Simulate routing delay and logic
    const quote = await dexRouter.getBestQuote(order.inputToken!, order.outputToken!, order.amount);
    
    order.venue = quote.venue;
    order.executionPrice = quote.price.toString();
    await orderRepo.save(order);

    // 2. Building Transaction
    order.status = OrderStatus.BUILDING;
    await orderRepo.save(order);
    broadcastStatus(orderId, OrderStatus.BUILDING, { venue: quote.venue, price: quote.price });
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate build time

    // 3. Submitted
    order.status = OrderStatus.SUBMITTED;
    await orderRepo.save(order);
    broadcastStatus(orderId, OrderStatus.SUBMITTED);
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network time

    // 4. Confirmed
    order.status = OrderStatus.CONFIRMED;
    order.txHash = "5x" + Math.random().toString(36).substring(7); // Mock Hash
    await orderRepo.save(order);
    broadcastStatus(orderId, OrderStatus.CONFIRMED, { txHash: order.txHash });

    console.log(`[OrderQueue] Order ${orderId} completed via ${quote.venue}`);

  } catch (error: any) {
    console.error(`[OrderQueue] Order ${orderId} failed:`, error);
    
    const order = await orderRepo.findOneBy({ id: orderId });
    if (order) {
        order.status = OrderStatus.FAILED;
        order.error = error.message;
        await orderRepo.save(order);
        broadcastStatus(orderId, OrderStatus.FAILED, { error: error.message });
    }
    throw error;
  }
};

export const initWorker = () => {
  const worker = new Worker("order-execution", processOrder, { 
    connection,
    concurrency: 10, // Requirement: Manage up to 10 concurrent orders
    limiter: {
        max: 100, // Requirement: Process 100 orders/minute
        duration: 60000
    }
  });

  worker.on("completed", (job) => {
    console.log(`[OrderQueue] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.log(`[OrderQueue] Job ${job?.id} failed: ${err.message}`);
  });
  
  console.log("[OrderQueue] Worker initialized");
  return worker;
};
