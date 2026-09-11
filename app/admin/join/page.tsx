"use client";

import { formatDisplayDateTime } from "@/lib/utils/display-date";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { RedirectToSignIn, SignUp, useUser } from "@clerk/nextjs";
import { Button } from "@heroui/button";
import { reportClientError } from "@/lib/client-report-error";

type InviteState = {
  email: string;
  assignedRole: string;
  inviterName: string;
  expiresAt: string;
  inviteeName: string;
};

function AdminJoinContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);
  const { isLoaded, isSignedIn, user } = useUser();

  const [loadingInvite, setLoadingInvite] = useState(true);
  const [invite, setInvite] = useState<InviteState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Missing invite token.");
      setLoadingInvite(false);
      return;
    }

    const run = async () => {
      setLoadingInvite(true);
      try {
        const response = await fetch(`/api/admin/join?token=${encodeURIComponent(token)}`);
        const payload = (await response.json()) as InviteState & { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Invite is invalid or expired.");
          setInvite(null);
        } else {
          setInvite(payload);
          setError(null);
        }
      } catch (error) {
        reportClientError(error, { feature: "admin-invite-validation" });
        setError("Unable to validate invite right now.");
      } finally {
        setLoadingInvite(false);
      }
    };

    void run();
  }, [token]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !token || completed || !invite) return;

    const finishJoin = async () => {
      setCompleting(true);
      try {
        const response = await fetch("/api/admin/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, clerkUserId: user.id }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "Failed to complete admin onboarding.");
          return;
        }
        setCompleted(true);
        router.replace("/admin/dashboard");
      } catch (error) {
        reportClientError(error, { feature: "admin-invite-completion" });
        setError("Failed to complete admin onboarding.");
      } finally {
        setCompleting(false);
      }
    };

    void finishJoin();
  }, [isLoaded, isSignedIn, user, token, completed, router, invite]);

  if (loadingInvite) {
    return <div className="mx-auto max-w-xl py-10">Validating invite...</div>;
  }

  if (error) {
    return <div className="mx-auto max-w-xl py-10 text-danger">{error}</div>;
  }

  if (!invite) {
    return <div className="mx-auto max-w-xl py-10">Invite not found.</div>;
  }

  if (!showSignUp && !isSignedIn) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10">
        <h1 className="text-2xl font-semibold">Admin Invite</h1>
        <p>
          You are invited as <strong>{invite.assignedRole}</strong> by{" "}
          <strong>{invite.inviterName}</strong>.
        </p>
        <p>Invite email: {invite.email}</p>
        <p>Expires at: {formatDisplayDateTime(invite.expiresAt)}</p>
        <Button color="primary" onPress={() => setShowSignUp(true)}>
          Accept &amp; Create Account
        </Button>
      </div>
    );
  }

  if (!isSignedIn && showSignUp) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <SignUp
          fallbackRedirectUrl={`/admin/join?token=${encodeURIComponent(token)}`}
          forceRedirectUrl={`/admin/join?token=${encodeURIComponent(token)}`}
        />
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="mx-auto max-w-xl py-10">Loading account...</div>;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl={`/admin/join?token=${encodeURIComponent(token)}`} />;
  }

  return (
    <div className="mx-auto max-w-xl py-10">
      {completing ? "Finalizing admin onboarding..." : "Redirecting to dashboard..."}
    </div>
  );
}

export default function AdminJoinPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-xl py-10">Loading...</div>}>
      <AdminJoinContent />
    </Suspense>
  );
}
