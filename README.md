## Usage

```js
var citrus = require("citrusjs");
```

## Table of Contents

- [1. Configure merchant details](#1-configure-merchant-details)
- [2. Fetch eligible payment options](#2-fetch-eligible-payment-options-enabled-for-merchant)
- [3. Process Payments](#3-process-payments)
  - [3.1 Create a Transaction](#31-create-a-transaction)
  - [3.2 Add User details](#32-add-user-details)
  - [3.3 Add payment info](#33-add-payment-info)
  - [3.4 Get payment URL](#34-get-payment-url)
- [4. Pay using saved cards / banks](#4-pay-using-saved-cards--banks)
  - [4.1 Fetch user's saved cards / banks](#41-fetch-users-saved-cards--banks)
  - [4.2 Get payment URL](#42-get-payment-url)

### 1. Configure merchant details

```js
// Initialize merchant
var merchant = new citrus.Merchant({
    "env"             : citrus.Merchant.Env.SANDBOX, // or citrus.Merchant.Env.PRODUCTION
    "access_key"      : "MERCHANT_ACCESS_KEY",
    "secret_key"      : "MERCHANT_SECRET_KEY",
    "vanity_url"      : "VANITY_URL",
    "js_signin_id"    : "JS_SIGNIN_ID",              // optional
    "js_signin_secret": "JS_SIGNING_SECRET"          // optional
});
```

The `js_signin_id` and `js_signin_secret` is required when fetching user payment modes (see [section 4](#4-pay-using-saved-cards--banks))

### 2. Fetch eligible payment options enabled for merchant

```js
merchant.getEligibleInstruments()
    .then(function (opts) {
        console.log(opts);
    });
```

**OUTPUT:**
The output is an array of `citrus.Instrument.Type.NET_BANKING` type. (See [/src/types.proto](/src/types.proto) for details).
Relevant fields are displayed below:

```js
[
    {
        "type"       : citrus.Instrument.Type.NET_BANKING,
        "bank_name"  : "AXIS Bank",
        "bank_code"  : "CID002"
    },
    // ...
    {
        "type"       : citrus.Instrument.Type.CREDIT_CARD,
        "card_scheme": citrus.Instrument.CardScheme.VISA
    },
    {
        "type"       : citrus.Instrument.Type.DEBIT_CARD,
        "card_scheme": citrus.Instrument.CardScheme.MAESTRO
    },
    // ...
]
```

### 3. Process payments

#### 3.1 Create a transaction

```js
var txn = new citrus.Transaction({
    "id"           : "TRANS_" + Number(new Date()), // some unique txn id
    "amount"       : 10.00,
    "currency"     : "INR",
    "return_url"   : "http://mysite.com/postpay",
    "notify_url"   : "http://mysite.com/notifypay",
    "custom_params": [
        { "name": "foo", "value": "bar" },
        // ...
    ]
});
```

To generate a signature for the transaction:

```js
merchant.generateRequestSignature(txn);
```

#### 3.2 Add user details

```js
var usr = new citrus.User({
    "email"   : "john.doe@gmail.com",
    "fname"   : "John",
    "lname"   : "Doe",
    "mobile"  : "9999999999",
    "username": "CITRUS_USERNAME", // optional
    "password": "CITRUS_PASSWORD", // optional
    "address" : {
        "street1": "ADDRESS LINE 1",
        "street2": "ADDRESS LINE 2",
        "city"   : "CITY",
        "state"  : "STATE",
        "country": "INDIA",
        "pincode": "560102"
    }
});`
```

Fields `username` and `password` are required only when fetching user's saved cards (see [section 4](#4-pay-using-saved-cards--banks)).    
Address can also be set separately:

```js
usr.set("address", new citrus.Address({
    "street1": "ADDRESS LINE 1",
    "street2": "ADDRESS LINE 2",
    "city"   : "CITY",
    "state"  : "STATE",
    "country": "INDIA",
    "pincode": "560102"
}));
```

#### 3.3 Add payment info

```js
var paymentMode = new citrus.Instrument({
    // ...
});
```

For card payment:

```js
paymentMode = new citrus.Instrument({
    "type"             : citrus.Instrument.Type.CREDIT_CARD, // or citrus.Instrument.Type.DEBIT_CARD
    "card_scheme"      : citrus.Instrument.CardScheme.VISA,
    "card_number"      : "4111111111111111",
    "card_owner_name"  : "John Doe",
    "card_expiry_month": 11,
    "card_expiry_year" : 2018,
    "card_cvv"         : "123"
});
```

For netbanking:

```js
paymentMode = new citrus.Instrument({
    "type"     : citrus.Instrument.Type.NET_BANKING,
    "bank_name": "AXIS Bank",
    "bank_code": "CID002"
});
```

#### 3.4 Get payment URL

```js
sz.getPaymentUrl(usr, paymentMode, txn)
    .then(function (url) {
        console.log("pay url: ", url);
        // redirect user to payment url (client side redirect)
    });
```

### 4. Pay using saved cards / banks

#### 4.1 Fetch user's saved cards / banks

> **ENSURE THAT**
>  
> - While creating merchant object, you set properties `js_signin_id` and `js_signin_secret`
> - While creating user object, you set properties `username` and `password`

```
merchant.getUserInstruments(usr)
    .then(function (instruments) {
        console.log(instruments);
    });
```

**OUTPUT:**
The output is an array of `citrus.Instrument.Type.NET_BANKING` type. (See [/src/types.proto](/src/types.proto) for details).
Relevant fields are displayed below:

```js
[
    { 
        type             : citrus.Instrument.Type.DEBIT_CARD,  // or citrus.Instrument.Type.CREDIT_CARD
        card_scheme      : citrus,Instrument.CardScheme.VISA,
        card_number      : 'XXXXXXXXXXXX1234',
        card_expiry_month: 10,
        card_expiry_year : 2020,
        citrus_token     : 'ajlklajsd921kj321l39asldkja921lk3',
        citrus_name      : 'Debit Card (1234)'
    },
    { 
        type             : citrus.Instrument.Type.NET_BANKING,
        bank_name        : 'ICICI Corporate Bank',
        citrus_token     : 'khe7312kjh8ah3k128ayhje81hjkdad8k',
        citrus_name      : 'ICICI bank'
    }
]
```

#### 4.2 Get payment URL

The method for getting payment URL is the same as described in [section 3.4]((#34-get-payment-url). Just add the CVV number input by user before fetching the url:

```js
paymentMode = new citrus.Instrument({
    "type"             : citrus.Instrument.Type.CREDIT_CARD, // or citrus.Instrument.Type.DEBIT_CARD
    "citrus_token"     : 'ajlklajsd921kj321l39asldkja921lk3',
    "card_cvv"         : "123"                               // input by user
});
```

In case of netbanking:

```js
paymentMode = new citrus.Instrument({
    "type"             : citrus.Instrument.Type.NET_BANKING,
    "citrus_token"     : 'khe7312kjh8ah3k128ayhje81hjkdad8k',
});
```

And then fetch URL:

```js
sz.getPaymentUrl(usr, paymentMode, txn)
    .then(function (url) {
        console.log("pay url: ", url);
        // redirect user to payment url (client side redirect)
    });
```