import { NextResponse } from "next/server";

import { loginAdmin, loginAgent } from "@/lib/server/auth";

interface LoginBody {
  role?: "admin" | "agent";
  email?: string;
  arcNumber?: string;
  password?: string;
  redirectTo?: string;
}

async function parseBody(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return {
      isJson: true,
      body: (await request.json()) as LoginBody,
    };
  }

  const formData = await request.formData();

  return {
    isJson: false,
    body: {
      role: String(formData.get("role") ?? "") as "admin" | "agent",
      email: String(formData.get("email") ?? ""),
      arcNumber: String(formData.get("arcNumber") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: String(formData.get("redirectTo") ?? ""),
    } satisfies LoginBody,
  };
}

function buildLoginRedirectUrl(request: Request, body: LoginBody, error: string) {
  const url = new URL("/login", request.url);

  if (body.role) {
    url.searchParams.set("role", body.role);
  }

  if (body.redirectTo && body.redirectTo.startsWith("/") && !body.redirectTo.startsWith("//")) {
    url.searchParams.set("redirectTo", body.redirectTo);
  }

  url.searchParams.set("error", error);
  return url;
}

export async function POST(request: Request) {
  const { isJson, body } = await parseBody(request);

  const safeRedirect =
    body.redirectTo && body.redirectTo.startsWith("/") && !body.redirectTo.startsWith("//")
      ? body.redirectTo
      : undefined;

  if (!body.role || !body.password) {
    if (isJson) {
      return NextResponse.json({ error: "Missing credentials." }, { status: 400 });
    }

    return NextResponse.redirect(buildLoginRedirectUrl(request, body, "Missing credentials."), 303);
  }

  if (body.role === "admin") {
    const user = await loginAdmin(body.email?.trim() ?? "", body.password);

    if (!user) {
      if (isJson) {
        return NextResponse.json({ error: "Invalid admin credentials." }, { status: 401 });
      }

      return NextResponse.redirect(
        buildLoginRedirectUrl(request, body, "Invalid admin credentials."),
        303
      );
    }

    if (isJson) {
      return NextResponse.json({ ok: true, redirectTo: safeRedirect ?? "/dashboard" });
    }

    return NextResponse.redirect(new URL(safeRedirect ?? "/dashboard", request.url), 303);
  }

  const user = await loginAgent(body.arcNumber?.trim() ?? "", body.password);

  if (!user) {
    if (isJson) {
      return NextResponse.json({ error: "Invalid agent credentials." }, { status: 401 });
    }

    return NextResponse.redirect(
      buildLoginRedirectUrl(request, body, "Invalid agent credentials."),
      303
    );
  }

  if (isJson) {
    return NextResponse.json({ ok: true, redirectTo: safeRedirect ?? "/agent/dashboard" });
  }

  return NextResponse.redirect(new URL(safeRedirect ?? "/agent/dashboard", request.url), 303);
}
