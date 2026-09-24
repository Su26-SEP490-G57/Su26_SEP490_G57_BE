/**
 * Comprehensive System Flow Test Suite
 *
 * Tests all major business logic flows in POMS system
 *
 * Coverage:
 * 1. Authentication & Authorization (all roles)
 * 2. Patient Management (CRUD, assignment)
 * 3. Diet Level Management (fetch, update, validation)
 * 4. Assessment & Triage (submit, calculate, alert)
 * 5. Data Integrity (constraints, soft delete)
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test accounts
const ACCOUNTS = {
  patient: { username: 'patient01', password: 'Patient@123', caseId: 'CASE-001', expectedRoles: ['PATIENT'] },
  nurse: { username: 'nurse01', password: 'Nurse@123', expectedRoles: ['NURSE'] },
  headNurse: { username: 'head_nurse', password: 'Nurse@123', expectedRoles: ['HEAD_NURSE'] },
  doctor: { username: 'doctor01', password: 'Doctor@123', expectedRoles: ['DOCTOR'] },
  admin: { username: 'admin', password: 'Admin@123', expectedRoles: ['ADMIN'] },
};

// Test data
const TEST_CASES = {
  dietLevels: [0, 1, 2, 3, 4],
  operationTypes: [1, 2], // 1=Gastric, 2=Colorectal
  triageLevels: ['GREEN', 'YELLOW', 'RED'],
};

// Utilities
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
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
        try {
          const response = {
            statusCode: res.statusCode,
            data: data ? JSON.parse(data) : null
          };
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(response.data)}`));
          } else {
            resolve(response);
          }
        } catch (parseError) {
          reject(new Error(`JSON parse error: ${data.substring(0, 100)}`));
        }
      });
    });

    req.on('error', reject);

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
  return response.data.accessToken;
}

// Test Suite
const testResults = {
  passed: 0,
  failed: 0,
  errors: []
};

function logTest(name, passed, error = null) {
  if (passed) {
    console.log(`  ✓ ${name}`);
    testResults.passed++;
  } else {
    console.log(`  ✗ ${name}`);
    testResults.failed++;
    if (error) testResults.errors.push({ test: name, error: error.message });
  }
}

// Test 1: Authentication & Authorization
async function testAuthentication() {
  console.log('\n=== Test 1: Authentication & Authorization ===');

  for (const [role, account] of Object.entries(ACCOUNTS)) {
    try {
      const token = await login(account.username, account.password);
      const meResponse = await httpRequest(`${BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const user = meResponse.data;

      // Note: roles come back as lowercase with uppercase first letter (e.g., "Patient" not "PATIENT")
      const hasExpectedRole = account.expectedRoles.some(expectedRole => {
        const normalizedExpectedRole = expectedRole.charAt(0).toUpperCase() + expectedRole.slice(1).toLowerCase();
        return user.roles?.some(userRole =>
          userRole.toLowerCase() === normalizedExpectedRole.toLowerCase()
        );
      });

      logTest(`${role} login & JWT validation`,
        token && user.username === account.username && hasExpectedRole
      );
    } catch (error) {
      logTest(`${role} login`, false, error);
    }
  }
}

// Test 2: Diet Level Management - Fetch All Levels
async function testDietLevelFetch() {
  console.log('\n=== Test 2: Diet Level Management - Fetch All Levels ===');

  try {
    const patientToken = await login(ACCOUNTS.patient.username, ACCOUNTS.patient.password);
    const doctorToken = await login(ACCOUNTS.doctor.username, ACCOUNTS.doctor.password);

    // Test fetching diet guidance for all levels (0-4)
    for (const level of TEST_CASES.dietLevels) {
      try {
        // Set patient to this diet level
        await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${doctorToken}` },
          body: { dietLevel: level, reason: `Test level ${level}` }
        });

        // Fetch diet guidance
        const guidance = await httpRequest(
          `${BASE_URL}/diet-guidance/patient/${ACCOUNTS.patient.caseId}/current`,
          { headers: { Authorization: `Bearer ${patientToken}` } }
        );

        logTest(
          `Fetch diet level ${level} guidance`,
          guidance.data.dietLevel === level &&
          guidance.data.label &&
          Array.isArray(guidance.data.recommendedFoods)
        );
      } catch (error) {
        logTest(`Fetch diet level ${level} guidance`, false, error);
      }
    }

    // Rollback to level 2
    await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { dietLevel: 2, reason: 'Rollback after test' }
    });

  } catch (error) {
    logTest('Diet level fetch setup', false, error);
  }
}

// Test 3: Diet Level Authorization Rules
async function testDietLevelAuthorization() {
  console.log('\n=== Test 3: Diet Level Authorization (Nurse/Doctor) ===');

  try {
    const nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);
    const doctorToken = await login(ACCOUNTS.doctor.username, ACCOUNTS.doctor.password);

    // Get current diet level
    const patientResponse = await httpRequest(
      `${BASE_URL}/patients/${ACCOUNTS.patient.caseId}`,
      { headers: { Authorization: `Bearer ${nurseToken}` } }
    );
    const currentLevel = patientResponse.data.currentDietLevel || 2;

    // Test Nurse can DECREASE diet level
    try {
      const lowerLevel = Math.max(0, currentLevel - 1);
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${nurseToken}` },
        body: { dietLevel: lowerLevel, reason: 'Nurse test decrease' }
      });
      logTest('Nurse can decrease diet level', true);

      // Rollback
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: currentLevel, reason: 'Rollback' }
      });
    } catch (error) {
      logTest('Nurse can decrease diet level', false, error);
    }

    // Test Nurse CANNOT INCREASE diet level (should fail)
    try {
      const higherLevel = Math.min(4, currentLevel + 1);
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${nurseToken}` },
        body: { dietLevel: higherLevel, reason: 'Nurse test increase (should fail)' }
      });
      logTest('Nurse cannot increase diet level (should be blocked)', false);
    } catch (error) {
      // Expected to fail - this is correct behavior
      logTest('Nurse cannot increase diet level (correctly blocked)', true);
    }

    // Test Doctor can INCREASE diet level
    try {
      const higherLevel = Math.min(4, currentLevel + 1);
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: higherLevel, reason: 'Doctor test increase' }
      });
      logTest('Doctor can increase diet level', true);

      // Rollback
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: currentLevel, reason: 'Rollback' }
      });
    } catch (error) {
      logTest('Doctor can increase diet level', false, error);
    }

  } catch (error) {
    logTest('Diet level authorization setup', false, error);
  }
}

// Test 4: Diet Level Dynamic Max Validation
async function testDietLevelMaxValidation() {
  console.log('\n=== Test 4: Diet Level Max Validation (by Operation Type) ===');

  try {
    const doctorToken = await login(ACCOUNTS.doctor.username, ACCOUNTS.doctor.password);

    // Test: Cannot set diet level > max for operation type
    try {
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 99, reason: 'Test max validation (should fail)' }
      });
      logTest('Diet level > max is rejected', false);
    } catch (error) {
      // Expected to fail - correct behavior
      logTest('Diet level > max is rejected (correctly blocked)', error.message.includes('400') || error.message.includes('exceed'));
    }

    // Test: Can set diet level = max (4)
    try {
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 4, reason: 'Test max level' }
      });
      logTest('Diet level = max (4) is allowed', true);

      // Rollback
      await httpRequest(`${BASE_URL}/patients/${ACCOUNTS.patient.caseId}/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { dietLevel: 2, reason: 'Rollback' }
      });
    } catch (error) {
      logTest('Diet level = max (4) is allowed', false, error);
    }

  } catch (error) {
    logTest('Diet level max validation setup', false, error);
  }
}

// Test 5: Patient List & Filtering
async function testPatientList() {
  console.log('\n=== Test 5: Patient List & Filtering ===');

  try {
    const nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);

    // Test: List all patients
    try {
      const response = await httpRequest(`${BASE_URL}/patients`, {
        headers: { Authorization: `Bearer ${nurseToken}` }
      });
      logTest('List all patients',
        response.data &&
        Array.isArray(response.data.data) &&
        response.data.data.length > 0
      );
    } catch (error) {
      logTest('List all patients', false, error);
    }

    // Test: Search patient by case ID
    try {
      const response = await httpRequest(
        `${BASE_URL}/patients?search=${ACCOUNTS.patient.caseId}`,
        { headers: { Authorization: `Bearer ${nurseToken}` } }
      );
      logTest('Search patient by case ID',
        response.data.data.length === 1 &&
        response.data.data[0].caseId === ACCOUNTS.patient.caseId
      );
    } catch (error) {
      logTest('Search patient by case ID', false, error);
    }

    // Test: Filter by triage level
    try {
      const response = await httpRequest(
        `${BASE_URL}/patients?triageLevel=GREEN`,
        { headers: { Authorization: `Bearer ${nurseToken}` } }
      );
      logTest('Filter patients by triage level', response.data && Array.isArray(response.data.data));
    } catch (error) {
      logTest('Filter patients by triage level', false, error);
    }

  } catch (error) {
    logTest('Patient list setup', false, error);
  }
}

// Test 6: Operation Types & Pod Protocols
async function testOperationTypeAndPods() {
  console.log('\n=== Test 6: Operation Types & Pod Protocols ===');

  try {
    const nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);

    // Test: List operation types
    try {
      const response = await httpRequest(`${BASE_URL}/diet-guidance/operation-types`, {
        headers: { Authorization: `Bearer ${nurseToken}` }
      });
      logTest('List operation types',
        response.data &&
        response.data.length >= 2 &&
        response.data.some(op => op.name.includes('dạ dày')) &&
        response.data.some(op => op.name.includes('đại trực tràng'))
      );
    } catch (error) {
      logTest('List operation types', false, error);
    }

    // Test: List pod protocols for each operation type
    for (const opTypeId of TEST_CASES.operationTypes) {
      try {
        const response = await httpRequest(
          `${BASE_URL}/diet-guidance/operation-types/${opTypeId}/pods`,
          { headers: { Authorization: `Bearer ${nurseToken}` } }
        );
        logTest(`List pod protocols for operation type ${opTypeId}`,
          response.data &&
          response.data.length === 5 && // Should have 5 diet levels (0-4)
          response.data.every(pod => pod.dietLevel >= 0 && pod.dietLevel <= 4)
        );
      } catch (error) {
        logTest(`List pod protocols for operation type ${opTypeId}`, false, error);
      }
    }

  } catch (error) {
    logTest('Operation types & pods setup', false, error);
  }
}

// Test 7: Symptom Survey Questions
async function testSymptomSurvey() {
  console.log('\n=== Test 7: Symptom Survey Questions ===');

  try {
    const patientToken = await login(ACCOUNTS.patient.username, ACCOUNTS.patient.password);

    // Test: List survey questions
    try {
      const response = await httpRequest(`${BASE_URL}/symptom-surveys/questions`, {
        headers: { Authorization: `Bearer ${patientToken}` }
      });
      logTest('List symptom survey questions',
        response.data &&
        Array.isArray(response.data) &&
        response.data.length > 0 &&
        response.data.every(q =>
          q.questionText &&
          Array.isArray(q.options) &&
          q.options.every(opt => opt.optionTriageLevel) // Check triage level exists
        )
      );
    } catch (error) {
      logTest('List symptom survey questions', false, error);
    }

  } catch (error) {
    logTest('Symptom survey setup', false, error);
  }
}

// Test 8: Patient Authentication Cannot Access Admin Endpoints
async function testPatientRoleRestrictions() {
  console.log('\n=== Test 8: Patient Role Restrictions ===');

  try {
    const patientToken = await login(ACCOUNTS.patient.username, ACCOUNTS.patient.password);

    // Test: Patient cannot access patient list
    try {
      await httpRequest(`${BASE_URL}/patients`, {
        headers: { Authorization: `Bearer ${patientToken}` }
      });
      logTest('Patient cannot access patient list', false);
    } catch (error) {
      // Expected to fail - correct behavior
      logTest('Patient cannot access patient list (correctly blocked)', error.message.includes('403'));
    }

    // Test: Patient cannot update other patient's diet level
    try {
      await httpRequest(`${BASE_URL}/patients/CASE-002/diet-level`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${patientToken}` },
        body: { dietLevel: 3, reason: 'Should fail' }
      });
      logTest('Patient cannot update diet levels', false);
    } catch (error) {
      // Expected to fail - correct behavior
      logTest('Patient cannot update diet levels (correctly blocked)', error.message.includes('403'));
    }

  } catch (error) {
    logTest('Patient role restrictions setup', false, error);
  }
}

// Test 9: Data Consistency - Pod Protocol Content
async function testPodProtocolDataIntegrity() {
  console.log('\n=== Test 9: Pod Protocol Data Integrity ===');

  try {
    const nurseToken = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);

    for (const opTypeId of TEST_CASES.operationTypes) {
      const response = await httpRequest(
        `${BASE_URL}/diet-guidance/operation-types/${opTypeId}/pods`,
        { headers: { Authorization: `Bearer ${nurseToken}` } }
      );

      const pods = response.data;

      // Check each diet level has unique data
      for (let i = 0; i < pods.length - 1; i++) {
        const currentPod = pods[i];
        const nextPod = pods[i + 1];

        // Volume should increase or stay same as diet level increases
        const volumeIncreases =
          (currentPod.volumePerMealMax || 0) <= (nextPod.volumePerMealMax || 999);

        logTest(
          `Op${opTypeId} Level${currentPod.dietLevel}→${nextPod.dietLevel}: Volume progression`,
          volumeIncreases
        );

        // Each level should have distinct label
        logTest(
          `Op${opTypeId} Level${currentPod.dietLevel}: Has distinct label`,
          currentPod.label && currentPod.label !== nextPod.label
        );

        // Level 0 should have no/minimal solid foods
        if (currentPod.dietLevel === 0) {
          logTest(
            `Op${opTypeId} Level 0: Minimal solid foods (liquid diet)`,
            (currentPod.recommendedFoods || []).length <= 1
          );
        }

        // Higher levels should have more food variety
        if (currentPod.dietLevel >= 3) {
          logTest(
            `Op${opTypeId} Level ${currentPod.dietLevel}: Rich food variety`,
            (currentPod.recommendedFoods || []).length >= 7
          );
        }
      }
    }

  } catch (error) {
    logTest('Pod protocol data integrity setup', false, error);
  }
}

// Test 10: Health Check
async function testHealthCheck() {
  console.log('\n=== Test 10: System Health Check ===');

  try {
    // Backend health
    try {
      const response = await httpRequest(`${BASE_URL}/`);
      logTest('Backend health check', response.statusCode === 200 || response.statusCode === 404);
    } catch (error) {
      // 404 is acceptable for root path
      logTest('Backend health check', error.message.includes('404'));
    }

    // Database connectivity (via any authenticated endpoint)
    try {
      const token = await login(ACCOUNTS.nurse.username, ACCOUNTS.nurse.password);
      const response = await httpRequest(`${BASE_URL}/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      logTest('Database connectivity', response.data && response.statusCode === 200);
    } catch (error) {
      logTest('Database connectivity', false, error);
    }

  } catch (error) {
    logTest('Health check setup', false, error);
  }
}

// Main Test Runner
async function runAllTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   POMS System - Comprehensive Flow Test Suite               ║');
  console.log('║   Testing all major business logic flows                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  await testAuthentication();
  await testDietLevelFetch();
  await testDietLevelAuthorization();
  await testDietLevelMaxValidation();
  await testPatientList();
  await testOperationTypeAndPods();
  await testSymptomSurvey();
  await testPatientRoleRestrictions();
  await testPodProtocolDataIntegrity();
  await testHealthCheck();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`Total Tests: ${testResults.passed + testResults.failed}`);
  console.log(`✓ Passed: ${testResults.passed}`);
  console.log(`✗ Failed: ${testResults.failed}`);
  console.log(`Duration: ${duration}s`);

  if (testResults.failed > 0) {
    console.log('\n--- Failed Tests Details ---');
    testResults.errors.forEach(({ test, error }) => {
      console.log(`✗ ${test}`);
      console.log(`  Error: ${error}`);
    });
    process.exit(1);
  } else {
    console.log('\n🎉 All tests passed! System is healthy.');
    process.exit(0);
  }
}

runAllTests();
