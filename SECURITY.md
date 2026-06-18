# Security Hardening Guide

## Overview
This document outlines all security measures implemented in this project to prevent common vulnerabilities.

## Implemented Security Measures

### 1. **Environment Variables Security**
- ✅ All sensitive keys marked as server-only (no `NEXT_PUBLIC_` prefix)
- ✅ `.env.local` added to `.gitignore`
- ✅ Clear documentation in `.env.example`
- ✅ Production secrets stored only in platform env vars (Vercel/hosting)

**Location:** `.env.example`, `lib/security.ts`

### 2. **Input Validation & Sanitization**
- ✅ All user inputs sanitized against XSS
- ✅ File uploads validated by type, size, and extension
- ✅ Email format validation (regex)
- ✅ Phone number format validation
- ✅ UTR (transaction ID) format validation (12 digits)
- ✅ Request payload size limits (50KB for resume text, 5MB for files)

**Location:** `lib/security.ts`, `app/api/**/*.ts`

### 3. **SQL Injection Prevention**
- ✅ Parameterized queries using Supabase query builder
- ✅ No raw SQL queries with user input
- ✅ All database operations use `.eq()`, `.neq()`, `.gt()` methods
- ✅ Query parameters validated before use

**Files:** All API routes in `app/api/**/*.ts`

### 4. **Rate Limiting**
- ✅ Public endpoints rate-limited (10 requests per minute)
- ✅ Per-IP tracking with configurable limits
- ✅ Prevents brute force and DDoS attacks
- ✅ Applied to: `/api/public/parse`, `/api/public/analyze-ats`

**Location:** `lib/rate-limit.ts`, `lib/security.ts`

### 5. **Authentication & Authorization**
- ✅ Protected routes require user authentication
- ✅ User ownership verification (user_id matching)
- ✅ Profile-based access control
- ✅ Service role key used only server-side for admin operations

**Files:** `app/api/**/*.ts` (all protected routes)

### 6. **Payment Security**
- ✅ UTR transaction ID validation and uniqueness check
- ✅ Duplicate payment submission prevention (24-hour window)
- ✅ Screenshot validation (format, size, extension)
- ✅ Private storage bucket for proof documents
- ✅ Atomic database transactions for plan activation
- ✅ Payment record verification before processing

**Location:** `app/api/payment/upi/submit/route.ts`

### 7. **CORS & Headers Security**
- ✅ Strict CSP (Content Security Policy)
- ✅ X-Frame-Options: DENY (prevent clickjacking)
- ✅ X-Content-Type-Options: nosniff
- ✅ X-XSS-Protection enabled
- ✅ Strict-Transport-Security (HSTS)
- ✅ Origin validation for cross-origin requests
- ✅ CORS headers only for allowed origins

**Location:** `next.config.mjs`, `lib/security.ts`

### 8. **Logging & Monitoring**
- ✅ Sensitive data never logged (passwords, tokens, API keys)
- ✅ Audit trail for payment submissions
- ✅ Warning logs for duplicate attempts
- ✅ Error logging without exposing internal details to frontend

**Location:** `lib/security.ts` (`sanitizeForLogging`)

### 9. **File Upload Security**
- ✅ MIME type validation
- ✅ File extension validation
- ✅ File size limits enforced
- ✅ Path traversal prevention (validated filenames)
- ✅ Private storage for sensitive uploads

**Files:** `app/api/public/parse/route.ts`, `app/api/parse/route.ts`

### 10. **Data Validation**
- ✅ Zod schema validation for all inputs
- ✅ Request body parsing with type checking
- ✅ Allowlist validation (not blacklist)

## API Endpoint Security Status

| Endpoint | Auth | Rate Limit | Input Validation | Status |
|----------|------|-----------|-----------------|--------|
| `/api/parse` | ✅ | ✅ | ✅ | Secure |
| `/api/analyze` | ✅ | ✅ | ✅ | Secure |
| `/api/public/parse` | ❌ | ✅ | ✅ | Secure (Public) |
| `/api/public/analyze-ats` | ❌ | ✅ | ✅ | Secure (Public) |
| `/api/payment/upi/submit` | ✅ | ✅ | ✅ | Secure |
| `/api/profile` | ✅ | N/A | ✅ | Secure |
| `/api/notifications` | ✅ | N/A | ✅ | Secure |
| `/api/download/*` | ✅ | N/A | ✅ | Secure |

## Security Checklist for Deployment

- [ ] All environment variables set in production platform
- [ ] `.env.local` is in `.gitignore`
- [ ] HTTPS enabled on production domain
- [ ] HSTS headers enabled
- [ ] Database Row Level Security (RLS) policies configured
- [ ] Supabase auth policies reviewed
- [ ] API rate limits tested
- [ ] Payment verification logic tested manually
- [ ] Security headers verified with [securityheaders.com](https://securityheaders.com)
- [ ] OWASP ZAP or similar security scan run
- [ ] Monitoring/logging configured for suspicious activity

## Common Vulnerabilities Prevented

| Vulnerability | Prevention Method |
|--------------|------------------|
| SQL Injection | Parameterized queries, input validation |
| XSS (Cross-Site Scripting) | Input sanitization, CSP headers |
| CSRF (Cross-Site Request Forgery) | SameSite cookies, origin validation |
| Clickjacking | X-Frame-Options: DENY |
| Path Traversal | Filename validation, path normalization |
| DoS/Brute Force | Rate limiting |
| Sensitive Data Exposure | Never log secrets, HTTPS only |
| Broken Authentication | User ownership verification |
| Insecure Direct Object Reference | User ID matching in queries |
| Using Components with Known Vulnerabilities | `npm audit fix` in CI/CD |

## Recommended Actions

1. **Regular Security Audits**
   ```bash
   npm audit
   npm audit fix  # Review changes before committing
   ```

2. **Enable GitHub Security Alerts**
   - Go to repository Settings → Security & Analysis
   - Enable "Dependabot alerts" and "Dependabot security updates"

3. **Run OWASP ZAP**
   ```bash
   # After deploying to staging
   docker run -t owasp/zap2docker-stable zap-baseline.py -t https://staging.yourdomain.com
   ```

4. **Monitor API Usage**
   - Set up alerts for unusual access patterns
   - Monitor failed authentication attempts
   - Track rate limit violations

5. **Rotate Keys Regularly**
   - Supabase keys: Every 90 days
   - Gemini API keys: Quarterly
   - Payment verification secrets: As needed

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/guides/security-guide)
- [Supabase Security](https://supabase.com/docs/guides/security)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/security/)

## Questions or Issues?

If you discover a security vulnerability, please **do not** open a public issue. Instead, email your security team immediately with details.
