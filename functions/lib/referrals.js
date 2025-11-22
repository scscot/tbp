"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSponsor = exports.clipHandoffClaim = exports.clipHandoffCreate = exports.redeemReferral = exports.issueReferral = void 0;
const crypto = __importStar(require("crypto"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const { admin, db, onRequest } = require('../shared/utilities');
const corsHandler = (0, cors_1.default)({
    origin: [
        'https://teambuildpro.com',
        'https://www.teambuildpro.com',
        'https://es.teambuildpro.com',
        'https://pt.teambuildpro.com',
        /^http:\/\/localhost(:\d+)?$/,
        /^http:\/\/127\.0\.0\.1(:\d+)?$/
    ],
    credentials: true
});
function token(n = 24) { return crypto.randomBytes(n).toString('hex'); }
function ttlHours(h) { return admin.firestore.Timestamp.fromMillis(Date.now() + h * 3600 * 1000); }
const limiter = (0, express_rate_limit_1.default)({ windowMs: 60000, max: 30, standardHeaders: true, legacyHeaders: false });
async function issueReferralHandler(req, res) {
    await new Promise(r => corsHandler(req, res, r));
    await new Promise(r => limiter(req, res, r));
    if (req.method !== 'POST')
        return res.status(405).send('Method Not Allowed');
    const body = req.body || {};
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
    const resp = { token: tok, expiresAt: new Date(expiresAt.toMillis()).toISOString() };
    return res.status(200).json(resp);
}
async function redeemReferralHandler(req, res) {
    await new Promise(r => corsHandler(req, res, r));
    if (req.method !== 'POST')
        return res.status(405).send('Method Not Allowed');
    const body = req.body || {};
    const tok = (body.token || '').trim();
    if (!tok)
        return res.status(400).send('token required');
    const docRef = db.collection('referralTokens').doc(tok);
    const snap = await docRef.get();
    if (!snap.exists) {
        const resp = { status: 'not_found' };
        return res.status(404).json(resp);
    }
    const data = snap.data();
    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
        const resp = { status: 'expired' };
        return res.status(200).json(resp);
    }
    if (data.status === 'redeemed') {
        const resp = {
            status: 'already_redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
        };
        return res.status(200).json(resp);
    }
    await docRef.update({ status: 'redeemed', redeemedAt: now });
    const resp = {
        status: 'redeemed', sponsorCode: data.sponsorCode || undefined, t: data.t
    };
    return res.status(200).json(resp);
}
async function clipHandoffCreateHandler(req, res) {
    var _a;
    await new Promise(r => corsHandler(req, res, r));
    if (req.method !== 'POST')
        return res.status(405).send('Method Not Allowed');
    const body = req.body || {};
    const handoffId = (body.handoffId || '').trim();
    if (!handoffId)
        return res.status(400).send('handoffId required');
    const ref = (body.ref || '').trim();
    const t = (body.t || '1').trim();
    const refDoc = db.collection('clipHandoffs').doc(handoffId);
    const snap = await refDoc.get();
    const payload = {
        ref: ref || null,
        t,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: ttlHours(24),
        claimed: false
    };
    if (!snap.exists) {
        await refDoc.set(payload, { merge: false });
        const sponsor = await tryResolveSponsor(ref);
        const resp = { handoffId, created: true, sponsor };
        return res.status(201).json(resp);
    }
    else {
        const sponsor = await tryResolveSponsor(ref || ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.ref));
        const resp = { handoffId, created: false, sponsor };
        return res.status(200).json(resp);
    }
}
async function clipHandoffClaimHandler(req, res) {
    await new Promise(r => corsHandler(req, res, r));
    if (req.method !== 'POST')
        return res.status(405).send('Method Not Allowed');
    const body = req.body || {};
    const handoffId = (body.handoffId || '').trim();
    if (!handoffId)
        return res.status(400).send('handoffId required');
    const refDoc = db.collection('clipHandoffs').doc(handoffId);
    const snap = await refDoc.get();
    if (!snap.exists)
        return res.status(404).json({ found: false, claimed: false });
    const data = snap.data();
    const now = admin.firestore.Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis() < now.toMillis()) {
        return res.status(404).json({ found: false, claimed: false });
    }
    if (!data.claimed) {
        await refDoc.update({ claimed: true, claimedAt: now });
    }
    const resp = { found: true, claimed: true, ref: data.ref || undefined, t: data.t };
    return res.status(200).json(resp);
}
async function resolveSponsorHandler(req, res) {
    var _a;
    await new Promise(r => corsHandler(req, res, r));
    const ref = ((_a = (req.query.ref || req.query.code)) !== null && _a !== void 0 ? _a : '').toString().trim();
    if (!ref)
        return res.status(400).send('ref required');
    const sponsor = await tryResolveSponsor(ref);
    const resp = { ref, sponsor };
    return res.status(200).json(resp);
}
async function tryResolveSponsor(ref) {
    var _a;
    if (!ref)
        return undefined;
    try {
        const codeDoc = await db.collection('referralCodes').doc(ref).get();
        const uid = codeDoc.exists ? (_a = codeDoc.data()) === null || _a === void 0 ? void 0 : _a.uid : ref;
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists)
            return undefined;
        const u = userDoc.data();
        return {
            firstName: u.firstName || u.givenName || '',
            lastName: u.lastName || u.familyName || '',
            bizOppName: u.bizOppName || u.company || ''
        };
    }
    catch (_b) {
        return undefined;
    }
}
// Export Cloud Functions wrapped with onRequest
exports.issueReferral = onRequest(issueReferralHandler);
exports.redeemReferral = onRequest(redeemReferralHandler);
exports.clipHandoffCreate = onRequest(clipHandoffCreateHandler);
exports.clipHandoffClaim = onRequest(clipHandoffClaimHandler);
exports.resolveSponsor = onRequest(resolveSponsorHandler);
//# sourceMappingURL=referrals.js.map