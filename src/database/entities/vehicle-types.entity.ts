import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { SeatTemplates } from "./seat-templates.entity";
import { Vehicles } from "./vehicles.entity";

@Index("vehicle_types_pkey", ["id"], { unique: true })
@Entity("vehicle_types", { schema: "SEP490_G57" })
export class VehicleTypes {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "name", length: 255 })
  name: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("integer", { name: "total_seat" })
  totalSeat: number;

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

  @OneToMany(() => SeatTemplates, (seatTemplates) => seatTemplates.vehicleType)
  seatTemplates: SeatTemplates[];

  @OneToMany(() => Vehicles, (vehicles) => vehicles.type)
  vehicles: Vehicles[];
}
