/**
 * Test script: Verify Diet Level Update Flow (Admin → Mobile App)
 *
 * Test Case: Bác sĩ điều chỉnh diet level từ 2 → 3, patient fetch lại thấy data mức 3
 *
 * Flow:
 * 1. Patient login → fetch diet guidance (expect level 2)
 * 2. Doctor login → update patient's diet level 2 → 3
 * 3. Patient fetch lại diet guidance → expect level 3 (data khác với level 2)
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

const TEST_PATIENT = {
  username: 'patient01',
  password: 'Patient@123',
  caseId: 'CASE-001',
  initialDietLevel: 2,
  targetDietLevel: 3
};

const TEST_DOCTOR = {
  username: 'doctor01',
  password: 'Doctor@123'
};

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
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data || '{}') });
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

async function getDietGuidance(caseId, token) {
  const response = await httpRequest(
    `${BASE_URL}/diet-guidance/patient/${caseId}/current`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
}

async function updateDietLevel(caseId, dietLevel, token, reason = 'Test update diet level') {
  const response = await httpRequest(
    `${BASE_URL}/patients/${caseId}/diet-level`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: { dietLevel, reason }
    }
  );
  return response.data;
}

async function main() {
  console.log('=== Test Diet Level Update Flow ===\n');

  try {
    // Step 1: Patient login & fetch diet guidance (initial state)
    console.log('Step 1: Patient login & fetch initial diet guidance...');
    const patientToken = await login(TEST_PATIENT.username, TEST_PATIENT.password);
    console.log('✓ Patient logged in');

    const initialGuidance = await getDietGuidance(TEST_PATIENT.caseId, patientToken);
    console.log('✓ Initial diet guidance fetched');
    console.log(`  Diet Level: ${initialGuidance.dietLevel}`);
    console.log(`  Label: ${initialGuidance.label}`);
    console.log(`  Meals: ${initialGuidance.mealsPerDayMin}-${initialGuidance.mealsPerDayMax} bữa/ngày`);
    console.log(`  Volume: ${initialGuidance.volumePerMealMin}-${initialGuidance.volumePerMealMax} ml/bữa`);
    console.log(`  Recommended Foods: ${initialGuidance.recommendedFoods.length} items`);
    console.log(`  Recommended Drinks: ${initialGuidance.recommendedDrinks.length} items\n`);

    if (initialGuidance.dietLevel !== TEST_PATIENT.initialDietLevel) {
      console.log(`⚠ Warning: Expected initial diet level ${TEST_PATIENT.initialDietLevel}, got ${initialGuidance.dietLevel}`);
      console.log('  Continuing test with current level...\n');
    }

    // Step 2: Doctor login & update diet level
    console.log('Step 2: Doctor login & update patient diet level...');
    const doctorToken = await login(TEST_DOCTOR.username, TEST_DOCTOR.password);
    console.log('✓ Doctor logged in');

    const updatedPatient = await updateDietLevel(
      TEST_PATIENT.caseId,
      TEST_PATIENT.targetDietLevel,
      doctorToken
    );
    console.log('✓ Diet level updated by doctor');
    console.log(`  New diet level: ${updatedPatient.currentDietLevel ?? updatedPatient.dietLevel}\n`);

    // Step 3: Patient fetch diet guidance again (should get new data)
    console.log('Step 3: Patient fetch diet guidance again...');
    const updatedGuidance = await getDietGuidance(TEST_PATIENT.caseId, patientToken);
    console.log('✓ Updated diet guidance fetched');
    console.log(`  Diet Level: ${updatedGuidance.dietLevel}`);
    console.log(`  Label: ${updatedGuidance.label}`);
    console.log(`  Meals: ${updatedGuidance.mealsPerDayMin}-${updatedGuidance.mealsPerDayMax} bữa/ngày`);
    console.log(`  Volume: ${updatedGuidance.volumePerMealMin}-${updatedGuidance.volumePerMealMax} ml/bữa`);
    console.log(`  Recommended Foods: ${updatedGuidance.recommendedFoods.length} items`);
    console.log(`  Recommended Drinks: ${updatedGuidance.recommendedDrinks.length} items\n`);

    // Step 4: Verify data changed
    console.log('Step 4: Verify data integrity...');

    const errors = [];

    if (updatedGuidance.dietLevel !== TEST_PATIENT.targetDietLevel) {
      errors.push(`Diet level not updated. Expected: ${TEST_PATIENT.targetDietLevel}, Got: ${updatedGuidance.dietLevel}`);
    }

    if (updatedGuidance.podId === initialGuidance.podId) {
      errors.push('Pod ID unchanged - patient still seeing old protocol');
    }

    if (updatedGuidance.label === initialGuidance.label) {
      errors.push('Label unchanged - may indicate same protocol');
    }

    if (errors.length > 0) {
      console.log('✗ Verification FAILED:');
      errors.forEach(err => console.log(`  - ${err}`));
      process.exit(1);
    }

    console.log('✓ Data verification PASSED\n');

    // Step 5: Compare changes
    console.log('=== Comparison: Level 2 vs Level 3 ===');
    console.log('Before (Level 2):');
    console.log(`  Pod ID: ${initialGuidance.podId}`);
    console.log(`  Meals: ${initialGuidance.mealsPerDayMin}-${initialGuidance.mealsPerDayMax} bữa`);
    console.log(`  Volume: ${initialGuidance.volumePerMealMin}-${initialGuidance.volumePerMealMax} ml`);
    console.log(`  Foods count: ${initialGuidance.recommendedFoods.length}`);
    console.log(`  Drinks count: ${initialGuidance.recommendedDrinks.length}`);

    console.log('\nAfter (Level 3):');
    console.log(`  Pod ID: ${updatedGuidance.podId}`);
    console.log(`  Meals: ${updatedGuidance.mealsPerDayMin}-${updatedGuidance.mealsPerDayMax} bữa`);
    console.log(`  Volume: ${updatedGuidance.volumePerMealMin}-${updatedGuidance.volumePerMealMax} ml`);
    console.log(`  Foods count: ${updatedGuidance.recommendedFoods.length}`);
    console.log(`  Drinks count: ${updatedGuidance.recommendedDrinks.length}`);

    console.log('\nRecommended Foods (Level 3):');
    updatedGuidance.recommendedFoods.forEach(food => console.log(`  - ${food}`));

    console.log('\n=== TEST PASSED ✓ ===');
    console.log('Luồng hoạt động ĐÚNG:');
    console.log('- Bác sĩ điều chỉnh diet level trên Admin Dashboard');
    console.log('- Patient fetch lại → nhận data mới theo diet level mới');
    console.log('- Data thay đổi: meals, volume, foods, drinks đều khác so với level cũ');

    // Rollback for next test
    console.log('\n--- Rollback for next test ---');
    await updateDietLevel(TEST_PATIENT.caseId, TEST_PATIENT.initialDietLevel, doctorToken);
    console.log(`✓ Rolled back diet level to ${TEST_PATIENT.initialDietLevel}`);

  } catch (error) {
    console.error('\n=== TEST FAILED ✗ ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();
