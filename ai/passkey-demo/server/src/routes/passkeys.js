import { Router } from 'express';
import { passkeyChallengeKey } from '../config.js';
import { setChallenge, consumeChallenge } from '../redis/challenge.js';
import { getUserById } from '../redis/user.js';
import {
  listUserCredentials,
  saveCredential,
  deleteCredential,
} from '../redis/credential.js';
import {
  buildRegistrationOptions,
  verifyRegistration,
} from '../webauthn.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { webAuthnRateLimit } from '../middleware/rateLimit.js';
import { sendOk, sendError } from '../utils/response.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const creds = await listUserCredentials(req.session.userId);
    const passkeys = creds.map((c) => ({
      id: c.credentialId,
      deviceName: c.deviceName,
      backedUp: c.backedUp,
      transports: c.transports,
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
    }));
    return sendOk(res, { passkeys });
  } catch (err) {
    next(err);
  }
});

router.post('/begin', requireAuth, webAuthnRateLimit, async (req, res, next) => {
  try {
    const user = await getUserById(req.session.userId);
    if (!user) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const existing = await listUserCredentials(user.userId);
    const options = await buildRegistrationOptions(user.username, user.userId, existing);

    await setChallenge(passkeyChallengeKey(user.userId), {
      challenge: options.challenge,
      userId: user.userId,
      type: 'passkey_add',
    });

    return sendOk(res, options);
  } catch (err) {
    next(err);
  }
});

router.post('/finish', requireAuth, webAuthnRateLimit, async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const { credential, deviceName } = req.body || {};

    if (!credential) {
      return sendError(res, 'INVALID_REQUEST', 'Missing credential');
    }

    const payload = await consumeChallenge(passkeyChallengeKey(userId));
    if (!payload || payload.type !== 'passkey_add' || payload.userId !== userId) {
      return sendError(res, 'CHALLENGE_EXPIRED', 'Passkey registration expired. Please try again.');
    }

    const result = await verifyRegistration(credential, payload.challenge);
    if (!result.verified) {
      return sendError(res, 'REGISTRATION_FAILED', 'Could not add passkey');
    }

    const passkey = await saveCredential(userId, {
      credentialId: result.credentialId,
      publicKey: result.publicKey,
      counter: result.counter,
      deviceName: deviceName?.trim() || 'Passkey',
      backedUp: result.backedUp,
      transports: result.transports,
    });

    return sendOk(res, {
      passkey: {
        id: passkey.credentialId,
        deviceName: passkey.deviceName,
        backedUp: passkey.backedUp,
        transports: passkey.transports,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id(*)', requireAuth, async (req, res, next) => {
  try {
    const credentialId = req.params.id;
    const userId = req.session.userId;

    const result = await deleteCredential(userId, credentialId);
    if (!result.ok) {
      return sendError(res, 'NOT_FOUND', 'Passkey not found', 404);
    }

    return sendOk(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export default router;
