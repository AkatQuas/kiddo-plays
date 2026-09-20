import { Router } from 'express';
import { randomUUID } from 'crypto';
import {
  validateUsername,
  registerChallengeKey,
  loginChallengeKey,
} from '../config.js';
import { setChallenge, consumeChallenge } from '../redis/challenge.js';
import {
  usernameExists,
  getUserByUsername,
  getUserById,
  createUserWithCredential,
} from '../redis/user.js';
import { listUserCredentials, getCredential, updateCounter } from '../redis/credential.js';
import { destroySession } from '../redis/session.js';
import {
  buildRegistrationOptions,
  verifyRegistration,
  buildAuthenticationOptions,
  verifyAuthentication,
} from '../webauthn.js';
import {
  createSessionAndSetCookie,
  clearSessionCookie,
} from '../middleware/session.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { webAuthnRateLimit } from '../middleware/rateLimit.js';
import { sendOk, sendError } from '../utils/response.js';
import { getSessionIdFromCookie } from '../utils/cookie.js';

const router = Router();

router.post('/register/begin', webAuthnRateLimit, async (req, res, next) => {
  try {
    const validated = validateUsername(req.body?.username);
    if (!validated.ok) {
      return sendError(res, validated.error.code, validated.error.message);
    }
    const { username } = validated;

    if (await usernameExists(username)) {
      return sendError(res, 'REGISTRATION_FAILED', 'Registration could not be completed');
    }

    const userId = randomUUID();
    const options = await buildRegistrationOptions(username, userId, []);

    await setChallenge(registerChallengeKey(username), {
      challenge: options.challenge,
      userId,
      username,
      type: 'register',
    });

    return sendOk(res, options);
  } catch (err) {
    next(err);
  }
});

router.post('/register/finish', webAuthnRateLimit, async (req, res, next) => {
  try {
    const validated = validateUsername(req.body?.username);
    if (!validated.ok) {
      return sendError(res, validated.error.code, validated.error.message);
    }
    const { username } = validated;
    const { credential } = req.body || {};

    if (!credential) {
      return sendError(res, 'INVALID_REQUEST', 'Missing credential');
    }

    const payload = await consumeChallenge(registerChallengeKey(username));
    if (!payload || payload.type !== 'register' || payload.username !== username) {
      return sendError(res, 'CHALLENGE_EXPIRED', 'Registration session expired. Please try again.');
    }

    const result = await verifyRegistration(credential, payload.challenge);
    if (!result.verified) {
      return sendError(res, 'REGISTRATION_FAILED', 'Registration could not be completed');
    }

    const created = await createUserWithCredential({
      userId: payload.userId,
      username,
      displayName: username,
      credential: {
        credentialId: result.credentialId,
        publicKey: result.publicKey,
        counter: result.counter,
        deviceName: 'Passkey',
        backedUp: result.backedUp,
        transports: result.transports,
      },
    });

    if (!created.ok) {
      return sendError(res, 'REGISTRATION_FAILED', 'Registration could not be completed');
    }

    await createSessionAndSetCookie(req, res, payload.userId);
    const user = await getUserById(payload.userId);
    return sendOk(res, { user });
  } catch (err) {
    next(err);
  }
});

router.post('/login/begin', webAuthnRateLimit, async (req, res, next) => {
  try {
    const validated = validateUsername(req.body?.username);
    if (!validated.ok) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }
    const { username } = validated;

    const user = await getUserByUsername(username);
    const creds = user ? await listUserCredentials(user.userId) : [];

    if (!user || creds.length === 0) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }

    const options = await buildAuthenticationOptions(creds);

    await setChallenge(loginChallengeKey(username), {
      challenge: options.challenge,
      userId: user.userId,
      username,
      type: 'login',
    });

    return sendOk(res, options);
  } catch (err) {
    next(err);
  }
});

router.post('/login/finish', webAuthnRateLimit, async (req, res, next) => {
  try {
    const validated = validateUsername(req.body?.username);
    if (!validated.ok) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }
    const { username } = validated;
    const { credential } = req.body || {};

    if (!credential) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }

    const payload = await consumeChallenge(loginChallengeKey(username));
    if (!payload || payload.type !== 'login' || payload.username !== username) {
      return sendError(res, 'CHALLENGE_EXPIRED', 'Login session expired. Please try again.');
    }

    const storedCred = await getCredential(credential.id);
    if (!storedCred || storedCred.userId !== payload.userId) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }

    const result = await verifyAuthentication(credential, storedCred, payload.challenge);
    if (!result.verified) {
      return sendError(res, 'AUTH_FAILED', 'Authentication failed');
    }

    await updateCounter(storedCred.credentialId, result.newCounter);
    await createSessionAndSetCookie(req, res, payload.userId);
    const user = await getUserById(payload.userId);
    return sendOk(res, { user });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const sid = getSessionIdFromCookie(req);
    await destroySession(sid);
    clearSessionCookie(res);
    return sendOk(res, { loggedOut: true });
  } catch (err) {
    next(err);
  }
});

router.get('/me', async (req, res, next) => {
  try {
    if (!req.session?.userId) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    const user = await getUserById(req.session.userId);
    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }
    return sendOk(res, { user });
  } catch (err) {
    next(err);
  }
});

export default router;
