import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

export enum OrderType {
  MARKET = "MARKET",
  LIMIT = "LIMIT",
  SNIPER = "SNIPER",
}

export enum OrderStatus {
  PENDING = "pending",
  ROUTING = "routing",
  BUILDING = "building",
  SUBMITTED = "submitted",
  CONFIRMED = "confirmed",
  FAILED = "failed",
}

export enum OrderSide {
  BUY = "buy",
  SELL = "sell",
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({
    type: "enum",
    enum: OrderType,
    default: OrderType.MARKET,
  })
  type!: OrderType;

  @Column({
    type: "enum",
    enum: OrderSide,
  })
  side!: OrderSide;

  @Column("decimal", { precision: 20, scale: 9 })
  amount!: number; // Amount of token to swap

  @Column({ nullable: true })
  inputToken!: string; // Mint address

  @Column({ nullable: true })
  outputToken!: string; // Mint address

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status!: OrderStatus;

  @Column({ nullable: true })
  txHash?: string;

  @Column({ nullable: true })
  executionPrice?: string;

  @Column({ nullable: true })
  venue?: string; // Raydium or Meteora

  @Column({ nullable: true })
  error?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
