/**
 * Test script: Verify Diet Guidance Flow
 *
 * Test Case: Patient với diet level 2 phải nhận đúng data của mức ăn 2
 *
 * Expected:
 * - CASE-001 (operation_type_id=2, current_diet_level=2)
 * - Should receive pod_protocol with diet_level=2
 * - Data must match: meals, volume, foods, drinks from DB
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Test credentials (patient account)
const TEST_PATIENT = {
  username: 'patient01',
  password: 'Patient@123',
  expectedCaseId: 'CASE-001',
  expectedDietLevel: 2,
  expectedOperationType: 2 // Phẫu thuật đại trực tràng
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
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
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

async function main() {
  console.log('=== Test Diet Guidance Flow ===\n');

  try {
    // Step 1: Login as patient
    console.log('Step 1: Login as patient...');
    const loginResponse = await httpRequest(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        username: TEST_PATIENT.username,
        password: TEST_PATIENT.password
      }
    });

    const { accessToken } = loginResponse.data;
    console.log('✓ Login successful');
    console.log(`  Access Token: ${accessToken.substring(0, 20)}...\n`);

    // Step 2: Get current user info
    console.log('Step 2: Get current user info...');
    const meResponse = await httpRequest(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const user = meResponse.data;
    console.log('✓ User info retrieved');
    console.log(`  User ID: ${user.userId}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Case ID: ${user.caseId}\n`);

    if (user.caseId !== TEST_PATIENT.expectedCaseId) {
      throw new Error(`Case ID mismatch. Expected: ${TEST_PATIENT.expectedCaseId}, Got: ${user.caseId}`);
    }

    // Step 3: Get current diet guidance
    console.log('Step 3: Get current diet guidance...');
    const dietGuidanceResponse = await httpRequest(
      `${BASE_URL}/diet-guidance/patient/${user.caseId}/current`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const protocol = dietGuidanceResponse.data;
    console.log('✓ Diet guidance retrieved');
    console.log(`  Pod ID: ${protocol.podId}`);
    console.log(`  Operation Type ID: ${protocol.operationTypeId}`);
    console.log(`  Diet Level: ${protocol.dietLevel}`);
    console.log(`  Label: ${protocol.label}\n`);

    // Step 4: Verify data integrity
    console.log('Step 4: Verify data integrity...');

    const errors = [];

    // Check diet level matches patient's current diet level
    if (protocol.dietLevel !== TEST_PATIENT.expectedDietLevel) {
      errors.push(`Diet level mismatch. Expected: ${TEST_PATIENT.expectedDietLevel}, Got: ${protocol.dietLevel}`);
    }

    // Check operation type matches
    if (protocol.operationTypeId !== TEST_PATIENT.expectedOperationType) {
      errors.push(`Operation type mismatch. Expected: ${TEST_PATIENT.expectedOperationType}, Got: ${protocol.operationTypeId}`);
    }

    // Check required fields are present
    if (!protocol.label) errors.push('Missing label');
    if (protocol.mealsPerDayMin === undefined) errors.push('Missing mealsPerDayMin');
    if (protocol.mealsPerDayMax === undefined) errors.push('Missing mealsPerDayMax');
    if (protocol.volumePerMealMin === undefined) errors.push('Missing volumePerMealMin');
    if (protocol.volumePerMealMax === undefined) errors.push('Missing volumePerMealMax');
    if (!Array.isArray(protocol.recommendedFoods)) errors.push('recommendedFoods not an array');
    if (!Array.isArray(protocol.recommendedDrinks)) errors.push('recommendedDrinks not an array');

    if (errors.length > 0) {
      console.log('✗ Data integrity check FAILED:');
      errors.forEach(err => console.log(`  - ${err}`));
      process.exit(1);
    }

    console.log('✓ Data integrity check PASSED\n');

    // Step 5: Display detailed protocol data
    console.log('=== Diet Protocol Details ===');
    console.log(`Label: ${protocol.label}`);
    console.log(`Meals per day: ${protocol.mealsPerDayMin} - ${protocol.mealsPerDayMax} bữa`);
    console.log(`Volume per meal: ${protocol.volumePerMealMin} - ${protocol.volumePerMealMax} ml`);
    console.log(`\nMeal Instruction:`);
    console.log(`  ${protocol.mealInstruction || '(none)'}`);
    console.log(`\nVolume Instruction:`);
    console.log(`  ${protocol.volumeInstruction || '(none)'}`);
    console.log(`\nRecommended Foods (${protocol.recommendedFoods.length}):`);
    protocol.recommendedFoods.forEach(food => console.log(`  - ${food}`));
    console.log(`\nRecommended Drinks (${protocol.recommendedDrinks.length}):`);
    protocol.recommendedDrinks.forEach(drink => console.log(`  - ${drink}`));
    console.log(`\nForbidden Foods (${protocol.forbiddenFoods?.length || 0}):`);
    (protocol.forbiddenFoods || []).forEach(food => console.log(`  - ${food}`));
    console.log(`\nForbidden Drinks (${protocol.forbiddenDrinks?.length || 0}):`);
    (protocol.forbiddenDrinks || []).forEach(drink => console.log(`  - ${drink}`));
    console.log(`\nUpgrade Criteria (${protocol.upgradeCriteria?.length || 0}):`);
    (protocol.upgradeCriteria || []).forEach(criteria => console.log(`  - ${criteria}`));

    console.log('\n=== TEST PASSED ✓ ===');
    console.log('Patient nhận đúng data theo diet level được chỉ định trong hệ thống.');

  } catch (error) {
    console.error('\n=== TEST FAILED ✗ ===');
    console.error(error.message);
    process.exit(1);
  }
}

main();
