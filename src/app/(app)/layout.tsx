import { and, count, desc, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarIcon } from "@/components/icons";
import { NavLink } from "@/components/nav-link";
import {
  NotificationBell,
  type NotificationItem,
} from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { leaveRequest, notification, user as requester } from "@/db/schema";
import { formatRange } from "@/lib/dates";
import { LEAVE_TYPE_LABEL } from "@/lib/leave";
import { requireUser } from "@/lib/session";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header
        style={{ viewTransitionName: "app-header" }}
        className="sticky top-0 z-10 bg-surface/90 backdrop-blur"
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-on-primary">
              <CalendarIcon className="size-5" />
            </span>
            <span className="text-[22px] text-on-surface">PTO</span>
          </Link>
          {/* Reads the session, so it streams in behind its own boundary. */}
          <Suspense>
            <Nav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
        {children}
      </main>
    </>
  );
}

async function Nav() {
  const user = await requireUser();
  const isApprover = user.role === "manager" || user.role === "superadmin";
  return (
    <>
      <nav className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
        <NavLink href="/">My leave</NavLink>
        <NavLink href="/calendar">Calendar</NavLink>
        {isApprover && <NavLink href="/approvals">Approvals</NavLink>}
        {user.role === "superadmin" && <NavLink href="/admin">Admin</NavLink>}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {isApprover && <Notifications userId={user.id} />}
        <UserMenu name={user.name} email={user.email} />
      </div>
    </>
  );
}

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });

function timeAgo(date: Date): string {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (minutes > -1) return "just now";
  if (minutes > -60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (hours > -24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

async function Notifications({ userId }: { userId: string }) {
  const [rows, [{ unread }]] = await Promise.all([
    db
      .select({
        id: notification.id,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        name: requester.name,
        type: leaveRequest.type,
        days: leaveRequest.days,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        status: leaveRequest.status,
      })
      .from(notification)
      .innerJoin(leaveRequest, eq(leaveRequest.id, notification.leaveRequestId))
      .innerJoin(requester, eq(requester.id, leaveRequest.userId))
      .where(eq(notification.userId, userId))
      .orderBy(desc(notification.createdAt))
      .limit(10),
    db
      .select({ unread: count() })
      .from(notification)
      .where(and(eq(notification.userId, userId), isNull(notification.readAt))),
  ]);
  const items: NotificationItem[] = rows.map((r) => ({
    id: r.id,
    read: r.readAt !== null,
    title: `${r.name} requested ${r.days} ${r.days === 1 ? "day" : "days"} of ${LEAVE_TYPE_LABEL[
      r.type
    ].toLowerCase()}`,
    detail: `${formatRange(r.startDate, r.endDate)} · ${timeAgo(r.createdAt)}`,
    status: r.status,
  }));
  return <NotificationBell items={items} unread={unread} />;
}
