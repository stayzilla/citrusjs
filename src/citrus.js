var co       = require('co'),
    pbf      = require('protobufjs'),
    crypto   = require('crypto'),
    prequest = require('request-promise'),
    builder  = pbf.loadProtoFile(__dirname + '/types.proto'),

    // Classes built from protobuf:
    Merchant       = builder.build('Merchant'),
    Address        = builder.build('Address'),
    User           = builder.build('User'),
    Instrument     = builder.build('Instrument'),
    CustomParam    = builder.build('CustomParam'),
    Transaction    = builder.build('Transaction'),
    AccessToken    = builder.build('AccessToken'),

    cardSchemeMap  = {
        'visa'        : 'VISA',
        'mastercard'  : 'MCRD',
        'master card' : 'MCRD',
        'maestro'     : 'MTRO',
        'maestro card': 'MTRO',
        'amex'        : 'AMEX',
        'dinersclub'  : 'DINERS',
        'diners club' : 'DINERS',
        'rupay'       : 'RPAY'
    };

/**
 * Fetch payment options enabled for merchant
 * @returns {Promise} Resolves to array of {Instrument}
 */
Merchant.prototype.getEligibleInstruments = function () {
    var that = this;

    return co(function * () {
        var params, resp, instruments;

        params = {
            url   : getBaseUrl(that.env) + '/service/v1/merchant/pgsetting',
            method: 'post',
            form  : { vanity: that.vanity_url }
        };
        resp        = yield prequest(params);
        resp        = JSON.parse(resp);
        instruments = [];

        resp.netBanking.forEach(function (bank) {
            instruments.push(new Instrument({
                type     : Instrument.Type.NET_BANKING,
                bank_name: bank.bankName,
                bank_code: bank.issuerCode
            }));
        });
        resp.creditCard.forEach(function (scheme) {
            instruments.push(new Instrument({
                type       : Instrument.Type.CREDIT_CARD,
                card_scheme: cardSchemeMap[scheme.toLowerCase()]
            }));
        });
        resp.debitCard.forEach(function (scheme) {
            instruments.push(new Instrument({
                type       : Instrument.Type.DEBIT_CARD,
                card_scheme: cardSchemeMap[scheme.toLowerCase()]
            }));
        });

        return instruments;
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
        ['transactionId',     txn.id],
        ['amount',            txn.amount]
    ]
        .map(function (keyval) {
            return keyval.join('=');
        })
        .join('&');

    txn.set('signature', crypto
        .createHmac('sha1', this.secret_key)
        .update(data)
        .digest('hex'));

    return txn.signature;
};

/**
 * Get citrus pay url
 * @param {User} user
 * @param {Instrument} ins
 * @param {Transaction} txn
 */
Merchant.prototype.getPaymentUrl = function (user, ins, txn) {
    var that = this;

    return co(function * () {
        var body, params, resp;

        body = {
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

            requestOrigin: 'CJSG',
            paymentToken: {}
        };

        txn.custom_params.forEach(function (param) {
            body.customParameters[param.name] = param.value;
        });

        if (ins.citrus_token) {
            body.paymentToken.type = 'paymentOptionIdToken';

            if ([Instrument.Type.CREDIT_CARD, Instrument.Type.DEBIT_CARD].indexOf(ins.type) !== -1) {
                body.paymentToken.cvv = ins.card_cvv;
                body.paymentToken.id  = ins.citrus_token;
            } else {
                body.paymentToken.id  = '1&' + ins.citrus_token;
            }
        } else {
            body.paymentToken.type        = 'paymentOptionToken';
            body.paymentToken.paymentMode = {};

            switch (ins.type) {
                case Instrument.Type.CREDIT_CARD:
                    body.paymentToken.paymentMode.type = 'credit';
                    break;
                case Instrument.Type.DEBIT_CARD:
                    body.paymentToken.paymentMode.type = 'debit';
                    break;
                case Instrument.Type.NET_BANKING:
                    body.paymentToken.paymentMode.type = 'netbanking';
                    break;
            }
            switch (ins.type) {
                case Instrument.Type.CREDIT_CARD:
                case Instrument.Type.DEBIT_CARD:
                    body.paymentToken.paymentMode.scheme = pbf.Reflect.Enum.getName(Instrument.CardScheme, ins.card_scheme);
                    body.paymentToken.paymentMode.number = ins.card_number;
                    body.paymentToken.paymentMode.holder = ins.card_owner_name;
                    body.paymentToken.paymentMode.expiry = ins.card_expiry_month + '/' + ins.card_expiry_year;
                    body.paymentToken.paymentMode.cvv    = ins.card_cvv;
                    break;
                case Instrument.Type.NET_BANKING:
                    body.paymentToken.paymentMode.bank = ins.bank_name;
                    body.paymentToken.paymentMode.code = ins.bank_code;
                    break;
            }
        }

        params = {
            url                    : getBaseUrl(that.env) + '/service/moto/authorize/struct/' + that.vanity_url,
            method                 : 'post',
            body                   : body,
            json                   : true,
            resolveWithFullResponse: true,
            simple                 : false

        };
        resp = yield prequest(params);
        resp = resp.body;

        if (resp.pgRespCode !== '0') {
            throw new Error(resp.pgRespCode + ': ' + resp.txMsg);
        }

        return resp.redirectUrl;
    });
};

Merchant.prototype.getAccessToken = function (user) {
    var that = this;

    return co(function * () {
        var params, resp;

        params = {
            url   : getBaseUrl(that.env) + '/oauth/token',
            method: 'post',
            form  : {
                client_id    : that.js_signin_id,
                client_secret: that.js_signin_secret,
                grant_type   : 'password',
                username     : user.username,
                password     : user.password
            },
            resolveWithFullResponse: true,
            simple: false
        };
        resp = yield prequest(params);

        if (resp.statusCode !== 200) {
            return null;
        }

        resp = JSON.parse(resp.body);

        return new AccessToken({
            access_token : resp.access_token,
            token_type   : resp.token_type,
            refresh_token: resp.refresh_token,
            expires_in   : resp.expires_in,
            scopes       : resp.scope.split(' '),
            received_at  : Number(new Date())
        });
    });
};

/**
 * Fetch users saved payment instruments
 * @param {User} user
 * @returns {*|Promise} resolves to array of {Instrument}
 */
Merchant.prototype.getUserInstruments = function (user) {
    var that = this;

    return co(function * () {
        var token, params, resp;

        token = yield that.getAccessToken(user);

        if (!token) {
            return null;
        }

        params = {
            url : getBaseUrl(that.env) + '/service/v2/profile/me/payment',
            auth: { bearer: token.access_token }
        };
        resp = yield prequest(params);
        resp = JSON.parse(resp);

        return resp.paymentOptions.map(function (opt) {
            var ins = new Instrument();
            ins.set('citrus_name',  opt.name);
            ins.set('citrus_token', opt.token);

            switch (opt.type) {
                case 'debit':
                    ins.set('type', Instrument.Type.DEBIT_CARD);
                    break;
                case 'credit':
                    ins.set('type', Instrument.Type.CREDIT_CARD);
                    break;
                case 'netbanking':
                    ins.set('type', Instrument.Type.NET_BANKING);
                    break;
            }

            switch (opt.type) {
                case 'debit':
                case 'credit':
                    ins.set('card_scheme',       opt.scheme);
                    ins.set('card_number',       opt.number);
                    ins.set('card_expiry_month', Number(opt.expiryDate.substr(0, 2)));
                    ins.set('card_expiry_year',  Number(opt.expiryDate.substr(2)));
                    break;
                case 'netbanking':
                    ins.set('bank_name', opt.bank);
                    break;
            }

            return ins;
        });
    });
};

function getBaseUrl(env) {
    switch (env) {
        case Merchant.Env.SANDBOX:
            return 'https://sandboxadmin.citruspay.com';
        case Merchant.Env.PRODUCTION:
            return 'https://admin.citruspay.com';
    }
}

module.exports = {
    User       : User,
    Address    : Address,
    Merchant   : Merchant,
    Instrument : Instrument,
    CustomParam: CustomParam,
    Transaction: Transaction,
    AccessToken: AccessToken
};
