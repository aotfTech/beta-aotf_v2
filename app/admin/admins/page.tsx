"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { addToast } from "@heroui/toast";
import { BadgeCheck, MailPlus, Shield, UserPlus } from "lucide-react";
import { reportClientError } from "@/lib/client-report-error";

const ROLE_OPTIONS = [
  { key: "SUPER_ADMIN", label: "Super Admin (Founder only)" },
  { key: "CRM", label: "Customer Relationship Manager" },
  { key: "FRM", label: "Faculty Relationship Manager" },
];

type InviteForm = {
  name: string;
  email: string;
  assignedRole: string;
};

export default function AdminManagementPage() {
  const [form, setForm] = useState<InviteForm>({
    name: "",
    email: "",
    assignedRole: "CRM",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.assignedRole.trim()) {
      addToast({ description: "Name, email, and role are required", color: "danger" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          assignedRole: form.assignedRole.trim(),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        addToast({
          description: payload.error ?? "Failed to send invite",
          color: "danger",
        });
        return;
      }

      addToast({
        description: "Invite sent. The user will receive a join link by email.",
        color: "success",
      });
      setForm({ name: "", email: "", assignedRole: "CRM" });
    } catch (error) {
      reportClientError(error, { feature: "admin-invite" });
      addToast({ description: "Failed to send invite", color: "danger" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="rounded-3xl border border-divider bg-linear-to-br from-slate-50 via-white to-blue-50 p-6 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold text-default-900">Admin Management</h1>
              <p className="text-sm text-default-500">
                Invite new admins and guide them through the join process.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-default-50 px-3 py-1 text-xs text-default-600">
              <Shield size={14} />
              Invites respect role hierarchy
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="border border-divider">
            <CardHeader className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <MailPlus size={20} />
              </div>
              <div>
                <p className="text-lg font-semibold text-default-900">Invite an admin</p>
                <p className="text-sm text-default-500">Send an email with a secure join link.</p>
              </div>
            </CardHeader>
            <CardBody className="space-y-4">
              <Input
                label="Full name"
                placeholder="e.g. Ananya Sen"
                value={form.name}
                onValueChange={(value) => setForm((prev) => ({ ...prev, name: value }))}
                variant="bordered"
                isRequired
              />
              <Input
                label="Email"
                placeholder="admin@example.com"
                type="email"
                value={form.email}
                onValueChange={(value) => setForm((prev) => ({ ...prev, email: value }))}
                variant="bordered"
                isRequired
              />
              <Select
                label="Assigned role"
                selectedKeys={[form.assignedRole]}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, assignedRole: event.target.value }))
                }
                variant="bordered"
                isRequired
              >
                {ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role.key}>{role.label}</SelectItem>
                ))}
              </Select>
              <Button
                color="primary"
                onPress={handleSubmit}
                isLoading={isSubmitting}
                className="w-full"
              >
                Send invite
              </Button>
            </CardBody>
          </Card>

          <div className="space-y-4">
            <Card className="border border-divider">
              <CardHeader className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <UserPlus size={20} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-default-900">Join instructions</p>
                  <p className="text-sm text-default-500">Share these steps with invitees.</p>
                </div>
              </CardHeader>
              <CardBody className="space-y-3 text-sm text-default-600">
                <div className="flex items-start gap-2">
                  <BadgeCheck size={18} className="text-emerald-500" />
                  <span>Open the invite email and click the join link.</span>
                </div>
                <div className="flex items-start gap-2">
                  <BadgeCheck size={18} className="text-emerald-500" />
                  <span>Finish Clerk sign up or sign in.</span>
                </div>
                <div className="flex items-start gap-2">
                  <BadgeCheck size={18} className="text-emerald-500" />
                  <span>They will be redirected to the admin dashboard.</span>
                </div>
              </CardBody>
            </Card>

            <Card className="border border-divider bg-default-50">
              <CardBody className="space-y-2 text-sm text-default-600">
                <p className="font-medium text-default-700">Role hierarchy reminder</p>
                <p>
                  Founder can invite Super Admin. Super Admin can invite CRM and FRM.
                  Other roles cannot invite admins.
                </p>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
