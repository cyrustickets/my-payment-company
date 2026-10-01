const express = require("express");

const {
  createAccount,
  getAccount,
  transfer,
  createDeposit,
  verifyDeposit,
  createPaymentRequest,
  completePayment
} = require("./ledger");

const {
  generateApiKey,
  authenticateApiKey
} = require("./auth");

const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());


// ==============================
// API KEY AUTHENTICATION
// ==============================

function requireApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  const auth = authenticateApiKey(apiKey);

  if (!auth) {
    return res.status(401).json({
      error: "Invalid or missing API key"
    });
  }

  req.auth = auth;

  next();
}


// ==============================
// BOOTSTRAP SECRET
// ==============================

function requireBootstrapSecret(req, res, next) {
  const secret = req.headers["x-bootstrap-secret"];

  if (!process.env.BOOTSTRAP_SECRET) {
    return res.status(500).json({
      error: "Bootstrap secret is not configured"
    });
  }

  if (secret !== process.env.BOOTSTRAP_SECRET) {
    return res.status(401).json({
      error: "Invalid bootstrap secret"
    });
  }

  next();
}


// ==============================
// HOME
// ==============================

app.get("/", (req, res) => {
  res.json({
    name: "My Payment Company API",
    status: "online",
    environment: "production"
  });
});


// ==============================
// CREATE ACCOUNT
// ==============================

app.post("/accounts", (req, res) => {
  try {
    const { owner } = req.body;

    if (!owner) {
      return res.status(400).json({
        error: "Owner is required"
      });
    }

    res.status(201).json(
      createAccount(owner)
    );

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// ==============================
// GENERATE API KEY
// ==============================

app.post(
  "/accounts/:id/api-key",
  requireBootstrapSecret,
  (req, res) => {
    try {
      const account = getAccount(req.params.id);

      if (!account) {
        return res.status(404).json({
          error: "Account not found"
        });
      }

      const apiKey =
        generateApiKey(account.id);

      return res.status(201).json({
        accountId: account.id,
        apiKey
      });

    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// GET ACCOUNT
// ==============================

app.get("/accounts/:id", (req, res) => {
  const account =
    getAccount(req.params.id);

  if (!account) {
    return res.status(404).json({
      error: "Account not found"
    });
  }

  res.json(account);
});


// ==============================
// TRANSFER
// ==============================

app.post(
  "/transfers",
  requireApiKey,
  (req, res) => {
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
        Math.round(Number(amount) * 100);

      if (
        !Number.isFinite(amountMinor) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error: "Invalid amount"
        });
      }

      res.status(201).json(
        transfer(
          from,
          to,
          amountMinor
        )
      );

    } catch (error) {
      res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// CREATE DEPOSIT
// ==============================

app.post(
  "/deposits",
  requireApiKey,
  (req, res) => {
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
        req.auth.accountId !== accountId
      ) {
        return res.status(403).json({
          error:
            "API key is not authorized for this account"
        });
      }

      const amountMinor =
        Math.round(Number(amount) * 100);

      if (
        !Number.isFinite(amountMinor) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error: "Invalid amount"
        });
      }

      const deposit =
        createDeposit(
          accountId,
          amountMinor,
          method,
          reference
        );

      return res.status(201).json(
        deposit
      );

    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// GET DEPOSIT
// ==============================

app.get(
  "/deposits/:id",
  requireApiKey,
  (req, res) => {
    try {
      const file =
        path.join(
          __dirname,
          "data",
          "ledger.json"
        );

      if (!fs.existsSync(file)) {
        return res.status(404).json({
          error: "Deposit not found"
        });
      }

      const ledger =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8"
          )
        );

      const deposit =
        ledger.transactions.find(
          transaction =>
            transaction.id ===
              req.params.id &&
            transaction.type ===
              "DEPOSIT"
        );

      if (!deposit) {
        return res.status(404).json({
          error: "Deposit not found"
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
      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==============================
// VERIFY DEPOSIT
// ==============================

app.post(
  "/deposits/:id/verify",
  requireApiKey,
  (req, res) => {
    try {
      const file =
        path.join(
          __dirname,
          "data",
          "ledger.json"
        );

      if (!fs.existsSync(file)) {
        return res.status(404).json({
          error: "Deposit not found"
        });
      }

      const ledger =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8"
          )
        );

      const deposit =
        ledger.transactions.find(
          transaction =>
            transaction.id ===
              req.params.id &&
            transaction.type ===
              "DEPOSIT"
        );

      if (!deposit) {
        return res.status(404).json({
          error: "Deposit not found"
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
        verifyDeposit(
          req.params.id
        );

      return res.json(verified);

    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// CREATE PAYMENT REQUEST
// ==============================

app.post(
  "/payment-requests",
  requireApiKey,
  (req, res) => {
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

      const amountMinor =
        Math.round(Number(amount) * 100);

      if (
        !Number.isFinite(amountMinor) ||
        amountMinor <= 0
      ) {
        return res.status(400).json({
          error: "Invalid amount"
        });
      }

      const payment =
        createPaymentRequest(
          merchantId,
          customerId,
          amountMinor
        );

      return res.status(201).json(
        payment
      );

    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// GET PAYMENT REQUEST
// ==============================

app.get(
  "/payment-requests/:id",
  (req, res) => {
    try {
      const file =
        path.join(
          __dirname,
          "data",
          "ledger.json"
        );

      const ledger =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8"
          )
        );

      const payment =
        ledger.transactions.find(
          transaction =>
            transaction.id ===
              req.params.id &&
            transaction.type ===
              "PAYMENT_REQUEST"
        );

      if (!payment) {
        return res.status(404).json({
          error:
            "Payment request not found"
        });
      }

      return res.json(payment);

    } catch (error) {
      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==============================
// COMPLETE PAYMENT
// ==============================

app.post(
  "/payment-requests/:id/complete",
  requireApiKey,
  (req, res) => {
    try {
      const payment =
        completePayment(
          req.params.id
        );

      return res.json(payment);

    } catch (error) {
      return res.status(400).json({
        error: error.message
      });
    }
  }
);


// ==============================
// GET TRANSACTIONS
// ==============================

app.get(
  "/transactions",
  requireApiKey,
  (req, res) => {
    try {
      const file =
        path.join(
          __dirname,
          "data",
          "ledger.json"
        );

      const ledger =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8"
          )
        );

      const transactions =
        ledger.transactions.filter(
          transaction => {
            if (
              transaction.type ===
                "DEPOSIT"
            ) {
              return (
                transaction.accountId ===
                req.auth.accountId
              );
            }

            if (
              transaction.type ===
                "TRANSFER"
            ) {
              return (
                transaction.from ===
                  req.auth.accountId ||
                transaction.to ===
                  req.auth.accountId
              );
            }

            if (
              transaction.type ===
                "PAYMENT_REQUEST"
            ) {
              return (
                transaction.merchantId ===
                  req.auth.accountId ||
                transaction.customerId ===
                  req.auth.accountId
              );
            }

            return false;
          }
        );

      return res.json(
        transactions
      );

    } catch (error) {
      return res.status(500).json({
        error: error.message
      });
    }
  }
);


// ==============================
// START SERVER
// ==============================

const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Payment API running on port ${PORT}`
  );
});
