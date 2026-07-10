import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* Verifies an emailed auth link (password reset, email confirmation) using the
   token hash. Unlike the PKCE code flow, this works in ANY browser/device,
   which is what you want for links clicked from an email. */
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") || "/app";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=expired`);
}
