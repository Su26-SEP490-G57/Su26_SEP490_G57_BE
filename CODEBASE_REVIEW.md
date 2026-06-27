# Codebase Review — SEP490 G57 Backend

> Ngày đánh giá: 2026-06-27  
> Branch: `sep490-242`  
> Stack: NestJS 11 · TypeORM 0.3 · PostgreSQL 16 · Socket.io · JWT

---

## Tổng quan

| Hạng mục | Đánh giá |
|---|---|
| Kiến trúc tổng thể | ✅ Tốt |
| Business logic | ✅ Ổn |
| Bảo mật | ⚠️ Cần cải thiện |
| Test coverage | ❌ 0% |
| Tính nhất quán | ⚠️ Một số chỗ không đồng đều |
| API completeness | ⚠️ Thiếu một số endpoint |

---

## Điểm mạnh

### 1. Kiến trúc module rõ ràng
Cấu trúc `controller → service → repository` được áp dụng nhất quán toàn bộ codebase. Mỗi module tự quản lý entity, DTO, guard riêng — dễ mở rộng và tìm kiếm.

### 2. Transaction đúng cách
Các thao tác span nhiều bảng (`patient_cases` + `users`) đều dùng `dataSource.transaction()`:
- `PatientRepository.createWithAccount()` — tạo user account và patient case atomically.
- `PatientRepository.updateWithAccount()` — update cả hai rows atomically.
- `PatientRepository.softDeletePatient()` — soft-delete cả user và case atomically.

Nếu bất kỳ bước nào lỗi, toàn bộ transaction rollback — không bị data inconsistency.

### 3. Soft delete đúng TypeORM convention
Dùng `@DeleteDateColumn()` — TypeORM tự lọc soft-deleted rows trong mọi query thông thường. Logic `withDeleted: true` khi check unique constraint (username, case_id) cũng xử lý đúng — soft-deleted rows vẫn giữ unique key.

### 4. Refresh token rotation có DB persistence
Refresh token được lưu vào bảng `refresh_tokens` với `expires_at`. Khi refresh:
1. Verify JWT signature.
2. Kiểm tra token có tồn tại trong DB không (phát hiện reuse sau revocation).
3. Kiểm tra `expires_at` chưa qua.

Tốt hơn stateless-only, hỗ trợ logout thực sự.

### 5. WebSocket tích hợp sạch
Gateway tách riêng khỏi service, service gọi `gateway.emit*()` ngay sau khi write DB. Hai namespace rõ ràng:
- `/alerts` — phát `alert.created` khi survey tạo ra alert.
- `/patients` — phát `pod.locked` / `pod.unlocked` khi nurse thao tác.

### 6. Type-safe alert constants
```ts
// alert.entity.ts
export const ALERT_TYPES = ['YELLOW', 'RED'] as const;
export const ALERT_STATUSES = ['Pending', 'Acknowledged', 'Paused_POD', ...] as const;
export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];
```
Dùng `as const` + type inference thay vì enum — TypeScript báo lỗi compile-time nếu dùng sai giá trị.

---

## Vấn đề nghiêm trọng

### ❌ 1. WebSocket không có authentication
**File:** `alert/gateways/alert.gateway.ts`, `patient/gateways/patient.gateway.ts`

```ts
@WebSocketGateway({
  cors: { origin: '*' },  // bất kỳ origin nào cũng connect được
  namespace: '/alerts',
})
export class AlertGateway implements OnGatewayConnection {
  handleConnection(client: Socket) {
    // không kiểm tra JWT, không reject unauthorized client
    this.logger.log(`Client connected: ${client.id}`);
  }
}
```

Bất kỳ client nào cũng connect được vào `/alerts` và `/patients` và nhận toàn bộ dữ liệu bệnh nhân, alert theo real-time **mà không cần token**. Với hệ thống y tế, đây là lỗ hổng bảo mật rõ ràng.

**Cần làm:** Thêm WsGuard hoặc middleware xác thực JWT trong `handleConnection`:
```ts
handleConnection(client: Socket) {
  const token = client.handshake.auth?.token ?? client.handshake.headers?.authorization;
  try {
    const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET });
    client.data.user = payload;
  } catch {
    client.disconnect();
  }
}
```

---

### ❌ 2. JWT secret có fallback không an toàn
**File:** `auth/services/auth.service.ts:19-20`

```ts
const JWT_SECRET         = process.env.JWT_SECRET          ?? 'change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  ?? 'refresh-change-me';
```

Nếu `.env` thiếu các biến này (lần đầu deploy, CI/CD thiếu config), token vẫn được ký bằng chuỗi cố định đã biết. Attacker có thể forge JWT hợp lệ.

**Cần làm:** Fail fast khi khởi động nếu secrets không được set:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is not set');
```

---

### ❌ 3. `/logout` và `/refresh` không được expose qua HTTP
**File:** `auth/controllers/auth.controller.ts`

`AuthService` có đủ `refresh()` và `logout()` nhưng controller chỉ expose `/login` và `/me`. Client không có cách refresh token hay logout qua API.

**Cần thêm:**
```ts
@Post('refresh')
refresh(@Body('refreshToken') token: string) {
  return this.authService.refresh(token);
}

@UseGuards(JwtAuthGuard)
@Post('logout')
logout(@Body('refreshToken') token: string) {
  return this.authService.logout(token);
}
```

---

### ❌ 4. Không có test nào
```
src/**/*.spec.ts → 0 files found
```

Toàn bộ codebase không có một unit test hay integration test nào. Các logic quan trọng không có gì bảo vệ khi refactor:
- Triage scoring (score → GREEN/YELLOW/RED) trong `symptom-survey.service.ts`
- Alert auto-creation chain (survey submit → alert → WebSocket emit)
- POD lock/unlock flow
- Transaction atomicity (create patient + account)
- JWT refresh/rotation logic

---

## Vấn đề đáng chú ý

### ⚠️ 5. N+1 query trong `getOperationTypes()`
**File:** `diet-guidance/services/diet-guidance.service.ts:43-51`

```ts
async getOperationTypes(): Promise<OperationTypeResponseDto[]> {
  const types = await this.repository.findAllOperationTypes();
  return Promise.all(
    types.map(async (t) => {
      const count = await this.repository.countPodsByOperationType(t.operation_type_id); // N queries
      return this.toOpTypeResponse(t, count);
    }),
  );
}
```

Với N operation types → N+1 queries. Nên dùng một query duy nhất:
```ts
// Trong repository
findAllOperationTypesWithPodCount(): Promise<{ type: OperationType; count: number }[]> {
  return this.opTypeRepo
    .createQueryBuilder('op')
    .loadRelationCountAndMap('op.podCount', 'op.podProtocols')
    .getMany();
}
```

---

### ⚠️ 6. `deleteNurse` không phải soft-delete thực sự
**File:** `nurse/services/nurse.service.ts:97-108`

```ts
async deleteNurse(id: number): Promise<NurseResponseDto> {
  await this.getNurseById(id);
  const deactivated = await this.usersService.deactivate(id); // chỉ set is_active = false
  return this.toResponse(deactivated);
}
```

`deactivate()` chỉ set `is_active = false`, không set `deleted_at`. Nurse vẫn xuất hiện trong `NurseRepository.findAll()` nếu không filter `isActive`. Hành vi hoàn toàn khác với `deletePatient()` — tạo ra sự không nhất quán trong API.

Nếu "delete nurse" nghĩa là deactivate thì tên endpoint nên là `PATCH /:id/deactivate`. Nếu nghĩa là xóa thực sự thì cần dùng `softDelete()` như patient.

---

### ⚠️ 7. `findByIds` deprecated trong TypeORM 0.3.x
**File:** `symptom-survey/repositories/symptom-survey.repository.ts:31`

```ts
findOptionsByIds(ids: number[]): Promise<QuestionOption[]> {
  return this.optionRepo.findByIds(ids); // deprecated
}
```

TypeORM 0.3.x đã bỏ `findByIds`. Sẽ bị remove trong version tiếp theo. Thay bằng:
```ts
import { In } from 'typeorm';

findOptionsByIds(ids: number[]): Promise<QuestionOption[]> {
  return this.optionRepo.findBy({ option_id: In(ids) });
}
```

---

### ⚠️ 8. `guardianPhone` không được map trong `toCaseFields()`
**File:** `patient/services/patient.service.ts:245-262`

Field `guardian_phone` tồn tại trên `Patient` entity nhưng `toCaseFields()` không include nó:
```ts
private toCaseFields(dto: CreatePatientDto | UpdatePatientDto): PatientCaseInput {
  return {
    nameInitials: dto.nameInitials,
    // ... các field khác
    // ❌ MISSING: guardianPhone: dto.guardianPhone,
  };
}
```

Tạo hoặc update patient với `guardianPhone` sẽ luôn lưu null.

---

### ⚠️ 9. Schema default không nhất quán
**File:** `app.module.ts:28` vs `data-source.ts:9`

```ts
// app.module.ts — schema mặc định là 'public'
schema: config.get('DB_SCHEMA') ?? 'public',

// data-source.ts — schema mặc định là 'SEP490_G57'
schema: process.env.DB_SCHEMA || 'SEP490_G57',
```

Nếu `.env` không set `DB_SCHEMA`:
- Migration CLI chạy trên schema `SEP490_G57`
- App runtime kết nối schema `public`
- App sẽ không thấy các bảng vừa migrate

Cần đồng nhất về một giá trị default, hoặc bắt buộc set qua env.

---

### ⚠️ 10. Role names hardcoded string thay vì enum
**File:** `nurse/repositories/nurse.repository.ts:34`

```ts
.where('role.roleName IN (:...roles)', { roles: ['Nurse', 'Head_Nurse'] })
```

Nếu `UserRole` enum thay đổi giá trị, query này sẽ không lấy được nurse nào mà không báo lỗi. Nên dùng:
```ts
import { UserRole } from '../../user/enums/user-role.enum';

.where('role.roleName IN (:...roles)', { roles: [UserRole.NURSE, UserRole.HEAD_NURSE] })
```

---

### ⚠️ 11. `resolvePatientRole` auto-create role ở runtime
**File:** `patient/repositories/patient.repository.ts:255-262`

```ts
private async resolvePatientRole(manager: EntityManager): Promise<Role> {
  let role = await roleRepo.findOne({ where: { roleName: UserRole.PATIENT } });
  if (!role) {
    role = await roleRepo.save(  // ← tạo role lúc runtime
      roleRepo.create({ roleName: UserRole.PATIENT, ... }),
    );
  }
  return role;
}
```

Logic này tạo role `Patient` nếu chưa có — chạy ngầm mỗi khi tạo patient. Không kiểm soát được và che giấu lỗi seed. Nên throw error để bắt buộc chạy seed:
```ts
if (!role) throw new InternalServerErrorException('Patient role not seeded — run npm run seed');
```

---

### ⚠️ 12. `as any` cast không an toàn trong diet-guidance
**File:** `diet-guidance/services/diet-guidance.service.ts:109, 129`

```ts
updatedBy: { id: userId } as any,
```

Nếu `updatedBy` là một `@ManyToOne` relation trên entity, TypeORM có thể không resolve đúng. Nên kiểm tra entity definition và dùng đúng type:
```ts
updatedBy: { id: userId } as User,
```

---

## Minor / Cleanup

| # | Vị trí | Vấn đề |
|---|---|---|
| 13 | `main.ts:22` | Swagger description vẫn là `"Ride Sharing API"` — sót từ template |
| 14 | `auth/controllers/auth.controller.ts:7` | Import dùng absolute path `src/modules/...` thay vì relative `../../modules/...` — có thể lỗi trong một số môi trường build |
| 15 | `src/modules/admin/` | Directory tồn tại với `.gitkeep` nhưng hoàn toàn trống — cần implement hoặc xóa |
| 16 | `patient/entities/pod-protocol.entity.ts` | Có thể trùng với `diet-guidance/entities/pod-protocol.entity.ts` — cần kiểm tra xem hai file này có phải cùng entity không |
| 17 | `package.json` | `firebase` và `firebase-admin` có trong dependencies nhưng không thấy sử dụng ở bất kỳ đâu — nên xóa nếu chưa implement |
| 18 | `symptom-survey/services/symptom-survey.service.ts` | Không validate đủ số câu trả lời — patient có thể submit survey với subset câu hỏi và vẫn được tính triage color |
| 19 | Toàn bộ | Không có rate limiting trên endpoint `/auth/login` — brute force attack dễ thực hiện |
| 20 | `alert/services/alert.service.ts:39` | Status hardcoded string `'Pending'` dù `ALERT_STATUSES` const đã được định nghĩa — nên dùng `ALERT_STATUSES[0]` hoặc một const riêng |

---

## Thứ tự ưu tiên fix

### Ngay bây giờ (blocking)
1. **Auth WebSocket** — bất kỳ ai cũng đọc được dữ liệu bệnh nhân real-time
2. **JWT secret fallback** — môi trường thiếu config sẽ có JWT forgeable
3. **Expose `/refresh` và `/logout`** — client không có cách dùng được

### Trước khi merge feature mới
4. **Thêm test** cho triage scoring và alert creation chain — ít nhất unit test
5. **Fix `guardianPhone` mapping** — bug data loss thầm lặng
6. **Fix schema default** — có thể gây migration không apply đúng schema

### Backlog
7. Fix N+1 query trong `getOperationTypes()`
8. Replace `findByIds` deprecated
9. Đồng nhất soft-delete vs deactivate cho Nurse
10. Replace hardcoded role strings bằng enum
11. Xử lý `resolvePatientRole` — throw thay vì silent create
12. Xóa dead dependency Firebase hoặc implement
