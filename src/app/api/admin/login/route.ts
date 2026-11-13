import { NextRequest, NextResponse } from "next/server";
import { createToken, validateCredentials } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || !process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ error: "Admin authentication is not configured on this deployment." }, { status: 503 });
    }
    const { email, password } = await req.json();
    if (!validateCredentials(email, password)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    const token = await createToken();
    const res = NextResponse.json({ success: true });
    res.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 86400,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
