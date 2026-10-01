const express = require("express");

const {
  createAccount,
  getAccount,
  transfer,
  addTestFunds,
  createPaymentRequest,
  completePayment
} = require("./ledger");

const app = express();

app.use(express.json());


// Home
app.get("/", (req, res) => {
  res.json({
    name: "My Payment Company API",
    status: "online",
    environment: "development"
  });
});


// Create account
app.post("/accounts", (req, res) => {
  try {
    const { owner } = req.body;

    if (!owner) {
      return res.status(400).json({
        error: "Owner is required"
      });
    }

    res.status(201).json(createAccount(owner));
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// Get account
app.get("/accounts/:id", (req, res) => {
  const account = getAccount(req.params.id);

  if (!account) {
    return res.status(404).json({
      error: "Account not found"
    });
  }

  res.json(account);
});


// Add test funds
app.post("/test-fund", (req, res) => {
  try {
    const { accountId, amount } = req.body;

    if (
      !accountId ||
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return res.status(400).json({
        error: "accountId and amount are required"
      });
    }

    const amountMinor = Math.round(Number(amount) * 100);

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    res.status(201).json(
      addTestFunds(accountId, amountMinor)
    );
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});


// Transfer money
app.post("/transfers", (req, res) => {
  try {
    const { from, to, amount } = req.body;

    if (
      !from ||
      !to ||
      amount === undefined ||
      amount === null ||
      amount === ""
    ) {
      return res.status(400).json({
        error: "from, to and amount are required"
      });
    }

    const amountMinor = Math.round(Number(amount) * 100);

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    res.status(201).json(
      transfer(from, to, amountMinor)
    );
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});


// Create payment request
app.post("/payment-requests", (req, res) => {
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
        error: "merchantId, customerId and amount are required"
      });
    }

    const amountMinor = Math.round(Number(amount) * 100);

    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    const payment = createPaymentRequest(
      merchantId,
      customerId,
      amountMinor
    );

    return res.status(201).json(payment);

  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
});


// Get payment request
app.get("/payment-requests/:id", (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");

    const file = path.join(
      __dirname,
      "data",
      "ledger.json"
    );

    const ledger = JSON.parse(
      fs.readFileSync(file, "utf8")
    );

    const payment = ledger.transactions.find(
      transaction =>
        transaction.id === req.params.id &&
        transaction.type === "PAYMENT_REQUEST"
    );

    if (!payment) {
      return res.status(404).json({
        error: "Payment request not found"
      });
    }

    return res.json(payment);

  } catch (error) {
    return res.status(500).json({
      error: error.message
    });
  }
});
// Complete payment request
app.post("/payment-requests/:id/complete", (req, res) => {
  try {
    const payment = completePayment(req.params.id);

    return res.json(payment);

  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
});


// Get all transactions
app.get("/transactions", (req, res) => {
  try {
    const fs = require("fs");
    const path = require("path");

    const file = path.join(
      __dirname,
      "data",
      "ledger.json"
    );

    const ledger = JSON.parse(
      fs.readFileSync(file, "utf8")
    );

    res.json(ledger.transactions);

  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});


// Start server
app.listen(process.env.PORT || 3000, () => {
  console.log(
    "Payment API running on http://localhost:3000"
  );
});
