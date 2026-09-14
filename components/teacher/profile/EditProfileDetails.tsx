"use client";

import { useEffect, useState } from "react";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/modal";
import { Pencil } from "lucide-react";
import PhoneFields from "@/components/reactbits/onboarding/PhoneFields";
import AddressField from "@/components/reactbits/onboarding/AddressField";
import ExperienceField from "@/components/reactbits/onboarding/ExperienceField";
import QualificationField from "@/components/reactbits/onboarding/QualificationField";
import BoardField from "@/components/reactbits/onboarding/BoardField";
import GenderField from "@/components/reactbits/onboarding/GenderField";
import {
  onboardingStep1Schema,
  type OnboardingStep1Values,
} from "@/components/reactbits/onboarding/types";

export interface EditableProfileDetails {
  phone: string | null;
  whatsapp: string | null;
  address: string | null;
  teachingExp: string | null;
  jobExp: string | null;
  qualification: string | null;
  board: string | null;
  gender: string | null;
}

type ProfileUpdate = Omit<OnboardingStep1Values, "jobExp"> & {
  jobExp?: string;
};

interface EditProfileDetailsProps {
  details: EditableProfileDetails;
  onSaved: (details: EditableProfileDetails) => void;
}

function toForm(details: EditableProfileDetails): ProfileUpdate {
  return {
    phone: details.phone ?? "",
    whatsapp: details.whatsapp ?? "",
    address: details.address ?? "",
    teachingExp: details.teachingExp ?? "",
    jobExp: details.jobExp ?? "",
    qualification: details.qualification ?? "",
    board: details.board ?? "",
    gender: details.gender
      ? details.gender.charAt(0).toUpperCase() + details.gender.slice(1)
      : "",
  };
}

export default function EditProfileDetails({
  details,
  onSaved,
}: EditProfileDetailsProps) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState<ProfileUpdate>(() => toForm(details));
  const [sameAsPhone, setSameAsPhone] = useState(
    Boolean(details.phone && details.phone === details.whatsapp),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const next = toForm(details);
      setForm(next);
      setSameAsPhone(Boolean(next.phone && next.phone === next.whatsapp));
      setError(null);
    }
  }, [details, isOpen]);

  const update = <K extends keyof ProfileUpdate>(
    key: K,
    value: ProfileUpdate[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handlePhoneChange = (
    key: "phone" | "whatsapp" | "sameAsPhone",
    value: string | boolean,
  ) => {
    if (key === "sameAsPhone") {
      setSameAsPhone(Boolean(value));
      if (value) update("whatsapp", form.phone);
      return;
    }

    const phoneValue = String(value);
    update(key, phoneValue);
    if (key === "phone" && sameAsPhone) update("whatsapp", phoneValue);
  };

  const save = async () => {
    const result = onboardingStep1Schema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Please check your details.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          whatsapp: form.whatsapp,
          address: form.address,
          teachingExp: form.teachingExp,
          jobExp: form.jobExp || undefined,
          qualification: form.qualification,
          board: form.board,
          gender: form.gender,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        profile?: EditableProfileDetails;
      };
      if (!response.ok || !data.profile) {
        throw new Error(data.error ?? "Unable to update your profile.");
      }

      onSaved(data.profile);
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update your profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="flat"
        color="primary"
        startContent={<Pencil size={15} />}
        onPress={onOpen}
      >
        Edit details
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Edit profile details
            <span className="text-xs font-normal text-default-500">
              Username and email cannot be changed here.
            </span>
          </ModalHeader>
          <ModalBody className="gap-4">
            <PhoneFields
              phone={form.phone}
              whatsapp={form.whatsapp ?? ""}
              sameAsPhone={sameAsPhone}
              onChange={handlePhoneChange}
            />
            <AddressField
              value={form.address}
              onChange={(value) => update("address", value)}
            />
            <ExperienceField
              label="Teaching Experience"
              value={form.teachingExp}
              isRequired
              onChange={(value) => update("teachingExp", value)}
            />
            <ExperienceField
              label="Job Experience (optional)"
              value={form.jobExp ?? ""}
              onChange={(value) => update("jobExp", value)}
            />
            <QualificationField
              value={form.qualification}
              onChange={(value) => update("qualification", value)}
            />
            <BoardField
              value={form.board}
              onChange={(value) => update("board", value)}
            />
            <GenderField
              value={form.gender}
              onChange={(value) => update("gender", value)}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onClose}>
              Cancel
            </Button>
            <Button color="primary" isLoading={isSaving} onPress={save}>
              Save details
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
