function PaymentMode(mode, opts) {
    var that         = this;
    opts             = opts || {};
    this.type        = 'paymentOptionToken';
    this.paymentMode = {};

    switch (mode) {
        case 'card':
            ['type', 'scheme', 'number', 'holder', 'expiry', 'cvv'].forEach(function (key, val) {
                that.paymentMode[key] = opts[key] || null;
            });
            break;

        case 'netbanking':
            this.paymentMode.type = 'netbanking';
            this.paymentMode.bank = opts.bank;
            this.paymentMode.code = opts.code;
            break;
    }
}

module.exports = PaymentMode;