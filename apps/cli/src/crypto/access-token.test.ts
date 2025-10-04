import { AccessToken } from './access-token';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testRoundTrip() {
  console.log('Testing round-trip encoding/decoding...');
  
  const tokenValue = 'abcdefghijklmnopqrstuvwxyz123456'; // exactly 32 chars
  const token = new AccessToken(tokenValue);
  
  const encoded = token.toString();
  console.log(`  Encoded token: ${encoded}`);
  console.log(`  Token length: ${encoded.length}`);
  
  const decoded = AccessToken.fromString(encoded);
  
  assert(decoded.tokenValue === tokenValue, 
    `Token value mismatch: expected "${tokenValue}", got "${decoded.tokenValue}"`);
  
  assert(decoded.privateKey.length === token.privateKey.length,
    'Private key length mismatch');
  
  assert(decoded.privateKey.every((byte, i) => byte === token.privateKey[i]),
    'Private key bytes mismatch');
  
  assert(decoded.publicKey.every((byte, i) => byte === token.publicKey[i]),
    'Public key bytes mismatch');
  
  assert(decoded.version === token.version,
    'Version mismatch');
  
  assert(decoded.algorithm === token.algorithm,
    'Algorithm mismatch');
  
  console.log('  ✓ Round-trip successful\n');
}

function testMultipleTokens() {
  console.log('Testing multiple different tokens...');
  
  const testValues = [
    '12345678901234567890123456789012', // numbers
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ123456', // uppercase
    'abcdefghijklmnopqrstuvwxyz123456', // lowercase
    'aBcDeFgHiJkLmNoPqRsTuVwXyZ123456', // mixed case
    '--------------------------------', // special chars
  ];
  
  for (const value of testValues) {
    const token = new AccessToken(value);
    const encoded = token.toString();
    const decoded = AccessToken.fromString(encoded);
    
    assert(decoded.tokenValue === value,
      `Failed for value "${value}": got "${decoded.tokenValue}"`);
    
    console.log(`  ✓ Token value "${value}"`);
  }
  
  console.log('  ✓ Multiple tokens successful\n');
}

function testWithSpecificPrivateKey() {
  console.log('Testing with specific private key...');
  
  const tokenValue = 'test-token-32-chars-exactly-okay'; // exactly 32 chars
  const privateKey = new Uint8Array(32).fill(42); // All bytes set to 42
  
  const token = new AccessToken(tokenValue, privateKey);
  const encoded = token.toString();
  const decoded = AccessToken.fromString(encoded);
  
  assert(decoded.privateKey.every(byte => byte === 42),
    'Private key not preserved');
  
  assert(decoded.tokenValue === tokenValue,
    'Token value not preserved');
  
  console.log('  ✓ Specific private key successful\n');
}

function testInvalidInputs() {
  console.log('Testing invalid inputs...');
  
  // Test invalid token value length
  try {
    new AccessToken('too-short');
    assert(false, 'Should have thrown for short token value');
  } catch (e) {
    console.log('  ✓ Rejected short token value');
  }
  
  try {
    new AccessToken('this-token-value-is-way-too-long-for-32-chars');
    assert(false, 'Should have thrown for long token value');
  } catch (e) {
    console.log('  ✓ Rejected long token value');
  }
  
  // Test invalid base64
  try {
    AccessToken.fromString('not-valid-base64!!!');
    assert(false, 'Should have thrown for invalid base64');
  } catch (e) {
    console.log('  ✓ Rejected invalid base64');
  }
  
  // Test wrong length
  try {
    const shortToken = Buffer.from([1, 2, 3]).toString('base64');
    AccessToken.fromString(shortToken);
    assert(false, 'Should have thrown for wrong length');
  } catch (e) {
    console.log('  ✓ Rejected wrong encoded length');
  }
  
  // Test invalid private key length
  try {
    const shortKey = new Uint8Array(16); // Only 16 bytes instead of 32
    new AccessToken('12345678901234567890123456789012', shortKey);
    assert(false, 'Should have thrown for short private key');
  } catch (e) {
    console.log('  ✓ Rejected short private key');
  }
  
  console.log('  ✓ Invalid inputs handled correctly\n');
}

async function main() {
  console.log('\n=== Access Token Tests ===\n');
  
  try {
    testRoundTrip();
    testMultipleTokens();
    testWithSpecificPrivateKey();
    testInvalidInputs();
    
    console.log('=== All tests passed! ===\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();

