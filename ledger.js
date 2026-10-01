const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "data", "ledger.json");

function loadLedger() {
  if (!fs.existsSync(file)) {
    return {
      accounts: [],
      transactions: [],
      apiKeys: []
    };
  }

  const ledger = JSON.parse(fs.readFileSync(file, "utf8"));

  if (!Array.isArray(ledger.accounts)) {
    ledger.accounts = [];
  }

  if (!Array.isArray(ledger.transactions)) {
    ledger.transactions = [];
  }

  if (!Array.isArray(ledger.apiKeys)) {
    ledger.apiKeys = [];
  }

  return ledger;
}

function saveLedger(ledger) {
  const directory = path.dirname(file);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  fs.writeFileSync(
    file,
    JSON.stringify(ledger, null, 2)
  );
}


// ==============================
// API KEYS
// ==============================

function generateApiKey(accountId) {
  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  const rawKey =
    "pk_" + crypto.randomBytes(32).toString("hex");

  const keyHash = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  ledger.apiKeys.push({
    keyHash,
    accountId,
    createdAt: new Date().toISOString()
  });

  saveLedger(ledger);

  return rawKey;
}

function authenticateApiKey(rawKey) {
  if (!rawKey) {
    return null;
  }

  const ledger = loadLedger();

  const keyHash = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  const record = ledger.apiKeys.find(
    key => key.keyHash === keyHash
  );

  if (!record) {
    return null;
  }

  return record;
}


// ==============================
// ACCOUNTS
// ==============================

function createAccount(owner) {
  const ledger = loadLedger();

  const account = {
    id: "ACC-" + crypto.randomUUID(),
    owner,
    currency: "KES",
    balanceMinor: 0,
    createdAt: new Date().toISOString()
  };

  ledger.accounts.push(account);

  saveLedger(ledger);

  return account;
}

function getAccount(id) {
  const ledger = loadLedger();

  return ledger.accounts.find(
    account => account.id === id
  );
}


// ==============================
// TRANSFERS
// ==============================

function transfer(fromId, toId, amountMinor) {
  const ledger = loadLedger();

  const from = ledger.accounts.find(
    account => account.id === fromId
  );

  const to = ledger.accounts.find(
    account => account.id === toId
  );

  if (!from || !to) {
    throw new Error("Account not found");
  }

  if (fromId === toId) {
    throw new Error("Cannot transfer to the same account");
  }

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid amount");
  }

  if (from.balanceMinor < amountMinor) {
    throw new Error("Insufficient balance");
  }

  from.balanceMinor -= amountMinor;
  to.balanceMinor += amountMinor;

  const transaction = {
    id: "TX-" + crypto.randomUUID(),
    type: "TRANSFER",
    from: fromId,
    to: toId,
    amountMinor,
    currency: "KES",
    status: "SUCCESS",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(transaction);

  saveLedger(ledger);

  return transaction;
}


// ==============================
// DEPOSITS
// ==============================

function createDeposit(
  accountId,
  amountMinor,
  method,
  reference
) {
  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  if (
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    throw new Error("Invalid amount");
  }

  const allowedMethods = [
    "BANK",
    "CARD",
    "MOBILE_MONEY",
    "CASH"
  ];

  if (!allowedMethods.includes(method)) {
    throw new Error(
      "Invalid deposit method"
    );
  }

  if (!reference || typeof reference !== "string") {
    throw new Error(
      "Deposit reference is required"
    );
  }

  const existingReference =
    ledger.transactions.find(
      transaction =>
        transaction.type === "DEPOSIT" &&
        transaction.reference === reference
    );

  if (existingReference) {
    throw new Error(
      "Deposit reference already exists"
    );
  }

  const deposit = {
    id: "DEP-" + crypto.randomUUID(),
    type: "DEPOSIT",
    accountId,
    amountMinor,
    currency: "KES",
    method,
    reference,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(deposit);

  saveLedger(ledger);

  return deposit;
}


// ==============================
// VERIFY DEPOSIT
// ==============================

function verifyDeposit(depositId) {
  const ledger = loadLedger();

  const deposit = ledger.transactions.find(
    transaction =>
      transaction.id === depositId &&
      transaction.type === "DEPOSIT"
  );

  if (!deposit) {
    throw new Error("Deposit not found");
  }

  if (deposit.status !== "PENDING") {
    throw new Error(
      "Deposit is not pending"
    );
  }

  const account = ledger.accounts.find(
    account =>
      account.id === deposit.accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  account.balanceMinor += deposit.amountMinor;

  deposit.status = "SUCCESS";

  deposit.verifiedAt =
    new Date().toISOString();

  saveLedger(ledger);

  return deposit;
}


// ==============================
// PAYMENT REQUESTS
// ==============================

function createPaymentRequest(
  merchantId,
  customerId,
  amountMinor
) {
  const ledger = loadLedger();

  const merchant = ledger.accounts.find(
    account => account.id === merchantId
  );

  const customer = ledger.accounts.find(
    account => account.id === customerId
  );

  if (!merchant || !customer) {
    throw new Error("Account not found");
  }

  if (
    !Number.isInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    throw new Error("Invalid amount");
  }

  const payment = {
    id: "PAY-" + crypto.randomUUID(),
    type: "PAYMENT_REQUEST",
    merchantId,
    customerId,
    amountMinor,
    currency: "KES",
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(payment);

  saveLedger(ledger);

  return payment;
}


function completePayment(paymentId) {
  const ledger = loadLedger();

  const payment = ledger.transactions.find(
    transaction =>
      transaction.id === paymentId &&
      transaction.type === "PAYMENT_REQUEST"
  );

  if (!payment) {
    throw new Error(
      "Payment request not found"
    );
  }

  if (payment.status !== "PENDING") {
    throw new Error(
      "Payment is not pending"
    );
  }

  const customer = ledger.accounts.find(
    account =>
      account.id === payment.customerId
  );

  const merchant = ledger.accounts.find(
    account =>
      account.id === payment.merchantId
  );

  if (!customer || !merchant) {
    throw new Error("Account not found");
  }

  if (
    customer.balanceMinor <
    payment.amountMinor
  ) {
    throw new Error(
      "Insufficient customer balance"
    );
  }

  customer.balanceMinor -=
    payment.amountMinor;

  merchant.balanceMinor +=
    payment.amountMinor;

  payment.status = "SUCCESS";

  payment.completedAt =
    new Date().toISOString();

  saveLedger(ledger);

  return payment;
}


module.exports = {
  generateApiKey,
  authenticateApiKey,
  createAccount,
  getAccount,
  transfer,
  createDeposit,
  verifyDeposit,
  createPaymentRequest,
  completePayment
};
