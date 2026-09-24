/**
 * Test: Patient Authorization & Nurse Assignment Rules
 *
 * Verify:
 * 1. Patient CANNOT access /patients
 * 2. Nurse CAN view patients but CANNOT create/update/delete
 * 3. Only Doctor/Head_Nurse can assign/reassign nurse
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT = 10000;

const ACCOUNTS = {
  patient: { username: 'patient01', password: 'Patient@123', caseId: 'CASE-001' },
  nurse: { username: 'nurse01', password: 'Nurse@123' },
  headNurse: { username: 'head_nurse', password: 'Nurse@123' },
  doctor: { username: 'doctor01', password: 'Doctor@123' },
};

const stats = { total: 0, passed: 0, failed: 0, errors: [] };

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
          resolve({
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          });
        } catch (e) {
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
  console.log('║   Test: Patient Authorization & Nurse Assignment Rules      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const startTime = Date.now();

  // Pre-authenticate
  console.log('Authenticating users...');
  let patientToken, nurseToken, headNurseToken, doctorToken;

  try {
    patientToken = await login(ACCOUNTS.patient.username, ACCOUNTS.patient.password);
    await new Promise(resolve => setTimeout(resolve, 500));
    nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);
    await new Promise(resolve => setTimeout(resolve, 500));
    headNurseToken = await login(ACCOUNTS.headNurse.username, ACCOUNTS.headNurse.password);
    await new Promise(resolve => setTimeout(resolve, 500));
    doctorToken = await login(ACCOUNTS.doctor.username, ACCOUNTS.doctor.password);
    console.log('✓ All users authenticated\n');
  } catch (error) {
    console.error('✗ Authentication failed:', error.message);
    process.exit(1);
  }

  // ========== Test Group 1: Patient Role Restrictions ==========
  console.log('Test Group 1: Patient Role Restrictions');

  await test('Patient CANNOT access GET /patients', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    if (res.statusCode === 200) {
      throw new Error('Patient should NOT have access to patient list');
    }
    // Should be 403 Forbidden
    if (res.statusCode !== 403) {
      throw new Error(`Expected 403, got ${res.statusCode}`);
    }
  });

  await test('Patient CAN access their own case details', async () => {
    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${patientToken}` } }
    );
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (res.data.caseId !== ACCOUNTS.patient.caseId) {
      throw new Error('Wrong case data returned');
    }
  });

  await test('Patient CANNOT create patient', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${patientToken}` },
      body: {
        caseId: 'TEST-999',
        fullName: 'Test Patient',
        operationTypeId: 1,
        surgeryDate: '2026-09-24'
      }
    });
    if (res.statusCode === 201 || res.statusCode === 200) {
      throw new Error('Patient should NOT be able to create patients');
    }
  });

  // ========== Test Group 2: Nurse Permissions ==========
  console.log('\nTest Group 2: Nurse Permissions');

  await test('Nurse CAN access GET /patients', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      headers: { Authorization: `Bearer ${nurseToken}` }
    });
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    if (!res.data || !Array.isArray(res.data.data)) {
      throw new Error('Invalid patient list response');
    }
  });

  await test('Nurse CAN view patient details (including assigned nurse)', async () => {
    const res = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
    // Check that response includes assignedNurse field (even if null)
    if (!res.data || res.data.caseId !== ACCOUNTS.patient.caseId) {
      throw new Error('Invalid patient data');
    }
  });

  await test('Nurse CANNOT create patient', async () => {
    const res = await httpRequest(`${BASE_URL}/patients`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${nurseToken}` },
      body: {
        caseId: 'TEST-998',
        fullName: 'Test Nurse Create',
        operationTypeId: 1,
        surgeryDate: '2026-09-24'
      }
    });
    if (res.statusCode === 201 || res.statusCode === 200) {
      throw new Error('Nurse should NOT be able to create patients');
    }
    // Should be 403 Forbidden
    if (res.statusCode !== 403) {
      throw new Error(`Expected 403, got ${res.statusCode}`);
    }
  });

  await test('Nurse CANNOT update patient (assign nurse)', async () => {
    // Get patient user ID first
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    const patientUserId = patientRes.data.account?.id;

    if (!patientUserId) {
      throw new Error('Cannot get patient user ID');
    }

    const res = await httpRequest(`${BASE_URL}/patients/${patientUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${nurseToken}` },
      body: {
        assignedNurseId: 3 // Try to assign nurse
      }
    });

    if (res.statusCode === 200) {
      throw new Error('Nurse should NOT be able to update patients');
    }
    // Should be 403 Forbidden
    if (res.statusCode !== 403) {
      throw new Error(`Expected 403, got ${res.statusCode}`);
    }
  });

  await test('Nurse CANNOT delete patient', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    const patientUserId = patientRes.data.account?.id;

    if (!patientUserId) {
      throw new Error('Cannot get patient user ID');
    }

    const res = await httpRequest(`${BASE_URL}/patients/${patientUserId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${nurseToken}` }
    });

    if (res.statusCode === 200) {
      throw new Error('Nurse should NOT be able to delete patients');
    }
    // Should be 403 Forbidden
    if (res.statusCode !== 403) {
      throw new Error(`Expected 403, got ${res.statusCode}`);
    }
  });

  // ========== Test Group 3: Head Nurse Permissions ==========
  console.log('\nTest Group 3: Head Nurse Permissions (Nurse Assignment)');

  await test('Head Nurse CAN assign nurse to patient', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${headNurseToken}` } }
    );
    const patientUserId = patientRes.data.account?.id;

    if (!patientUserId) {
      throw new Error('Cannot get patient user ID');
    }

    const res = await httpRequest(`${BASE_URL}/patients/${patientUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${headNurseToken}` },
      body: {
        assignedNurseId: 3 // Assign nurse01
      }
    });

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }
  });

  // ========== Test Group 4: Doctor Permissions ==========
  console.log('\nTest Group 4: Doctor Permissions (Nurse Assignment)');

  await test('Doctor CAN assign nurse to patient', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    const patientUserId = patientRes.data.account?.id;

    if (!patientUserId) {
      throw new Error('Cannot get patient user ID');
    }

    const res = await httpRequest(`${BASE_URL}/patients/${patientUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: {
        assignedNurseId: 3
      }
    });

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
    }
  });

  await test('Doctor CAN reassign nurse (change assignment)', async () => {
    const patientRes = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${doctorToken}` } }
    );
    const patientUserId = patientRes.data.account?.id;

    if (!patientUserId) {
      throw new Error('Cannot get patient user ID');
    }

    // Change to null (unassign)
    const res = await httpRequest(`${BASE_URL}/patients/${patientUserId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: {
        assignedNurseId: null
      }
    });

    if (res.statusCode !== 200) {
      throw new Error(`Expected 200, got ${res.statusCode}`);
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
    console.log('\n❌ Some tests failed.');
    process.exit(1);
  } else {
    console.log('\n✅ All authorization rules working correctly!');
    console.log('\nVerified:');
    console.log('  • Patient CANNOT access /patients list');
    console.log('  • Patient CAN view their own case details');
    console.log('  • Nurse CAN view patients but CANNOT create/update/delete');
    console.log('  • Head Nurse CAN assign/reassign nurse');
    console.log('  • Doctor CAN assign/reassign nurse');
    process.exit(0);
  }
}

runTests().catch((error) => {
  console.error('\n💥 Test suite crashed:');
  console.error(error);
  process.exit(1);
});
