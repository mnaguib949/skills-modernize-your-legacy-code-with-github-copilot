'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;
const MAX_BALANCE_CENTS = 99999999;

let storageBalanceCents = INITIAL_BALANCE_CENTS;

function formatBalance(balanceCents) {
  const whole = Math.floor(balanceCents / 100).toString().padStart(6, '0');
  const cents = (balanceCents % 100).toString().padStart(2, '0');
  return `${whole}.${cents}`;
}

function parseAmount(input) {
  const normalized = input.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) {
    return null;
  }

  const [wholePart, fractionPart = ''] = normalized.split('.');
  const amountCents = Number(wholePart) * 100 + Number(fractionPart.padEnd(2, '0'));
  return Number.isSafeInteger(amountCents) && amountCents <= MAX_BALANCE_CENTS
    ? amountCents
    : null;
}

function readBalance() {
  return storageBalanceCents;
}

function writeBalance(balanceCents) {
  storageBalanceCents = balanceCents;
}

function dataOperation(operation, balanceCents) {
  if (operation === 'READ') {
    return readBalance();
  }
  if (operation === 'WRITE') {
    writeBalance(balanceCents);
  }
  return balanceCents;
}

async function performOperation(operation, ask) {
  if (operation === 'TOTAL') {
    console.log(`Current balance: ${formatBalance(dataOperation('READ'))}`);
    return;
  }

  if (operation !== 'CREDIT' && operation !== 'DEBIT') {
    return;
  }

  const prompt = operation === 'CREDIT' ? 'Enter credit amount: ' : 'Enter debit amount: ';
  const amount = parseAmount(await ask(prompt));
  if (amount === null) {
    console.log('Invalid amount, please enter a non-negative amount with up to two decimals.');
    return;
  }

  const balance = dataOperation('READ');
  if (operation === 'CREDIT') {
    if (balance + amount > MAX_BALANCE_CENTS) {
      console.log('Amount exceeds the supported account balance.');
      return;
    }
    dataOperation('WRITE', balance + amount);
    console.log(`Amount credited. New balance: ${formatBalance(dataOperation('READ'))}`);
  } else if (operation === 'DEBIT') {
    if (balance < amount) {
      console.log('Insufficient funds for this debit.');
      return;
    }
    dataOperation('WRITE', balance - amount);
    console.log(`Amount debited. New balance: ${formatBalance(dataOperation('READ'))}`);
  }
}

async function main() {
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = input[Symbol.asyncIterator]();
  const ask = async (prompt) => {
    process.stdout.write(prompt);
    const nextLine = await lines.next();
    return nextLine.done ? '' : nextLine.value;
  };
  let continueRunning = true;

  while (continueRunning) {
    console.log('--------------------------------');
    console.log('Account Management System');
    console.log('1. View Balance');
    console.log('2. Credit Account');
    console.log('3. Debit Account');
    console.log('4. Exit');
    console.log('--------------------------------');

    const choice = (await ask('Enter your choice (1-4): ')).trim();
    if (choice === '1') {
      await performOperation('TOTAL', ask);
    } else if (choice === '2') {
      await performOperation('CREDIT', ask);
    } else if (choice === '3') {
      await performOperation('DEBIT', ask);
    } else if (choice === '4') {
      continueRunning = false;
    } else {
      console.log('Invalid choice, please select 1-4.');
    }
  }

  input.close();
  console.log('Exiting the program. Goodbye!');
}

if (require.main === module) {
  main();
}

module.exports = {
  formatBalance,
  parseAmount,
  dataOperation,
  readBalance,
  writeBalance,
  performOperation,
};