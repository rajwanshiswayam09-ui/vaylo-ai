import { NextRequest, NextResponse } from "next/server";

/**
 * Security Utilities for API Routes
 * Prevents: CORS abuse, CSRF, XSS, Rate limiting
 */

// CORS allowed origins
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  "https://vaylo-ai.vercel.app",
  "https://www.vaylo-ai.com",
  // Add production domain here
];

/**
 * CORS Headers with strict settings
 */
export function getCORSHeaders(origin: string | null) {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Access-Control-Allow-Credentials": "true",
  };
}

/**
 * Security Headers
 */
export function getSecurityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co https://generativelanguage.googleapis.com",
      "frame-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  };
}

/**
 * Sanitize user input - prevent XSS
 */
export function sanitizeInput(input: string): string {
  if (!input) return "";
  return input
    .replace(/[<>\"']/g, (char) => {
      const map: Record<string, string> = {
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#x27;",
      };
      return map[char];
    })
    .trim();
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format (basic)
 */
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\d+\-().\s]{7,}$/;
  return phoneRegex.test(phone.replace(/\s/g, ""));
}

/**
 * Prevent NoSQL Injection in Supabase queries
 * Always use parameterized queries (eq, neq, etc.)
 */
export function validateQueryParam(param: any): string {
  if (typeof param !== "string") {
    throw new Error("Invalid query parameter");
  }
  // Only allow alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(param)) {
    throw new Error("Invalid query parameter format");
  }
  return param;
}

/**
 * Rate limit check for public endpoints
 */
const publicEndpointLimits = new Map<string, { count: number; resetTime: number }>();
const PUBLIC_LIMIT = 10; // requests per window
const PUBLIC_WINDOW = 60 * 1000; // 1 minute

export function checkPublicRateLimit(ip: string): boolean {
  const now = Date.now();
  const key = ip;
  let limit = publicEndpointLimits.get(key);

  if (!limit || now > limit.resetTime) {
    limit = { count: 1, resetTime: now + PUBLIC_WINDOW };
  } else {
    limit.count++;
  }

  publicEndpointLimits.set(key, limit);

  if (limit.count > PUBLIC_LIMIT) {
    return false;
  }

  return true;
}

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/**
 * Reject if origin not allowed
 */
export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Allow same-origin requests
  return ALLOWED_ORIGINS.includes(origin);
}

/**
 * Generate CSRF token (for forms if needed)
 */
export function generateCSRFToken(): string {
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Never log sensitive data
 */
export function sanitizeForLogging(obj: any): any {
  const sensitiveKeys = [
    "password",
    "token",
    "secret",
    "key",
    "apiKey",
    "authorization",
    "creditCard",
    "cvv",
    "utr",
    "paymentId",
  ];

  if (typeof obj !== "object" || obj === null) return obj;

  const sanitized = { ...obj };
  for (const key of sensitiveKeys) {
    if (key in sanitized) {
      sanitized[key] = "[REDACTED]";
    }
  }
  return sanitized;
}
