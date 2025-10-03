import * as crypto from 'crypto';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
const { admin, db, onRequest } = require('../shared/utilities');
import type {
  IssueReferralRequest, IssueReferralResponse,
  RedeemReferralRequest, RedeemReferralResponse,
  ClipHandoffCreateRequest, ClipHandoffCreateResponse,
  ClipHandoffClaimRequest, ClipHandoffClaimResponse,
  ResolveSponsorResponse
} from './types';
const corsHandler = cors({
  origin: [
    'https://teambuildpro.com',
    'https://www.teambuildpro.com',
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/
  ],
  credentials: true
});

function token(n = 24) { return crypto.randomBytes(n).toString('hex'); }
function ttlHours(h: number) { return admin.firestore.Timestamp.fromMillis(Date.now() + h * 3600 * 1000); }

const limiter = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });

async function issueReferralHandler(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  await new Promise(r => (limiter as any)(req, res, r));

  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: IssueReferralRequest = req.body || {};
  const sponsorCode = (body.sponsorCode || '').trim();
  const t = (body.t || '1').trim();

  const tok = token(16);
  const doc = db.collection('referralTokens').doc(tok);
  const expiresAt = ttlHours(24);

  await doc.set({
    sponsorCode: sponsorCode || null,
    t,
    status: 'issued',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt
  }, { merge: false });

  const resp: IssueReferralResponse = { token: tok, expiresAt: new Date(expiresAt.toMillis()).toISOString() };
  return res.status(200).json(resp);
}

async function redeemReferralHandler(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: RedeemReferralRequest = req.body || {};
  const tok = (body.token || '').trim();
  if (!tok) return res.status(400).send('token required');

  const docRef = db.collection('referralTokens').doc(tok);
  const snap = await docRef.get();
  if (!snap.exists) {
    const resp: RedeemReferralResponse = { status: 'not_found' };
    return res.status(404).json(resp);
  }

  const data = snap.data()!;
  const now = admin.firestore.Timestamp.now();
  if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
    const resp: RedeemReferralResponse = { status: 'expired' };
    return res.status(200).json(resp);
  }

  if (data.status === 'redeemed') {
    const resp: RedeemReferralResponse = {
      status: 'already_redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
    };
    return res.status(200).json(resp);
  }

  await docRef.update({ status: 'redeemed', redeemedAt: now });
  const resp: RedeemReferralResponse = {
    status: 'redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
  };
  return res.status(200).json(resp);
}

async function clipHandoffCreateHandler(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: ClipHandoffCreateRequest = req.body || {};
  const handoffId = (body.handoffId || '').trim();
  if (!handoffId) return res.status(400).send('handoffId required');

  const ref = (body.ref || '').trim();
  const t = (body.t || '1').trim();

  const refDoc = db.collection('clipHandoffs').doc(handoffId);
  const snap = await refDoc.get();
  const payload: any = {
    ref: ref || null,
    t,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: ttlHours(24),
    claimed: false
  };

  if (!snap.exists) {
    await refDoc.set(payload, { merge: false });
    const sponsor = await tryResolveSponsor(ref);
    const resp: ClipHandoffCreateResponse = { handoffId, created: true, sponsor };
    return res.status(201).json(resp);
  } else {
    const sponsor = await tryResolveSponsor(ref || snap.data()?.ref);
    const resp: ClipHandoffCreateResponse = { handoffId, created: false, sponsor };
    return res.status(200).json(resp);
  }
}

async function clipHandoffClaimHandler(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const body: ClipHandoffClaimRequest = req.body || {};
  const handoffId = (body.handoffId || '').trim();
  if (!handoffId) return res.status(400).send('handoffId required');

  const refDoc = db.collection('clipHandoffs').doc(handoffId);
  const snap = await refDoc.get();
  if (!snap.exists) return res.status(404).json({ found: false, claimed: false } as ClipHandoffClaimResponse);

  const data = snap.data()!;
  const now = admin.firestore.Timestamp.now();
  if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
    return res.status(404).json({ found: false, claimed: false } as ClipHandoffClaimResponse);
  }

  if (!data.claimed) {
    await refDoc.update({ claimed: true, claimedAt: now });
  }
  const resp: ClipHandoffClaimResponse = { found: true, claimed: true, ref: data.ref || undefined, t: data.t };
  return res.status(200).json(resp);
}

async function resolveSponsorHandler(req: any, res: any) {
  await new Promise(r => corsHandler(req, res, r));
  const ref = ((req.query.ref || req.query.code) ?? '').toString().trim();
  if (!ref) return res.status(400).send('ref required');

  const sponsor = await tryResolveSponsor(ref);
  const resp: ResolveSponsorResponse = { ref, sponsor };
  return res.status(200).json(resp);
}

async function tryResolveSponsor(ref?: string | null) {
  if (!ref) return undefined;
  try {
    const codeDoc = await db.collection('referralCodes').doc(ref).get();
    const uid = codeDoc.exists ? codeDoc.data()?.uid : ref;

    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return undefined;

    const u = userDoc.data()!;
    return {
      firstName: u.firstName || u.givenName || '',
      lastName:  u.lastName  || u.familyName || '',
      bizOppName: u.bizOppName || u.company || ''
    };
  } catch { return undefined; }
}

// Export Cloud Functions wrapped with onRequest
export const issueReferral = onRequest(issueReferralHandler);
export const redeemReferral = onRequest(redeemReferralHandler);
export const clipHandoffCreate = onRequest(clipHandoffCreateHandler);
export const clipHandoffClaim = onRequest(clipHandoffClaimHandler);
export const resolveSponsor = onRequest(resolveSponsorHandler);
