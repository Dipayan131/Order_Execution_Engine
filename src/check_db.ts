import "reflect-metadata";
import { AppDataSource } from "./config/database";

const check = async () => {
  try {
    await AppDataSource.initialize();
    console.log("Database connected successfully");
    await AppDataSource.destroy();
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1);
  }
};

check();
