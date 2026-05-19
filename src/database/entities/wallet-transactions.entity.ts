import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Wallets } from "./wallets.entity";

@Index("wallet_transactions_pkey", ["id"], { unique: true })
@Entity("wallet_transactions", { schema: "SEP490_G57" })
export class WalletTransactions {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("numeric", { name: "amount", precision: 15, scale: 2 })
  amount: string;

  @Column("character varying", { name: "transaction_type", length: 50 })
  transactionType: string;

  @Column("character varying", {
    name: "payment_method",
    nullable: true,
    length: 50,
  })
  paymentMethod: string | null;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("character varying", {
    name: "reference_code",
    nullable: true,
    length: 100,
  })
  referenceCode: string | null;

  @Column("character varying", { name: "status", nullable: true, length: 50 })
  status: string | null;

  @Column("timestamp without time zone", {
    name: "created_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  createdAt: Date | null;

  @Column("character varying", {
    name: "created_by",
    nullable: true,
    length: 255,
  })
  createdBy: string | null;

  @Column("timestamp without time zone", {
    name: "last_modified_at",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  lastModifiedAt: Date | null;

  @Column("character varying", {
    name: "last_modified_by",
    nullable: true,
    length: 255,
  })
  lastModifiedBy: string | null;

  @Column("timestamp without time zone", { name: "deleted_at", nullable: true })
  deletedAt: Date | null;

  @ManyToOne(() => Wallets, (wallets) => wallets.walletTransactions, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "wallet_id", referencedColumnName: "id" }])
  wallet: Wallets;
}
