var crypto = require('crypto');

function Server(opts) {
    var that = this;
    opts     = opts || {};

    ['mode', 'accessKey', 'secretKey'].forEach(function (key, val) {
        that[key] = opts[key] || null;
    });
}

Server.prototype.generateRequestSignature = function (txnId, amount) {
    var data = 'merchantAccessKey=' + this.accessKey +
        '&transactionId=' + txnId +
        '&amount=' + amount;

    return crypto.createHmac('sha1', this.secretKey).update(data).digest('hex');
};

module.exports = Server;