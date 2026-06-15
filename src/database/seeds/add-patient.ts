/**
 * Seed script — add a single Patient user that can log in.
 *
 * A "patient" here is a row in the `users` table carrying the `Patient` role,
 * which is what the mobile patient login form authenticates against.
 *
 * Usage (from capstone-backend/):
 *   npm run seed:patient                          # uses defaults below
 *   npm run seed:patient -- POMS123456 Secret@123 "Nguyễn Văn A" 0901234567
 *
 * Positional args (all optional): <username> <password> <fullName> <phoneNumber>
 *
 * Idempotent: if the username already exists, the script reports it and exits
 * without creating a duplicate.
 */
import 'dotenv/config';
import * as bcrypt from 'bcrypt';

import dataSource from '../../data-source';
import { User } from '../../modules/user/entities/user.entity';
import { Role } from '../../modules/user/entities/role.entity';
import { UserRole } from '../../modules/user/enums/user-role.enum';

const SALT_ROUNDS = 10; // keep in sync with UsersService

async function run() {
  const [
    username = 'POMS000001',
    password = 'Patient@123',
    fullName = 'Bệnh nhân Demo',
    phoneNumber = '0900000001',
  ] = process.argv.slice(2);

  await dataSource.initialize();
  console.log(`Connected to ${dataSource.options.database}`);

  try {
    const userRepo = dataSource.getRepository(User);
    const roleRepo = dataSource.getRepository(Role);

    const existing = await userRepo.findOne({ where: { username } });
    if (existing) {
      console.log(`✓ User "${username}" already exists (id=${existing.id}) — nothing to do.`);
      return;
    }

    // Resolve the Patient role, creating the row if it does not exist yet.
    let patientRole = await roleRepo.findOne({
      where: { roleName: UserRole.PATIENT },
    });
    if (!patientRole) {
      patientRole = await roleRepo.save(
        roleRepo.create({
          roleName: UserRole.PATIENT,
          description: 'Patient (mobile app user)',
        }),
      );
      console.log(`+ Created "${UserRole.PATIENT}" role (id=${patientRole.id})`);
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await userRepo.save(
      userRepo.create({
        username,
        password_hash: passwordHash,
        full_name: fullName,
        phone_number: phoneNumber || null,
        is_active: true,
        roles: [patientRole],
      }),
    );

    console.log('✓ Patient created:');
    console.log(`    id:       ${user.id}`);
    console.log(`    username: ${username}`);
    console.log(`    password: ${password}`);
    console.log(`    role:     ${UserRole.PATIENT}`);
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
