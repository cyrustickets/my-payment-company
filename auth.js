const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const file = path.join(
  __dirname,
  "data",
  "ledger.json"
);

function loadLedger() {
  if (!fs.existsSync(file)) {
    return {
      accounts: [],
      transactions: [],
      apiKeys: []
    };
  }

  const ledger = JSON.parse(
    fs.readFileSync(file, "utf8")
  );

  if (!Array.isArray(ledger.apiKeys)) {
    ledger.apiKeys = [];
  }

  return ledger;
}

function saveLedger(ledger) {
  const directory = path.dirname(file);

  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, {
      recursive: true
    });
  }

  fs.writeFileSync(
    file,
    JSON.stringify(ledger, null, 2)
  );
}

function generateApiKey(accountId) {
  const ledger = loadLedger();

  const account = ledger.accounts.find(
    account => account.id === accountId
  );

  if (!account) {
    throw new Error(
      "Account not found"
    );
  }

  const rawKey =
    "pk_" +
    crypto
      .randomBytes(32)
      .toString("hex");

  const keyHash = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  ledger.apiKeys.push({
    keyHash,
    accountId,
    createdAt:
      new Date().toISOString()
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

  const record =
    ledger.apiKeys.find(
      key =>
        key.keyHash === keyHash
    );

  if (!record) {
    return null;
  }

  return record;
}

module.exports = {
  generateApiKey,
  authenticateApiKey
};
