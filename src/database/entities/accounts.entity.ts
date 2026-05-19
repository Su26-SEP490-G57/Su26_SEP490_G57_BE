import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Users } from "./users.entity"; 

@Index("accounts_email_key", ["email"], { unique: true })
@Index("accounts_firebase_uid_key", ["firebaseUid"], { unique: true })
@Index("accounts_pkey", ["id"], { unique: true })
@Entity("accounts", { schema: "SEP490_G57" })
export class Accounts {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("character varying", {
    name: "firebase_uid",
    nullable: true,
    unique: true,
    length: 255,
  })
  firebaseUid: string | null;

  @Column("character varying", { name: "email", unique: true, length: 255 })
  email: string;

  @Column("character varying", {
    name: "phone_number",
    nullable: true,
    length: 50,
  })
  phoneNumber: string | null;

  @Column("character varying", { name: "role", nullable: true, length: 50 })
  role: string | null;

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

  // Sửa thành quan hệ 1:1 chuẩn dựa trên cột user_id trong bảng accounts
  @OneToOne(() => Users, (user) => user.account, { onDelete: "SET NULL" })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Users;
}
