function Transaction(opts) {
    var that = this;
    opts     = opts || {};

    ['txnId', 'amount', 'currency', 'requestSignature'].forEach(function (key, val) {
        that[key] = opts[key] || null;
    });
}

module.exports = Transaction;