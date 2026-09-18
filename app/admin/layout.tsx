import { CalendarProvider } from "@/calendar/contexts/calendar-context";
import AdminFab from "@/components/admin/ui/AdminFab";
import AdminSidebar from "@/components/admin/ui/AdminSidebar";
import { getEvents, getUsers } from "@/calendar/requests";
import AdminGuard from "@/components/admin/ui/AdminGuard";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [events, users] = await Promise.all([getEvents(), getUsers()]);
  return (
    <>
      <CalendarProvider users={users} events={events}>
        <AdminSidebar />
        <AdminGuard>
          {children}
        </AdminGuard>
        <AdminFab />
      </CalendarProvider>
    </>
  );
}
