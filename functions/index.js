'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
const express = require('express');
const cors = require('cors')({ origin: true });
const app = express();
const appTracking = express();
app.use(cors);
appTracking.use(cors);

// Response Example
// Error: { status: 'error', error: { id: 'xxx/yyy', message: 'Everything is broken!' } }
// Success: { status: 'ok'[, data: <Mixed>] }

// Express middleware that validates Firebase ID Tokens passed in the Authorization HTTP header.
// The Firebase ID token needs to be passed as a Bearer token in the Authorization HTTP header like this:
// `Authorization: Bearer <Firebase ID Token>`.
// when decoded successfully, the ID Token content will be added as `req.user`.
const validateFirebaseIdToken = (req, res, next) => {
  if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) {
    res.status(403).send({
      status: 'error',
      error: {
        id: 'app/request/no-token',
        message: 'The request should contains a Token'
      }
    });
    return;
  }

  // Read the ID Token from the Authorization header.
  let idToken = req.headers.authorization.split('Bearer ')[1];
  admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
    req.user = decodedIdToken;
    next();
  }).catch(error => {
    res.status(403).send({
      status: 'error',
      error: {
        id: 'app/request/invalid-token',
        message: 'The request should contains a valid Token'
      }
    });
    return;
  });
};

app.use(validateFirebaseIdToken);

// app.get('/customers/me', (req, res) => {
//   let ref = admin.database().ref(`/customers/${req.user.uid}`);
//
//   ref.once('value').then(customer => {
//     res.send({
//       status: 'ok',
//       data: {
//         customer: customer.val()
//       }
//     });
//   });
// });

// app.post('/campaigns/new', (req, res) => {
//   let newCampaign = {
//     name: req.body.name,
//     type: req.body.type,
//     status: req.body.status
//   };
//
//   let campaignRef = admin.database().ref(`/customers/${req.user.uid}/campaigns`).push();
//
//   campaignRef.set(newCampaign);
//
//   newCampaign.id = campaignRef.key;
//
//   res.send({
//     status: 'ok',
//     data: {
//       campaign: newCampaign
//     }
//   });
// });

// app.post('/campaigns/remove', (req, res) => {
//   let ref = admin.database().ref(`/customers/${req.user.uid}/campaigns/${req.body.id}`);
//   ref.remove();
//
//   res.send({
//     status: 'ok'
//   });
// });

// Events
exports.userCreated = functions.auth.user().onCreate(event => {
  const data = event.data;
  return admin.database().ref(`/users/${data.uid}`).set(data);
});
exports.api = functions.https.onRequest(app);
