import "reflect-metadata";
import { buildApp } from "./app";
import { initializeDatabase } from "./config/database";
import dotenv from "dotenv";

dotenv.config();

const start = async () => {
  try {
    // Initialize Database
    await initializeDatabase();

    const app = await buildApp();
    const port = parseInt(process.env.PORT || "3000");

    await app.listen({ port, host: "0.0.0.0" });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
