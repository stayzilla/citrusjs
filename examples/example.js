var citrus = require('../src');

var citrusClient = new citrus.Client({
    accessKey: 'ACCESS_KEY',
    vanityUrl: 'VANITY_URL',
    mode     : 'sandbox' // or production
});

var citrusServer = new citrus.Server({
    accessKey: 'ACCESS_KEY',
    secretKey: 'SECRET_KEY',
    mode     : 'sandbox' // or production
});

var addr = new citrus.models.Address({
    street1: 'Address LINE 1',
    street2: 'Address LINE 2',
    city   : 'CITY',
    state  : 'STATE',
    country: 'COUNTRY',
    zip    : 'ZIPCODE'
});

var user = new citrus.models.User({
    email    : 'john.doe@gmail.com',
    firstName: 'John',
    lastName : 'Doe',
    mobileNo : '9845940393'
});

var paymentMode = new citrus.models.PaymentMode('netbanking', {
    bank: 'AXIS Bank',
    code: 'CID002'
});

//var paymentMode = new citrus.models.PaymentMode('card', {
//    type      : 'credit',
//    scheme    : 'visa',
//    number    : '4111111111111111',
//    holderName: 'John Doe',
//    expiry    : '01/2019',
//    cvv       : '123'
//});

var txnId  = Number(new Date());
var amount = 10.00;
var transaction = new citrus.models.Transaction({
    txnId           : txnId,
    amount          : amount,
    currency        : 'INR',
    requestSignature: citrusServer.generateRequestSignature(txnId, amount)
});

citrusClient.getTransactionUrl({
    transaction: transaction,
    user       : user,
    address    : addr,
    paymentMode: paymentMode,
    returnUrl  : 'RETURN_URL',
    notifyUrl  : 'NOTIFY_URL'
})
    .then(function (url) {
        console.log('Txn url', url);
    })
    .catch(function (err) {
        console.log('Txn ERR', err.stack);
    });