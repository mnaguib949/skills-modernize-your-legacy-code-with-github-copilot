'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const {
  formatBalance,
  parseAmount,
  dataOperation,
  readBalance,
  writeBalance,
  performOperation,
} = require('./index');

const application = path.join(__dirname, 'index.js');

function runApplication(input) {
  return spawnSync(process.execPath, [application], {
    input,
    encoding: 'utf8',
  });
}

function outputFor(input) {
  const result = runApplication(input);
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  return result.stdout;
}

describe('account management application', () => {
  test('TC-001 displays the account menu at startup', () => {
    const output = outputFor('4\n');

    expect(output).toContain('Account Management System');
    expect(output).toContain('1. View Balance');
    expect(output).toContain('2. Credit Account');
    expect(output).toContain('3. Debit Account');
    expect(output).toContain('4. Exit');
  });

  test('TC-002 displays the initial balance', () => {
    expect(outputFor('1\n4\n')).toContain('Current balance: 001000.00');
  });

  test('TC-003 displays the latest balance after an update', () => {
    expect(outputFor('2\n250\n1\n4\n')).toContain('Current balance: 001250.00');
  });

  test.each([
    ['TC-004', '250', '001250.00'],
    ['TC-005', '125.50', '001125.50'],
    ['TC-006', '0', '001000.00'],
  ])('%s credits an amount and displays %s', (_id, amount, balance) => {
    const output = outputFor(`2\n${amount}\n1\n4\n`);

    expect(output).toContain(`Amount credited. New balance: ${balance}`);
    expect(output).toContain(`Current balance: ${balance}`);
  });

  test('TC-007 rejects a credit that exceeds the supported balance range', () => {
    const output = outputFor('2\n999999.99\n1\n4\n');

    expect(output).toContain('Amount exceeds the supported account balance.');
    expect(output).toContain('Current balance: 001000.00');
  });

  test('TC-008 debits an amount below the available balance', () => {
    const output = outputFor('3\n250\n1\n4\n');

    expect(output).toContain('Amount debited. New balance: 000750.00');
    expect(output).toContain('Current balance: 000750.00');
  });

  test('TC-009 debits the exact available balance', () => {
    const output = outputFor('3\n1000\n1\n4\n');

    expect(output).toContain('Amount debited. New balance: 000000.00');
    expect(output).toContain('Current balance: 000000.00');
  });

  test.each([
    ['TC-010', '1000.01', '001000.00'],
    ['TC-011', '0', '001000.00'],
  ])('%s handles debit amount %s', (_id, amount, balance) => {
    const output = outputFor(`3\n${amount}\n1\n4\n`);

    if (amount === '1000.01') {
      expect(output).toContain('Insufficient funds for this debit.');
    } else {
      expect(output).toContain('Amount debited. New balance: 001000.00');
    }
    expect(output).toContain(`Current balance: ${balance}`);
  });

  test('TC-012 rejects a debit after the balance reaches zero', () => {
    const output = outputFor('3\n1000\n3\n0.01\n4\n');

    expect(output).toContain('Amount debited. New balance: 000000.00');
    expect(output).toContain('Insufficient funds for this debit.');
  });

  test('TC-013 applies multiple credits and debits sequentially', () => {
    const output = outputFor('2\n500\n3\n200\n2\n25.75\n1\n4\n');

    expect(output).toContain('Current balance: 001325.75');
  });

  test('TC-014 continues to process valid choices after an operation', () => {
    const output = outputFor('1\n1\n4\n');

    expect((output.match(/Current balance: 001000.00/g) || []).length).toBe(2);
  });

  test('TC-015 exits with the goodbye message and no later menu', () => {
    const output = outputFor('4\n');

    expect(output).toContain('Exiting the program. Goodbye!');
    expect(output.lastIndexOf('Account Management System')).toBeLessThan(
      output.indexOf('Exiting the program. Goodbye!'),
    );
  });

  test.each([
    ['TC-016', '0'],
    ['TC-017', '5'],
  ])('%s rejects menu choice %s', (_id, choice) => {
    const output = outputFor(`${choice}\n4\n`);

    expect(output).toContain('Invalid choice, please select 1-4.');
    expect(output).toContain('Account Management System');
  });

  test('TC-018 handles non-numeric menu input without running an operation', () => {
    const output = outputFor('X\n4\n');

    expect(output).toContain('Invalid choice, please select 1-4.');
    expect(output).not.toContain('Current balance:');
    expect(output).not.toContain('Amount credited.');
    expect(output).not.toContain('Amount debited.');
  });
});

describe('account storage and operations', () => {
  beforeEach(() => writeBalance(100000));

  test('TC-019 READ returns the stored balance without changing it', () => {
    writeBalance(123456);

    expect(dataOperation('READ')).toBe(123456);
    expect(readBalance()).toBe(123456);
  });

  test('TC-020 WRITE replaces the stored balance', () => {
    dataOperation('WRITE', 123456);

    expect(readBalance()).toBe(123456);
  });

  test('TC-021 unsupported storage operations have no effect', () => {
    writeBalance(100000);

    expect(dataOperation('ARCHIVE', 123456)).toBe(123456);
    expect(readBalance()).toBe(100000);
  });

  test('TC-022 unsupported operations have no business effect', async () => {
    const ask = jest.fn();
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await performOperation('UNKNOWN', ask);

    expect(ask).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(readBalance()).toBe(100000);
    log.mockRestore();
  });

  test('TC-023 preserves two-decimal precision and the supported range', async () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    await performOperation('CREDIT', async () => '0.01');
    expect(readBalance()).toBe(100001);
    expect(formatBalance(readBalance())).toBe('001000.01');

    await performOperation('CREDIT', async () => '999999.99');
    expect(readBalance()).toBe(100001);
    expect(log).toHaveBeenCalledWith('Amount exceeds the supported account balance.');
    log.mockRestore();
  });

  test('formats and parses supported monetary values', () => {
    expect(formatBalance(99999999)).toBe('999999.99');
    expect(parseAmount('125.5')).toBe(12550);
    expect(parseAmount('125.50')).toBe(12550);
    expect(parseAmount('-1')).toBeNull();
    expect(parseAmount('1.234')).toBeNull();
  });
});