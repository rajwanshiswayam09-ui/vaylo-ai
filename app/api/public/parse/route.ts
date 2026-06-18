import { NextRequest, NextResponse } from "next/server";
import { parseResumeFile } from "@/lib/parse-resume";
import { checkPublicRateLimit, getClientIP, getCORSHeaders, getSecurityHeaders } from "@/lib/security";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export async function POST(request: NextRequest) {
  try {
    // Security: Rate limiting for public endpoint
    const ip = getClientIP(request);
    if (!checkPublicRateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    // 1. Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max 5MB allowed." },
        { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    // 2. Validate MIME type & file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt"];
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "Invalid file type. Only PDF, DOCX, and TXT are allowed." },
        { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    // 3. Validate file name length (prevent path traversal)
    if (file.name.length > 255) {
      return NextResponse.json(
        { error: "File name too long" },
        { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseResumeFile(buffer, file.name);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "Could not extract text from file" },
        { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }

    return NextResponse.json(
      { text },
      { headers: { ...getCORSHeaders(request.headers.get("origin")), ...getSecurityHeaders() } }
    );
  } catch (error) {
    console.error("Public parse error:", error);
    return NextResponse.json(
      { error: "Failed to parse resume" },
      { status: 500, headers: getCORSHeaders(request.headers.get("origin")) }
    );
  }
}
