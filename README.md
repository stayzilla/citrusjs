## Usage

```
var citrus = require("citrusjs");
```

### 1. Configure merchant details

```
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

The `js_signin_id` and `js_signin_secret` is required when fetching user payment modes (covered later)

### 2. Fetch eligible payment options enabled for merchant

```
merchant.getEligibleInstruments()
    .then(function (opts) {
        console.log(opts);
    });
```

**OUTPUT:**
The output is an array of `citrus.Instrument.Type.NET_BANKING` type. (See `/src/types.proto` for details).
Relevant fields are displayed below:

```
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

### 3. Process card payment

#### 3.1 Create a transaction

```
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

```
merchant.generateRequestSignature(txn);
```

#### 3.2 Add user details

```
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

Address can also be set separately:

```
usr.set("address", new citrus.Address({
    "street1": "ADDRESS LINE 1",
    "street2": "ADDRESS LINE 2",
    "city"   : "CITY",
    "state"  : "STATE",
    "country": "INDIA",
    "pincode": "560102"
}));
```

#### 3.2. Add payment info

```
var paymentMode = new citrus.Instrument({
    // ...
});
```

For card payment:

```
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

```
paymentMode = new citrus.Instrument({
    "type"     : citrus.Instrument.Type.NET_BANKING,
    "bank_name": "AXIS Bank",
    "bank_code": "CID002"
});
```

#### 3.3 Get payment URL

```
sz.getPaymentUrl(usr, paymentMode, txn)
    .then(function (url) {
        console.log("pay url: ", url);
        // redirect user to payment url (client side redirect)
    });
```
