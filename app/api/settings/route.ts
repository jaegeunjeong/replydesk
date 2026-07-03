import { NextRequest, NextResponse } from "next/server";

import { getWorkspaceContext, pool, requireWorkspacePermission, WorkspaceAccessError, WorkspacePermissionError } from "@/lib/db";

export async function GET(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });

  const result = await pool.query(
    `
    select
      business_profile as "businessProfile",
      tone_profile as "toneProfile",
      response_window as "responseWindow",
      channels,
      intake_fields as "intakeFields",
      welcome_message as "welcomeMessage",
      onboarding_completed_at as "onboardingCompletedAt"
    from workspace_settings
    where workspace_id = $1
    `,
    [context.workspaceId],
  );

  return NextResponse.json({
    settings:
      result.rows[0] ?? {
        businessProfile: "tattoo",
        toneProfile: "warm",
        responseWindow: "fast",
        channels: [],
        intakeFields: [],
        welcomeMessage: "",
        onboardingCompletedAt: null,
      },
  });
}

export async function PUT(request: NextRequest) {
  const context = await getWorkspaceContext(request).catch((error) => {
    if (error instanceof WorkspaceAccessError) return null;
    throw error;
  });
  if (!context) return NextResponse.json({ error: "Workspace access denied" }, { status: 403 });
  try {
    requireWorkspacePermission(context, "settings.write");
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }

  const body = await request.json();

  const result = await pool.query(
    `
    insert into workspace_settings (
      workspace_id,
      business_profile,
      tone_profile,
      response_window,
      channels,
      intake_fields,
      welcome_message,
      onboarding_completed_at,
      updated_at
    )
    values ($1, $2, $3, $4, $5, $6, $7, $8, now())
    on conflict (workspace_id) do update set
      business_profile = excluded.business_profile,
      tone_profile = excluded.tone_profile,
      response_window = excluded.response_window,
      channels = excluded.channels,
      intake_fields = excluded.intake_fields,
      welcome_message = excluded.welcome_message,
      onboarding_completed_at = coalesce(excluded.onboarding_completed_at, workspace_settings.onboarding_completed_at),
      updated_at = now()
    returning
      business_profile as "businessProfile",
      tone_profile as "toneProfile",
      response_window as "responseWindow",
      channels,
      intake_fields as "intakeFields",
      welcome_message as "welcomeMessage",
      onboarding_completed_at as "onboardingCompletedAt"
    `,
    [
      context.workspaceId,
      body.businessProfile || "tattoo",
      body.toneProfile || "warm",
      body.responseWindow || "fast",
      Array.isArray(body.channels) ? body.channels : [],
      Array.isArray(body.intakeFields) ? body.intakeFields : [],
      body.welcomeMessage || "",
      body.onboardingCompletedAt || null,
    ],
  );

  return NextResponse.json({ settings: result.rows[0] });
}
