import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Accounts } from "./accounts.entity";
import { Bookings } from "./bookings.entity";
import { DriverProfiles } from "./driver-profiles.entity";
import { Wallets } from "./wallets.entity";

@Index("users_pkey", ["id"], { unique: true })
@Entity("users", { schema: "SEP490_G57" })
export class Users {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "full_name", length: 255 })
  fullName: string;

  @Column("text", { name: "avatar", nullable: true })
  avatar: string | null;

  @Column("character varying", { name: "gender", nullable: true, length: 20 })
  gender: string | null;

  @Column("date", { name: "date_of_birth", nullable: true })
  dateOfBirth: string | null;

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

  @OneToMany(() => Accounts, (accounts) => accounts.user)
  accounts: Accounts[];

  @OneToMany(() => Bookings, (bookings) => bookings.passenger)
  bookings: Bookings[];

  @OneToMany(() => DriverProfiles, (driverProfiles) => driverProfiles.user)
  driverProfiles: DriverProfiles[];

  @OneToOne(() => Accounts, (accounts) => accounts.user, {
    onDelete: "SET NULL",
  })
  @JoinColumn([{ name: "account_id", referencedColumnName: "id" }])
  account: Accounts;

  @OneToMany(() => Wallets, (wallets) => wallets.user)
  wallets: Wallets[];
}
