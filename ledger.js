const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "data");
const file = path.join(dataDir, "ledger.json");

function ensureDataDirectory() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function createEmptyLedger() {
  return {
    accounts: [],
    transactions: [],
    apiKeys: []
  };
}

function loadLedger() {
  ensureDataDirectory();

  if (!fs.existsSync(file)) {
    return createEmptyLedger();
  }

  let ledger;

  try {
    ledger = JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch (error) {
    throw new Error("Ledger file is corrupted or invalid");
  }

  if (!ledger || typeof ledger !== "object") {
    throw new Error("Invalid ledger");
  }

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
  ensureDataDirectory();

  const tempFile = `${file}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(ledger, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, file);
}

function generateId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function validateAccountId(id) {
  if (
    typeof id !== "string" ||
    id.trim() === ""
  ) {
    throw new Error("Invalid account ID");
  }
}

function validateAmount(amountMinor) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    throw new Error("Invalid amount");
  }
}


// ==============================
// API KEYS
// ==============================

function generateApiKey(accountId) {
  validateAccountId(accountId);

  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  const rawKey =
    "pk_" +
    crypto.randomBytes(32).toString("hex");

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
  if (
    typeof owner !== "string" ||
    owner.trim() === ""
  ) {
    throw new Error("Owner is required");
  }

  const ledger = loadLedger();

  const account = {
    id: generateId("ACC"),
    owner: owner.trim(),
    currency: "KES",
    balanceMinor: 0,
    createdAt: new Date().toISOString()
  };

  ledger.accounts.push(account);

  saveLedger(ledger);

  return account;
}

function getAccount(id) {
  validateAccountId(id);

  const ledger = loadLedger();

  return (
    ledger.accounts.find(
      account => account.id === id
    ) || null
  );
}


// ==============================
// TRANSFERS
// ==============================

function transfer(fromId, toId, amountMinor) {
  validateAccountId(fromId);
  validateAccountId(toId);
  validateAmount(amountMinor);

  if (fromId === toId) {
    throw new Error(
      "Cannot transfer to the same account"
    );
  }

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

  if (from.currency !== to.currency) {
    throw new Error("Currency mismatch");
  }

  if (from.balanceMinor < amountMinor) {
    throw new Error("Insufficient balance");
  }

  from.balanceMinor -= amountMinor;
  to.balanceMinor += amountMinor;

  const transaction = {
    id: generateId("TX"),
    type: "TRANSFER",
    from: fromId,
    to: toId,
    amountMinor,
    currency: from.currency,
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
  validateAccountId(accountId);
  validateAmount(amountMinor);

  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  const allowedMethods = [
    "BANK",
    "CARD",
    "MOBILE_MONEY"
  ];

  if (!allowedMethods.includes(method)) {
    throw new Error("Invalid deposit method");
  }

  if (
    typeof reference !== "string" ||
    reference.trim() === ""
  ) {
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
    id: generateId("DEP"),
    type: "DEPOSIT",
    accountId,
    amountMinor,
    currency: account.currency,
    method,
    reference: reference.trim(),
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
  if (
    typeof depositId !== "string" ||
    depositId.trim() === ""
  ) {
    throw new Error("Invalid deposit ID");
  }

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
    throw new Error("Deposit is not pending");
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
  validateAccountId(merchantId);
  validateAccountId(customerId);
  validateAmount(amountMinor);

  if (merchantId === customerId) {
    throw new Error(
      "Merchant and customer cannot be the same account"
    );
  }

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

  if (merchant.currency !== customer.currency) {
    throw new Error("Currency mismatch");
  }

  const payment = {
    id: generateId("PAY"),
    type: "PAYMENT_REQUEST",
    merchantId,
    customerId,
    amountMinor,
    currency: customer.currency,
    status: "PENDING",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(payment);

  saveLedger(ledger);

  return payment;
}

function getPaymentRequest(paymentId) {
  if (
    typeof paymentId !== "string" ||
    paymentId.trim() === ""
  ) {
    throw new Error("Invalid payment ID");
  }

  const ledger = loadLedger();

  return (
    ledger.transactions.find(
      transaction =>
        transaction.id === paymentId &&
        transaction.type === "PAYMENT_REQUEST"
    ) || null
  );
}

function completePayment(
  paymentId,
  authorizedAccountId = null
) {
  if (
    typeof paymentId !== "string" ||
    paymentId.trim() === ""
  ) {
    throw new Error("Invalid payment ID");
  }

  const ledger = loadLedger();

  const payment = ledger.transactions.find(
    transaction =>
      transaction.id === paymentId &&
      transaction.type === "PAYMENT_REQUEST"
  );

  if (!payment) {
    throw new Error("Payment request not found");
  }

  if (payment.status !== "PENDING") {
    throw new Error("Payment is not pending");
  }

  if (
    authorizedAccountId &&
    authorizedAccountId !== payment.customerId
  ) {
    throw new Error(
      "API key is not authorized for this payment"
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

  if (customer.currency !== payment.currency) {
    throw new Error(
      "Customer currency mismatch"
    );
  }

  if (merchant.currency !== payment.currency) {
    throw new Error(
      "Merchant currency mismatch"
    );
  }

  if (
    customer.balanceMinor <
    payment.amountMinor
  ) {
    throw new Error(
      "Insufficient customer balance"
    );
  }

  customer.balanceMinor -= payment.amountMinor;
  merchant.balanceMinor += payment.amountMinor;

  payment.status = "SUCCESS";
  payment.completedAt =
    new Date().toISOString();

  const settlement = {
    id: generateId("SET"),
    type: "PAYMENT_SETTLEMENT",
    paymentId: payment.id,
    from: customer.id,
    to: merchant.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: "SUCCESS",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(settlement);

  saveLedger(ledger);

  return {
    payment,
    settlement
  };
}


// ==============================
// TRANSACTIONS
// ==============================

function getTransactions(accountId = null) {
  const ledger = loadLedger();

  if (!accountId) {
    return ledger.transactions;
  }

  validateAccountId(accountId);

  return ledger.transactions.filter(
    transaction =>
      transaction.account === accountId ||
      transaction.accountId === accountId ||
      transaction.from === accountId ||
      transaction.to === accountId ||
      transaction.merchantId === accountId ||
      transaction.customerId === accountId
  );
}


// ==============================
// EXPORTS
// ==============================

module.exports = {
  generateApiKey,
  authenticateApiKey,
  createAccount,
  getAccount,
  transfer,
  createDeposit,
  verifyDeposit,
  createPaymentRequest,
  getPaymentRequest,
  completePayment,
  getTransactions
};
