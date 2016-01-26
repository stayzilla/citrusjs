function Address(opts) {
    var that = this;
    opts     = opts || {};

    ['street1', 'street2', 'city', 'state', 'country', 'zip'].forEach(function (key, val) {
        that[key] = opts[key] || null;
    });
}

module.exports = Address;