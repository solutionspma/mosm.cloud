/**
 * Phase D Enforcement Tests
 * 
 * Run with: npx ts-node tests/enforcement.test.ts
 * 
 * These tests prove the enforcement matrix without needing
 * a running server or Stripe connection.
 */

import { 
  enforceBillingForPairing, 
  enforceDeviceLimit,
  isBillingActive,
  ACTIVE_BILLING_STATUSES,
  BLOCKED_BILLING_STATUSES,
  getEnforcementLogs,
} from '../src/billing/enforce.js';

import { pairDevice, canPairDevice } from '../src/devices/pair.js';

// Test accounts
const unpaidAccount = {
  id: 'org-unpaid-001',
  billing_status: 'unpaid',
  plan: { max_devices: 3 },
  device_count: 0,
};

const paidAccount = {
  id: 'org-paid-001',
  billing_status: 'paid',
  plan: { max_devices: 3 },
  device_count: 0,
};

const trialingAccount = {
  id: 'org-trial-001',
  billing_status: 'trialing',
  plan: { max_devices: 3 },
  device_count: 0,
};

const pastDueAccount = {
  id: 'org-pastdue-001',
  billing_status: 'past_due',
  plan: { max_devices: 3 },
  device_count: 0,
};

const atLimitAccount = {
  id: 'org-limit-001',
  billing_status: 'paid',
  plan: { max_devices: 3 },
  device_count: 3, // Already at limit
};

// Test runner
let passed = 0;
let failed = 0;

function test(name: string, fn: () => boolean) {
  try {
    const result = fn();
    if (result) {
      console.log(`✅ ${name}`);
      passed++;
    } else {
      console.log(`❌ ${name} - assertion failed`);
      failed++;
    }
  } catch (error: any) {
    console.log(`❌ ${name} - ${error.message}`);
    failed++;
  }
}

console.log('\n🧪 PHASE D ENFORCEMENT TESTS\n');
console.log('=' .repeat(50));

// Scenario 1: Unpaid Account
console.log('\n📋 Scenario 1: Unpaid Account\n');

test('Unpaid billing_status is NOT in active list', () => {
  return !ACTIVE_BILLING_STATUSES.includes('unpaid');
});

test('Unpaid billing_status IS in blocked list', () => {
  return BLOCKED_BILLING_STATUSES.includes('unpaid');
});

test('isBillingActive returns false for unpaid', () => {
  return isBillingActive('unpaid') === false;
});

test('enforceBillingForPairing blocks unpaid', () => {
  const result = enforceBillingForPairing(unpaidAccount);
  return result.allowed === false && result.code === 'BILLING_INACTIVE';
});

test('canPairDevice returns false for unpaid', () => {
  const result = canPairDevice(unpaidAccount);
  return result.allowed === false && result.code === 'BILLING_INACTIVE';
});

// Scenario 2: Paid Account
console.log('\n📋 Scenario 2: Paid Account\n');

test('Paid billing_status IS in active list', () => {
  return ACTIVE_BILLING_STATUSES.includes('paid');
});

test('isBillingActive returns true for paid', () => {
  return isBillingActive('paid') === true;
});

test('enforceBillingForPairing allows paid', () => {
  const result = enforceBillingForPairing(paidAccount);
  return result.allowed === true;
});

test('canPairDevice returns true for paid', () => {
  const result = canPairDevice(paidAccount);
  return result.allowed === true;
});

// Scenario 3: Trialing Account
console.log('\n📋 Scenario 3: Trialing Account\n');

test('Trialing billing_status IS in active list', () => {
  return ACTIVE_BILLING_STATUSES.includes('trialing');
});

test('isBillingActive returns true for trialing', () => {
  return isBillingActive('trialing') === true;
});

test('enforceBillingForPairing allows trialing', () => {
  const result = enforceBillingForPairing(trialingAccount);
  return result.allowed === true;
});

// Scenario 4: Past Due Account
console.log('\n📋 Scenario 4: Past Due Account\n');

test('Past due billing_status is NOT in active list', () => {
  return !ACTIVE_BILLING_STATUSES.includes('past_due');
});

test('enforceBillingForPairing blocks past_due', () => {
  const result = enforceBillingForPairing(pastDueAccount);
  return result.allowed === false && result.code === 'BILLING_INACTIVE';
});

// Scenario 5: Device Limit
console.log('\n📋 Scenario 5: Device Limit\n');

test('Account at limit cannot add more devices', () => {
  const result = canPairDevice(atLimitAccount);
  return result.allowed === false && result.code === 'DEVICE_LIMIT_EXCEEDED';
});

test('Device limit enforcement throws for over-limit', () => {
  try {
    enforceDeviceLimit(atLimitAccount, 4); // Trying to add 4th device
    return false; // Should have thrown
  } catch (error: any) {
    return error.message.includes('Device limit exceeded');
  }
});

// Scenario 6: Audit Logging
console.log('\n📋 Scenario 6: Audit Logging\n');

test('Enforcement events are logged', () => {
  const logs = getEnforcementLogs();
  return logs.length > 0;
});

test('Logs contain BILLING_ENFORCEMENT type', () => {
  const logs = getEnforcementLogs();
  return logs.every(log => log.type === 'BILLING_ENFORCEMENT');
});

// Summary
console.log('\n' + '=' .repeat(50));
console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed\n`);

if (failed === 0) {
  console.log('🎉 ALL ENFORCEMENT TESTS PASSED!\n');
  console.log('Phase D enforcement is proven.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Review enforcement logic.\n');
  process.exit(1);
}
