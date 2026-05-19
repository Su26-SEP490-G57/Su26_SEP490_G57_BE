import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Bookings } from "./bookings.entity";

@Index("booking_seats_pkey", ["id"], { unique: true })
@Entity("booking_seats", { schema: "SEP490_G57" })
export class BookingSeats {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "seat_code", length: 50 })
  seatCode: string;

  @Column("numeric", { name: "seat_price", precision: 15, scale: 2 })
  seatPrice: string;

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

  @ManyToOne(() => Bookings, (bookings) => bookings.bookingSeats, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "booking_id", referencedColumnName: "id" }])
  booking: Bookings;
}
