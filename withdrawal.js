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

function generateId() {
  return `WDR-${crypto.randomUUID()}`;
}

function normalizeSafaricomNumber(phone) {
  if (typeof phone !== "string") {
    throw new Error("Safaricom number is required");
  }

  let number = phone.trim().replace(/\s+/g, "");

  if (number.startsWith("+254")) {
    number = "0" + number.slice(4);
  } else if (number.startsWith("254")) {
    number = "0" + number.slice(3);
  }

  if (!/^07\d{8}$/.test(number)) {
    throw new Error("Invalid Safaricom number");
  }

  return number;
}

async function createSafaricomWithdrawal(
  accountId,
  phone,
  amountMinor
) {
  if (
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0
  ) {
    throw new Error("Invalid amount");
  }

  const safaricomNumber =
    normalizeSafaricomNumber(phone);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
      SELECT id, currency, balance_minor
      FROM accounts
      WHERE id = $1
      FOR UPDATE
      `,
      [accountId]
    );

    if (result.rowCount === 0) {
      throw new Error("Account not found");
    }

    const account = result.rows[0];

    if (account.currency !== "KES") {
      throw new Error("Only KES withdrawals are supported");
    }

    if (Number(account.balance_minor) < amountMinor) {
      throw new Error("Insufficient balance");
    }

    const id = generateId();
    const createdAt = new Date().toISOString();

    await client.query(
      `
      UPDATE accounts
      SET balance_minor = balance_minor - $1
      WHERE id = $2
      `,
      [amountMinor, accountId]
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
        id,
        "WITHDRAWAL",
        accountId,
        amountMinor,
        "KES",
        "SAFARICOM",
        safaricomNumber,
        "PENDING",
        createdAt
      ]
    );

    await client.query("COMMIT");

    return {
      id,
      type: "WITHDRAWAL",
      accountId,
      phone: safaricomNumber,
      amountMinor,
      currency: "KES",
      method: "SAFARICOM",
      status: "PENDING",
      createdAt
    };

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  createSafaricomWithdrawal
};
