import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Better Auth tables (user, session, account, verification).
// `role` and `teamId` are app fields exposed via `additionalFields`.
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["employee", "manager", "superadmin"]);

export const team = pgTable("team", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
});

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: roleEnum("role").notNull().default("employee"),
  teamId: uuid("team_id").references(() => team.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

// ---------------------------------------------------------------------------
// PTO
// ---------------------------------------------------------------------------

export const leaveTypeEnum = pgEnum("leave_type", ["paid", "unpaid", "sick"]);

export const leaveStatusEnum = pgEnum("leave_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

/** Paid-leave days per user per year. Missing row = DEFAULT_ALLOWANCE. */
export const allowance = pgTable(
  "allowance",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    year: integer("year").notNull(),
    days: integer("days").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.year] })],
);

/** Non-working days (public holidays, government-declared days off). */
export const holiday = pgTable("holiday", {
  date: date("date").primaryKey(),
  name: text("name").notNull(),
});

export const leaveRequest = pgTable(
  "leave_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: leaveTypeEnum("type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    /** Working days, computed when the request is submitted. */
    days: integer("days").notNull(),
    note: text("note"),
    status: leaveStatusEnum("status").notNull().default("pending"),
    /** Who approved, rejected or cancelled it, and when. */
    decidedById: text("decided_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    decidedAt: timestamp("decided_at"),
    decisionComment: text("decision_comment"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("leave_request_user_id_idx").on(t.userId),
    index("leave_request_dates_idx").on(t.startDate, t.endDate),
  ],
);

/** In-app notice to an approver that a leave request was submitted. */
export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Recipient. */
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    leaveRequestId: uuid("leave_request_id")
      .notNull()
      .references(() => leaveRequest.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notification_user_id_idx").on(t.userId, t.createdAt)],
);

export type Role = (typeof roleEnum.enumValues)[number];
export type LeaveType = (typeof leaveTypeEnum.enumValues)[number];
export type LeaveStatus = (typeof leaveStatusEnum.enumValues)[number];
