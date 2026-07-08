import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Google (and any OAuth) redirects back here with a code. We exchange it for a
   session cookie, then send the user on to the app. */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/app";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
