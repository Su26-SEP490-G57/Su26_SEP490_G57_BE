import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { WalletTransactions } from "./wallet-transactions.entity";
import { Users } from "./users.entity";

@Index("wallets_pkey", ["id"], { unique: true })
@Entity("wallets", { schema: "SEP490_G57" })
export class Wallets {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("numeric", {
    name: "balance",
    nullable: true,
    precision: 15,
    scale: 2,
    default: () => "0.00",
  })
  balance: string | null;

  @Column("character varying", {
    name: "currency",
    nullable: true,
    length: 10,
    default: () => "'VND'",
  })
  currency: string | null;

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

  @OneToMany(
    () => WalletTransactions,
    (walletTransactions) => walletTransactions.wallet
  )
  walletTransactions: WalletTransactions[];

  @ManyToOne(() => Users, (users) => users.wallets, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;
}
