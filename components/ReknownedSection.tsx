import React from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Avatar } from "@heroui/avatar";
import { ScrollShadow } from "@heroui/scroll-shadow";
import Underline from "./ui/Underline";
import { reportError } from "@/lib/sentry-report";

interface RenownedTeacher {
  _id: string;
  name: string;
  designation: string;
  image: string;
  quote: string;
  order: number;
}

async function fetchRenownedTeachers(): Promise<RenownedTeacher[]> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/v1/renowned-teachers`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.teachers ?? [];
  } catch (error) {
    reportError(error, {
      tags: { area: "public-content", operation: "load-renowned-teachers" },
    });
    return [];
  }
}

const ReknownedSection = async () => {
  const teachers = await fetchRenownedTeachers();

  if (teachers.length === 0) return null;

  return (
    <div className="w-full max-w-7xl flex flex-col my-5 md:my-10">
      <Underline
        title="Reknowned Teachers"
        className="text-center"
        size="large"
      />
      <ScrollShadow
        orientation="horizontal"
        className="w-full py-4 no-scrollbar"
      >
        <div className="flex gap-4 px-4">
          {teachers.map((item) => (
            <Card
              key={item._id}
              className="min-w-70 max-w-70 shadow-sm border border-slate-100 dark:border-slate-800"
            >
              <CardHeader className="flex gap-3 items-center">
                <Avatar
                  src={"https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?fm=jpg&q=60&w=3000&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dXNlciUyMHByb2ZpbGV8ZW58MHx8MHx8fDA%3D"}
                  name={item.name}
                  alt={item.name}
                  size="lg"
                  radius="full"
                />
                <div className="flex flex-col">
                  <p className="font-semibold text-slate-800 dark:text-slate-100">
                    {item.name}
                  </p>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {item.designation}
                  </span>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <p className="text-sm text-center italic text-slate-600 dark:text-slate-300 leading-relaxed">
                  "{item.quote}"
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </ScrollShadow>
    </div>
  );
};

export default ReknownedSection;
