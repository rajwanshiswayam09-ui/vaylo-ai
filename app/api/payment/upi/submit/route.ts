import { NextRequest, NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { upiSubmitSchema } from "@/lib/validations";
import { sanitizeInput, isValidEmail, isValidPhone, sanitizeForLogging } from "@/lib/security";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const UTR_REGEX = /^[0-9]{12}$/; // UTR is 12 digits
const PAYMENT_DUPLICATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

// After paying via the UPI app, the user submits their payment proof here:
// name, email, phone, UTR/transaction ID, and a screenshot of the payment.
// The order is recorded and the plan is activated immediately so the user
// gets instant access. Keep the screenshot + UTR on file in case you need
// to verify a transaction later.
export async function POST(request: NextRequest) {
  try {
    const profile = await getProfile();
    if (!profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const fields = {
      paymentId: sanitizeInput(String(formData.get("paymentId") || "")),
      utr: sanitizeInput(String(formData.get("utr") || "")),
      customerName: sanitizeInput(String(formData.get("customerName") || "")),
      customerEmail: sanitizeInput(String(formData.get("customerEmail") || "")),
      customerPhone: sanitizeInput(String(formData.get("customerPhone") || "")),
    };

    const validation = upiSubmitSchema.safeParse(fields);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.issues[0].message }, { status: 400 });
    }
    const { paymentId, utr, customerName, customerEmail, customerPhone } = validation.data;

    // SECURITY: Validate UTR format (12 digits)
    if (!UTR_REGEX.test(utr)) {
      return NextResponse.json(
        { error: "Invalid UTR format. UTR must be 12 digits." },
        { status: 400 }
      );
    }

    // SECURITY: Validate email format
    if (!isValidEmail(customerEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // SECURITY: Validate phone format
    if (!isValidPhone(customerPhone)) {
      return NextResponse.json({ error: "Invalid phone format" }, { status: 400 });
    }

    const screenshot = formData.get("screenshot");
    if (!(screenshot instanceof File) || screenshot.size === 0) {
      return NextResponse.json({ error: "Please upload a payment screenshot" }, { status: 400 });
    }
    if (screenshot.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Screenshot must be under 5MB" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(screenshot.type)) {
      return NextResponse.json(
        { error: "Screenshot must be a JPG, PNG, or WEBP image" },
        { status: 400 }
      );
    }

    // SECURITY: Validate screenshot file extension
    const extForValidation = (screenshot.name.split(".").pop() || "jpg").toLowerCase();
    if (!["jpg", "jpeg", "png", "webp"].includes(extForValidation)) {
      return NextResponse.json({ error: "Invalid file extension" }, { status: 400 });
    }

    // Use service client for atomic transaction
    const supabase = await createServiceClient();

    // SECURITY: Fetch payment and verify ownership
    const { data: payment } = await supabase
      .from("payments")
      .select("id, status, user_id, plan, created_at")
      .eq("id", paymentId)
      .eq("user_id", profile.id)
      .single();

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // SECURITY: Prevent duplicate submissions
    if (payment.status === "completed") {
      return NextResponse.json({ success: true, status: "completed" });
    }

    // SECURITY: Prevent duplicate UTR submissions within 24 hours
    const { data: existingUTR } = await supabase
      .from("payments")
      .select("id")
      .eq("utr", utr)
      .gt("created_at", new Date(Date.now() - PAYMENT_DUPLICATE_WINDOW).toISOString())
      .neq("id", paymentId)
      .maybeSingle();

    if (existingUTR) {
      console.warn(`Potential duplicate UTR submission detected for user: ${profile.id}`);
      return NextResponse.json(
        { error: "This UTR has already been submitted. Please use a different payment proof." },
        { status: 400 }
      );
    }

    // Upload screenshot to private storage: <userId>/<paymentId>.<ext>
    const ext = extForValidation;
    const path = `${profile.id}/${paymentId}.${ext}`;
    const buffer = Buffer.from(await screenshot.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from("payment-proofs")
      .upload(path, buffer, { contentType: screenshot.type, upsert: true });

    if (uploadError) {
      console.error("Screenshot upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload screenshot" }, { status: 500 });
    }

    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        utr,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        screenshot_url: path,
        status: "completed",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", paymentId);

    if (paymentError) throw paymentError;

    // Activate the plan immediately
    const analysisLimit = payment.plan === "pro" ? 100 : payment.plan === "premium" ? 500 : 10;
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        plan: payment.plan,
        subscription_status: "active",
        current_period_start: new Date().toISOString(),
        analyses_limit: analysisLimit,
      })
      .eq("id", profile.id);

    if (profileError) throw profileError;

    return NextResponse.json({ success: true, status: "completed" });
  } catch (error) {
    console.error("UPI submit error:", sanitizeForLogging(error));
    return NextResponse.json({ error: "Something went wrong, try again" }, { status: 500 });
  }
}
