import { NextRequest, NextResponse } from "next/server";

// Simple In-Memory Rate Limiter for Development
// For Production: Replace with Upstash Redis
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

const LIMIT = 10; // 10 requests
const WINDOW = 60 * 1000; // per 1 minute

export function rateLimit(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  const now = Date.now();

  const userLimit = rateLimitMap.get(ip) || { count: 0, lastReset: now };

  if (now - userLimit.lastReset > WINDOW) {
    userLimit.count = 1;
    userLimit.lastReset = now;
  } else {
    userLimit.count++;
  }

  rateLimitMap.set(ip, userLimit);

  if (userLimit.count > LIMIT) {
    return {
      success: false,
      response: NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": Math.ceil((WINDOW - (now - userLimit.lastReset)) / 1000).toString(),
          },
        }
      ),
    };
  }

  return { success: true };
}

// Helper to use in API routes
export async function withRateLimit(request: NextRequest, handler: () => Promise<NextResponse>) {
  const { success, response } = rateLimit(request);
  if (!success) return response;
  return handler();
}
