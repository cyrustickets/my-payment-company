const crypto = require("crypto");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

let databaseReady = false;


// ========================================
// DATABASE INITIALIZATION
// ========================================

async function initDatabase() {
  if (databaseReady) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'KES',
      balance_minor BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      key_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS card_payments (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id),
      cardholder_name TEXT,
      card_brand TEXT,
      card_last4 TEXT NOT NULL,
      amount_minor BIGINT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'KES',
      status TEXT NOT NULL,
      reference TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS
      card_payments_account_idx
      ON card_payments(account_id);

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,

      account_id TEXT,

      from_account TEXT,
      to_account TEXT,

      merchant_id TEXT,
      customer_id TEXT,

      payment_id TEXT,

      amount_minor BIGINT,

      currency TEXT,

      method TEXT,
      reference TEXT,

      status TEXT NOT NULL,

      created_at TIMESTAMPTZ NOT NULL,

      verified_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );

    CREATE UNIQUE INDEX IF NOT EXISTS
      deposits_reference_unique
      ON transactions(reference)
      WHERE type = 'DEPOSIT';

    CREATE INDEX IF NOT EXISTS
      transactions_account_idx
      ON transactions(account_id);

    CREATE INDEX IF NOT EXISTS
      transactions_from_idx
      ON transactions(from_account);

    CREATE INDEX IF NOT EXISTS
      transactions_to_idx
      ON transactions(to_account);

    CREATE INDEX IF NOT EXISTS
      transactions_merchant_idx
      ON transactions(merchant_id);

    CREATE INDEX IF NOT EXISTS
      transactions_customer_idx
      ON transactions(customer_id);
  `);

  databaseReady = true;
}


// ========================================
// HELPERS
// ========================================

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

function accountFromRow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    owner: row.owner,
    currency: row.currency,
    balanceMinor: Number(row.balance_minor),
    createdAt: row.created_at
  };
}

function transactionFromRow(row) {
  if (!row) {
    return null;
  }

  const transaction = {
    id: row.id,
    type: row.type,
    status: row.status,
    createdAt: row.created_at
  };

  if (row.account_id) {
    transaction.accountId =
      row.account_id;
  }

  if (row.from_account) {
    transaction.from =
      row.from_account;
  }

  if (row.to_account) {
    transaction.to =
      row.to_account;
  }

  if (row.merchant_id) {
    transaction.merchantId =
      row.merchant_id;
  }

  if (row.customer_id) {
    transaction.customerId =
      row.customer_id;
  }

  if (row.payment_id) {
    transaction.paymentId =
      row.payment_id;
  }

  if (row.amount_minor !== null) {
    transaction.amountMinor =
      Number(row.amount_minor);
  }

  if (row.currency) {
    transaction.currency =
      row.currency;
  }

  if (row.method) {
    transaction.method =
      row.method;
  }

  if (row.reference) {
    transaction.reference =
      row.reference;
  }

  if (row.verified_at) {
    transaction.verifiedAt =
      row.verified_at;
  }

  if (row.completed_at) {
    transaction.completedAt =
      row.completed_at;
  }

  return transaction;
}


// ========================================
// API KEYS
// ========================================

async function generateApiKey(accountId) {
  validateAccountId(accountId);

  await initDatabase();

  const account =
    await pool.query(
      `
        SELECT id
        FROM accounts
        WHERE id = $1
      `,
      [accountId]
    );

  if (account.rowCount === 0) {
    throw new Error("Account not found");
  }

  const rawKey =
    "pk_" +
    crypto.randomBytes(32).toString("hex");

  const keyHash =
    crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

  await pool.query(
    `
      INSERT INTO api_keys
      (
        key_hash,
        account_id,
        created_at
      )
      VALUES ($1, $2, NOW())
    `,
    [
      keyHash,
      accountId
    ]
  );

  return rawKey;
}

async function authenticateApiKey(rawKey) {
  if (!rawKey) {
    return null;
  }

  await initDatabase();

  const keyHash =
    crypto
      .createHash("sha256")
      .update(rawKey)
      .digest("hex");

  const result =
    await pool.query(
      `
        SELECT
          key_hash,
          account_id,
          created_at
        FROM api_keys
        WHERE key_hash = $1
      `,
      [keyHash]
    );

  if (result.rowCount === 0) {
    return null;
  }

  return {
    keyHash:
      result.rows[0].key_hash,

    accountId:
      result.rows[0].account_id,

    createdAt:
      result.rows[0].created_at
  };
}


// ========================================
// ACCOUNTS
// ========================================

async function createAccount(owner) {
  if (
    typeof owner !== "string" ||
    owner.trim() === ""
  ) {
    throw new Error("Owner is required");
  }

  await initDatabase();

  const account = {
    id: generateId("ACC"),
    owner: owner.trim(),
    currency: "KES",
    balanceMinor: 0,
    createdAt:
      new Date().toISOString()
  };

  await pool.query(
    `
      INSERT INTO accounts
      (
        id,
        owner,
        currency,
        balance_minor,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5)
    `,
    [
      account.id,
      account.owner,
      account.currency,
      account.balanceMinor,
      account.createdAt
    ]
  );

  return account;
}

async function getAccount(id) {
  validateAccountId(id);

  await initDatabase();

  const result =
    await pool.query(
      `
        SELECT
          id,
          owner,
          currency,
          balance_minor,
          created_at
        FROM accounts
        WHERE id = $1
      `,
      [id]
    );

  return accountFromRow(
    result.rows[0]
  );
}


// ========================================
// TRANSFERS
// ========================================

async function transfer(
  fromId,
  toId,
  amountMinor
) {
  validateAccountId(fromId);
  validateAccountId(toId);
  validateAmount(amountMinor);

  if (fromId === toId) {
    throw new Error(
      "Cannot transfer to the same account"
    );
  }

  await initDatabase();

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const result =
      await client.query(
        `
          SELECT
            id,
            currency,
            balance_minor
          FROM accounts
          WHERE id IN ($1, $2)
          FOR UPDATE
        `,
        [
          fromId,
          toId
        ]
      );

    const from =
      result.rows.find(
        row => row.id === fromId
      );

    const to =
      result.rows.find(
        row => row.id === toId
      );

    if (!from || !to) {
      throw new Error(
        "Account not found"
      );
    }

    if (
      from.currency !==
      to.currency
    ) {
      throw new Error(
        "Currency mismatch"
      );
    }

    if (
      Number(from.balance_minor) <
      amountMinor
    ) {
      throw new Error(
        "Insufficient balance"
      );
    }

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor - $1
        WHERE id = $2
      `,
      [
        amountMinor,
        fromId
      ]
    );

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor + $1
        WHERE id = $2
      `,
      [
        amountMinor,
        toId
      ]
    );

    const transaction = {
      id: generateId("TX"),
      type: "TRANSFER",
      from: fromId,
      to: toId,
      amountMinor,
      currency: from.currency,
      status: "SUCCESS",
      createdAt:
        new Date().toISOString()
    };

    await client.query(
      `
        INSERT INTO transactions
        (
          id,
          type,
          from_account,
          to_account,
          amount_minor,
          currency,
          status,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
      `,
      [
        transaction.id,
        transaction.type,
        transaction.from,
        transaction.to,
        transaction.amountMinor,
        transaction.currency,
        transaction.status,
        transaction.createdAt
      ]
    );

    await client.query("COMMIT");

    return transaction;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}


// ========================================
// DEPOSITS
// ========================================

async function createDeposit(
  accountId,
  amountMinor,
  method,
  reference
) {
  validateAccountId(accountId);
  validateAmount(amountMinor);

  await initDatabase();

  const allowedMethods = [
    "BANK",
    "CARD",
    "MOBILE_MONEY"
  ];

  if (
    !allowedMethods.includes(method)
  ) {
    throw new Error(
      "Invalid deposit method"
    );
  }

  if (
    typeof reference !== "string" ||
    reference.trim() === ""
  ) {
    throw new Error(
      "Deposit reference is required"
    );
  }

  const accountResult =
    await pool.query(
      `
        SELECT
          id,
          currency
        FROM accounts
        WHERE id = $1
      `,
      [accountId]
    );

  if (accountResult.rowCount === 0) {
    throw new Error(
      "Account not found"
    );
  }

  const account =
    accountResult.rows[0];

  const existing =
    await pool.query(
      `
        SELECT id
        FROM transactions
        WHERE type = 'DEPOSIT'
        AND reference = $1
      `,
      [reference.trim()]
    );

  if (existing.rowCount > 0) {
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
    createdAt:
      new Date().toISOString()
  };

  await pool.query(
    `
      INSERT INTO transactions
      (
        id,
        type,
        account_id,
        amount_minor,
        currency,
        method,
        reference,
        status,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `,
    [
      deposit.id,
      deposit.type,
      deposit.accountId,
      deposit.amountMinor,
      deposit.currency,
      deposit.method,
      deposit.reference,
      deposit.status,
      deposit.createdAt
    ]
  );

  return deposit;
}

async function getDeposit(depositId) {
  if (
    typeof depositId !== "string" ||
    depositId.trim() === ""
  ) {
    throw new Error(
      "Invalid deposit ID"
    );
  }

  await initDatabase();

  const result =
    await pool.query(
      `
        SELECT *
        FROM transactions
        WHERE id = $1
        AND type = 'DEPOSIT'
      `,
      [depositId]
    );

  return transactionFromRow(
    result.rows[0]
  );
}


// ========================================
// VERIFY DEPOSIT
// ========================================

async function verifyDeposit(
  depositId
) {
  if (
    typeof depositId !== "string" ||
    depositId.trim() === ""
  ) {
    throw new Error(
      "Invalid deposit ID"
    );
  }

  await initDatabase();

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const depositResult =
      await client.query(
        `
          SELECT *
          FROM transactions
          WHERE id = $1
          AND type = 'DEPOSIT'
          FOR UPDATE
        `,
        [depositId]
      );

    if (
      depositResult.rowCount === 0
    ) {
      throw new Error(
        "Deposit not found"
      );
    }

    const deposit =
      depositResult.rows[0];

    if (
      deposit.status !==
      "PENDING"
    ) {
      throw new Error(
        "Deposit is not pending"
      );
    }

    const accountResult =
      await client.query(
        `
          SELECT *
          FROM accounts
          WHERE id = $1
          FOR UPDATE
        `,
        [deposit.account_id]
      );

    if (
      accountResult.rowCount === 0
    ) {
      throw new Error(
        "Account not found"
      );
    }

    const verifiedAt =
      new Date().toISOString();

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor + $1
        WHERE id = $2
      `,
      [
        Number(
          deposit.amount_minor
        ),
        deposit.account_id
      ]
    );

    await client.query(
      `
        UPDATE transactions
        SET
          status = 'SUCCESS',
          verified_at = $1
        WHERE id = $2
      `,
      [
        verifiedAt,
        depositId
      ]
    );

    await client.query("COMMIT");

    return transactionFromRow({
      ...deposit,
      status: "SUCCESS",
      verified_at: verifiedAt
    });

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}


// ========================================
// PAYMENT REQUESTS
// ========================================

async function createPaymentRequest(
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

  await initDatabase();

  const result =
    await pool.query(
      `
        SELECT
          id,
          currency
        FROM accounts
        WHERE id IN ($1, $2)
      `,
      [
        merchantId,
        customerId
      ]
    );

  const merchant =
    result.rows.find(
      row => row.id === merchantId
    );

  const customer =
    result.rows.find(
      row => row.id === customerId
    );

  if (!merchant || !customer) {
    throw new Error(
      "Account not found"
    );
  }

  if (
    merchant.currency !==
    customer.currency
  ) {
    throw new Error(
      "Currency mismatch"
    );
  }

  const payment = {
    id: generateId("PAY"),
    type: "PAYMENT_REQUEST",
    merchantId,
    customerId,
    amountMinor,
    currency: customer.currency,
    status: "PENDING",
    createdAt:
      new Date().toISOString()
  };

  await pool.query(
    `
      INSERT INTO transactions
      (
        id,
        type,
        merchant_id,
        customer_id,
        amount_minor,
        currency,
        status,
        created_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      payment.id,
      payment.type,
      payment.merchantId,
      payment.customerId,
      payment.amountMinor,
      payment.currency,
      payment.status,
      payment.createdAt
    ]
  );

  return payment;
}

async function getPaymentRequest(
  paymentId
) {
  if (
    typeof paymentId !== "string" ||
    paymentId.trim() === ""
  ) {
    throw new Error(
      "Invalid payment ID"
    );
  }

  await initDatabase();

  const result =
    await pool.query(
      `
        SELECT *
        FROM transactions
        WHERE id = $1
        AND type = 'PAYMENT_REQUEST'
      `,
      [paymentId]
    );

  const row =
    result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    type: row.type,
    merchantId: row.merchant_id,
    customerId: row.customer_id,
    amountMinor:
      Number(row.amount_minor),
    currency: row.currency,
    status: row.status,
    createdAt: row.created_at,
    ...(row.completed_at
      ? {
          completedAt:
            row.completed_at
        }
      : {})
  };
}


// ========================================
// COMPLETE PAYMENT
// ========================================

async function completePayment(
  paymentId,
  authorizedAccountId = null
) {
  if (
    typeof paymentId !== "string" ||
    paymentId.trim() === ""
  ) {
    throw new Error(
      "Invalid payment ID"
    );
  }

  await initDatabase();

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const paymentResult =
      await client.query(
        `
          SELECT *
          FROM transactions
          WHERE id = $1
          AND type = 'PAYMENT_REQUEST'
          FOR UPDATE
        `,
        [paymentId]
      );

    if (
      paymentResult.rowCount === 0
    ) {
      throw new Error(
        "Payment request not found"
      );
    }

    const payment =
      paymentResult.rows[0];

    if (
      payment.status !==
      "PENDING"
    ) {
      throw new Error(
        "Payment is not pending"
      );
    }

    if (
      authorizedAccountId &&
      authorizedAccountId !==
        payment.customer_id
    ) {
      throw new Error(
        "API key is not authorized for this payment"
      );
    }

    const accountsResult =
      await client.query(
        `
          SELECT *
          FROM accounts
          WHERE id IN ($1, $2)
          FOR UPDATE
        `,
        [
          payment.customer_id,
          payment.merchant_id
        ]
      );

    const customer =
      accountsResult.rows.find(
        row =>
          row.id ===
          payment.customer_id
      );

    const merchant =
      accountsResult.rows.find(
        row =>
          row.id ===
          payment.merchant_id
      );

    if (!customer || !merchant) {
      throw new Error(
        "Account not found"
      );
    }

    if (
      customer.currency !==
      payment.currency
    ) {
      throw new Error(
        "Customer currency mismatch"
      );
    }

    if (
      merchant.currency !==
      payment.currency
    ) {
      throw new Error(
        "Merchant currency mismatch"
      );
    }

    const amountMinor =
      Number(payment.amount_minor);

    if (
      Number(customer.balance_minor) <
      amountMinor
    ) {
      throw new Error(
        "Insufficient customer balance"
      );
    }

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor - $1
        WHERE id = $2
      `,
      [
        amountMinor,
        customer.id
      ]
    );

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor + $1
        WHERE id = $2
      `,
      [
        amountMinor,
        merchant.id
      ]
    );

    const completedAt =
      new Date().toISOString();

    await client.query(
      `
        UPDATE transactions
        SET
          status = 'SUCCESS',
          completed_at = $1
        WHERE id = $2
      `,
      [
        completedAt,
        paymentId
      ]
    );

    const settlement = {
      id: generateId("SET"),
      type: "PAYMENT_SETTLEMENT",
      paymentId: payment.id,
      from: customer.id,
      to: merchant.id,
      amountMinor,
      currency: payment.currency,
      status: "SUCCESS",
      createdAt:
        new Date().toISOString()
    };

    await client.query(
      `
        INSERT INTO transactions
        (
          id,
          type,
          from_account,
          to_account,
          payment_id,
          amount_minor,
          currency,
          status,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        settlement.id,
        settlement.type,
        settlement.from,
        settlement.to,
        settlement.paymentId,
        settlement.amountMinor,
        settlement.currency,
        settlement.status,
        settlement.createdAt
      ]
    );

    await client.query("COMMIT");

    return {
      payment: {
        id: payment.id,
        type: payment.type,
        merchantId:
          payment.merchant_id,
        customerId:
          payment.customer_id,
        amountMinor,
        currency:
          payment.currency,
        status: "SUCCESS",
        createdAt:
          payment.created_at,
        completedAt
      },
      settlement
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}


// ========================================
// CARD PAYMENTS
// ========================================

async function createCardPayment(
  accountId,
  amountMinor,
  cardNumber,
  expiry,
  cvv,
  cardholderName = ""
) {
  validateAccountId(accountId);
  validateAmount(amountMinor);

  if (
    typeof cardNumber !== "string" ||
    typeof expiry !== "string" ||
    typeof cvv !== "string"
  ) {
    throw new Error("Card details are required");
  }

  const cleanCard =
    cardNumber.replace(/\s/g, "");

  if (cleanCard !== "4111111111111111") {
    throw new Error("Card payment declined");
  }

  if (!/^\d{2}\/\d{2}$/.test(expiry)) {
    throw new Error("Invalid expiry");
  }

  if (!/^\d{3}$/.test(cvv)) {
    throw new Error("Invalid CVV");
  }

  await initDatabase();

  const accountResult =
    await pool.query(
      `
        SELECT id, currency
        FROM accounts
        WHERE id = $1
      `,
      [accountId]
    );

  if (accountResult.rowCount === 0) {
    throw new Error("Account not found");
  }

  const account =
    accountResult.rows[0];

  const transactionId =
    generateId("TX");

  const reference =
    "CARD-" +
    crypto.randomBytes(12).toString("hex");

  const createdAt =
    new Date().toISOString();

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
        UPDATE accounts
        SET balance_minor =
          balance_minor + $1
        WHERE id = $2
      `,
      [
        amountMinor,
        accountId
      ]
    );

    await client.query(
      `
        INSERT INTO transactions
        (
          id,
          type,
          account_id,
          amount_minor,
          currency,
          method,
          reference,
          status,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `,
      [
        transactionId,
        "CARD_PAYMENT",
        accountId,
        amountMinor,
        account.currency,
        "CARD",
        reference,
        "SUCCESS",
        createdAt
      ]
    );

    await client.query(
      `
        INSERT INTO card_payments
        (
          id,
          account_id,
          cardholder_name,
          card_brand,
          card_last4,
          amount_minor,
          currency,
          status,
          reference,
          created_at
        )
        VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        transactionId,
        accountId,
        String(cardholderName || "").trim() || null,
        "VISA",
        cleanCard.slice(-4),
        amountMinor,
        account.currency,
        "SUCCESS",
        reference,
        createdAt
      ]
    );

    await client.query("COMMIT");

    return {
      id: transactionId,
      type: "CARD_PAYMENT",
      accountId,
      amountMinor,
      currency: account.currency,
      method: "CARD",
      reference,
      status: "SUCCESS",
      createdAt,
      cardLast4: cleanCard.slice(-4)
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;

  } finally {
    client.release();
  }
}

// ========================================
// CARD PAYMENT HISTORY
// ========================================

async function getCardPayments() {
  await initDatabase();

  const result = await pool.query(`
    SELECT
      id,
      account_id,
      amount_minor,
      currency,
      card_brand,
      card_last4,
      reference,
      status,
      created_at
    FROM card_payments
    ORDER BY created_at DESC
  `);

  return result.rows.map(row => ({
    id: row.id,
    accountId: row.account_id,
    amountMinor: Number(row.amount_minor),
    amount: Number(row.amount_minor) / 100,
    currency: row.currency,
    cardBrand: row.card_brand,
    cardLast4: row.card_last4,
    reference: row.reference,
    status: row.status,
    createdAt: row.created_at
  }));
}


// ========================================
// TRANSACTIONS
// ========================================

async function getTransactions(
  accountId = null
) {
  await initDatabase();

  if (!accountId) {
    const result =
      await pool.query(
        `
          SELECT *
          FROM transactions
          ORDER BY created_at DESC
        `
      );

    return result.rows.map(
      transactionFromRow
    );
  }

  validateAccountId(accountId);

  const result =
    await pool.query(
      `
        SELECT *
        FROM transactions
        WHERE
          account_id = $1
          OR from_account = $1
          OR to_account = $1
          OR merchant_id = $1
          OR customer_id = $1
        ORDER BY created_at DESC
      `,
      [accountId]
    );

  return result.rows.map(
    transactionFromRow
  );
}


// ========================================
// EXPORTS
// ========================================

module.exports = {
  initDatabase,
  generateApiKey,
  authenticateApiKey,
  createAccount,
  getAccount,
  transfer,
  createDeposit,
  getDeposit,
  verifyDeposit,
  createPaymentRequest,
  getPaymentRequest,
  completePayment,
  getTransactions,
  createCardPayment,
  getCardPayments
};
