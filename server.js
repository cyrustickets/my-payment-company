[1mdiff --git a/ledger.js b/ledger.js[m
[1mindex 2004cbd..aae769d 100644[m
[1m--- a/ledger.js[m
[1m+++ b/ledger.js[m
[36m@@ -19,7 +19,35 @@[m [mlet databaseReady = false;[m
 // DATABASE INITIALIZATION[m
 // ========================================[m
 [m
[32m+[m
[32m+[m[32masync function migrateTransactionColumns() {[m
[32m+[m[32m  await pool.query(`[m
[32m+[m[32m    ALTER TABLE transactions[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS client_name TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS card_brand TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS card_all[m
[32m+[m[32m TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS card_expiry TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS customer_email TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS customer_phone TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS order_reference TEXT[m
[32m+[m[32m  `);[m
[32m+[m[32m}[m
[32m+[m
[32m+[m
[32m+[m[32masync function migrateCardPaymentColumns() {[m
[32m+[m[32m  await pool.query(`[m
[32m+[m[32m    ALTER TABLE card_payments[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS card_expiry TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS customer_email TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS customer_phone TEXT,[m
[32m+[m[32m      ADD COLUMN IF NOT EXISTS order_reference TEXT[m
[32m+[m[32m  `);[m
[32m+[m[32m}[m
[32m+[m
 async function initDatabase() {[m
[32m+[m[32m  await migrateCardPaymentColumns();[m
[32m+[m[32m  await migrateTransactionColumns();[m
   if (databaseReady) {[m
     return;[m
   }[m
[36m@@ -1247,7 +1275,10 @@[m [masync function createCardPayment([m
   cardNumber,[m
   expiry,[m
   cvv,[m
[31m-  cardholderName = ""[m
[32m+[m[32m  cardholderName = "",[m
[32m+[m[32m  customerEmail = "",[m
[32m+[m[32m  customerPhone = "",[m
[32m+[m[32m  orderReference = ""[m
 ) {[m
   validateAccountId(accountId);[m
   validateAmount(amountMinor);[m
[36m@@ -1362,6 +1393,10 @@[m [masync function createCardPayment([m
           cardholder_name,[m
           card_brand,[m
           card_last4,[m
[32m+[m[32m          card_expiry,[m
[32m+[m[32m          customer_email,[m
[32m+[m[32m          customer_phone,[m
[32m+[m[32m          order_reference,[m
           amount_minor,[m
           currency,[m
           status,[m
[36m@@ -1369,7 +1404,7 @@[m [masync function createCardPayment([m
           created_at[m
         )[m
         VALUES[m
[31m-        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)[m
[32m+[m[32m        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)[m
       `,[m
       [[m
         transactionId,[m
[36m@@ -1377,6 +1412,10 @@[m [masync function createCardPayment([m
         String(cardholderName || "").trim() || null,[m
         "VISA",[m
         cleanCard.slice(-4),[m
[32m+[m[32m        String(expiry || "").trim() || null,[m
[32m+[m[32m        String(customerEmail || "").trim() || null,[m
[32m+[m[32m        String(customerPhone || "").trim() || null,[m
[32m+[m[32m        String(orderReference || "").trim() || null,[m
         amountMinor,[m
         account.currency,[m
         "SUCCESS",[m
[1mdiff --git a/server.js b/server.js[m
[1mindex cd0ac5e..bba7397 100644[m
[1m--- a/server.js[m
[1m+++ b/server.js[m
[36m@@ -864,7 +864,11 @@[m [mapp.post([m
         amount,[m
         cardNumber,[m
         expiry,[m
[31m-        cvv[m
[32m+[m[32m        cvv,[m
[32m+[m[32m        cardholderName,[m
[32m+[m[32m        customerEmail,[m
[32m+[m[32m        customerPhone,[m
[32m+[m[32m        orderReference[m
       } = req.body;[m
 [m
       if ([m
[36m@@ -901,7 +905,11 @@[m [mapp.post([m
           amountMinor,[m
           cardNumber,[m
           expiry,[m
[31m-          cvv[m
[32m+[m[32m          cvv,[m
[32m+[m[32m          cardholderName,[m
[32m+[m[32m          customerEmail,[m
[32m+[m[32m          customerPhone,[m
[32m+[m[32m          orderReference[m
         );[m
 [m
       return res.status(201).json(payment);[m
