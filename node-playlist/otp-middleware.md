# Tech Sharing: 2FA (TOTP) Setup for NestJS Server

_Dynamic Header Validation + QR Code Enrollment_

## Overview

We implement a **time-based one-time password (TOTP)** system for NestJS that:

1. Lets users enroll 2FA via a scannable QR code (Authy / Google Authenticator)
2. Validates 6-digit OTP from a **custom HTTP header** using NestJS middleware
3. Uses modern, maintained libraries only
4. Follows NestJS best practices (Service + Middleware + Controller)

---

## Core Stack

- `@otplib/*` → Modern TOTP (2FA)
- `qrcode` → Generate QR code for app pairing
- NestJS Middleware → Dynamic HTTP header check

---

## 1. Flow (Pseudocode)

### Enrollment Flow

```
User requests 2FA setup (GET /auth/2fa/setup/:userId)
  Server generates a secure TOTP secret
  Server creates OTPAuth URL (scannable by 2FA apps)
  Server generates QR code (base64 image)
  Server stores secret for the user <- unique secret for user
  Return QR code + secret to frontend
```

### Request Validation Flow

```
Client sends API request with headers:
  X-User-Id: <user-id>
  X-2FA-OTP: <6-digit code from authenticator app>

NestJS 2FA Middleware runs:
  Validate both headers exist
  Fetch user's stored TOTP secret
  Verify OTP is valid and not expired
  If valid → proceed to controller
  If invalid → return 401 Unauthorized
```

---

## 2. Project Structure

```
src/auth/
├── two-factor.service.ts      # 2FA logic (generate, verify)
├── two-factor.middleware.ts   # Header validation middleware
├── auth.controller.ts         # Enrollment + protected routes
└── auth.module.ts             # Module configuration
```

---

## 3. Pseudocode Implementation

### A. Two-Factor Service (Core Logic)

```typescript
@Injectable()
class TwoFactorService {
  private totp: TOTP;

  constructor() {
    Initialize TOTP (6 digits, 30s expiry)
  }

  // Generate secret + QR code
  async generateSecret(userId: string, appName: string) {
    secret = generateRandomBase32Secret()
    otpAuthUrl = createScannableUrl(userId, appName, secret)
    qrCode = convertUrlToBase64Image(otpAuthUrl)
    return { secret, qrCode }
  }

  // Validate OTP code
  validateToken(otpCode: string, secret: string): boolean {
    return totp.verify(otpCode, secret)
  }
}
```

### B. 2FA Middleware (Header Check)

```typescript
@Injectable()
class TwoFactorMiddleware implements NestMiddleware {
  constructor(private twoFactorService: TwoFactorService) {}

  use(req, res, next) {
    otpCode = req.headers['x-2fa-otp'];
    userId = req.headers['x-user-id'];

    if (!otpCode || !userId) {
      throw BadRequestException;
    }

    user = findUserFromStore(userId);
    if (!user || !user.totpSecret) {
      throw UnauthorizedException;
    }

    isValid = this.twoFactorService.validateToken(otpCode, user.totpSecret);

    if (!isValid) {
      throw UnauthorizedException;
    }

    next(); // Allow request
  }
}
```

### C. Controller (API Routes)

```typescript
@Controller('auth')
class AuthController {
  constructor(private twoFactorService: TwoFactorService) {}

  // 2FA Enrollment: returns QR code
  @Get('2fa/setup/:userId')
  async setup2FA(@Param('userId') userId) {
    { secret, qrCode } = await this.twoFactorService.generateSecret(userId)
    saveSecretForUser(userId, secret)
    return { qrCode, manualSecret: secret }
  }

  // Protected Route (secured by middleware)
  @Post('protected-action')
  protectedAction() {
    return { success: true, message: "2FA validated" }
  }
}
```

### D. Module Configuration

```typescript
@Module({
  controllers: [AuthController],
  providers: [TwoFactorService]
})
class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TwoFactorMiddleware).forRoutes('auth/protected-action');
  }
}
```

---

## 4. Required Headers for Protected Endpoints

```http
X-User-Id: user123
X-2FA-OTP: 123456
```

---

## 5. Key Notes for Team

- **No legacy libraries** (replaces 10-year-old packages)
- **Compatible with all authenticator apps**: Authy, Google Auth, Microsoft Auth
- Middleware runs **before controllers** → early security validation
- Secrets must be stored in a **database** (not memory) in production
- Add rate limiting to prevent brute-force OTP attempts
- Works with any frontend (web / mobile) that displays images

---

## 6. Production Improvements

1. Persist TOTP secrets in encrypted database fields
2. Combine with JWT (replace `X-User-Id` with auth token)
3. Add window tolerance for clock drift
4. Apply middleware globally or via guards
5. Log failed OTP attempts

---

## Summary

This implementation provides a **clean, secure, modern 2FA system** for NestJS using dynamic HTTP header validation — perfect for securing sensitive actions in your full-stack app.
