const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:4183";
const testRun = Date.now();
const inquiryId = `e2e-${testRun}`;
const customerName = `E2E Customer ${testRun}`;
const memberEmail = `e2e-member-${testRun}@example.local`;
const memberPassword = "admin1234";

const cookies = new Map();
const results = [];
const cleanup = {
  inquiryCreated: false,
  memberId: "",
  knowledge: null,
  settings: null,
  ownerCookies: null,
};

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`PASS ${name}${detail ? ` - ${detail}` : ""}`);
}

function assert(condition, name, detail = "") {
  if (!condition) {
    throw new Error(`${name}${detail ? `: ${detail}` : ""}`);
  }
  pass(name, detail);
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  const headers = new Headers(options.headers || {});
  if (!headers.has("content-type") && options.body && typeof options.body !== "string") {
    headers.set("content-type", "application/json");
  }
  if (cookies.size > 0) {
    headers.set(
      "cookie",
      Array.from(cookies.entries())
        .map(([key, value]) => `${key}=${value}`)
        .join("; "),
    );
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  storeCookies(response.headers);
  const text = await response.text();
  const data = parseResponseBody(text, method, path, response.status, options.allowNonJson);

  if (!response.ok && !options.allowError) {
    throw new Error(`${method} ${path} failed ${response.status}: ${text}`);
  }

  return { response, data };
}

function parseResponseBody(text, method, path, status, allowNonJson = false) {
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    if (allowNonJson) return { raw: text };
    const preview = text.length > 500 ? `${text.slice(0, 500)}...` : text;
    throw new Error(`${method} ${path} returned non-JSON response ${status}: ${preview}`);
  }
}

function storeCookies(headers) {
  const setCookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : splitSetCookie(headers.get("set-cookie"));
  for (const entry of setCookies) {
    const [pair] = entry.split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value) cookies.set(key, value);
    else cookies.delete(key);
  }
}

function splitSetCookie(value) {
  if (!value) return [];
  return value.split(/,(?=\s*[^;,]+=)/g).map((entry) => entry.trim());
}

function restoreCookies(snapshot) {
  cookies.clear();
  if (!snapshot) return;
  for (const [key, value] of snapshot.entries()) {
    cookies.set(key, value);
  }
}

async function cleanupCreatedData() {
  const errors = [];
  restoreCookies(cleanup.ownerCookies);

  if (cleanup.inquiryCreated) {
    const result = await request(`/api/inquiries/${encodeURIComponent(inquiryId)}`, {
      method: "DELETE",
      allowError: true,
    });
    if (!result.response.ok && result.response.status !== 404) {
      errors.push(`delete inquiry: ${result.response.status}`);
    }
  }

  if (cleanup.memberId) {
    const result = await request(`/api/members/${encodeURIComponent(cleanup.memberId)}`, {
      method: "DELETE",
      allowError: true,
    });
    if (!result.response.ok && result.response.status !== 404) {
      errors.push(`delete member: ${result.response.status}`);
    }
  }

  if (cleanup.knowledge) {
    const result = await request("/api/knowledge", {
      method: "PUT",
      body: cleanup.knowledge,
      allowError: true,
    });
    if (!result.response.ok) errors.push(`restore knowledge: ${result.response.status}`);
  }

  if (cleanup.settings) {
    const result = await request("/api/settings", {
      method: "PUT",
      body: cleanup.settings,
      allowError: true,
    });
    if (!result.response.ok) errors.push(`restore settings: ${result.response.status}`);
  }

  if (errors.length > 0) {
    console.error(`Cleanup warnings: ${errors.join(", ")}`);
  }
}

async function main() {
  const health = await request("/api/db/health");
  assert(health.data.ok === true, "DB health check", health.data.database || "");

  const anonymousSession = await request("/api/session");
  assert(anonymousSession.data.authenticated === false, "Anonymous session is not authenticated");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: "owner@example.local", password: "admin1234" },
  });
  assert(login.data.user?.id === "demo-owner", "Login with demo owner", login.data.user?.email || "");
  cleanup.ownerCookies = new Map(cookies);

  const session = await request("/api/session");
  assert(session.data.authenticated === true, "Authenticated session");
  assert(session.data.currentWorkspaceId, "Workspace selected", session.data.currentWorkspaceId);

  if ((session.data.workspaces || []).length > 1) {
    const originalWorkspace = session.data.currentWorkspaceId;
    const nextWorkspace = session.data.workspaces.find((workspace) => workspace.id !== originalWorkspace);
    await request("/api/session/select", {
      method: "POST",
      body: { workspaceId: nextWorkspace.id },
    });
    const switched = await request("/api/session");
    assert(switched.data.currentWorkspaceId === nextWorkspace.id, "Workspace switch", nextWorkspace.name);
    await request("/api/session/select", {
      method: "POST",
      body: { workspaceId: originalWorkspace },
    });
    const restored = await request("/api/session");
    assert(restored.data.currentWorkspaceId === originalWorkspace, "Workspace switch restore", originalWorkspace);
  }

  const settings = await request("/api/settings");
  cleanup.settings = normalizeSettings(settings.data.settings);
  const nextTone = cleanup.settings.toneProfile === "warm" ? "concise" : "warm";
  const updatedSettings = await request("/api/settings", {
    method: "PUT",
    body: { ...cleanup.settings, toneProfile: nextTone },
  });
  assert(updatedSettings.data.settings.toneProfile === nextTone, "Settings update");

  const knowledge = await request("/api/knowledge");
  const profile = cleanup.settings.businessProfile || "tattoo";
  const currentKnowledge =
    (knowledge.data.knowledge || []).find((entry) => entry.profile === profile) || {
      profile,
      prices: "",
      faq: "",
    };
  cleanup.knowledge = {
    profile,
    prices: currentKnowledge.prices || "",
    faq: currentKnowledge.faq || "",
  };
  const marker = `E2E_MARKER_${testRun}`;
  const updatedKnowledge = await request("/api/knowledge", {
    method: "PUT",
    body: {
      ...cleanup.knowledge,
      prices: `${cleanup.knowledge.prices}\n${marker} | 1 | smoke test`,
    },
  });
  assert(updatedKnowledge.data.knowledge.prices.includes(marker), "Knowledge update");

  const createInquiry = await request("/api/inquiries", {
    method: "POST",
    body: {
      id: inquiryId,
      customer: customerName,
      channel: "010-9000-0000",
      message: "오늘 저녁 7시에 예약 가능한가요? 가격도 알려주세요.",
      category: "booking",
      priority: "긴급",
      keywords: ["예약", "가격"],
      reply: "확인 후 안내드리겠습니다.",
      status: "quoted",
      profile,
      tone: cleanup.settings.toneProfile,
      responseWindow: cleanup.settings.responseWindow,
      aiDraft: "확인 후 안내드리겠습니다.",
      aiQuality: { score: 100, forbiddenHits: [], missingSignals: [] },
      replyRevisionLog: [],
      assigneeId: null,
      internalNote: "",
      timeline: [],
      tattooArea: "손목",
      tattooSize: "5cm",
      tattooStyle: "lettering",
      isCoverup: false,
      sessionCount: 1,
      quotedPrice: "80,000원~",
      preferredDate: "다음주 토요일 오후",
    },
  });
  cleanup.inquiryCreated = true;
  assert(createInquiry.data.ok === true && createInquiry.data.saved === 1, "Inquiry create");

  const inquiries = await request("/api/inquiries");
  const created = (inquiries.data.inquiries || []).find((entry) => entry.id === inquiryId);
  assert(created?.customer === customerName, "Inquiry list includes created inquiry");

  const reportBeforeUpdate = await request("/api/report/daily?tz=Asia%2FSeoul");
  assert(reportBeforeUpdate.data.report?.today?.total >= 1, "Daily report includes today's inquiries", `${reportBeforeUpdate.data.report.today.total} total`);
  assert(reportBeforeUpdate.data.report?.today?.urgent >= 1, "Daily report counts urgent inquiries", `${reportBeforeUpdate.data.report.today.urgent} urgent`);

  const patchedInquiry = await request(`/api/inquiries/${encodeURIComponent(inquiryId)}`, {
    method: "PATCH",
    body: {
      status: "deposit_pending",
      priority: "보통",
      assigneeId: "demo-agent",
      internalNote: `E2E note ${testRun}`,
      reply: `E2E reply ${testRun}`,
      preferredDate: "7/20 오후",
      timeline: [{ id: `tl-${testRun}`, actor: "E2E", label: "smoke test" }],
    },
  });
  assert(
    patchedInquiry.data.inquiry.status === "deposit_pending" &&
      patchedInquiry.data.inquiry.priority === "보통" &&
      patchedInquiry.data.inquiry.assigneeId === "demo-agent" &&
      patchedInquiry.data.inquiry.preferredDate === "7/20 오후",
    "Inquiry update",
  );

  const customers = await request("/api/customers");
  const customer = (customers.data.customers || []).find((entry) => entry.name === customerName);
  assert(customer?.inquiryCount >= 1, "Customer created from inquiry", customer?.id || "");

  const patchedCustomer = await request(`/api/customers/${encodeURIComponent(customer.id)}`, {
    method: "PATCH",
    body: { status: "booked", tags: ["e2e", "smoke"], note: `E2E customer note ${testRun}`, skinNotes: "E2E skin note" },
  });
  assert(patchedCustomer.data.customer.status === "booked", "Customer profile update");

  const member = await request("/api/members", {
    method: "POST",
    body: { name: "E2E Member", email: memberEmail, role: "member" },
  });
  cleanup.memberId = member.data.member.id;
  assert(member.data.member.email === memberEmail, "Member invite");

  const roleChange = await request(`/api/members/${encodeURIComponent(cleanup.memberId)}`, {
    method: "PATCH",
    body: { role: "member" },
  });
  assert(roleChange.data.member.role === "member", "Member role change");

  await assertMemberPermissions();

  const ai = await request("/api/generate-reply", {
    method: "POST",
    body: { customer: customerName, message: "예약 문의", currentReply: "확인 후 안내드리겠습니다." },
    allowError: true,
  });
  assert(
    ai.response.ok || [400, 401, 403, 429].includes(ai.response.status),
    "AI endpoint handled",
    ai.response.ok ? `configured: ${ai.data.model || "server model"}` : ai.data.error || `status ${ai.response.status}`,
  );
}

async function assertMemberPermissions() {
  const ownerCookies = new Map(cookies);

  try {
    cookies.clear();
    const memberLogin = await request("/api/auth/login", {
      method: "POST",
      body: { email: memberEmail, password: memberPassword },
    });
    assert(memberLogin.data.user?.email === memberEmail, "Login with invited member", memberLogin.data.user?.email || "");

    const memberSession = await request("/api/session");
    const memberWorkspace = (memberSession.data.workspaces || []).find((workspace) => workspace.id === memberSession.data.currentWorkspaceId);
    assert(memberWorkspace?.role === "member", "Member session role", memberSession.data.currentWorkspaceId || "");

    const memberReport = await request("/api/report/daily?tz=Asia%2FSeoul");
    assert(memberReport.response.ok && memberReport.data.report, "Member can read daily report");

    const deniedSettings = await request("/api/settings", {
      method: "PUT",
      body: normalizeSettings({}),
      allowError: true,
    });
    assert(deniedSettings.response.status === 403, "Member cannot update settings");

    const deniedMember = await request("/api/members", {
      method: "POST",
      body: { name: "Denied Member Invite", email: `denied-${testRun}@example.local`, role: "member" },
      allowError: true,
    });
    assert(deniedMember.response.status === 403, "Member cannot invite members");
  } finally {
    restoreCookies(ownerCookies);
  }
}

function normalizeSettings(value) {
  return {
    businessProfile: value?.businessProfile || "tattoo",
    toneProfile: value?.toneProfile || "warm",
    responseWindow: value?.responseWindow || "fast",
    channels: Array.isArray(value?.channels) ? value.channels : [],
    intakeFields: Array.isArray(value?.intakeFields) ? value.intakeFields : [],
    welcomeMessage: value?.welcomeMessage || "",
    onboardingCompletedAt: value?.onboardingCompletedAt || null,
  };
}

try {
  await main();
  console.log(`\nE2E smoke passed: ${results.length} checks`);
} catch (error) {
  console.error(`\nE2E smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await cleanupCreatedData();
}
