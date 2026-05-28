import * as admin from 'firebase-admin';

let app: admin.app.App;

export function initializeFirebase(): admin.app.App {
  if (app) return app;

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });

  return app;
}

export function getFirebaseAdmin(): typeof admin {
  return admin;
}