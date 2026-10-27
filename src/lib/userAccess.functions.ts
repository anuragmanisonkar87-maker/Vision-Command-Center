import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PASSWORD_RESET_REDIRECT_URL } from "./authRecovery.helpers";
import { isValidPassword, type InviteStatus } from "./userAccess.helpers";

async function assertAdmin(context: any) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

async function audit(
  admin: any,
  actor: { id: string; email: string | null },
  entry: { target_email: string; target_user_id?: string | null; action: string; details?: Record<string, unknown> },
) {
  try {
    await admin.from("user_access_audit_log").insert({
      actor_user_id: actor.id,
      actor_email: actor.email,
      target_user_id: entry.target_user_id ?? null,
      target_email: entry.target_email,
      action: entry.action,
      details: entry.details ?? {},
    });
  } catch (e) {
    console.warn("[user-access audit] failed", e);
  }
}

async function findAuthUserByEmail(admin: any, email: string) {
  const lower = email.toLowerCase();
  // Page through users (small workspaces — at most a few pages).
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = data.users.find((u: any) => (u.email ?? "").toLowerCase() === lower);
    if (u) return u;
    if (data.users.length < 200) return null;
  }
  return null;
}

export type UserAccessRow = {
  user_id: string | null;
  email: string;
  display_name: string | null;
  roles: string[];
  invite_status: InviteStatus;
  invite_sent_at: string | null;
  password_reset_sent_at: string | null;
  last_login_at: string | null;
  disabled: boolean;
};

export const listUserAccessRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [teamRes, profilesRes, rolesRes] = await Promise.all([
      supabaseAdmin
        .from("gwv_team_members")
        .select("id, name, email, linked_user_id, status")
        .eq("is_deleted", false),
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, email, invite_status, invite_sent_at, password_reset_sent_at, last_login_at, disabled_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (teamRes.error) throw new Error(teamRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);
    if (rolesRes.error) throw new Error(rolesRes.error.message);

    const rolesByUser = new Map<string, string[]>();
    for (const r of rolesRes.data ?? []) {
      const arr = rolesByUser.get((r as any).user_id) ?? [];
      arr.push((r as any).role);
      rolesByUser.set((r as any).user_id, arr);
    }

    const authByEmail = new Map<string, any>();
    const authById = new Map<string, any>();
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      for (const u of data.users) {
        if (u.email) authByEmail.set(u.email.toLowerCase(), u);
        authById.set(u.id, u);
      }
      if (data.users.length < 200) break;
    }

    const profilesByEmail = new Map<string, any>();
    const profilesById = new Map<string, any>();
    for (const p of profilesRes.data ?? []) {
      if ((p as any).email) profilesByEmail.set(String((p as any).email).toLowerCase(), p);
      profilesById.set((p as any).id, p);
    }

    const buildRow = (email: string, display_name: string | null): UserAccessRow => {
      const lower = email.toLowerCase();
      const auth = authByEmail.get(lower);
      const profile = (auth && profilesById.get(auth.id)) ?? profilesByEmail.get(lower);
      const banned = !!auth?.banned_until && new Date(auth.banned_until) > new Date();
      const status: InviteStatus = !auth
        ? ((profile?.invite_status as InviteStatus) ?? "not_invited")
        : banned
        ? "disabled"
        : auth.last_sign_in_at
        ? "active"
        : !auth.email_confirmed_at
        ? "email_not_confirmed"
        : ((profile?.invite_status as InviteStatus) ?? "invite_sent");
      return {
        user_id: auth?.id ?? profile?.id ?? null,
        email: lower,
        display_name: display_name ?? profile?.display_name ?? null,
        roles: auth ? (rolesByUser.get(auth.id) ?? []) : [],
        invite_status: status,
        invite_sent_at: profile?.invite_sent_at ?? null,
        password_reset_sent_at: profile?.password_reset_sent_at ?? null,
        last_login_at: auth?.last_sign_in_at ?? profile?.last_login_at ?? null,
        disabled: banned,
      };
    };

    const seen = new Set<string>();
    const rows: UserAccessRow[] = [];
    // Team-members first — source of truth for "who should have login access".
    for (const t of teamRes.data ?? []) {
      const email = String((t as any).email ?? "").toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      rows.push(buildRow(email, (t as any).name ?? null));
    }
    // Also include admin auth users not in the team list (e.g. founding admin).
    for (const [email, auth] of authByEmail) {
      if (seen.has(email)) continue;
      const roles = rolesByUser.get(auth.id) ?? [];
      if (!roles.includes("admin")) continue;
      seen.add(email);
      const profile = profilesById.get(auth.id);
      rows.push(buildRow(email, profile?.display_name ?? null));
    }

    rows.sort((a, b) => (a.display_name ?? a.email).localeCompare(b.display_name ?? b.email));
    return { rows };
  });

export const sendUserInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; display_name?: string | null }) => ({
    email: String(input.email || "").trim().toLowerCase(),
    display_name: input.display_name ?? null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Invalid email");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = { id: context.userId, email: context.claims?.email ?? null };
    const redirectTo = PASSWORD_RESET_REDIRECT_URL;

    const existing = await findAuthUserByEmail(supabaseAdmin, data.email);

    if (existing) {
      // Don't duplicate. If never signed in, treat as resend invite by sending invite email again.
      if (!existing.last_sign_in_at) {
        const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo });
        if (error) throw new Error(error.message);
        await supabaseAdmin.from("profiles").upsert({
          id: existing.id,
          email: data.email,
          display_name: data.display_name ?? existing.user_metadata?.display_name ?? null,
          invite_status: "invite_sent",
          invite_sent_at: new Date().toISOString(),
        });
        await audit(supabaseAdmin, actor, { target_email: data.email, target_user_id: existing.id, action: "invite_resent" });
        return { ok: true, alreadyExists: true, resent: true } as const;
      }
      // User is already active — caller should send a password reset instead.
      return { ok: true, alreadyExists: true, resent: false } as const;
    }

    const { data: inv, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      redirectTo,
      data: data.display_name ? { display_name: data.display_name } : undefined,
    });
    if (error) throw new Error(error.message);

    const newId = inv?.user?.id;
    if (newId) {
      await supabaseAdmin.from("profiles").upsert({
        id: newId,
        email: data.email,
        display_name: data.display_name,
        invite_status: "invite_sent",
        invite_sent_at: new Date().toISOString(),
      });
    }
    await audit(supabaseAdmin, actor, { target_email: data.email, target_user_id: newId ?? null, action: "invite_sent" });
    return { ok: true, alreadyExists: false } as const;
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => ({
    email: String(input.email || "").trim().toLowerCase(),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.email) throw new Error("Email required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = { id: context.userId, email: context.claims?.email ?? null };
    const redirectTo = PASSWORD_RESET_REDIRECT_URL;

    const user = await findAuthUserByEmail(supabaseAdmin, data.email);
    if (!user) throw new Error("User not found");

    // Use the standard end-user reset flow so Supabase sends the recovery email.
    // We use a publishable client server-side (no service-role exposure) and call
    // resetPasswordForEmail — this is the documented method that triggers email
    // delivery via Supabase Auth's SMTP/email pipeline.
    const { createClient } = await import("@supabase/supabase-js");
    const pub = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await pub.auth.resetPasswordForEmail(data.email, { redirectTo });
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("profiles").upsert({
      id: user.id,
      email: data.email,
      password_reset_sent_at: new Date().toISOString(),
      invite_status: user.last_sign_in_at ? "active" : "reset_sent",
    });
    await audit(supabaseAdmin, actor, { target_email: data.email, target_user_id: user.id, action: "password_reset_sent" });
    return { ok: true } as const;
  });

export const setUserLoginDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; disabled: boolean }) => ({
    user_id: String(input.user_id),
    disabled: !!input.disabled,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = { id: context.userId, email: context.claims?.email ?? null };

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as any);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("profiles").upsert({
      id: data.user_id,
      disabled_at: data.disabled ? new Date().toISOString() : null,
      invite_status: data.disabled ? "disabled" : "active",
    });

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    await audit(supabaseAdmin, actor, {
      target_email: target?.user?.email ?? "",
      target_user_id: data.user_id,
      action: data.disabled ? "login_disabled" : "login_enabled",
    });
    return { ok: true } as const;
  });

/**
 * Confirm an internal user (sets email_confirmed_at via service role) and then
 * sends a password-reset/setup email. Use when an invited employee is stuck on
 * "Email not confirmed" because the confirmation email never arrived.
 *
 * If the user doesn't yet have an auth record, create one (email-confirmed) so
 * the reset email can be sent. No password is generated or returned.
 */
export const confirmAndSendSetupLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; display_name?: string | null }) => ({
    email: String(input.email || "").trim().toLowerCase(),
    display_name: input.display_name ?? null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Invalid email");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = { id: context.userId, email: context.claims?.email ?? null };
    const redirectTo = PASSWORD_RESET_REDIRECT_URL;

    let user = await findAuthUserByEmail(supabaseAdmin, data.email);

    if (!user) {
      // Create an email-confirmed auth user with no password set. Reset link below
      // lets the employee establish their own password.
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        email_confirm: true,
        user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
      });
      if (error) throw new Error(error.message);
      user = created.user;
    } else if (!user.email_confirmed_at) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      } as any);
      if (error) throw new Error(error.message);
    }

    const { createClient } = await import("@supabase/supabase-js");
    const pub = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: resetErr } = await pub.auth.resetPasswordForEmail(data.email, { redirectTo });
    if (resetErr) throw new Error(resetErr.message);

    await supabaseAdmin.from("profiles").upsert({
      id: user!.id,
      email: data.email,
      display_name: data.display_name ?? user!.user_metadata?.display_name ?? null,
      invite_status: "reset_sent",
      password_reset_sent_at: new Date().toISOString(),
    });
    await audit(supabaseAdmin, actor, {
      target_email: data.email,
      target_user_id: user!.id,
      action: "confirm_and_send_setup",
    });
    return { ok: true } as const;
  });

/**
 * Manually set a password for a team member. Admin-only. Creates the auth user
 * (email-confirmed) if one doesn't exist yet, so the employee can sign in
 * immediately with email + password — no invite/reset email required.
 *
 * The plaintext password is only ever sent from the admin's browser to this
 * server function over HTTPS, handed to Supabase Auth, and never persisted,
 * logged, or echoed back in the response.
 */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; display_name?: string | null }) => ({
    email: String(input.email || "").trim().toLowerCase(),
    password: String(input.password || ""),
    display_name: input.display_name ?? null,
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new Error("Invalid email");
    }
    const pwCheck = isValidPassword(data.password);
    if (!pwCheck.ok) throw new Error(pwCheck.reason ?? "Invalid password");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actor = { id: context.userId, email: context.claims?.email ?? null };

    let user = await findAuthUserByEmail(supabaseAdmin, data.email);
    let created = false;

    if (!user) {
      const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
      });
      if (error) throw new Error(error.message);
      user = newUser.user;
      created = true;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: data.password,
        email_confirm: true,
        ban_duration: "none",
      } as any);
      if (error) throw new Error(error.message);
    }

    await supabaseAdmin.from("profiles").upsert({
      id: user!.id,
      email: data.email,
      display_name: data.display_name ?? user!.user_metadata?.display_name ?? null,
      invite_status: "active" as InviteStatus,
      disabled_at: null,
    });

    // NOTE: never write the plaintext password into details.
    await audit(supabaseAdmin, actor, {
      target_email: data.email,
      target_user_id: user!.id,
      action: created ? "password_set_created_user" : "password_set",
      details: { manual: true },
    });

    return { ok: true, created } as const;
  });
