var request = require('request');

function Client(opts) {
    var that = this;
    opts     = opts || {};

    ['mode', 'accessKey', 'vanityUrl'].forEach(function (key, val) {
        that[key] = opts[key] || null;
    });
}

Client.prototype.getTransactionUrl = function (opts) {
    opts = opts || {};

    var that = this;
    var body = {};

    body.merchantTxnId       = opts.transaction.txnId;
    body.requestSignature    = opts.transaction.requestSignature;
    body.userDetails         = opts.user;
    body.userDetails.address = opts.address;
    body.paymentToken        = opts.paymentMode;
    body.amount              = { value: opts.transaction.amount, currency: opts.transaction.currency };
    body.returnUrl           = opts.returnUrl;
    body.notifyUrl           = opts.notifyUrl;
    body.merchantAccessKey   = that.accessKey;

    return new Promise(function (resolve, reject) {
        request({
            url   : getPayUrl.call(that),
            method: 'POST',
            body  : body,
            json  : true
        }, function (err, res, body) {
            if (err) {
                return reject(err);
            }

            if (body.pgRespCode !== '0') {
                return reject(new Error(body.pgRespCode + ': ' + body.txMsg));
            }

            resolve(body.redirectUrl);
        });
    });
};

function getPayUrl() {
    var baseUrl;

    switch(this.mode) {
        case 'sandbox':
            baseUrl = 'https://sandboxadmin.citruspay.com/service/moto/authorize/struct/';
            break;
        case 'production':
            baseUrl = 'https://admin.citruspay.com/service/moto/authorize/struct/';
            break;
    }

    return baseUrl + this.vanityUrl;
}

module.exports = Client;