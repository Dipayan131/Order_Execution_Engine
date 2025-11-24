# Order Execution Engine

A backend Order Execution Engine built with Node.js, Fastify, BullMQ, Redis, and PostgreSQL. This system processes Market Orders with a Mock DEX Router (simulating Raydium and Meteora) and provides real-time status updates via WebSockets.

## Features

- **Market Order Execution**: Immediate execution at the best available price.
- **Mock DEX Routing**: Simulates fetching quotes from Raydium and Meteora, selecting the best venue based on price.
- **Queue System**: Uses BullMQ and Redis to handle concurrent orders with exponential backoff retries.
- **Real-time Updates**: WebSockets stream order status changes (Pending -> Routing -> Building -> Submitted -> Confirmed).
- **Persistence**: PostgreSQL stores order history and status.

## Design Decisions

### Why Market Order?
I chose **Market Order** because it is the fundamental building block of any trading system. It requires immediate execution logic, which allows focusing on the core architecture of routing and status streaming without the complexity of an order book or price monitoring service needed for Limit/Sniper orders.

### Extensibility
To support **Limit Orders**, we would add a "Price Monitor" service that watches market prices and triggers the execution queue when the target price is hit. For **Sniper Orders**, we would add a "Liquidity Monitor" to trigger execution upon token launch or liquidity addition.

## Setup Instructions

### Prerequisites
- Node.js (v18+)
- Docker (for PostgreSQL and Redis)

### Installation

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create a `.env` file (see `.env.example` or use default):
    ```env
    PORT=3000
    DB_HOST=localhost
    DB_PORT=5432
    DB_USERNAME=postgres
    DB_PASSWORD=postgres
    DB_NAME=order_execution_engine
    REDIS_HOST=localhost
    REDIS_PORT=6379
    ```

### Running Locally

1.  Start Database and Redis:
    ```bash
    docker run --name order-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=order_execution_engine -p 5432:5432 -d postgres
    docker run --name order-redis -p 6379:6379 -d redis
    ```
2.  Start the server:
    ```bash
    npm start
    ```
    The server will start on `http://localhost:3000`.

### Testing

Run integration tests:
```bash
npm test
```

## API Documentation

### Execute Order
**POST** `/api/orders/execute`

Body:
```json
{
  "side": "buy",
  "amount": 10,
  "inputToken": "SOL",
  "outputToken": "USDC"
}
```

Response:
```json
{
  "success": true,
  "orderId": "uuid",
  "status": "pending",
  "message": "Order queued successfully"
}
```

### WebSocket Status
**WS** `/api/orders/:orderId/ws`

Connect to receive updates. Messages format:
```json
{
  "orderId": "uuid",
  "status": "routing", // routing, building, submitted, confirmed, failed
  "venue": "Raydium", // if applicable
  "price": 105.5,     // if applicable
  "txHash": "0x..."   // on confirmation
}
```

## Deployment
Public URL: [Insert Public URL Here]
