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

app.post('/game/create', (req, res) => {
  let players = {};
  players[req.user.uid] = {
    ready: false
  };

  let game = {
    sudoku: 1,
    level: req.body.game.level,
    type: req.body.game.type,
    startedAt: Date.now(),
    won: null,
    config: {
      showTimer: !!req.body.game.config.showTimer
    },
    teams: {
      0: {
        players: players,
        solved: { },
        isSolved: false
      }
    }
  };

  let gameRef = admin.database().ref(`/games/`).push();

  gameRef.set(game);

  game.id = gameRef.key;

  res.send({
    status: 'ok',
    data: {
      game: game
    }
  });
});

app.post('/game/player/ready', (req, res) => {
  admin.database()
    .ref('/games/').child(req.body.gameId)
    .child('/teams/').child(req.body.teamId)
    .child('/players/').child(req.body.playerId)
    .child('/ready/').set(true);

  res.send({
    status: 'ok'
  });
});

app.post('/game/get', (req, res) => {
  admin.database().ref('/games/').child(req.body.gameId)
    .once('value').then(value => {
      let game = value.val();

      game.initial = {
        0: 1,
        1: 2,
        2: 3,
        3: 4,
      };

      game.teams[0].solved = game.teams[0].solved || {};

      // The WTF Firebase behavior
      if (Array.isArray(game.teams[0].solved)) {
        let newSolved = {};

        for (var i = 0; i < game.teams[0].solved.length; ++i) {
          if (game.teams[0].solved[i] > 0) {
            newSolved[i] = game.teams[0].solved[i]
          }
        }

        game.teams[0].solved = newSolved;
      }

      res.send({
        status: 'ok',
        data: {
          game: game
        }
      });
    });
});

app.post('/game/solved/change', (req, res) => {
  admin.database()
    .ref('/games/').child(req.body.gameId)
    .child('/teams/').child(req.body.teamId)
    .child('/solved/').child(req.body.i).set(req.body.newValue);

  res.send({
    status: 'ok'
  });
});

app.post('/game/isSolved', (req, res) => {
  var ref = admin.database()
    .ref('/games/').child(req.body.gameId)
    .child('/teams/').child(req.body.teamId);

  ref.child('/isSolved/').set(true);
  ref.child('/solvedAt/').set(Date.now());

  res.send({
    status: 'ok'
  });
});

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

// Export API
exports.api = functions.https.onRequest(app);
