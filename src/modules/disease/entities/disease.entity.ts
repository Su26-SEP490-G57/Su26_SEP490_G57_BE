import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Danh mục mã bệnh ICD-10 (seed sẵn trong migration CreateDiseasesTable). */
@Entity('diseases')
export class Disease {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  code!: string;

  @Column({ type: 'text' })
  name!: string;

  /** `code name` lowercase, bỏ dấu — chỉ dùng để tìm kiếm, không trả ra API. */
  @Column({ type: 'text', select: false })
  searchText!: string;
}
