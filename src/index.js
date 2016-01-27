var co             = require('co'),
    pbf            = require('protobufjs'),
    crypto         = require('crypto'),
    prequest       = require('request-promise'),
    builder        = pbf.loadProtoFile(__dirname + '/types.proto'),

    // Classes built from protobuf:
    Merchant       = builder.build('Merchant'),
    Address        = builder.build('Address'),
    User           = builder.build('User'),
    Card           = builder.build('Card'),
    Bank           = builder.build('Bank'),
    CustomParam    = builder.build('CustomParam'),
    Transaction    = builder.build('Transaction'),
    PaymentMethods = builder.build('PaymentMethods'),

    cardSchemeMap  = {
        'visa'        : 'VISA',
        'mastercard'  : 'MASTERCARD',
        'master card' : 'MASTERCARD',
        'maestro'     : 'MAESTRO',
        'maestro card': 'MAESTRO',
        'amex'        : 'AMEX',
        'dinersclub'  : 'DINERS',
        'diners club' : 'DINERS',
        'rupay'       : 'RUPAY'
    };

/**
 * Fetch payment options enabled for merchant
 * @returns {Promise} Resolves to {PaymentMethods}
 */
Merchant.prototype.fetchPaymentOptions = function () {
    var that = this;

    return co(function* () {
        var params = {
            url   : getBaseUrl(that.env) + '/service/v1/merchant/pgsetting',
            method: 'post',
            form  : { vanity: that.vanity_url }
        };

        var resp = yield prequest(params);
            resp = JSON.parse(resp);

        return new PaymentMethods({
            banks: resp.netBanking.map(function (bank) {
                return { name: bank.bankName, code: bank.issuerCode }
            }),

            credit_cards: resp.creditCard.map(function (scheme) {
                return { scheme: cardSchemeMap[scheme.toLowerCase()] }
            }),

            debit_cards: resp.debitCard.map(function (scheme) {
                return { scheme: cardSchemeMap[scheme.toLowerCase()] }
            })
        });
    });
};

/**
 * Generate request signature for a transaction with ID and amount
 * @param {Transaction} txn
 * @returns {String} Signature. Also sets the signature on the passed transaction
 */
Merchant.prototype.generateRequestSignature = function (txn) {
    var data = [
        ['merchantAccessKey', this.access_key],
        ['transactionId'    , txn.id         ],
        ['amount'           , txn.amount     ]
    ]
        .map(function (keyval) {
            return keyval.join('=');
        })
        .join('&');

    txn.signature = crypto
        .createHmac('sha1', this.secret_key)
        .update(data)
        .digest('hex');

    return txn.signature;
};

/**
 * Get citrus pay url for card payment
 * @param {User} user
 * @param {Card} card
 * @param {Transaction} txn
 */
Merchant.prototype.getCardPaymentUrl = function (user, card, txn) {
    return getPaymentUrl.call(this, 'card', user, card, txn);
};

/**
 * Get citrus pay url for net banking payment
 * @param {User} user
 * @param {Bank} bank
 * @param {Transaction} txn
 */
Merchant.prototype.getNetBankingUrl = function (user, bank, txn) {
    return getPaymentUrl.call(this, 'nb', user, bank, txn);
};

function getBaseUrl(env) {
    switch (env) {
        case Merchant.Env.SANDBOX:
            return 'https://sandboxadmin.citruspay.com';
        case Merchant.Env.PRODUCTION:
            return 'https://admin.citruspay.com';
    }
}

function getPaymentUrl(mode, user, payment, txn) {
    var that = this;

    return co(function* () {
        var body = {
            merchantTxnId    : txn.id,
            requestSignature : txn.signature,
            returnUrl        : txn.return_url,
            notifyUrl        : txn.notify_url,
            merchantAccessKey: that.access_key,
            customParameters : {},

            amount: {
                currency: txn.currency,
                value   : txn.amount
            },

            userDetails: {
                email    : user.email,
                firstName: user.fname,
                lastName : user.lname,
                mobileNo : user.mobile,

                address: {
                    street1: user.address.street1,
                    street2: user.address.street2,
                    city   : user.address.city,
                    state  : user.address.state,
                    country: user.address.country,
                    zip    : user.address.pincode
                }
            },

            paymentToken: {
                type       : 'paymentOptionToken',
                paymentMode: {}
            }
        };

        txn.custom_params.forEach(function (param) {
            body.customParameters[param.name] = param.value;
        });

        switch (mode) {
            case 'card':
                body.paymentToken.paymentMode.type   = pbf.Reflect.Enum.getName(Card.Type, payment.type).toLowerCase();
                body.paymentToken.paymentMode.scheme = pbf.Reflect.Enum.getName(Card.Scheme, payment.scheme).toLowerCase();
                body.paymentToken.paymentMode.number = payment.number;
                body.paymentToken.paymentMode.holder = payment.owner_name;
                body.paymentToken.paymentMode.expiry = payment.expiry_month + '/' + payment.expiry_year;
                body.paymentToken.paymentMode.cvv    = payment.cvv;
                break;

            case 'nb':
                body.paymentToken.paymentMode.type = 'netbanking';
                body.paymentToken.paymentMode.bank = payment.name;
                body.paymentToken.paymentMode.code = payment.code;
                break;
        }

        var params = {
            url   : getBaseUrl(that.env) + '/service/moto/authorize/struct/' + that.vanity_url,
            headers: {
                'Content-Type': 'application/json'
            },
            method: 'post',
            body  : JSON.stringify(body)
        };

        var resp = yield prequest(params);
            resp = JSON.parse(resp);

        if (resp.pgRespCode !== '0') {
            throw new Error(resp.pgRespCode + ': ' + resp.txMsg);
        }

        return resp.redirectUrl;
    });
}
