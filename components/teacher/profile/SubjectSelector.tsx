"use client";

import { Select, SelectItem } from "@heroui/select";
import { useEffect, useState } from "react";

export type SubjectOption = { key: string; label: string };

export default function SubjectSelector({
  value,
  onChange,
  isRequired = false,
}: {
  value: string[];
  onChange: (subjects: string[]) => void;
  isRequired?: boolean;
}) {
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/subjects")
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load subjects");
        return response.json() as Promise<{ subjects?: SubjectOption[] }>;
      })
      .then((data) => setSubjects(data.subjects ?? []))
      .catch(() => setError("Unable to load subjects. Please try again."));
  }, []);

  return (
    <div className="space-y-1">
      <Select
        label="Subjects you can teach"
        placeholder="Select one or more subjects"
        selectionMode="multiple"
        isRequired={isRequired}
        selectedKeys={new Set(value)}
        onSelectionChange={(keys) => onChange(Array.from(keys as Set<string>))}
        description="You can update these subjects later from your profile."
      >
        {subjects.map((subject) => (
          <SelectItem key={subject.key}>{subject.label}</SelectItem>
        ))}
      </Select>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
