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

  // Your backend expects X-API-Key
  if (apiKey) {
    headers["X-API-Key"] = apiKey.trim();
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

// ==============================
// LOAD ACCOUNT
// ==============================

async function loadAccount(showMessage = true) {
  if (!accountId) return;

  try {
    const account = await apiRequest(
      `/accounts/${accountId}`
    );

    balanceElement.textContent =
      `KSh ${(account.balanceMinor / 100).toFixed(2)}`;

    if (showMessage) {
      alert(
        `Account found!\n\n` +
        `Owner: ${account.owner}\n` +
        `Account ID: ${account.id}\n` +
        `Balance: KSh ${(account.balanceMinor / 100).toFixed(2)}`
      );
    }

    return account;

  } catch (error) {
    alert(`Account error:\n${error.message}`);
  }
}

// ==============================
// GET STARTED
// ==============================

getStartedButton.addEventListener("click", async () => {
  const id = prompt(
    "Enter your Account ID:"
  );

  if (!id) return;

  accountId = id.trim();

  await loadAccount(true);
});

// ==============================
// GET API KEY
// ==============================

function askForApiKey() {
  if (apiKey) {
    return true;
  }

  const key = prompt(
    "Enter your API key:\n\n" +
    "Your API key starts with pk_"
  );

  if (!key) {
    return false;
  }

  apiKey = key.trim();

  return true;
}

// ==============================
// DEPOSIT
// ==============================

actionButtons[0].addEventListener(
  "click",
  async () => {

    if (!accountId) {
      alert(
        "Please click Get Started and enter your Account ID first."
      );
      return;
    }

    if (!askForApiKey()) {
      return;
    }

    const amount = prompt(
      "Enter deposit amount in KSh:\n\n" +
      "Example: 100"
    );

    if (!amount) return;

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      alert("Please enter a valid amount.");
      return;
    }

    const method = prompt(
      "Enter deposit method:\n\n" +
      "BANK\n" +
      "CARD\n" +
      "MOBILE_MONEY"
    );

    if (!method) return;

    const cleanMethod =
      method.trim().toUpperCase();

    if (
      ![
        "BANK",
        "CARD",
        "MOBILE_MONEY"
      ].includes(cleanMethod)
    ) {
      alert(
        "Invalid method.\n\n" +
        "Use BANK, CARD, or MOBILE_MONEY."
      );
      return;
    }

    const reference = prompt(
      "Enter payment reference:\n\n" +
      "Example: MPESA123456"
    );

    if (!reference) return;

    try {

      const deposit =
        await apiRequest(
          "/deposits",
          {
            method: "POST",
            body: JSON.stringify({
              accountId,
              amount: numericAmount,
              method: cleanMethod,
              reference: reference.trim()
            })
          }
        );

      alert(
        `Deposit created successfully!\n\n` +
        `Deposit ID:\n${deposit.id}\n\n` +
        `Amount: KSh ${numericAmount.toFixed(2)}\n` +
        `Method: ${deposit.method}\n` +
        `Status: ${deposit.status}\n\n` +
        `The deposit is currently PENDING.`
      );

      // Automatically verify the test deposit
      const verify =
        confirm(
          "This is a test deposit.\n\n" +
          "Do you want to verify it now?"
        );

      if (verify) {

        const verified =
          await apiRequest(
            `/deposits/${deposit.id}/verify`,
            {
              method: "POST"
            }
          );

        alert(
          `Deposit verified successfully!\n\n` +
          `Status: ${verified.status}\n` +
          `Amount: KSh ${numericAmount.toFixed(2)}`
        );

        await loadAccount(false);
      }

    } catch (error) {

      alert(
        `Deposit failed:\n\n${error.message}`
      );
    }
  }
);

// ==============================
// TRANSFER
// ==============================

actionButtons[1].addEventListener(
  "click",
  async () => {

    if (!accountId) {
      alert(
        "Please click Get Started first."
      );
      return;
    }

    if (!askForApiKey()) {
      return;
    }

    const to = prompt(
      "Enter the recipient Account ID:"
    );

    if (!to) return;

    const amount = prompt(
      "Enter transfer amount in KSh:"
    );

    if (!amount) return;

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      alert(
        "Please enter a valid amount."
      );
      return;
    }

    try {

      const transfer =
        await apiRequest(
          "/transfers",
          {
            method: "POST",
            body: JSON.stringify({
              from: accountId,
              to: to.trim(),
              amount: numericAmount
            })
          }
        );

      alert(
        `Transfer created successfully!\n\n` +
        `Transfer ID: ${transfer.id || "Created"}`
      );

      await loadAccount(false);

    } catch (error) {

      alert(
        `Transfer failed:\n\n${error.message}`
      );
    }
  }
);

// ==============================
// PAYMENT REQUEST
// ==============================

actionButtons[2].addEventListener(
  "click",
  async () => {

    if (!accountId) {
      alert(
        "Please click Get Started first."
      );
      return;
    }

    if (!askForApiKey()) {
      return;
    }

    const customerId =
      prompt(
        "Enter Customer Account ID:"
      );

    if (!customerId) return;

    const amount =
      prompt(
        "Enter requested amount in KSh:"
      );

    if (!amount) return;

    const numericAmount =
      Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      alert(
        "Please enter a valid amount."
      );
      return;
    }

    try {

      const payment =
        await apiRequest(
          "/payment-requests",
          {
            method: "POST",
            body: JSON.stringify({
              merchantId: accountId,
              customerId:
                customerId.trim(),
              amount: numericAmount
            })
          }
        );

      alert(
        `Payment request created!\n\n` +
        `Request ID: ${payment.id}\n` +
        `Amount: KSh ${numericAmount.toFixed(2)}`
      );

    } catch (error) {

      alert(
        `Payment request failed:\n\n${error.message}`
      );
    }
  }
);

// ==============================
// TRANSACTION HISTORY
// ==============================

actionButtons[3].addEventListener(
  "click",
  async () => {

    if (!accountId) {
      alert(
        "Please click Get Started first."
      );
      return;
    }

    if (!askForApiKey()) {
      return;
    }

    try {

      const transactions =
        await apiRequest(
          "/transactions"
        );

      if (
        !Array.isArray(transactions) ||
        transactions.length === 0
      ) {
        alert(
          "No transactions found."
        );
        return;
      }

      const text =
        transactions
          .map(
            (transaction, index) => {

              const amount =
                transaction.amountMinor !==
                undefined
                  ? `KSh ${(transaction.amountMinor / 100).toFixed(2)}`
                  : "";

              return (
                `${index + 1}. ` +
                `${transaction.type || "TRANSACTION"} ` +
                `${amount}\n` +
                `Status: ${transaction.status || "N/A"}\n` +
                `ID: ${transaction.id}`
              );
            }
          )
          .join("\n\n");

      alert(
        `Transaction History\n\n${text}`
      );

    } catch (error) {

      alert(
        `Could not load transactions:\n\n${error.message}`
      );
    }
  }
);

// ==============================
// STARTUP
// ==============================

console.log(
  "My Payment Company frontend loaded"
);

console.log(
  "API:",
  API_BASE
);
