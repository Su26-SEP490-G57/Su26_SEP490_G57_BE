/**
 * POMS System - Core Business Logic Test Suite
 * Focused on critical paths with better error handling
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000;

// Test accounts
const ACCOUNTS = {
  patient: { username: 'patient01', password: 'Patient@123', caseId: 'CASE-001' },
  nurse: { username: 'nurse01', password: 'Nurse@123' },
  doctor: { username: 'doctor01', password: 'Doctor@123' },
};

// Statistics
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

// Utilities
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout'));
    }, options.timeout || TIMEOUT);

    const parsedUrl = new URL(url);
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        clearTimeout(timeout);
        try {
          const response = {
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          };
          resolve(response);
        } catch (parseError) {
          resolve({ statusCode: res.statusCode, data: null, error: 'Parse error' });
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

async function login(username, password) {
  const response = await httpRequest(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: { username, password }
  });
  if (response.statusCode !== 200 && response.statusCode !== 201) {
    throw new Error(`Login failed: ${response.statusCode}`);
  }
  return response.data.accessToken;
}

function test(name, fn) {
  stats.total++;
  return fn()
    .then(() => {
      console.log(`  ✓ ${name}`);
      stats.passed++;
    })
    .catch((error) => {
      console.log(`  ✗ ${name}`);
      console.log(`    ${error.message}`);
      stats.failed++;
      stats.errors.push({ test: name, error: error.message });
    });
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   POMS System - Core Business Logic Test                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // ========== Pre-authenticate all users ==========
  console.log('Authenticating users...');
  let patientToken, nurseToken, doctorToken;

  try {
    patientToken = await login(ACCOUNTS.patient.username, ACCOUNTS.patient.password);
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between logins
    nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);
    await new Promise(resolve => setTimeout(resolve, 500));
    doctorToken = await login(ACCOUNTS.doctor.username, ACCOUNTS.doctor.password);
    console.log('✓ All users authenticated\n');
  } catch (error) {
    console.error('✗ Authentication failed:', error.message);
    process.exit(1);
  }

  // ========== Test Group 1: Authentication ==========
  console.log('Test Group 1: Authentication & Authorization');

  await test('Patient token is valid', async () => {
    if (!patientToken || patientToken.length < 20) throw new Error('Invalid token');
  });

  await test('Nurse token is valid', async () => {
    if (!nurseToken) throw new Error('No token received');
  });

  await test('Doctor token is valid', async () => {
    if (!doctorToken) throw new Error('No token received');
  });

  // ========== Test Group 2: Diet Guidance Core Flow ==========
  console.log('\nTest Group 2: Diet Guidance - Core Flow');

  await test('Patient can fetch current diet guidance', async () => {
    const res = await httpRequest(
      `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.data || !res.data.label) throw new Error('Missing diet guidance data');
  });

  await test('Diet guidance matches patient diet level', async () => {
    // Get patient info
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    const currentLevel = patientRes.data.currentDietLevel;

    // Get diet guidance
    const guidanceRes = await httpRequest(
      `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );

    if (guidanceRes.data.dietLevel !== currentLevel) {
      throw new Error(`Mismatch: patient level=${currentLevel}, guidance level=${guidanceRes.data.dietLevel}`);
    }
  });

  await test('Doctor can update patient diet level', async () => {
    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 3, reason: 'Test update' }
      }
    );
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
  });

  await test('Patient sees updated diet level guidance', async () => {
    const res = await httpRequest(
      `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    if (res.data.dietLevel !== 3) {
      throw new Error(`Expected level 3, got ${res.data.dietLevel}`);
    }
  });

  // Rollback
  await httpRequest(
    `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { dietLevel: 2, reason: 'Rollback after test' }
    }
  );

  // ========== Test Group 3: All Diet Levels ==========
  console.log('\nTest Group 3: All Diet Levels (0-4)');

  for (const level of [0, 1, 2, 3, 4]) {
    await test(`Level ${level} has valid guidance data`, async () => {
      // Set patient to this level
      await httpRequest(
        `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${doctorToken}` },
          body: { dietLevel: level, reason: `Test level ${level}` }
        }
      );

      // Fetch guidance
      const res = await httpRequest(
        `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
        { headers: { Authorization: `Bearer ${patientToken}` } }
      );

      if (res.data.dietLevel !== level) throw new Error(`Wrong level: ${res.data.dietLevel}`);
      if (!res.data.label) throw new Error('Missing label');
      if (!Array.isArray(res.data.recommendedFoods)) throw new Error('Missing foods array');
      if (!Array.isArray(res.data.recommendedDrinks)) throw new Error('Missing drinks array');
    });
  }

  // Rollback to level 2
  await httpRequest(
    `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { dietLevel: 2, reason: 'Rollback' }
    }
  );

  // ========== Test Group 4: Authorization Rules ==========
  console.log('\nTest Group 4: Authorization Rules');

  await test('Nurse can decrease diet level', async () => {
    // Get current level
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    const currentLevel = patientRes.data.currentDietLevel;
    const lowerLevel = Math.max(0, currentLevel - 1);

    // Nurse decreases
    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${nurseToken}` },
        body: { dietLevel: lowerLevel, reason: 'Test nurse decrease' }
      }
    );

    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);

    // Rollback
    await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: currentLevel, reason: 'Rollback' }
      }
    );
  });

  await test('Nurse CANNOT increase diet level', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    const currentLevel = patientRes.data.currentDietLevel;
    const higherLevel = Math.min(4, currentLevel + 1);

    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${nurseToken}` },
        body: { dietLevel: higherLevel, reason: 'Should fail' }
      }
    );

    // Should return 400 or 403
    if (res.statusCode === 200) {
      throw new Error('Nurse should not be able to increase diet level');
    }
  });

  await test('Doctor can increase diet level', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    const currentLevel = patientRes.data.currentDietLevel;
    const higherLevel = Math.min(4, currentLevel + 1);

    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: higherLevel, reason: 'Test doctor increase' }
      }
    );

    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);

    // Rollback
    await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: currentLevel, reason: 'Rollback' }
      }
    );
  });

  // ========== Test Group 5: Operation Types & Pod Protocols ==========
  console.log('\nTest Group 5: Operation Types & Pod Protocols');

  await test('List operation types', async () => {
    const res = await httpRequest(`${BASE_URL}/diet-guidance/operation-types`, {
      headers: { Authorization: `Bearer ${nurseToken}` }
    });
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!Array.isArray(res.data) || res.data.length < 2) {
      throw new Error('Should have at least 2 operation types');
    }
  });

  await test('Each operation type has 5 diet levels', async () => {
    for (const opId of [1, 2]) {
      const res = await httpRequest(
        `${BASE_URL}/diet-guidance/operation-types/${opId}/pods`,
        { headers: { Authorization: `Bearer ${nurseToken}` } }
      );
      if (res.data.length !== 5) {
        throw new Error(`Op${opId} should have 5 diet levels, got ${res.data.length}`);
      }
    }
  });

  // ========== Test Group 6: Patient Management ==========
  console.log('\nTest Group 6: Patient Management');

  await test('Nurse can list patients', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      headers: { Authorization: `Bearer ${nurseToken}` }
    });
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (!res.data || !Array.isArray(res.data.data)) {
      throw new Error('Invalid patient list response');
    }
  });

  await test('Nurse can fetch single patient', async () => {
    const res = await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`, {
      headers: { Authorization: `Bearer ${nurseToken}` }
    });
    if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
    if (res.data.caseId !== ACCOUNTS.patient.caseId) {
      throw new Error('Wrong patient data');
    }
  });

  await test('Patient CANNOT access patient list', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    if (res.statusCode === 200) {
      throw new Error('Patient should not access patient list');
    }
  });

  // ========== Test Group 7: Data Integrity ==========
  console.log('\nTest Group 7: Data Integrity');

  await test('Cannot set diet level > max (4)', async () => {
    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 99, reason: 'Should fail' }
      }
    );
    if (res.statusCode === 200) {
      throw new Error('Should reject diet level > max');
    }
  });

  await test('Diet level 0 has liquid-only diet', async () => {
    await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 0, reason: 'Test level 0' }
      }
    );

    const res = await httpRequest(
      `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );

    if (res.data.recommendedFoods && res.data.recommendedFoods.length > 1) {
      throw new Error('Level 0 should have minimal solid foods');
    }

    // Rollback
    await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 2, reason: 'Rollback' }
      }
    );
  });

  await test('Higher diet levels have more food variety', async () => {
    const res = await httpRequest(
      `${BASE_URL}/diet-guidance/operation-types/2/pods`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );

    const level3 = res.data.find(p => p.dietLevel === 3);
    const level4 = res.data.find(p => p.dietLevel === 4);

    if (!level3 || !level4) throw new Error('Missing diet levels');
    if ((level3.recommendedFoods || []).length < 7) {
      throw new Error('Level 3 should have rich food variety');
    }
    if ((level4.recommendedFoods || []).length < 7) {
      throw new Error('Level 4 should have rich food variety');
    }
  });

  // ========== Summary ==========
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Total:    ${stats.total}`);
  console.log(`✓ Passed: ${stats.passed}`);
  console.log(`✗ Failed: ${stats.failed}`);
  console.log(`Duration: ${duration}s`);

  if (stats.failed > 0) {
    console.log('\n--- Failed Tests ---');
    stats.errors.forEach(({ test, error }) => {
      console.log(`✗ ${test}`);
      console.log(`  ${error}`);
    });
    console.log('\n❌ Some tests failed. Review errors above.');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed! System is healthy.');
    console.log('\nKey flows verified:');
    console.log('  • Authentication & authorization (all roles)');
    console.log('  • Diet guidance fetch matches patient diet level');
    console.log('  • Doctor can update diet level → patient sees new guidance');
    console.log('  • All 5 diet levels (0-4) have valid data');
    console.log('  • Nurse can decrease, cannot increase diet level');
    console.log('  • Doctor can increase diet level');
    console.log('  • Operation types & pod protocols are complete');
    console.log('  • Patient role restrictions enforced');
    console.log('  • Data integrity rules enforced');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('\n💥 Test suite crashed:');
  console.error(error);
  process.exit(1);
});
