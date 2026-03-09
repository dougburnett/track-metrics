import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function createServerSupabase(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // setAll can fail in certain contexts; safe to ignore for reads
          }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerSupabase(cookieStore);

    // Verify caller is super_admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized: " + (userError?.message ?? "no session") }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: "Profile lookup failed: " + profileError.message }, { status: 500 });
    }

    if (profile?.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { email, role } = await request.json();
    if (!email || !role) {
      return NextResponse.json({ error: "Email and role are required" }, { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server misconfigured: missing service role key" }, { status: 500 });
    }

    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Check if invite already exists for this email
    const { data: existing } = await adminClient
      .from("invites")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Update the role on the existing invite
      const { error: updateError } = await adminClient
        .from("invites")
        .update({ role, invited_by: user.id })
        .eq("id", existing.id);

      if (updateError) {
        return NextResponse.json({ error: "Update failed: " + updateError.message }, { status: 500 });
      }
    } else {
      // Insert new invite record
      const { error: inviteError } = await adminClient
        .from("invites")
        .insert({ email, role, invited_by: user.id });

      if (inviteError) {
        return NextResponse.json({ error: "Invite insert failed: " + inviteError.message }, { status: 500 });
      }
    }

    // Try to send invite email, but don't fail if it doesn't work
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(email);

    if (authError) {
      // Invite record is saved — role will be assigned on signup regardless
      const alreadyRegistered = authError.message.includes("already been registered");
      return NextResponse.json({
        success: true,
        emailSent: false,
        message: alreadyRegistered
          ? "User already has an account. Their role will update on next sign-in."
          : "Invite saved. Share the signup link manually — the email couldn't be sent automatically.",
      });
    }

    return NextResponse.json({ success: true, emailSent: true });
  } catch (err) {
    return NextResponse.json({ error: "Unexpected error: " + (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
