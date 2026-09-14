import { handleApiError } from "@/lib/api-utils";
import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import crypto from "crypto";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import Payment from "@/lib/models/Payment";
import OnboardingDetails from "@/lib/models/OnboardingDetails";

export async function POST(req: Request) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      body as {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error(
        `[verify-payment] Signature mismatch for order ${razorpay_order_id}`,
      );
      return NextResponse.json(
        { error: "Invalid payment signature" },
        { status: 400 },
      );
    }

    await dbConnect();

    // Find the payment record
    const payment = await Payment.findOne({
      providerOrderId: razorpay_order_id,
      clerkId,
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment record not found" },
        { status: 404 },
      );
    }

    const toPlan = payment.toPlan;

    if (!["teacher", "teacher_candidate"].includes(toPlan)) {
      return NextResponse.json(
        { error: "Invalid payment plan target" },
        { status: 400 },
      );
    }

    // Idempotency: if already paid, return success
    if (payment.status === "paid") {
      console.log(
        `[verify-payment] Payment ${razorpay_order_id} already verified`,
      );
      return NextResponse.json({ success: true });
    }

    // Update payment record
    payment.status = "paid";
    payment.providerPaymentId = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();

    // Update user record
    await User.updateOne(
      { clerkId },
      {
        "plan.current": toPlan,
        "plan.hasTuitionAccess": true,
        "plan.hasCandidateAccess": toPlan === "teacher_candidate",
        "plan.activatedAt": new Date(),
        onboardingCompleted: true,
        paymentCompleted: true,
        registrationPaymentId: payment._id,
        role: toPlan,
      },
    );

    // Clear TTL on onboarding details so MongoDB doesn't auto-delete them
    await OnboardingDetails.updateOne(
      { clerkId },
      { $set: { expiresAt: null, status: "completed" } },
    );

    // Sync to Clerk public metadata
    const client = await clerkClient();
    await client.users.updateUserMetadata(clerkId, {
      publicMetadata: {
        onboardingCompleted: true,
        role: toPlan,
      },
    });

    console.log(
      `[verify-payment] Payment verified for ${clerkId}, from: ${payment.fromPlan ?? "none"}, to: ${toPlan}`,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "POST /api/v1/payments/verify");
  }
}
