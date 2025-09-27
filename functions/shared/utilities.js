// ==============================
// SHARED UTILITIES MODULE
// Common functions and Firebase setup used across all modules
// ==============================

// ==============================
// Environment and Firebase Setup
// ==============================

// Early environment loader - ensures .env is loaded before exports
(() => {
  try {
    if (!process.env.K_SERVICE) { // skip on Cloud Run
      const fs = require('fs');
      const path = require('path');
      const dotenvPath = path.join(__dirname, '..', '.env');
      if (fs.existsSync(dotenvPath)) {
        const lines = fs.readFileSync(dotenvPath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
          if (!line || line.trim().startsWith('#')) continue;
          const idx = line.indexOf('=');
          if (idx === -1) continue;
          const k = line.slice(0, idx).trim();
          const v = line.slice(idx + 1).trim();
          if (k && !(k in process.env)) process.env[k] = v;
        }
      }
    }
  } catch (error) {
    // Silently ignore errors when loading environment configuration
  }
})();

// v2 HTTPS APIs
const { onCall, HttpsError, onRequest } = require('firebase-functions/v2/https');

// v2 Firestore trigger APIs
const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted,
} = require('firebase-functions/v2/firestore');

// v2 Scheduler API
const { onSchedule } = require('firebase-functions/v2/scheduler');

// v2 logger
const logger = require('firebase-functions/logger');

// Keep classic import ONLY for runtime config
const functions = require('firebase-functions');

// Admin SDK
const admin = require('firebase-admin');

// Initialize Firebase Admin (only if not already initialized)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

// Canonical Firestore aliases
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const FieldPath = admin.firestore.FieldPath;
const auth = admin.auth();

// Config-derived flags
const NOTIF_TRIGGER_ENABLED = String(process.env.NOTIFICATIONS_ENABLE_TRIGGER || 'false').trim().toLowerCase() === 'true';
const DELIVERY_MODE = String(process.env.NOTIFICATIONS_DELIVERY_MODE || 'helper').trim().toLowerCase();
const isHelperMode = DELIVERY_MODE === 'helper';
const isTriggerMode = DELIVERY_MODE === 'trigger';

// Global options
const { setGlobalOptions } = require("firebase-functions/v2");
setGlobalOptions({ region: "us-central1", timeoutSeconds: 60, memory: "512MiB" });

// ==============================
// Common Utility Functions
// ==============================

/**
 * Validates that a user is authenticated
 * @param {Object} request - Firebase function request object
 * @returns {string} - Authenticated user UID
 * @throws {HttpsError} - If user is not authenticated
 */
function validateAuthentication(request) {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }
  return request.auth.uid;
}

/**
 * Validates that a user has admin role
 * @param {Object} userData - User document data
 * @throws {HttpsError} - If user is not an admin
 */
function validateAdminRole(userData) {
  if (!userData || userData.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Admin access required');
  }
}

/**
 * Validates that a user has user or admin role
 * @param {Object} userData - User document data
 * @throws {HttpsError} - If user doesn't have valid role
 */
function validateUserRole(userData) {
  if (!userData || (userData.role !== 'user' && userData.role !== 'admin')) {
    throw new HttpsError('permission-denied', 'Valid user role required');
  }
}

/**
 * Safely gets a user document by UID
 * @param {string} uid - User UID
 * @returns {Promise<Object|null>} - User document data or null
 */
async function getUserDocument(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
  } catch (error) {
    logger.error('Error fetching user document:', error);
    return null;
  }
}

/**
 * Implements exponential backoff retry logic
 * @param {Function} operation - Async operation to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} baseDelay - Base delay in ms (default: 1000)
 * @returns {Promise<any>} - Result of the operation
 */
async function retryWithBackoff(operation, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        break;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Validates input data against a schema
 * @param {Object} data - Data to validate
 * @param {Object} schema - Validation schema
 * @throws {HttpsError} - If validation fails
 */
function validateInput(data, schema) {
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];

    if (rules.required && (value === undefined || value === null || value === '')) {
      throw new HttpsError('invalid-argument', `Field '${field}' is required`);
    }

    if (value !== undefined && value !== null) {
      if (rules.type && typeof value !== rules.type) {
        throw new HttpsError('invalid-argument', `Field '${field}' must be of type ${rules.type}`);
      }

      if (rules.minLength && value.length < rules.minLength) {
        throw new HttpsError('invalid-argument', `Field '${field}' must be at least ${rules.minLength} characters`);
      }

      if (rules.maxLength && value.length > rules.maxLength) {
        throw new HttpsError('invalid-argument', `Field '${field}' must be at most ${rules.maxLength} characters`);
      }

      if (rules.pattern && !rules.pattern.test(value)) {
        throw new HttpsError('invalid-argument', `Field '${field}' has invalid format`);
      }
    }
  }
}

/**
 * Sanitizes user input to prevent injection attacks
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return input;

  return input
    .trim()
    .replace(/[<>"'&]/g, '') // Remove potentially dangerous characters
    .substring(0, 1000); // Limit length
}

/**
 * Formats timestamp for logging
 * @returns {string} - Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Creates a standardized error response
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 * @returns {HttpsError} - Formatted error
 */
function createError(code, message, details = {}) {
  logger.error(`${getTimestamp()} - ${code}: ${message}`, details);
  return new HttpsError(code, message, details);
}

/**
 * Rate limiting helper using Firestore
 * @param {string} key - Rate limit key (usually user ID + action)
 * @param {number} maxAttempts - Maximum attempts allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Promise<boolean>} - True if rate limit passed, false if exceeded
 */
async function checkRateLimit(key, maxAttempts = 100, windowMs = 3600000) { // 1 hour default
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const rateLimitDoc = db.collection('rateLimits').doc(key);
    const doc = await rateLimitDoc.get();

    let attempts = [];
    if (doc.exists) {
      attempts = doc.data().attempts || [];
    }

    // Remove old attempts outside the window
    attempts = attempts.filter(timestamp => timestamp > windowStart);

    if (attempts.length >= maxAttempts) {
      return false; // Rate limit exceeded
    }

    // Add current attempt
    attempts.push(now);

    await rateLimitDoc.set({ attempts }, { merge: true });
    return true; // Rate limit passed

  } catch (error) {
    logger.error('Rate limit check failed:', error);
    return true; // Allow on error to prevent blocking legitimate requests
  }
}

// ==============================
// Exports
// ==============================

module.exports = {
  // Firebase APIs
  onCall,
  HttpsError,
  onRequest,
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentWritten,
  onDocumentDeleted,
  onSchedule,
  logger,
  functions,
  admin,
  db,
  FieldValue,
  FieldPath,
  auth,

  // Config flags
  NOTIF_TRIGGER_ENABLED,
  DELIVERY_MODE,
  isHelperMode,
  isTriggerMode,

  // Utility functions
  validateAuthentication,
  validateAdminRole,
  validateUserRole,
  getUserDocument,
  retryWithBackoff,
  validateInput,
  sanitizeInput,
  getTimestamp,
  createError,
  checkRateLimit,
};