import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Bookings } from "./bookings.entity";
import { DriverProfiles } from "./driver-profiles.entity";
import { Hubs } from "./hubs.entity";
import { Vehicles } from "./vehicles.entity";

@Index("trips_pkey", ["id"], { unique: true })
@Entity("trips", { schema: "SEP490_G57" })
export class Trips {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "status", nullable: true, length: 50 })
  status: string | null;

  @Column("text", { name: "note", nullable: true })
  note: string | null;

  @Column("timestamp without time zone", { name: "departure_time" })
  departureTime: Date;

  @Column("timestamp without time zone", {
    name: "estimated_arrival_time",
    nullable: true,
  })
  estimatedArrivalTime: Date | null;

  @Column("numeric", { name: "price_per_seat", precision: 15, scale: 2 })
  pricePerSeat: string;

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

  @OneToMany(() => Bookings, (bookings) => bookings.trip)
  bookings: Bookings[];

  @ManyToOne(() => DriverProfiles, (driverProfiles) => driverProfiles.trips, {
    onDelete: "RESTRICT",
  })
  @JoinColumn([{ name: "driver_profile_id", referencedColumnName: "id" }])
  driverProfile: DriverProfiles;

  @ManyToOne(() => Hubs, (hubs) => hubs.trips, { onDelete: "RESTRICT" })
  @JoinColumn([{ name: "end_hub_id", referencedColumnName: "id" }])
  endHub: Hubs;

  @ManyToOne(() => Hubs, (hubs) => hubs.trips2, { onDelete: "RESTRICT" })
  @JoinColumn([{ name: "start_hub_id", referencedColumnName: "id" }])
  startHub: Hubs;

  @ManyToOne(() => Vehicles, (vehicles) => vehicles.trips, {
    onDelete: "RESTRICT",
  })
  @JoinColumn([{ name: "vehicle_id", referencedColumnName: "id" }])
  vehicle: Vehicles;
}
