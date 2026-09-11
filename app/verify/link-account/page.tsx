"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { RedirectToSignIn, useUser } from "@clerk/nextjs";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { reportClientError } from "@/lib/client-report-error";

type ClerkLikeError = {
  errors?: Array<{ message?: string }>;
};

function getClerkErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const maybe = error as ClerkLikeError;
    const first = maybe.errors?.[0]?.message;
    if (first) return first;
  }

  if (error instanceof Error && error.message) return error.message;
  return "Unable to set password right now. Please try again.";
}

export default function LinkAccountPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPassword = useMemo(() => Boolean(user?.passwordEnabled), [user]);

  if (!isLoaded) {
    return <div className="mx-auto max-w-md py-10 text-sm">Loading...</div>;
  }

  if (!isSignedIn) {
    return <RedirectToSignIn redirectUrl="/verify/link-account" />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      await user?.updatePassword({
        newPassword,
        signOutOfOtherSessions: false,
      });
      setSuccess(true);
    } catch (err: unknown) {
      reportClientError(err, { feature: "link-account-password-update" });
      setError(getClerkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (hasPassword || success) {
    return (
      <div className="mx-auto max-w-md space-y-4 py-10">
        <h1 className="text-2xl font-semibold">Login Method Linked</h1>
        <p className="text-default-600">
          Your account now supports both Google SSO and password-based sign in.
          Use either method on your next login.
        </p>
        <Button as={Link} color="primary" href="/u/servicehub/dashboard">
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 py-10">
      <h1 className="text-2xl font-semibold">Add Password Login</h1>
      <p className="text-default-600">
        You signed in to an existing account. Set a password below to enable
        both Google SSO and password login for this same account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          label="New password"
          value={newPassword}
          onValueChange={setNewPassword}
          isRequired
        />
        <Input
          type="password"
          label="Confirm password"
          value={confirmPassword}
          onValueChange={setConfirmPassword}
          isRequired
        />

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <Button type="submit" color="primary" isLoading={loading}>
          Add password login
        </Button>
      </form>
    </div>
  );
}
