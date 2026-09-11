import { CalendarProvider } from "@/calendar/contexts/calendar-context";
import { getEvents, getUsers } from "@/calendar/requests";
import BackButton from "@/components/BackButton";

export const dynamic = "force-dynamic";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, users] = await Promise.all([getEvents(), getUsers()]);

  return (
    <>
      <BackButton title="Calendar" />
      <CalendarProvider users={users} events={events}>
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 py-4 pb-20">
          {children}
        </div>
      </CalendarProvider>
    </>
  );
}
