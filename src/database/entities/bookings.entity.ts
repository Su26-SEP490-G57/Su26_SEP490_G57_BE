import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BookingSeats } from "./bookingSeats.entity";
import { Users } from "./users.entity";
import { Trips } from "./trips.entity";

@Index("bookings_pkey", ["id"], { unique: true })
@Entity("bookings", { schema: "SEP490_G57" })
export class Bookings {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("text", { name: "note", nullable: true })
  note: string | null;

  @Column("character varying", {
    name: "payment_method",
    nullable: true,
    length: 50,
  })
  paymentMethod: string | null;

  @Column("numeric", { name: "total_price", precision: 15, scale: 2 })
  totalPrice: string;

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

  @OneToMany(() => BookingSeats, (bookingSeats) => bookingSeats.booking)
  bookingSeats: BookingSeats[];

  @ManyToOne(() => Users, (users) => users.bookings, { onDelete: "RESTRICT" })
  @JoinColumn([{ name: "passenger_id", referencedColumnName: "id" }])
  passenger: Users;

  @ManyToOne(() => Trips, (trips) => trips.bookings, { onDelete: "RESTRICT" })
  @JoinColumn([{ name: "trip_id", referencedColumnName: "id" }])
  trip: Trips;
}
