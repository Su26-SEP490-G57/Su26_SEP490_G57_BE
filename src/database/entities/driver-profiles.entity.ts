import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Users } from "./users.entity";
import { Trips } from "./trips.entity";
import { Vehicles } from "./vehicles.entity";

@Index("driver_profiles_pkey", ["id"], { unique: true })
@Entity("driver_profiles", { schema: "SEP490_G57" })
export class DriverProfiles {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "national_id_card", length: 50 })
  nationalIdCard: string;

  @Column("numeric", {
    name: "rating_score",
    nullable: true,
    precision: 3,
    scale: 2,
    default: () => "5.00",
  })
  ratingScore: string | null;

  @Column("integer", {
    name: "total_trips",
    nullable: true,
    default: () => "0",
  })
  totalTrips: number | null;

  @Column("character varying", {
    name: "license_number",
    nullable: true,
    length: 50,
  })
  licenseNumber: string | null;

  @Column("boolean", {
    name: "is_verified",
    nullable: true,
    default: () => "false",
  })
  isVerified: boolean | null;

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

  @ManyToOne(() => Users, (users) => users.driverProfiles, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;

  @OneToMany(() => Trips, (trips) => trips.driverProfile)
  trips: Trips[];

  @OneToMany(() => Vehicles, (vehicles) => vehicles.driver)
  vehicles: Vehicles[];
}
