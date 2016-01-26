function User(opts) {
    var that = this;
    opts     = opts || {};

    ['email', 'firstName', 'lastName', 'mobileNo'].forEach(function (key, val) {
        that[key] = opts[key] || null;
    });
}

module.exports = User;