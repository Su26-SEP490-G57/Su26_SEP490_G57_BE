import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import pdfmake from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

/** Only the bundled Roboto files may be read from disk (it has Vietnamese glyphs). */
const FONT_DIR = join(dirname(require.resolve('pdfmake/package.json')), 'fonts', 'Roboto');

const DISPLAY_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const CARE_LEVEL_LABELS: Record<string, string> = {
  LEVEL_1: 'Cấp 1',
  LEVEL_2: 'Cấp 2',
  LEVEL_3: 'Cấp 3',
};

/** A "Phiếu theo dõi điều trị" as stored in the HIS. */
export interface TreatmentSheetPdfData {
  sheetNumber: number;
  patientCode: string;
  patientName: string;
  facility: string | null;
  department: string | null;
  diagnosis: string | null;
  comorbidities: string | null;
  age: number | null;
  gender: string | null;
  room: string | null;
  bed: string | null;
  recordedAt: string;
  progressNotes: string;
  orders: string;
  careLevel: string | null;
  doctorName: string | null;
}

/** A "Phiếu theo dõi và chăm sóc" as stored in the HIS, plus its form layout. */
export interface CareSheetPdfData {
  title: string;
  formCode: string;
  legend: string;
  sheetNumber: number;
  patientCode: string;
  patientName: string;
  facility: string | null;
  department: string | null;
  admissionNumber: string | null;
  age: number | null;
  gender: string | null;
  room: string | null;
  bed: string | null;
  diagnosis: string | null;
  hasAllergy: boolean | null;
  allergyNote: string | null;
  recordedAt: string;
  careLevel: string | null;
  nurseName: string | null;
  content: Record<string, string>;
  sections: {
    key: string;
    title: string;
    group: 'observation' | 'diagnosis' | 'intervention';
    fields: { key: string; label: string }[];
  }[];
}

/**
 * Renders HIS sheets as printable A4 PDFs laid out like the paper forms.
 * Server-side so the web and mobile apps download the same document.
 */
@Injectable()
export class SheetPdfService {
  constructor() {
    pdfmake.setFonts({
      Roboto: {
        normal: join(FONT_DIR, 'Roboto-Regular.ttf'),
        bold: join(FONT_DIR, 'Roboto-Medium.ttf'),
        italics: join(FONT_DIR, 'Roboto-Italic.ttf'),
        bolditalics: join(FONT_DIR, 'Roboto-MediumItalic.ttf'),
      },
    });
    // Documents never reference remote or arbitrary local resources.
    pdfmake.setUrlAccessPolicy(() => false);
    (
      pdfmake as unknown as { setLocalAccessPolicy(cb: (path: string) => boolean): void }
    ).setLocalAccessPolicy((path) => path.startsWith(FONT_DIR));
  }

  renderTreatmentSheet(sheet: TreatmentSheetPdfData): Promise<Buffer> {
    const content: Content[] = [
      this.formHeader({
        left: [sheet.facility, sheet.department],
        title: 'PHIẾU THEO DÕI ĐIỀU TRỊ',
        right: [`Tờ số: ${sheet.sheetNumber}`, `Mã người bệnh: ${sheet.patientCode}`],
      }),
      this.infoTable([
        [
          ['Họ và tên', sheet.patientName],
          ['Tuổi', sheet.age],
          ['Giới tính', sheet.gender],
        ],
        [
          ['Phòng', sheet.room],
          ['Giường', sheet.bed],
          ['Mức chăm sóc', this.careLevel(sheet.careLevel)],
        ],
        [['Chẩn đoán', sheet.diagnosis]],
        [['Bệnh kèm theo', sheet.comorbidities]],
      ]),
      {
        margin: [0, 10, 0, 0],
        table: {
          widths: [90, '*', '*'],
          headerRows: 1,
          body: [
            ['Thời gian', 'Diễn biến bệnh', 'Chỉ định'].map((text) => this.headCell(text)),
            [
              { text: this.dateTime(sheet.recordedAt) },
              { text: sheet.progressNotes },
              { text: sheet.orders },
            ],
          ],
        },
      },
      this.signature('Bác sĩ điều trị', sheet.doctorName),
    ];

    return this.render(content, `Phiếu theo dõi điều trị - tờ ${sheet.sheetNumber}`);
  }

  renderCareSheet(sheet: CareSheetPdfData): Promise<Buffer> {
    const value = (sectionKey: string, fieldKey: string) =>
      sheet.content[`${sectionKey}.${fieldKey}`] ?? '';
    const sections = (group: CareSheetPdfData['sections'][number]['group']) =>
      sheet.sections.filter((section) => section.group === group);

    const allergy =
      sheet.hasAllergy === null
        ? ''
        : sheet.hasAllergy
          ? `Có, ghi rõ: ${sheet.allergyNote ?? ''}`
          : 'Chưa ghi nhận';

    // Cell swallowed by a neighbour's rowSpan/colSpan.
    const covered: TableCell = {};

    // nhóm | mục | giá trị — nhóm gộp ô theo số mục. Nhóm chỉ có 1 mục thì tiêu
    // đề nhóm chiếm luôn cột "mục"; mục trùng tên nhóm (vd "Chẩn đoán 1") ghi
    // là "Nội dung" cho khỏi lặp.
    const rows = (group: CareSheetPdfData['sections'][number]['group']): TableCell[][] =>
      sections(group).flatMap((section) =>
        section.fields.map((field, index): TableCell[] => {
          const single = section.fields.length === 1;
          const groupCell: TableCell =
            index > 0
              ? covered
              : single
                ? { text: section.title, bold: true, colSpan: 2 }
                : { text: section.title, bold: true, rowSpan: section.fields.length };
          const labelCell: TableCell = single
            ? covered
            : { text: field.label === section.title ? 'Nội dung' : field.label };
          return [groupCell, labelCell, { text: value(section.key, field.key) }];
        }),
      );

    const threeColumnTable = (title: string, rows: TableCell[][]): Content => ({
      margin: [0, 10, 0, 0],
      table: {
        widths: [95, 120, '*'],
        headerRows: 1,
        dontBreakRows: true,
        body: [
          [
            { text: title, bold: true, alignment: 'center', fillColor: '#eeeeee', colSpan: 3 },
            covered,
            covered,
          ],
          ...rows,
        ],
      },
    });

    const content: Content[] = [
      this.formHeader({
        left: [sheet.facility, sheet.department],
        title: sheet.title.toUpperCase(),
        right: [
          `MS: ${sheet.formCode}`,
          `Số vào viện: ${sheet.admissionNumber ?? ''}`,
          `Mã người bệnh: ${sheet.patientCode}`,
          `Tờ số: ${sheet.sheetNumber}`,
        ],
      }),
      this.infoTable([
        [
          ['Họ và tên người bệnh', sheet.patientName],
          ['Tuổi', sheet.age],
          ['Giới tính', sheet.gender],
        ],
        [
          ['Phòng', sheet.room],
          ['Giường', sheet.bed],
        ],
        [['Chẩn đoán', sheet.diagnosis]],
        [['Tiền sử dị ứng', allergy]],
        [
          ['Ngày giờ', this.dateTime(sheet.recordedAt)],
          ['Phân cấp chăm sóc', this.careLevel(sheet.careLevel)],
        ],
      ]),
      threeColumnTable('NHẬN ĐỊNH, THEO DÕI', rows('observation')),
      threeColumnTable('CHẨN ĐOÁN ĐD / ĐÁNH GIÁ MỤC TIÊU', rows('diagnosis')),
      threeColumnTable('CAN THIỆP ĐIỀU DƯỠNG / BÀN GIAO', rows('intervention')),
      {
        text: `Quy ước ký hiệu: ${sheet.legend}`,
        italics: true,
        fontSize: 8,
        margin: [0, 6, 0, 0],
      },
      this.signature('Tên điều dưỡng thực hiện', sheet.nurseName),
    ];

    return this.render(content, `${sheet.title} - tờ ${sheet.sheetNumber}`);
  }

  private render(content: Content[], title: string): Promise<Buffer> {
    const doc: TDocumentDefinitions = {
      pageSize: 'A4',
      pageMargins: [36, 36, 36, 36],
      info: { title },
      defaultStyle: { font: 'Roboto', fontSize: 9.5, lineHeight: 1.15 },
      content,
      footer: (currentPage, pageCount) => ({
        text: `Trang ${currentPage}/${pageCount}`,
        alignment: 'right',
        fontSize: 8,
        margin: [0, 10, 36, 0],
      }),
    };
    return pdfmake.createPdf(doc).getBuffer();
  }

  private formHeader(opts: { left: (string | null)[]; title: string; right: string[] }): Content {
    return {
      table: {
        widths: ['*', 'auto', '*'],
        body: [
          [
            { stack: opts.left.filter(Boolean).map((text) => ({ text: text as string })) },
            {
              text: opts.title,
              bold: true,
              fontSize: 13,
              alignment: 'center',
              margin: [8, 4, 8, 4],
            },
            { stack: opts.right.map((text) => ({ text })), alignment: 'right' },
          ],
        ],
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 8],
    };
  }

  /** Rows of "label: value" pairs; each row spreads its pairs over the width. */
  private infoTable(rows: [string, string | number | null | undefined][][]): Content {
    return {
      table: {
        widths: ['*'],
        body: rows.map((pairs) => [
          {
            columns: pairs.map(([label, val]) => ({
              text: [
                { text: `${label}: `, color: '#555555' },
                { text: `${val ?? ''}`, bold: true },
              ],
            })),
            columnGap: 12,
          },
        ]),
      },
    };
  }

  private headCell(text: string): TableCell {
    return { text, bold: true, alignment: 'center', fillColor: '#eeeeee' };
  }

  private signature(title: string, name: string | null): Content {
    return {
      columns: [
        { width: '*', text: '' },
        {
          width: 200,
          stack: [
            { text: title, bold: true, alignment: 'center' },
            { text: '(Ký, ghi rõ họ tên)', italics: true, fontSize: 8, alignment: 'center' },
            { text: name ?? '', alignment: 'center', margin: [0, 36, 0, 0] },
          ],
        },
      ],
      margin: [0, 16, 0, 0],
      unbreakable: true,
    };
  }

  private careLevel(level: string | null): string {
    return level ? (CARE_LEVEL_LABELS[level] ?? level) : '';
  }

  private dateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: DISPLAY_TIME_ZONE,
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
