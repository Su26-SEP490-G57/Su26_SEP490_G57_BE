/**
 * Field layout of "Phiếu theo dõi và chăm sóc" (MS: 38/BV1). Cấp 1 and Cấp 2-3
 * share exactly the same fields — only the title differs.
 *
 * Defined ONCE here and served to the web + mobile clients with the prefill,
 * so all three stay in sync. A sheet's `content` is a flat map keyed by
 * `${section.key}.${field.key}`; keys are stable (they are persisted in HIS),
 * labels may change.
 *
 * `group` tells the client which column a section belongs to on the paper
 * form: `observation` (left: nhận định, theo dõi), `diagnosis` (right: chẩn
 * đoán ĐD / đánh giá mục tiêu), `intervention` (bottom: can thiệp, bàn giao).
 */
export const CARE_SHEET_TYPES = ['LEVEL_1', 'LEVEL_2_3'] as const;
export type CareSheetType = (typeof CARE_SHEET_TYPES)[number];

export const CARE_SHEET_TITLES: Record<CareSheetType, string> = {
  LEVEL_1: 'Phiếu theo dõi và chăm sóc (Cấp 1)',
  LEVEL_2_3: 'Phiếu theo dõi và chăm sóc (Cấp 2-3)',
};

/** Form code printed on the paper sheet. */
export const CARE_SHEET_FORM_CODE = '38/BV1';

export type CareSheetGroup = 'observation' | 'diagnosis' | 'intervention';

export interface CareSheetField {
  key: string;
  label: string;
  /** Free text over several lines rather than a short value. */
  multiline?: boolean;
}

export interface CareSheetSection {
  key: string;
  title: string;
  group: CareSheetGroup;
  fields: CareSheetField[];
}

/** "Quy ước ký hiệu" printed on the sheet. */
export const CARE_SHEET_LEGEND = '(+): Có · (-): Không · (/): Không ghi nhận';

const nursingDiagnosis = (n: number): CareSheetSection => ({
  key: `chanDoan${n}`,
  title: `Chẩn đoán ${n}`,
  group: 'diagnosis',
  fields: [
    { key: 'chanDoan', label: `Chẩn đoán ${n}`, multiline: true },
    { key: 'mucTieu1', label: 'Mục tiêu 1', multiline: true },
    { key: 'mucTieu1ChiTiet', label: 'Mục tiêu 1 — chi tiết', multiline: true },
    { key: 'mucTieu2', label: 'Mục tiêu 2', multiline: true },
    { key: 'mucTieu2ChiTiet', label: 'Mục tiêu 2 — chi tiết', multiline: true },
  ],
});

export const CARE_SHEET_SECTIONS: CareSheetSection[] = [
  {
    key: 'chung',
    title: 'Nhận định, theo dõi',
    group: 'observation',
    fields: [{ key: 'nhanDinhTheoDoi', label: 'Nhận định, theo dõi', multiline: true }],
  },
  {
    key: 'chiSo',
    title: 'Chỉ số sinh tồn, sinh trắc',
    group: 'observation',
    fields: [
      { key: 'mach', label: 'Mạch (lần/phút)' },
      { key: 'nhietDo', label: 'Nhiệt độ (°C)' },
      { key: 'huyetAp', label: 'Huyết áp (mmHg)' },
      { key: 'nhipTho', label: 'Nhịp thở (lần/phút)' },
      { key: 'spo2', label: 'SpO2 (%)' },
      { key: 'canNang', label: 'Cân nặng (kg)' },
      { key: 'bmi', label: 'BMI' },
    ],
  },
  {
    key: 'toanThan',
    title: 'Toàn thân',
    group: 'observation',
    fields: [
      { key: 'theTrang', label: 'Thể trạng' },
      { key: 'triGiac', label: 'Tri giác' },
      { key: 'glasgow', label: 'Glasgow' },
      { key: 'avpu', label: 'AVPU' },
      { key: 'daNiemMac', label: 'Da, niêm mạc' },
      { key: 'moi', label: 'Môi' },
      { key: 'dauChi', label: 'Đầu chi' },
      { key: 'da', label: 'Da' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'hoHap',
    title: 'Hô hấp',
    group: 'observation',
    fields: [
      { key: 'binhThuong', label: 'Bình thường' },
      { key: 'thoOxy', label: 'Thở oxy' },
      { key: 'thoMay', label: 'Thở máy' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'tuanHoan',
    title: 'Tuần hoàn',
    group: 'observation',
    fields: [
      { key: 'mach', label: 'Mạch' },
      { key: 'huyetAp', label: 'Huyết áp' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'dinhDuong',
    title: 'Dinh dưỡng',
    group: 'observation',
    fields: [
      { key: 'mieng', label: 'Miệng' },
      { key: 'sonde', label: 'Sonde' },
      { key: 'luongAn', label: 'Lượng ăn (ml)/bữa' },
      { key: 'tinhMach', label: 'Tĩnh mạch' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'tieuHoa',
    title: 'Tiêu hoá',
    group: 'observation',
    fields: [
      { key: 'daiTien', label: 'Đại tiện' },
      { key: 'trungTien', label: 'Trung tiện' },
      { key: 'dichDaDay', label: 'Dịch dạ dày' },
      { key: 'soLuong', label: 'Số lượng' },
      { key: 'mauSac', label: 'Màu sắc' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'tietNieuSinhDuc',
    title: 'Tiết niệu, sinh dục',
    group: 'observation',
    fields: [
      { key: 'tuTieu', label: 'Tự tiểu' },
      { key: 'tieuQuaSonde', label: 'Tiểu qua sonde' },
      { key: 'soLuong', label: 'Số lượng' },
      { key: 'mauSac', label: 'Màu sắc' },
      { key: 'boPhanSinhDuc', label: 'Bộ phận sinh dục' },
      { key: 'khac', label: 'Khác', multiline: true },
    ],
  },
  {
    key: 'rhmMatTmh',
    title: 'RHM, Mắt, TMH',
    group: 'observation',
    fields: [{ key: 'ghiNhan', label: 'RHM, Mắt, TMH' }],
  },
  {
    key: 'coXuongKhop',
    title: 'Cơ, Xương, Khớp',
    group: 'observation',
    fields: [
      { key: 'viTri', label: 'Vị trí tổn thương (viết)' },
      { key: 'vanDong', label: 'Vận động' },
    ],
  },
  {
    key: 'giacNgu',
    title: 'Giấc ngủ, nghỉ ngơi',
    group: 'observation',
    fields: [{ key: 'ghiNhan', label: 'Giấc ngủ, nghỉ ngơi' }],
  },
  {
    key: 'veSinh',
    title: 'Vệ sinh cá nhân',
    group: 'observation',
    fields: [{ key: 'ghiNhan', label: 'Vệ sinh cá nhân' }],
  },
  {
    key: 'vanDongPhcn',
    title: 'Vận động, PHCN',
    group: 'observation',
    fields: [{ key: 'ghiNhan', label: 'Vận động, PHCN' }],
  },
  {
    key: 'gdsk',
    title: 'GDSK',
    group: 'observation',
    fields: [{ key: 'ghiNhan', label: 'Giáo dục sức khoẻ' }],
  },
  {
    key: 'theoDoiKhac',
    title: 'Theo dõi khác',
    group: 'observation',
    fields: [
      { key: 'da', label: 'Da' },
      { key: 'loet', label: 'Loét do tỳ đè' },
      { key: 'nga', label: 'Nguy cơ ngã' },
      { key: 'canhBao', label: 'Cảnh báo sớm' },
    ],
  },
  nursingDiagnosis(1),
  nursingDiagnosis(2),
  nursingDiagnosis(3),
  nursingDiagnosis(4),
  {
    key: 'cheDo',
    title: 'Chế độ chăm sóc',
    group: 'diagnosis',
    fields: [{ key: 'cheDoChamSoc', label: 'Chế độ chăm sóc', multiline: true }],
  },
  {
    key: 'canThiep',
    title: 'Can thiệp điều dưỡng',
    group: 'intervention',
    fields: [
      { key: 'thuoc', label: 'Thực hiện thuốc theo chỉ định', multiline: true },
      { key: 'cls', label: 'Thực hiện theo chỉ định CLS', multiline: true },
      { key: 'chamSoc', label: 'Chăm sóc điều dưỡng', multiline: true },
      { key: 'tuVan', label: 'Tư vấn, giáo dục sức khoẻ', multiline: true },
    ],
  },
  {
    key: 'banGiao',
    title: 'Bàn giao',
    group: 'intervention',
    fields: [{ key: 'ghiNhan', label: 'Bàn giao', multiline: true }],
  },
];

/** Every valid `content` key. */
export const CARE_SHEET_CONTENT_KEYS: ReadonlySet<string> = new Set(
  CARE_SHEET_SECTIONS.flatMap((section) =>
    section.fields.map((field) => `${section.key}.${field.key}`),
  ),
);

/** Max length of one content value. */
export const CARE_SHEET_VALUE_MAX_LENGTH = 2000;
