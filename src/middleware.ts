import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const schema = process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "public";

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;
  const isLoginPage = pathname.startsWith("/login");
  const isRecoveryPage = pathname.startsWith("/pincode-herstellen");
  const isTellerApp = pathname.startsWith("/tellen");
  const isGastApp = pathname.startsWith("/gast");
  const isApiRoute = pathname.startsWith("/api");

  if (user && !isRecoveryPage) {
    const { data: profile } = await supabase.from("profiles").select("active").eq("id", user.id).maybeSingle();
    if (profile?.active === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "Dit account is niet actief.");
      return NextResponse.redirect(url);
    }
  }

  if (!user && !isLoginPage && !isRecoveryPage && !isTellerApp && !isGastApp && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
