import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiseaseDto } from '../dtos/query-disease.dto';
import { Disease } from '../entities/disease.entity';

const DEFAULT_LIMIT = 20;

/** Cùng cách chuẩn hoá với cột search_text (xem migration CreateDiseasesTable). */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

@Injectable()
export class DiseaseService {
  constructor(@InjectRepository(Disease) private readonly diseaseRepo: Repository<Disease>) {}

  /**
   * Tìm theo mã hoặc tên (không phân biệt dấu). Mỗi từ khoá phải xuất hiện;
   * mã khớp tiền tố được xếp trước, sau đó theo thứ tự mã.
   */
  async search(search?: string, limit = DEFAULT_LIMIT): Promise<DiseaseDto[]> {
    const qb = this.diseaseRepo.createQueryBuilder('d').select(['d.code', 'd.name']).limit(limit);

    const terms = normalize(search ?? '')
      .split(/\s+/)
      .filter(Boolean);
    terms.forEach((term, i) => {
      qb.andWhere(`d.searchText LIKE :t${i}`, { [`t${i}`]: `%${escapeLike(term)}%` });
    });

    if (search?.trim()) {
      qb.orderBy('CASE WHEN LOWER(d.code) LIKE :prefix THEN 0 ELSE 1 END', 'ASC').setParameter(
        'prefix',
        `${escapeLike(search.trim().toLowerCase())}%`,
      );
      qb.addOrderBy('d.code', 'ASC');
    } else {
      qb.orderBy('d.code', 'ASC');
    }

    const rows = await qb.getMany();
    return rows.map(({ code, name }) => ({ code, name }));
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
