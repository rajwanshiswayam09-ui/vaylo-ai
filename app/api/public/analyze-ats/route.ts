import { NextRequest, NextResponse } from "next/server";
import { analyzeATS } from "@/lib/gemini";
import { withRateLimit } from "@/lib/rate-limit";
import { sanitizeInput, getCORSHeaders, getSecurityHeaders } from "@/lib/security";

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();
      let { resumeText } = body;

      // Security: Sanitize input to prevent XSS
      if (!resumeText || resumeText.trim().length < 100) {
        return NextResponse.json(
          { error: "Please provide a valid resume text (minimum 100 characters)" },
          { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
        );
      }

      // Limit text length (prevent DoS via large payloads)
      const MAX_RESUME_LENGTH = 50000; // 50KB
      if (resumeText.length > MAX_RESUME_LENGTH) {
        return NextResponse.json(
          { error: "Resume text too long. Maximum 50KB allowed." },
          { status: 400, headers: getCORSHeaders(request.headers.get("origin")) }
        );
      }

      resumeText = sanitizeInput(resumeText);
      const atsResult = await analyzeATS(resumeText, "General Software Engineer role (entry to senior level)");

      return NextResponse.json(
        {
          atsScore: atsResult.ats_score,
          keywordMatchScore: atsResult.keyword_match_score,
          skillsMatchScore: atsResult.skills_match_score,
          readabilityScore: atsResult.readability_score,
          formatScore: atsResult.format_score,
          missingKeywords: atsResult.missing_keywords,
          missingSkills: atsResult.missing_skills,
          weakSections: atsResult.weak_sections,
          summaryAnalysis: atsResult.summary_analysis,
        },
        { headers: { ...getCORSHeaders(request.headers.get("origin")), ...getSecurityHeaders() } }
      );
    } catch (error) {
      console.error("Public ATS analyze error:", error);
      return NextResponse.json(
        { error: "Failed to analyze resume. Please try again." },
        { status: 500, headers: getCORSHeaders(request.headers.get("origin")) }
      );
    }
  });
}
