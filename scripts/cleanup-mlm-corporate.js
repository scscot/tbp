#!/usr/bin/env node
/**
 * Cleanup corporate emails from mlm_contacts collection
 * Only keeps personal email addresses (gmail, yahoo, ISPs, etc.)
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({ credential: cert(require('../secrets/serviceAccountKey.json')) });
const db = getFirestore();

// Corporate email prefixes to exclude
const EXCLUDED_PREFIXES = [
  'support', 'help', 'helpdesk', 'customerservice', 'customer-service', 'cs',
  'info', 'information', 'contact', 'contactus', 'hello', 'hi', 'inquiries',
  'sales', 'marketing', 'promotions', 'promo', 'advertising', 'press',
  'admin', 'administrator', 'webmaster', 'postmaster', 'hostmaster',
  'hr', 'humanresources', 'careers', 'jobs', 'recruiting', 'talent',
  'billing', 'finance', 'accounting', 'accounts', 'payments',
  'legal', 'compliance', 'privacy', 'privacyofficer', 'abuse', 'dmca', 'copyright',
  'noreply', 'no-reply', 'donotreply', 'notifications', 'alerts',
  'news', 'newsletter', 'updates', 'team', 'office', 'general',
  'orders', 'shipping', 'returns', 'refunds', 'feedback', 'complaints',
  '48hrs_reply', 'service', 'investorrelations', 'productquestions'
];

// MLM company domains to exclude
const EXCLUDED_DOMAINS = [
  'nuskin.com', 'colorstreet.com', 'scentsy.com', 'herbalife.com', 'avon.com',
  'amway.com', 'marykay.com', 'doterra.com', 'youngliving.com', 'arbonne.com',
  'rodanandfields.com', 'myrandf.com', 'monat.com', 'monatglobal.com', 'tupperware.com',
  'beachbody.com', 'pruvit.com', 'pruvithq.com', 'isagenix.com', 'plexus.com',
  'itworks.com', 'neora.com', 'younique.com', 'paparazzi.com', 'shaklee.com',
  'melaleuca.com', 'usana.com', 'advocare.com', 'lularoe.com', 'modere.com',
  'lifevantage.com', 'zinzino.com', 'hyperwallet.com', 'payoneer.com', 'paypal.com',
  'zendesk.com', 'quickshyft.info'
];

// Personal email domains (whitelist)
const PERSONAL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'msn.com', 'live.com',
  'aol.com', 'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
  'mail.com', 'gmx.com', 'gmx.net', 'ymail.com', 'rocketmail.com',
  'rogers.com', 'shaw.ca', 'telus.net', 'bell.net', 'sympatico.ca', // Canadian ISPs
  'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net', 'cox.net', // US ISPs
  'btinternet.com', 'sky.com', 'virginmedia.com', // UK ISPs
  'web.de', 'freenet.de', 't-online.de', // German
  'orange.fr', 'free.fr', 'sfr.fr', 'wanadoo.fr', // French
  'libero.it', 'virgilio.it', 'alice.it', // Italian
  'terra.com.br', 'uol.com.br', 'bol.com.br', // Brazilian
  'telefonica.net', 'movistar.es', // Spanish
];

function isCorporateEmail(email) {
  if (!email) return true;

  const emailLower = email.toLowerCase();
  const atIndex = emailLower.indexOf('@');
  if (atIndex === -1) return true;

  const localPart = emailLower.substring(0, atIndex);
  const domain = emailLower.substring(atIndex + 1);

  // Check excluded domains (MLM companies, payment providers)
  for (const d of EXCLUDED_DOMAINS) {
    if (domain === d || domain.endsWith('.' + d)) return true;
  }

  // Check excluded prefixes
  for (const prefix of EXCLUDED_PREFIXES) {
    if (localPart === prefix ||
        localPart.startsWith(prefix + '_') ||
        localPart.startsWith(prefix + '-') ||
        localPart.startsWith(prefix + '.')) {
      return true;
    }
  }

  // Check for patterns like canadacs, uscs, ukcs (customer service)
  if (/^[a-z]{2,3}cs$/i.test(localPart)) return true;

  // If it's a known personal domain, it's NOT corporate
  if (PERSONAL_DOMAINS.includes(domain)) return false;

  // For unknown domains with generic local parts, mark as corporate
  if (localPart === 'info' || localPart === 'contact' || localPart === 'hello') return true;

  // Unknown domain with non-generic local part - needs manual review
  // For now, mark as corporate to be safe (only allow known personal domains)
  return true;
}

async function cleanupCorporateEmails() {
  const snapshot = await db.collection('mlm_contacts').get();

  let deleted = 0;
  let kept = 0;

  console.log('Analyzing emails in mlm_contacts...\n');

  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.email) {
      if (isCorporateEmail(data.email)) {
        console.log('DELETE: ' + data.email);
        await doc.ref.delete();
        deleted++;
      } else {
        console.log('KEEP:   ' + data.email);
        kept++;
      }
    }
  }

  console.log('\n---');
  console.log('Deleted:', deleted);
  console.log('Kept:', kept);
}

cleanupCorporateEmails().catch(console.error);
