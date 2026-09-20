import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { config } from './config.js';

export function toWebAuthnCredential(storedCred) {
  return {
    id: storedCred.credentialId,
    publicKey: Buffer.from(storedCred.publicKey, 'base64'),
    counter: storedCred.counter,
    transports: storedCred.transports,
  };
}

export async function buildRegistrationOptions(username, userId, excludeCredentials = []) {
  return generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpId,
    userName: username,
    userDisplayName: username,
    userID: new TextEncoder().encode(userId),
    attestationType: 'none',
    excludeCredentials: excludeCredentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
}

export async function verifyRegistration(attestationResponse, expectedChallenge) {
  const verification = await verifyRegistrationResponse({
    response: attestationResponse,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
  });

  if (!verification.verified || !verification.registrationInfo) {
    return { verified: false };
  }

  const { credential, credentialBackedUp } = verification.registrationInfo;

  return {
    verified: true,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    backedUp: credentialBackedUp,
    transports: credential.transports || attestationResponse.response?.transports || [],
  };
}

export async function buildAuthenticationOptions(credentials) {
  return generateAuthenticationOptions({
    rpID: config.rpId,
    allowCredentials: credentials.map((cred) => ({
      id: cred.credentialId,
      transports: cred.transports,
    })),
    userVerification: 'preferred',
  });
}

export async function verifyAuthentication(assertionResponse, storedCred, expectedChallenge) {
  const verification = await verifyAuthenticationResponse({
    response: assertionResponse,
    expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpId,
    credential: toWebAuthnCredential(storedCred),
  });

  if (!verification.verified || !verification.authenticationInfo) {
    return { verified: false };
  }

  const { newCounter } = verification.authenticationInfo;
  if (newCounter <= storedCred.counter) {
    return { verified: false, reason: 'COUNTER' };
  }

  return { verified: true, newCounter };
}
