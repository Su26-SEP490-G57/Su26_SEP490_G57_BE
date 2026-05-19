import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { VehicleTypes } from "./vehicle-types.entity";

@Index("seat_templates_pkey", ["id"], { unique: true })
@Entity("seat_templates", { schema: "SEP490_G57" })
export class SeatTemplates {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", { name: "seat_code", length: 50 })
  seatCode: string;

  @Column("integer", { name: "position_x", nullable: true })
  positionX: number | null;

  @Column("integer", { name: "position_y", nullable: true })
  positionY: number | null;

  @Column("boolean", {
    name: "is_driver_seat",
    nullable: true,
    default: () => "false",
  })
  isDriverSeat: boolean | null;

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

  @ManyToOne(() => VehicleTypes, (vehicleTypes) => vehicleTypes.seatTemplates, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "vehicle_type_id", referencedColumnName: "id" }])
  vehicleType: VehicleTypes;
}
