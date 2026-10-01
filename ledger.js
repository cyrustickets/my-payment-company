const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "data", "ledger.json");

function loadLedger() {
  if (!fs.existsSync(file)) {
    return {
      accounts: [],
      transactions: []
    };
  }

  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function saveLedger(data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2)
  );
}

function createAccount(owner) {
  const ledger = loadLedger();

  const account = {
    id: "ACC-" + Date.now(),
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

function addTestFunds(accountId, amountMinor) {
  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error("Account not found");
  }

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid amount");
  }

  account.balanceMinor += amountMinor;

  const transaction = {
    id: "TEST-" + Date.now(),
    type: "TEST_FUNDING",
    account: accountId,
    amountMinor,
    currency: "KES",
    status: "SUCCESS",
    createdAt: new Date().toISOString()
  };

  ledger.transactions.push(transaction);

  saveLedger(ledger);

  return transaction;
}

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

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid amount");
  }

  if (from.balanceMinor < amountMinor) {
    throw new Error("Insufficient balance");
  }

  from.balanceMinor -= amountMinor;
  to.balanceMinor += amountMinor;

  const transaction = {
    id: "TX-" + Date.now(),
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
function createPaymentRequest(merchantId, customerId, amountMinor) {
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

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new Error("Invalid amount");
  }

  const payment = {
   id: "PAY-" + Date.now(),
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
    throw new Error("Payment request not found");
  }

  if (payment.status !== "PENDING") {
    throw new Error("Payment is not pending");
  }

  const customer = ledger.accounts.find(
    account => account.id === payment.customerId
  );

  const merchant = ledger.accounts.find(
    account => account.id === payment.merchantId
  );

  if (!customer || !merchant) {
    throw new Error("Account not found");
  }

  if (customer.balanceMinor < payment.amountMinor) {
    throw new Error("Insufficient customer balance");
  }

  customer.balanceMinor -= payment.amountMinor;
  merchant.balanceMinor += payment.amountMinor;

  payment.status = "SUCCESS";
  payment.completedAt = new Date().toISOString();

  saveLedger(ledger);

  return payment;
}
module.exports = {
  createAccount,
  getAccount,
  addTestFunds,
  transfer,
  createPaymentRequest,
  completePayment
};
