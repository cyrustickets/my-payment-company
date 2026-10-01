const API_BASE = "https://my-payment-company-1.onrender.com";

let accountId = null;
let apiKey = null;

const getStartedButton = document.querySelector(".primary");
const balanceElement = document.querySelector(".balance");
const actionButtons = document.querySelectorAll(".action");

async function apiRequest(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  // Your API uses X-API-Key
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

async function loadAccount(showMessage = true) {
  if (!accountId) return;

  try {
    const account = await apiRequest(
      `/accounts/${encodeURIComponent(accountId)}`
    );

    balanceElement.textContent =
      `KSh ${(account.balanceMinor / 100).toFixed(2)}`;

    if (showMessage) {
      alert(
        `Account found!\n\n` +
        `Owner: ${account.owner}\n` +
        `Balance: KSh ${(account.balanceMinor / 100).toFixed(2)}`
      );
    }

    return account;
  } catch (error) {
    alert(`Could not load account:\n${error.message}`);
  }
}

function requireAccount() {
  if (!accountId) {
    alert("Please click Get Started and enter your Account ID first.");
    return false;
  }

  return true;
}

function requireApiKey() {
  if (!apiKey) {
    apiKey = prompt("Enter your API key:");

    if (!apiKey) {
      return false;
    }

    apiKey = apiKey.trim();
  }

  return true;
}


// ==============================
// GET STARTED
// ==============================

getStartedButton.addEventListener("click", async () => {
  const id = prompt("Enter your Account ID:");

  if (!id) return;

  accountId = id.trim();

  await loadAccount(true);
});


// ==============================
// DEPOSIT
// ==============================

actionButtons[0].addEventListener("click", async () => {
  if (!requireAccount()) return;
  if (!requireApiKey()) return;

  const amount = prompt("Enter deposit amount in KSh:");

  if (!amount) return;

  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  const method = prompt(
    "Deposit method:\n\n" +
    "BANK\n" +
    "CARD\n" +
    "MOBILE_MONEY\n\n" +
    "Enter method:"
  );

  if (!method) return;

  const cleanMethod = method.trim().toUpperCase();

  const allowedMethods = [
    "BANK",
    "CARD",
    "MOBILE_MONEY"
  ];

  if (!allowedMethods.includes(cleanMethod)) {
    alert(
      "Invalid method.\n\nUse BANK, CARD or MOBILE_MONEY."
    );
    return;
  }

  const reference = prompt(
    "Enter payment reference:\n\n" +
    "Example: MPESA123456"
  );

  if (!reference) return;

  try {
    const deposit = await apiRequest("/deposits", {
      method: "POST",
      body: JSON.stringify({
        accountId,
        amount: amountNumber,
        method: cleanMethod,
        reference: reference.trim()
      })
    });

    alert(
      `Deposit created successfully!\n\n` +
      `Deposit ID: ${deposit.id}\n` +
      `Amount: KSh ${amountNumber.toFixed(2)}\n` +
      `Status: ${deposit.status}\n\n` +
      `The deposit can now be verified.`
    );

    await loadAccount(false);

  } catch (error) {
    alert(`Deposit failed:\n${error.message}`);
  }
});


// ==============================
// TRANSFER
// ==============================

actionButtons[1].addEventListener("click", async () => {
  if (!requireAccount()) return;
  if (!requireApiKey()) return;

  const to = prompt("Enter the recipient Account ID:");

  if (!to) return;

  const amount = prompt("Enter transfer amount in KSh:");

  if (!amount) return;

  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  try {
    const transfer = await apiRequest("/transfers", {
      method: "POST",
      body: JSON.stringify({
        from: accountId,
        to: to.trim(),
        amount: amountNumber
      })
    });

    alert(
      `Transfer successful!\n\n` +
      `Transfer ID: ${transfer.id || "Created"}`
    );

    await loadAccount(false);

  } catch (error) {
    alert(`Transfer failed:\n${error.message}`);
  }
});


// ==============================
// REQUEST PAYMENT
// ==============================

actionButtons[2].addEventListener("click", async () => {
  if (!requireAccount()) return;
  if (!requireApiKey()) return;

  const customerId = prompt(
    "Enter Customer Account ID:"
  );

  if (!customerId) return;

  const amount = prompt(
    "Enter requested amount in KSh:"
  );

  if (!amount) return;

  const amountNumber = Number(amount);

  if (!Number.isFinite(amountNumber) || amountNumber <= 0) {
    alert("Please enter a valid amount.");
    return;
  }

  try {
    const payment = await apiRequest(
      "/payment-requests",
      {
        method: "POST",
        body: JSON.stringify({
          merchantId: accountId,
          customerId: customerId.trim(),
          amount: amountNumber
        })
      }
    );

    alert(
      `Payment request created!\n\n` +
      `Request ID: ${payment.id}\n` +
      `Amount: KSh ${amountNumber.toFixed(2)}`
    );

  } catch (error) {
    alert(
      `Payment request failed:\n${error.message}`
    );
  }
});


// ==============================
// TRANSACTIONS
// ==============================

actionButtons[3].addEventListener("click", async () => {
  if (!requireAccount()) return;
  if (!requireApiKey()) return;

  try {
    const transactions =
      await apiRequest("/transactions");

    if (
      !Array.isArray(transactions) ||
      transactions.length === 0
    ) {
      alert("No transactions found.");
      return;
    }

    const text = transactions
      .map((transaction, index) => {
        const amount =
          transaction.amountMinor !== undefined
            ? `KSh ${(transaction.amountMinor / 100).toFixed(2)}`
            : "";

        const status =
          transaction.status
            ? ` — ${transaction.status}`
            : "";

        return (
          `${index + 1}. ` +
          `${transaction.type || "TRANSACTION"} ` +
          `${amount}${status}`
        );
      })
      .join("\n");

    alert(
      `Transaction History\n\n${text}`
    );

  } catch (error) {
    alert(
      `Could not load transactions:\n${error.message}`
    );
  }
});


console.log("My Payment Company frontend loaded");
console.log("API:", API_BASE);
