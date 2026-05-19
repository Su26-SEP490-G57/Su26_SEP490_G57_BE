import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Trips } from "./trips.entity";
import { DriverProfiles } from "./driver-profiles.entity";
import { VehicleTypes } from "./vehicle-types.entity";

@Index("vehicles_pkey", ["id"], { unique: true })
@Entity("vehicles", { schema: "SEP490_G57" })
export class Vehicles {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "plate_number", length: 50 })
  plateNumber: string;

  @Column("character varying", { name: "model", nullable: true, length: 255 })
  model: string | null;

  @Column("character varying", { name: "color", nullable: true, length: 50 })
  color: string | null;

  @Column("text", { name: "image", nullable: true })
  image: string | null;

  @Column("boolean", {
    name: "is_active",
    nullable: true,
    default: () => "true",
  })
  isActive: boolean | null;

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

  @OneToMany(() => Trips, (trips) => trips.vehicle)
  trips: Trips[];

  @ManyToOne(
    () => DriverProfiles,
    (driverProfiles) => driverProfiles.vehicles,
    { onDelete: "SET NULL" }
  )
  @JoinColumn([{ name: "driver_id", referencedColumnName: "id" }])
  driver: DriverProfiles;

  @ManyToOne(() => VehicleTypes, (vehicleTypes) => vehicleTypes.vehicles, {
    onDelete: "RESTRICT",
  })
  @JoinColumn([{ name: "type_id", referencedColumnName: "id" }])
  type: VehicleTypes;
}
