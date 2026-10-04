const express = require("express");
const cors = require("cors");
const path = require("path");

const {
  initDatabase,
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
  createCardPayment
} = require("./ledger");

const {
  generateApiKey,
  authenticateApiKey
} = require("./auth");

const {
  createSafaricomWithdrawal
} = require("./withdrawal");

const RECEIVING_ACCOUNT_ID =
  process.env.RECEIVING_ACCOUNT_ID;

const app = express();

app.use(cors());
app.use(express.json());


// ========================================
// WEBSITE
// ========================================

app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

app.get("/", (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      "public",
      "index.html"
    )
  );
});


// ========================================
// API KEY AUTHENTICATION
// ========================================

async function requireApiKey(req, res, next) {
  try {
    const apiKey =
      req.headers["x-api-key"];

    const auth =
      await authenticateApiKey(apiKey);

    if (!auth) {
      return res.status(401).json({
        error: "Invalid or missing API key"
      });
    }

    req.auth = auth;

    next();

  } catch (error) {
    console.error(
      "API KEY AUTH ERROR:",
      error
    );

    return res.status(500).json({
      error: error.message
    });
  }
}


// ========================================
// BOOTSTRAP SECRET
// ========================================

function requireBootstrapSecret(
  req,
  res,
  next
) {
  const secret =
    req.headers["x-bootstrap-secret"];

  if (!process.env.BOOTSTRAP_SECRET) {
    return res.status(500).json({
      error:
        "Bootstrap secret is not configured"
    });
  }

  if (
    secret !==
    process.env.BOOTSTRAP_SECRET
  ) {
    return res.status(401).json({
      error:
        "Invalid bootstrap secret"
    });
  }

  next();
}



// ========================================
// OWNER DASHBOARD AUTHENTICATION
// ========================================

function requireOwnerSecret(req, res, next) {
  const secret =
    req.headers["x-owner-secret"];

  if (!process.env.OWNER_DASHBOARD_SECRET) {
    return res.status(500).json({
      error:
        "Owner dashboard secret is not configured"
    });
  }

  if (
    secret !==
    process.env.OWNER_DASHBOARD_SECRET
  ) {
    return res.status(401).json({
      error:
        "Invalid owner dashboard secret"
    });
  }

  next();
}


// ========================================
// API STATUS
// ========================================

app.get("/api", (req, res) => {
  res.json({
    name: "My Payment Company API",
    status: "online",
    environment:
      process.env.NODE_ENV ||
      "production",
    database:
      process.env.DATABASE_URL
        ? "PostgreSQL"
        : "Not configured"
  });
});


// ========================================
// CREATE ACCOUNT
// ========================================

app.post(
  "/accounts",
  async (req, res) => {
    try {
      const { owner } =
        req.body;

      if (!owner) {
        return res.status(400).json({
          error:
            "Owner is required"
        });
      }

      const account =
        await createAccount(owner);

      return res.status(201).json(
        account
      );

    } catch (error) {
      console.error(
        "CREATE ACCOUNT ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// GET ACCOUNT
// ========================================

app.get(
  "/accounts/:id",
  async (req, res) => {
    try {
      const account =
        await getAccount(
          req.params.id
        );

      if (!account) {
        return res.status(404).json({
          error:
            "Account not found"
        });
      }

      return res.json(account);

    } catch (error) {
      console.error(
        "GET ACCOUNT ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// GENERATE API KEY
// ========================================

app.post(
  "/accounts/:id/api-key",
  requireBootstrapSecret,
  async (req, res) => {
    try {
      const account =
        await getAccount(
          req.params.id
        );

      if (!account) {
        return res.status(404).json({
          error:
            "Account not found"
        });
      }

      const apiKey =
        await generateApiKey(
          account.id
        );

      return res.status(201).json({
        accountId:
          account.id,
        apiKey
      });

    } catch (error) {
      console.error(
        "GENERATE API KEY ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// TRANSFER
// ========================================

app.post(
  "/transfers",
  requireApiKey,
  async (req, res) => {
    try {
      const {
        from,
        to,
        amount
      } = req.body;

      if (
        !from ||
        !to ||
        amount === undefined ||
        amount === null ||
        amount === ""
      ) {
        return res.status(400).json({
          error:
            "from, to and amount are required"
        });
      }

      if (
        req.auth.accountId !== from
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this account"
        });
      }

      const amountMinor =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isSafeInteger(
          amountMinor
        ) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid amount"
        });
      }

      const transaction =
        await transfer(
          from,
          to,
          amountMinor
        );

      return res.status(201).json(
        transaction
      );

    } catch (error) {
      console.error(
        "TRANSFER ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// CREATE DEPOSIT
// ========================================

app.post(
  "/deposits",
  requireApiKey,
  async (req, res) => {
    try {
      const {
        accountId,
        amount,
        method,
        reference
      } = req.body;

      if (
        !accountId ||
        amount === undefined ||
        amount === null ||
        amount === "" ||
        !method ||
        !reference
      ) {
        return res.status(400).json({
          error:
            "accountId, amount, method and reference are required"
        });
      }

      if (
        req.auth.accountId !==
        accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this account"
        });
      }

      const amountMinor =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isSafeInteger(
          amountMinor
        ) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid amount"
        });
      }

      const deposit =
        await createDeposit(
          accountId,
          amountMinor,
          method,
          reference
        );

      return res.status(201).json(
        deposit
      );

    } catch (error) {
      console.error(
        "CREATE DEPOSIT ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// GET DEPOSIT
// ========================================

app.get(
  "/deposits/:id",
  requireApiKey,
  async (req, res) => {
    try {
      const deposit =
        await getDeposit(
          req.params.id
        );

      if (!deposit) {
        return res.status(404).json({
          error:
            "Deposit not found"
        });
      }

      if (
        deposit.accountId !==
        req.auth.accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this deposit"
        });
      }

      return res.json(deposit);

    } catch (error) {
      console.error(
        "GET DEPOSIT ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// VERIFY DEPOSIT
// ========================================

app.post(
  "/deposits/:id/verify",
  requireApiKey,
  async (req, res) => {
    try {
      const deposit =
        await getDeposit(
          req.params.id
        );

      if (!deposit) {
        return res.status(404).json({
          error:
            "Deposit not found"
        });
      }

      if (
        deposit.accountId !==
        req.auth.accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this deposit"
        });
      }

      const verified =
        await verifyDeposit(
          req.params.id
        );

      return res.json(verified);

    } catch (error) {
      console.error(
        "VERIFY DEPOSIT ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// CREATE PAYMENT REQUEST
// ========================================

app.post(
  "/payment-requests",
  requireApiKey,
  async (req, res) => {
    try {
      const {
        merchantId,
        customerId,
        amount
      } = req.body;

      if (
        !merchantId ||
        !customerId ||
        amount === undefined ||
        amount === null ||
        amount === ""
      ) {
        return res.status(400).json({
          error:
            "merchantId, customerId and amount are required"
        });
      }

      if (
        req.auth.accountId !==
        merchantId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this merchant account"
        });
      }

      const amountMinor =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isSafeInteger(
          amountMinor
        ) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid amount"
        });
      }

      const payment =
        await createPaymentRequest(
          merchantId,
          customerId,
          amountMinor
        );

      return res.status(201).json(
        payment
      );

    } catch (error) {
      console.error(
        "PAYMENT REQUEST ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// GET PAYMENT REQUEST
// ========================================

app.get(
  "/payment-requests/:id",
  async (req, res) => {
    try {
      const payment =
        await getPaymentRequest(
          req.params.id
        );

      if (!payment) {
        return res.status(404).json({
          error:
            "Payment request not found"
        });
      }

      return res.json(payment);

    } catch (error) {
      console.error(
        "GET PAYMENT REQUEST ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// COMPLETE PAYMENT
// ========================================

app.post(
  "/payment-requests/:id/complete",
  requireApiKey,
  async (req, res) => {
    try {
      const payment =
        await getPaymentRequest(
          req.params.id
        );

      if (!payment) {
        return res.status(404).json({
          error:
            "Payment request not found"
        });
      }

      if (
        payment.customerId !==
        req.auth.accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this payment"
        });
      }

      const result =
        await completePayment(
          req.params.id,
          req.auth.accountId
        );

      return res.json(result);

    } catch (error) {
      console.error(
        "COMPLETE PAYMENT ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// SEND MONEY TO SAFARICOM NUMBER
// ========================================

app.post(
  "/withdrawals/safaricom",
  requireApiKey,
  async (req, res) => {
    try {
      const {
        phone,
        amount
      } = req.body;

      if (
        !phone ||
        amount === undefined ||
        amount === null ||
        amount === ""
      ) {
        return res.status(400).json({
          error:
            "phone and amount are required"
        });
      }

      const amountMinor =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isSafeInteger(
          amountMinor
        ) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error:
            "Invalid amount"
        });
      }

      const withdrawal =
        await createSafaricomWithdrawal(
          req.auth.accountId,
          phone,
          amountMinor
        );

      return res.status(201).json(
        withdrawal
      );

    } catch (error) {
      console.error(
        "SAFARICOM WITHDRAWAL ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// PUBLIC CARD CHECKOUT
// ========================================

app.post(
  "/checkout/card",
  async (req, res) => {
    try {
      if (!RECEIVING_ACCOUNT_ID) {
        return res.status(500).json({
          error: "Receiving account is not configured"
        });
      }

      const {
        amount,
        cardNumber,
        expiry,
        cvv
      } = req.body;

      if (
        amount === undefined ||
        amount === null ||
        amount === "" ||
        !cardNumber ||
        !expiry ||
        !cvv
      ) {
        return res.status(400).json({
          error:
            "amount, cardNumber, expiry and cvv are required"
        });
      }

      return res.status(501).json({
        error:
          "Card authorization is not configured yet"
      });

    } catch (error) {
      console.error(
        "PUBLIC CARD CHECKOUT ERROR:",
        error
      );

      return res.status(500).json({
        error: "Checkout unavailable"
      });
    }
  }
);


// ========================================
// CARD PAYMENTS
// ========================================

app.post(
  "/card-payments",
  requireApiKey,
  async (req, res) => {
    try {
      const {
        accountId,
        amount,
        cardNumber,
        expiry,
        cvv
      } = req.body;

      if (
        !accountId ||
        amount === undefined ||
        amount === null ||
        amount === "" ||
        !cardNumber ||
        !expiry ||
        !cvv
      ) {
        return res.status(400).json({
          error:
            "accountId, amount, cardNumber, expiry and cvv are required"
        });
      }

      if (
        req.auth.accountId !== accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this account"
        });
      }

      const amountMinor =
        Math.round(
          Number(amount) * 100
        );

      if (
        !Number.isSafeInteger(amountMinor) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error: "Invalid amount"
        });
      }

      const payment =
        await createCardPayment(
          accountId,
          amountMinor,
          cardNumber,
          expiry,
          cvv
        );

      return res.status(201).json(payment);

    } catch (error) {
      console.error(
        "CARD PAYMENT ERROR:",
        error
      );

      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ========================================
// OWNER DASHBOARD
// ========================================

app.get(
  "/owner/payments",
  requireOwnerSecret,
  async (req, res) => {
    try {
      const payments =
        await getTransactions();

      return res.json({
        payments
      });

    } catch (error) {
      console.error(
        "OWNER PAYMENTS ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// TRANSACTIONS
// ========================================

app.get(
  "/transactions",
  requireApiKey,
  async (req, res) => {
    try {
      const transactions =
        await getTransactions(
          req.auth.accountId
        );

      return res.json(
        transactions
      );

    } catch (error) {
      console.error(
        "TRANSACTIONS ERROR:",
        error
      );

      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ========================================
// START SERVER
// ========================================

const PORT =
  process.env.PORT || 3000;

async function startServer() {
  try {
    await initDatabase();

    app.listen(
      PORT,
      () => {
        console.log(
          `Payment API running on port ${PORT}`
        );

        console.log(
          "PostgreSQL database connected"
        );
      }
    );

  } catch (error) {
    console.error(
      "DATABASE STARTUP ERROR:",
      error
    );

    process.exit(1);
  }
}

startServer();
