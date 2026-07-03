"use client";

import { useEffect, useMemo, useState } from "react";
import { getRolePermissions, hasPermission, permissionLabels, roleLabels, type Permission, type WorkspaceRole } from "@/lib/permissions";

import type {
  Inquiry,
  Status,
  Settings,
  Knowledge,
  Customer,
  WorkspaceMember,
  DemoUser,
  DemoWorkspace,
  AuthDraft,
  ConfirmAction,
  OnboardingDraft,
  BusinessProfileKey,
  TattooStyle,
} from "@/types";

import {
  ONBOARDING_KEY,
  DEFAULT_USER_ID,
  DEFAULT_WORKSPACE_ID,
  appViews,
  categoryLabels,
  defaultSettings,
  defaultKnowledge,
  workspaceDefaultSettings,
  businessProfiles,
  toneProfiles,
  responseWindows,
  sampleLines,
  manageableRoles,
  tattooStyleLabels,
  channelOptions,
  statusLabels,
  knowledgeSections,
} from "@/lib/constants";

import {
  createInquiry,
  getCounts,
  getSummary,
  getCustomerGroups,
  getCustomerKey,
  getCustomerInquiries,
  appendTimeline,
  analyzeAiQuality,
  summarizeReplyRevision,
  isOpenInquiryStatus,
  customerStatusForInquiryStatus,
  getConsultChecklist,
  parseFaqSections,
  getRelevantFaqSectionKeys,
  type TattooFields,
} from "@/lib/inquiry";

import { exportCsv, importCsv } from "@/lib/utils";

import { AuthScreen } from "@/components/AuthScreen";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { InquiryList } from "@/components/InquiryList";
import { DetailPanel } from "@/components/DetailPanel";
import { CustomerPanel } from "@/components/CustomerPanel";
import { KnowledgePanel } from "@/components/KnowledgePanel";
import { SettingsPanel } from "@/components/SettingsPanel";
import { MemberPanel } from "@/components/MemberPanel";
import { SetupWizard } from "@/components/SetupWizard";
import { DailyReport } from "@/components/DailyReport";
import { Metric, SelectField } from "@/components/shared";

const permissionRoleOrder: WorkspaceRole[] = ["member", "owner"];

function getPermissionAccessCopy(role: string | null | undefined, profile: BusinessProfileKey, permission: Permission) {
  const requiredRole =
    permissionRoleOrder.find((candidate) => getRolePermissions(candidate, profile).includes(permission)) ?? "owner";
  const currentRoleLabel = role && role in roleLabels ? roleLabels[role as WorkspaceRole] : "역할 없음";
  return {
    title: `${permissionLabels[permission]} 권한이 잠겨 있습니다`,
    body: `${businessProfiles[profile].label} 권한 템플릿에서는 ${roleLabels[requiredRole]} 이상 역할부터 가능합니다. 현재 역할은 ${currentRoleLabel}입니다.`,
  };
}

function createOnboardingDraft(settings: Settings = defaultSettings): OnboardingDraft {
  const defaults = defaultKnowledge[settings.businessProfile];
  const channels = settings.channels.length > 0 ? settings.channels : defaultSettings.channels;
  const intakeFields = settings.intakeFields.length > 0 ? settings.intakeFields : defaultSettings.intakeFields;
  const welcomeMessage = settings.welcomeMessage.trim() ? settings.welcomeMessage : defaultSettings.welcomeMessage;
  return {
    ...settings,
    channels,
    intakeFields,
    welcomeMessage,
    loadDefaults: true,
    prices: defaults.prices,
    faq: defaults.faq,
    inviteName: "",
    inviteEmail: "",
    inviteRole: "member",
  };
}

export default function ReplyDeskPage() {
  const [mounted, setMounted] = useState(false);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [knowledge, setKnowledge] = useState<Knowledge>(defaultKnowledge);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [workspaces, setWorkspaces] = useState<DemoWorkspace[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(DEFAULT_USER_ID);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(DEFAULT_WORKSPACE_ID);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authDraft, setAuthDraft] = useState<AuthDraft>({
    mode: "login",
    name: "",
    email: "owner@example.local",
    password: "admin1234",
    workspaceName: "",
  });
  const [authStatus, setAuthStatus] = useState("");
  const [activeView, setActiveView] = useState<"inbox" | "customers" | "knowledge" | "settings" | "members" | "report">("inbox");
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<"quote" | "booking" | "coverup" | "retouch" | "aftercare" | "general" | "all">("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [aiStatus, setAiStatus] = useState("문의를 선택하고 AI 초안 생성을 누르면 답변이 채워집니다.");
  const [dbStatus, setDbStatus] = useState("DB 연결 확인 중입니다.");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizardDraft, setWizardDraft] = useState<OnboardingDraft>(() => createOnboardingDraft(defaultSettings));
  const [memberDraft, setMemberDraft] = useState({ name: "", email: "", role: "member" as WorkspaceRole });
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [intakeMode, setIntakeMode] = useState<"paste" | "form">("paste");
  const [formDraft, setFormDraft] = useState({
    customer: "",
    channel: "인스타 DM",
    message: "",
    tattooArea: "",
    tattooSize: "",
    tattooStyle: "" as TattooStyle | "",
    isCoverup: false,
    preferredDate: "",
  });

  useEffect(() => {
    setMounted(true);
    void bootstrap();
  }, []);

  // --- Derived state ---
  const selected = inquiries.find((i) => i.id === selectedId) ?? null;
  const userWorkspaces = workspaces.filter((w) => w.userId === selectedUserId);
  const activeWorkspace = userWorkspaces.find((w) => w.id === selectedWorkspaceId) ?? userWorkspaces[0] ?? null;
  const activeUser = users.find((u) => u.id === selectedUserId);
  const activeUserName = activeUser?.name ?? "현재 사용자";
  const activeUserEmail = activeUser?.email ?? "";
  const currentRole = activeWorkspace?.role;
  const permissionTemplate = (activeWorkspace?.profile ?? settings.businessProfile) as BusinessProfileKey;
  const canCreateInquiry = hasPermission(currentRole, "inquiry.create", permissionTemplate);
  const canUpdateInquiry = hasPermission(currentRole, "inquiry.update", permissionTemplate);
  const canDeleteInquiry = hasPermission(currentRole, "inquiry.delete", permissionTemplate);
  const canBulkDeleteInquiries = hasPermission(currentRole, "inquiry.bulk_delete", permissionTemplate);
  const canWriteKnowledge = hasPermission(currentRole, "knowledge.write", permissionTemplate);
  const canWriteSettings = hasPermission(currentRole, "settings.write", permissionTemplate);
  const canExportCsv = hasPermission(currentRole, "export.csv", permissionTemplate);
  const canRunSetup = canWriteSettings && canWriteKnowledge;
  const canManageMembers = hasPermission(currentRole, "member.manage", permissionTemplate);
  const accessCopies = {
    createInquiry: getPermissionAccessCopy(currentRole, permissionTemplate, "inquiry.create"),
    updateInquiry: getPermissionAccessCopy(currentRole, permissionTemplate, "inquiry.update"),
    deleteInquiry: getPermissionAccessCopy(currentRole, permissionTemplate, "inquiry.delete"),
    bulkDeleteInquiries: getPermissionAccessCopy(currentRole, permissionTemplate, "inquiry.bulk_delete"),
    writeKnowledge: getPermissionAccessCopy(currentRole, permissionTemplate, "knowledge.write"),
    writeSettings: getPermissionAccessCopy(currentRole, permissionTemplate, "settings.write"),
    manageMembers: getPermissionAccessCopy(currentRole, permissionTemplate, "member.manage"),
    exportCsv: getPermissionAccessCopy(currentRole, permissionTemplate, "export.csv"),
  };
  const activeViewMeta = appViews.find((v) => v.key === activeView) ?? appViews[0];
  const counts = useMemo(() => getCounts(inquiries), [inquiries]);
  const customerGroups = useMemo(() => getCustomerGroups(inquiries), [inquiries]);
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) ?? customers[0] ?? null;
  const selectedCustomerInquiries = selectedCustomer ? getCustomerInquiries(selectedCustomer, inquiries) : [];
  const visibleInquiries = useMemo(
    () =>
      inquiries.filter((i) => {
        const statusMatch = statusFilter === "all" || i.status === statusFilter;
        const categoryMatch = categoryFilter === "all" || i.category === categoryFilter;
        const customerMatch = customerFilter === "all" || getCustomerKey(i) === customerFilter;
        return statusMatch && categoryMatch && customerMatch;
      }),
    [categoryFilter, customerFilter, inquiries, statusFilter],
  );
  const summary = getSummary(inquiries, settings);
  const sidebarOpen = inquiries.filter((i) => isOpenInquiryStatus(i.status)).length;
  const sidebarUrgent = inquiries.filter((i) => i.priority === "긴급" && isOpenInquiryStatus(i.status)).length;
  const sidebarDepositPending = counts.deposit_pending;
  const sidebarBooked = counts.booked;
  const currentKnowledge = knowledge[settings.businessProfile] ?? defaultKnowledge[settings.businessProfile];

  // --- Actions ---
  function requestConfirm(action: ConfirmAction) {
    setConfirmAction(action);
  }

  function confirmPendingAction() {
    const action = confirmAction;
    if (!action) return;
    setConfirmAction(null);
    action.onConfirm();
  }

  async function bootstrap() {
    try {
      const authenticated = await loadSession();
      if (authenticated) await hydrateFromDatabase();
    } catch (error) {
      setDbStatus(error instanceof Error ? `초기 세션 로딩 실패: ${error.message}` : "초기 세션 로딩 실패");
      setIsLoading(false);
    }
  }

  function processInput() {
    if (!canCreateInquiry) {
      setDbStatus("문의 등록 권한이 없습니다.");
      return;
    }
    const lines = inputText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const created = lines.map((line) => createInquiry(line, settings, knowledge));
    setInquiries((current) => [...created, ...current]);
    setSelectedId(created[0]?.id ?? null);
    setInputText("");
    void saveInquiriesToDatabase(created);
  }

  function processFormInput() {
    if (!canCreateInquiry) {
      setDbStatus("문의 등록 권한이 없습니다.");
      return;
    }
    if (!formDraft.message.trim()) return;
    const line = formDraft.customer.trim()
      ? `${formDraft.customer} | ${formDraft.channel} | ${formDraft.message}`
      : formDraft.message;
    const tattoo: TattooFields = {
      tattooArea: formDraft.tattooArea || null,
      tattooSize: formDraft.tattooSize || null,
      tattooStyle: (formDraft.tattooStyle || null) as TattooStyle | null,
      isCoverup: formDraft.isCoverup,
      preferredDate: formDraft.preferredDate || null,
    };
    const created = [createInquiry(line, settings, knowledge, tattoo)];
    setInquiries((current) => [...created, ...current]);
    setSelectedId(created[0].id);
    setFormDraft({ customer: "", channel: "인스타 DM", message: "", tattooArea: "", tattooSize: "", tattooStyle: "", isCoverup: false, preferredDate: "" });
    void saveInquiriesToDatabase(created);
  }

  function updateSettings(next: Settings) {
    if (!canWriteSettings) {
      setDbStatus("워크스페이스 설정 변경은 대표 권한이 필요합니다.");
      return;
    }
    setSettings(next);
    void saveSettingsToDatabase(next);
  }

  function saveKnowledge(prices: string, faq: string) {
    if (!canWriteKnowledge) {
      setDbStatus("가격표/FAQ 변경 권한이 없습니다.");
      return;
    }
    setKnowledge({ ...knowledge, [settings.businessProfile]: { prices, faq } });
    void saveKnowledgeToDatabase(settings.businessProfile, prices, faq);
  }

  function updateInquiryStatus(id: string, status: Status) {
    if (!canUpdateInquiry) {
      setDbStatus("문의 상태 변경 권한이 없습니다.");
      return;
    }
    const next = inquiries.find((i) => i.id === id);
    if (!next) return;
    const updated = { ...next, status, timeline: appendTimeline(next, activeUserName, `상태 변경: ${statusLabels[status]}`) };
    setInquiries((current) => current.map((i) => (i.id === id ? updated : i)));
    void patchInquiryInDatabase(id, { status, timeline: updated.timeline });
    syncCustomerFromInquiryStatus(next, status);
  }

  // 문의 파이프라인 진행에 맞춰 연결된 고객 카드 상태를 자동 갱신한다.
  function syncCustomerFromInquiryStatus(inquiry: Inquiry, status: Status) {
    const mapped = customerStatusForInquiryStatus(status);
    if (!mapped || !inquiry.customerId) return;
    const target = customers.find((c) => c.id === inquiry.customerId);
    if (!target || target.status === mapped) return;
    setCustomers((current) => current.map((c) => (c.id === inquiry.customerId ? { ...c, status: mapped } : c)));
    void patchCustomerInDatabase(inquiry.customerId, { status: mapped });
  }

  function updateInquiryReply(id: string, reply: string) {
    if (!canUpdateInquiry) {
      setDbStatus("답변 수정 권한이 없습니다.");
      return;
    }
    const next = inquiries.find((i) => i.id === id);
    if (!next) return;
    const aiQuality = analyzeAiQuality(next.aiDraft || next.reply, reply, next.message);
    const replyRevisionLog = [
      {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        actor: activeUserName,
        changedChars: aiQuality.changedChars,
        forbiddenHits: aiQuality.forbiddenHits,
        summary: summarizeReplyRevision(next.aiDraft || next.reply, reply),
      },
      ...(next.replyRevisionLog ?? []),
    ].slice(0, 20);
    const updated = { ...next, reply, aiQuality, replyRevisionLog, timeline: appendTimeline(next, activeUserName, "답변 초안 수정") };
    setInquiries((current) => current.map((i) => (i.id === id ? updated : i)));
    void patchInquiryInDatabase(id, { reply, aiQuality, replyRevisionLog, timeline: updated.timeline });
  }

  function updateInquiryOperations(
    id: string,
    patch: Partial<Pick<Inquiry, "status" | "priority" | "assigneeId" | "internalNote" | "tattooArea" | "tattooSize" | "tattooStyle" | "isCoverup" | "sessionCount" | "quotedPrice" | "preferredDate">>,
    label: string,
  ) {
    if (!canUpdateInquiry) {
      setDbStatus("문의 운영 정보 변경 권한이 없습니다.");
      return;
    }
    const next = inquiries.find((i) => i.id === id);
    if (!next) return;
    const updated = { ...next, ...patch, timeline: appendTimeline(next, activeUserName, label) };
    setInquiries((current) => current.map((i) => (i.id === id ? updated : i)));
    void patchInquiryInDatabase(id, { ...patch, timeline: updated.timeline });
    if (patch.status) syncCustomerFromInquiryStatus(next, patch.status);
  }

  function updateCustomerProfile(id: string, patch: Partial<Pick<Customer, "status" | "tags" | "note" | "skinNotes">>) {
    if (!canUpdateInquiry) {
      setDbStatus("고객 프로필 변경 권한이 없습니다.");
      return;
    }
    setCustomers((current) => current.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    void patchCustomerInDatabase(id, patch);
  }

  function deleteInquiry(id: string) {
    if (!canDeleteInquiry) {
      setDbStatus("문의 삭제 권한이 없습니다.");
      return;
    }
    const next = inquiries.filter((i) => i.id !== id);
    setInquiries(next);
    setSelectedId(next[0]?.id ?? null);
    void deleteInquiryFromDatabase(id);
  }

  function clearInquiries() {
    if (!canBulkDeleteInquiries) {
      setDbStatus("전체 초기화는 대표 권한이 필요합니다.");
      return;
    }
    setInquiries([]);
    setSelectedId(null);
    void deleteInquiriesFromDatabase();
  }

  // --- API calls ---
  async function loadSession() {
    const response = await fetch("/api/session");
    if (!response.ok) throw new Error("세션 정보를 불러오지 못했습니다.");
    const payload = (await response.json()) as {
      authenticated?: boolean;
      currentUserId: string;
      currentWorkspaceId: string;
      users: DemoUser[];
      workspaces: DemoWorkspace[];
    };

    if (!payload.authenticated) {
      setIsAuthenticated(false);
      setUsers([]);
      setWorkspaces([]);
      setInquiries([]);
      setCustomers([]);
      setMembers([]);
      setSelectedId(null);
      setDbStatus("로그인이 필요합니다.");
      setIsLoading(false);
      return false;
    }

    const userId = payload.currentUserId || DEFAULT_USER_ID;
    const workspaceId = payload.currentWorkspaceId || DEFAULT_WORKSPACE_ID;
    const available = payload.workspaces.filter((w) => w.userId === userId);
    const nextWorkspaceId = available.some((w) => w.id === workspaceId) ? workspaceId : available[0]?.id || DEFAULT_WORKSPACE_ID;
    setUsers(payload.users);
    setWorkspaces(payload.workspaces);
    setSelectedUserId(userId);
    setSelectedWorkspaceId(nextWorkspaceId);
    setIsAuthenticated(true);
    return true;
  }

  async function submitAuth() {
    setIsLoading(true);
    setAuthStatus(authDraft.mode === "login" ? "로그인 중입니다." : "계정을 만드는 중입니다.");
    const endpoint = authDraft.mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(authDraft),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      setAuthStatus(payload.error || "인증에 실패했습니다.");
      setIsLoading(false);
      return;
    }

    setAuthStatus("로그인되었습니다.");
    const authenticated = await loadSession();
    if (authenticated) await hydrateFromDatabase();
    else setIsLoading(false);
  }

  async function logout() {
    setIsLoading(false);
    await fetch("/api/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
    setAuthStatus("로그아웃되었습니다.");
    setUsers([]);
    setWorkspaces([]);
    setInquiries([]);
    setCustomers([]);
    setMembers([]);
    setSelectedId(null);
    setSelectedCustomerId(null);
    setDbStatus("로그아웃되었습니다.");
  }

  async function hydrateFromDatabase() {
    setIsLoading(true);
    setDbStatus("DB에서 문의와 설정을 불러오는 중입니다.");

    try {
      const [settingsRes, knowledgeRes, inquiriesRes, customersRes, membersRes] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/knowledge"),
        fetch("/api/inquiries"),
        fetch("/api/customers"),
        fetch("/api/members"),
      ]);

      if (!settingsRes.ok || !knowledgeRes.ok || !inquiriesRes.ok || !customersRes.ok || !membersRes.ok) {
        throw new Error("DB API 응답이 올바르지 않습니다.");
      }

      const settingsPayload = (await settingsRes.json()) as { settings: Settings };
      const knowledgePayload = (await knowledgeRes.json()) as {
        knowledge: Array<{ profile: BusinessProfileKey; prices: string; faq: string }>;
      };
      const inquiriesPayload = (await inquiriesRes.json()) as { inquiries: Inquiry[] };
      const customersPayload = (await customersRes.json()) as { customers: Customer[] };
      const membersPayload = (await membersRes.json()) as { members: WorkspaceMember[] };

      const nextSettings = settingsPayload.settings ?? defaultSettings;
      const nextKnowledge = knowledgePayload.knowledge.reduce(
        (acc, item) => ({ ...acc, [item.profile]: { prices: item.prices, faq: item.faq } }),
        { ...defaultKnowledge },
      );

      setSettings(nextSettings);
      setKnowledge(nextKnowledge);
      setInquiries(inquiriesPayload.inquiries ?? []);
      setCustomers(customersPayload.customers ?? []);
      setMembers(membersPayload.members ?? []);
      setSelectedId(inquiriesPayload.inquiries?.[0]?.id ?? null);
      setWizardDraft(createOnboardingDraft(nextSettings));
      if (!localStorage.getItem(ONBOARDING_KEY)) setWizardOpen(true);
      setDbStatus("로컬 PostgreSQL에 연결되었습니다.");
    } catch (error) {
      setInquiries([]);
      setCustomers([]);
      setMembers([]);
      setSettings(defaultSettings);
      setKnowledge(defaultKnowledge);
      setSelectedId(null);
      setDbStatus(error instanceof Error ? `DB 연결 실패: ${error.message}` : "DB 연결 실패");
    } finally {
      setIsLoading(false);
    }
  }

  async function saveInquiriesToDatabase(next: Inquiry[]) {
    if (next.length === 0) return;
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inquiries: next }),
      });
      if (!res.ok) throw new Error("문의 저장 실패");
      await refreshCustomersFromDatabase();
      setDbStatus("문의가 DB에 저장되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "문의 저장 실패");
    }
  }

  async function saveSettingsToDatabase(next: Settings) {
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("설정 저장 실패");
      setDbStatus("설정이 DB에 저장되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "설정 저장 실패");
    }
  }

  async function saveKnowledgeToDatabase(profile: BusinessProfileKey, prices: string, faq: string) {
    try {
      const res = await fetch("/api/knowledge", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prices, faq }),
      });
      if (!res.ok) throw new Error("가격표/FAQ 저장 실패");
      setDbStatus("가격표/FAQ가 DB에 저장되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "가격표/FAQ 저장 실패");
    }
  }

  async function patchInquiryInDatabase(id: string, patch: Partial<Inquiry>) {
    try {
      const res = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("문의 수정 저장 실패");
      const payload = (await res.json()) as { inquiry: Inquiry };
      setInquiries((current) => current.map((i) => (i.id === id ? payload.inquiry : i)));
      setDbStatus("문의 수정 사항이 DB에 저장되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "문의 수정 저장 실패");
    }
  }

  async function patchCustomerInDatabase(id: string, patch: Partial<Pick<Customer, "status" | "tags" | "note" | "skinNotes">>) {
    try {
      const res = await fetch(`/api/customers/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("고객 프로필 저장 실패");
      const payload = (await res.json()) as { customer: Customer };
      setCustomers((current) =>
        current.map((c) =>
          c.id === id ? { ...c, ...payload.customer, inquiryCount: c.inquiryCount, lastInquiryAt: c.lastInquiryAt } : c,
        ),
      );
      setDbStatus("고객 프로필이 DB에 저장되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "고객 프로필 저장 실패");
    }
  }

  async function deleteInquiryFromDatabase(id: string) {
    try {
      const res = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("문의 삭제 실패");
      await refreshCustomersFromDatabase();
      setDbStatus("선택 문의가 DB에서 삭제되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "문의 삭제 실패");
    }
  }

  async function deleteInquiriesFromDatabase() {
    try {
      const res = await fetch("/api/inquiries", { method: "DELETE" });
      if (!res.ok) throw new Error("문의 초기화 실패");
      await refreshCustomersFromDatabase();
      setDbStatus("문의가 DB에서도 초기화되었습니다.");
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "문의 초기화 실패");
    }
  }

  async function refreshCustomersFromDatabase() {
    const res = await fetch("/api/customers");
    if (!res.ok) throw new Error("고객 목록 새로고침 실패");
    const payload = (await res.json()) as { customers: Customer[] };
    setCustomers(payload.customers ?? []);
  }

  async function refreshMembersFromDatabase() {
    const res = await fetch("/api/members");
    if (!res.ok) throw new Error("멤버 목록 새로고침 실패");
    const payload = (await res.json()) as { members: WorkspaceMember[] };
    setMembers(payload.members ?? []);
  }

  async function inviteMember() {
    if (!canManageMembers) { setDbStatus("멤버 관리는 대표 권한이 필요합니다."); return; }
    if (!memberDraft.email.trim()) { setDbStatus("초대할 이메일을 입력해주세요."); return; }
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(memberDraft),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setDbStatus(payload.error || "멤버 초대에 실패했습니다.");
      return;
    }
    setMemberDraft({ name: "", email: "", role: "member" });
    await loadSession();
    await refreshMembersFromDatabase();
    setDbStatus("멤버를 워크스페이스에 추가했습니다.");
  }

  async function updateMemberRole(userId: string, role: WorkspaceRole) {
    if (!canManageMembers) { setDbStatus("역할 변경은 대표 권한이 필요합니다."); return; }
    const res = await fetch(`/api/members/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setDbStatus(payload.error || "역할 변경에 실패했습니다.");
      return;
    }
    await loadSession();
    await refreshMembersFromDatabase();
    setDbStatus("멤버 역할을 변경했습니다.");
  }

  async function removeMember(userId: string) {
    if (!canManageMembers) { setDbStatus("멤버 제거는 대표 권한이 필요합니다."); return; }
    const res = await fetch(`/api/members/${encodeURIComponent(userId)}`, { method: "DELETE" });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setDbStatus(payload.error || "멤버 제거에 실패했습니다.");
      return;
    }
    await loadSession();
    await refreshMembersFromDatabase();
    setDbStatus("멤버를 워크스페이스에서 제거했습니다.");
  }

  async function selectSession(userId: string, workspaceId: string) {
    setIsLoading(true);
    const res = await fetch("/api/session/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, workspaceId }),
    });
    if (!res.ok) {
      setDbStatus("워크스페이스 접근 권한이 없습니다.");
      setIsLoading(false);
      return;
    }
    setSelectedUserId(userId);
    setSelectedWorkspaceId(workspaceId);
    await loadSession();
    await hydrateFromDatabase();
  }

  async function changeWorkspace(workspaceId: string) {
    await selectSession(selectedUserId, workspaceId);
  }

  function loadDefaultKnowledge() {
    if (!canWriteKnowledge) { setDbStatus("가격표/FAQ 기본값 적용은 대표 권한이 필요합니다."); return; }
    const defaults = defaultKnowledge[settings.businessProfile];
    setKnowledge((current) => ({ ...current, [settings.businessProfile]: defaults }));
    void saveKnowledgeToDatabase(settings.businessProfile, defaults.prices, defaults.faq);
  }

  async function resetWorkspaceDefaults() {
    if (!activeWorkspace || !canWriteSettings || !canWriteKnowledge) {
      setDbStatus("워크스페이스 기본값 복원은 대표 권한이 필요합니다.");
      return;
    }
    const nextSettings = workspaceDefaultSettings[activeWorkspace.profile];
    const defaults = defaultKnowledge[nextSettings.businessProfile];
    setSettings(nextSettings);
    setKnowledge((current) => ({ ...current, [nextSettings.businessProfile]: defaults }));
    setWizardDraft(createOnboardingDraft(nextSettings));
    try {
      await Promise.all([
        saveSettingsToDatabase(nextSettings),
        saveKnowledgeToDatabase(nextSettings.businessProfile, defaults.prices, defaults.faq),
      ]);
      setDbStatus(`${activeWorkspace.name} 기본 설정을 복원했습니다.`);
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "워크스페이스 기본 설정 복원에 실패했습니다.");
    }
  }

  async function generateAiReply(options?: { includeDeposit?: boolean; includeAftercare?: boolean }) {
    if (!selected) return;
    setAiStatus("AI 답변 초안을 생성하는 중입니다.");
    const profileKnowledge = knowledge[selected.profile] ?? knowledge[settings.businessProfile];
    const checklist = getConsultChecklist(selected);
    // 문의 유형과 생성 옵션에 맞는 지식베이스 섹션만 AI 컨텍스트로 넘긴다.
    const faqSections = parseFaqSections(profileKnowledge.faq);
    const relevantKeys = getRelevantFaqSectionKeys(selected.category, options);
    const faqContext = knowledgeSections
      .filter((section) => relevantKeys.includes(section.key) && faqSections[section.key].trim())
      .map((section) => `[${section.label}]\n${faqSections[section.key].trim()}`)
      .join("\n\n");
    const payload = {
      businessLabel: businessProfiles[selected.profile].label,
      toneLabel: toneProfiles[selected.tone].label,
      responseWindow: responseWindows[selected.responseWindow],
      customer: selected.customer,
      channel: selected.channel,
      categoryLabel: categoryLabels[selected.category],
      priority: selected.priority,
      message: selected.message,
      currentReply: selected.reply,
      prices: profileKnowledge.prices,
      faq: faqContext,
      tattooArea: selected.tattooArea ?? undefined,
      tattooSize: selected.tattooSize ?? undefined,
      tattooStyle: selected.tattooStyle ? (tattooStyleLabels[selected.tattooStyle] ?? selected.tattooStyle) : undefined,
      isCoverup: selected.isCoverup ?? undefined,
      sessionCount: selected.sessionCount ?? undefined,
      preferredDate: selected.preferredDate ?? undefined,
      missingInfo: checklist.missing.length > 0 ? checklist.missing : undefined,
      includeDeposit: options?.includeDeposit || undefined,
      includeAftercare: options?.includeAftercare || undefined,
    };

    const res = await fetch("/api/generate-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await readJsonResponse(res)) as { reply?: string; model?: string; error?: string };
    if (!res.ok || !result.reply) {
      setAiStatus(result.error || "AI 초안 생성에 실패했습니다.");
      return;
    }
    const updatedInquiry = {
      ...selected,
      reply: result.reply,
      aiDraft: result.reply,
      aiQuality: analyzeAiQuality(result.reply, result.reply, selected.message),
      aiGeneratedAt: new Date().toISOString(),
      aiModel: result.model ?? "server-configured",
      timeline: appendTimeline(selected, activeUserName, "AI 답변 초안 생성"),
    };
    setInquiries((current) => current.map((i) => (i.id === selected.id ? updatedInquiry : i)));
    void saveInquiriesToDatabase([updatedInquiry]);
    setAiStatus(`AI 초안을 생성했습니다. 사용 모델: ${result.model ?? "서버 설정"}`);
  }

  async function readJsonResponse(response: Response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { error: response.ok ? "응답을 해석하지 못했습니다." : text.slice(0, 300) };
    }
  }

  async function completeWizard() {
    if (!canRunSetup) {
      setDbStatus("초기 세팅 변경은 대표 권한이 필요합니다.");
      setWizardOpen(false);
      setWizardStep(1);
      return;
    }
    const nextSettings: Settings = {
      businessProfile: wizardDraft.businessProfile,
      toneProfile: wizardDraft.toneProfile,
      responseWindow: wizardDraft.responseWindow,
      channels: wizardDraft.channels,
      intakeFields: wizardDraft.intakeFields,
      welcomeMessage: wizardDraft.welcomeMessage,
      onboardingCompletedAt: new Date().toISOString(),
    };
    const nextKnowledge = {
      prices: wizardDraft.loadDefaults ? wizardDraft.prices : currentKnowledge.prices,
      faq: wizardDraft.loadDefaults ? wizardDraft.faq : currentKnowledge.faq,
    };
    setSettings(nextSettings);
    setKnowledge((current) => ({ ...current, [wizardDraft.businessProfile]: nextKnowledge }));
    try {
      await Promise.all([
        saveSettingsToDatabase(nextSettings),
        saveKnowledgeToDatabase(wizardDraft.businessProfile, nextKnowledge.prices, nextKnowledge.faq),
      ]);
      if (wizardDraft.inviteEmail.trim() && canManageMembers) {
        const res = await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: wizardDraft.inviteName, email: wizardDraft.inviteEmail, role: wizardDraft.inviteRole }),
        });
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "멤버 초대에 실패했습니다.");
        }
        await loadSession();
        await refreshMembersFromDatabase();
      }
      localStorage.setItem(ONBOARDING_KEY, new Date().toISOString());
      setDbStatus("워크스페이스 온보딩이 완료되었습니다.");
      setWizardOpen(false);
      setWizardStep(1);
    } catch (error) {
      setDbStatus(error instanceof Error ? error.message : "온보딩 저장에 실패했습니다.");
    }
  }

  // --- Render ---
  if (!isAuthenticated) {
    return (
      <AuthScreen
        draft={authDraft}
        status={authStatus || dbStatus}
        isLoading={isLoading}
        onDraftChange={setAuthDraft}
        onSubmit={() => void submitAuth()}
      />
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">I</div>
          <div>
            <h1>InkDesk</h1>
            <p>타투 상담 자동화</p>
          </div>
        </div>
        <nav className="nav">
          {appViews.map((view) => (
            <button
              key={view.key}
              className={`nav-item ${activeView === view.key ? "active" : ""}`}
              onClick={() => setActiveView(view.key)}
            >
              <span className="nav-copy">
                <strong>{view.label}</strong>
                <small>{view.description}</small>
              </span>
              {view.key === "inbox" && sidebarOpen > 0 && <span>{sidebarOpen}</span>}
              {view.key === "customers" && customers.length > 0 && <span>{customers.length}</span>}
            </button>
          ))}
        </nav>
        <div className="side-panel">
          <p className="label">상담 현황</p>
          <div className="summary-rows">
            <div className="summary-row"><span>응대 필요</span><strong>{sidebarOpen}건</strong></div>
            <div className="summary-row"><span>예약금 대기</span><strong>{sidebarDepositPending}건</strong></div>
            <div className="summary-row"><span>예약 확정</span><strong className="done">{sidebarBooked}건</strong></div>
            <div className="summary-row"><span>긴급</span><strong className="urgent">{sidebarUrgent}건</strong></div>
          </div>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">InkDesk</p>
            <h2>{activeViewMeta.label}</h2>
            <p className="workspace-note">
              {activeWorkspace
                ? `${activeWorkspace.name} · ${businessProfiles[activeWorkspace.profile].label} · ${activeViewMeta.description}`
                : "워크스페이스를 불러오는 중입니다."}
            </p>
          </div>
          <div className="actions" style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:'10px'}}>
            <div className="session-controls">
              <select value={selectedWorkspaceId} onChange={(e) => void changeWorkspace(e.target.value)} style={{height:'36px',borderRadius:'9px'}}>
                {userWorkspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
              <div className="session-user">
                <span className="avatar-topbar">{activeUserName.charAt(0)}</span>
                <div className="user-info">
                  <strong>{activeUserName}</strong>
                  {activeUserEmail && <span>{activeUserEmail}</span>}
                </div>
              </div>
            </div>
            <div style={{display:'flex',gap:'8px',flexWrap:'wrap',justifyContent:'flex-end'}}>
              <label className="file-button" style={{height:'32px',minHeight:'32px',padding:'0 13px',fontSize:'12px'}}>
                CSV 가져오기
                <input type="file" accept=".csv,text/csv" onChange={(e) => importCsv(e, settings, knowledge, (items) => {
                  setInquiries((current) => [...items, ...current]);
                  setSelectedId(items[0]?.id ?? null);
                  void saveInquiriesToDatabase(items);
                })} />
              </label>
              <button className="secondary" style={{height:'32px',minHeight:'32px',padding:'0 13px',fontSize:'12px'}} disabled={!canExportCsv} onClick={() => exportCsv(inquiries)}>
                CSV 내보내기
              </button>
              <button
                className="danger"
                style={{height:'32px',minHeight:'32px',padding:'0 13px',fontSize:'12px'}}
                disabled={!canBulkDeleteInquiries}
                onClick={() =>
                  requestConfirm({
                    title: "저장된 문의 전체 삭제",
                    message: "현재 워크스페이스의 모든 문의가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.",
                    confirmLabel: "전체 삭제",
                    tone: "danger",
                    onConfirm: clearInquiries,
                  })
                }
              >
                초기화
              </button>
              <button className="primary" style={{height:'32px',minHeight:'32px',padding:'0 14px',fontSize:'12px'}} disabled={!canRunSetup} onClick={() => setWizardOpen(true)}>
                초기 설정 마법사
              </button>
              <button className="secondary" style={{height:'32px',minHeight:'32px',padding:'0 13px',fontSize:'12px'}} onClick={() => void logout()}>
                로그아웃
              </button>
            </div>
          </div>
        </header>

        <div className={`db-banner ${isLoading ? "loading" : ""}`}>{dbStatus}</div>

        {activeView === "inbox" && (
          <>
            <section className="inbox-brief" aria-label="오늘 처리할 문의">
              <div>
                <p className="eyebrow">Today</p>
                <h3>오늘 처리할 상담</h3>
                <p>
                  응대 필요 {counts.open}건 · 예약금 대기 {counts.deposit_pending}건 · 예약 확정 {counts.booked}건입니다.
                </p>
              </div>
              <div className="brief-metrics">
                <Metric label="응대 필요" value={counts.open} />
                <Metric label="견적 안내" value={counts.quoted} />
                <Metric label="예약금 대기" value={counts.deposit_pending} />
                <Metric label="예약 확정" value={counts.booked} />
              </div>
            </section>

            <section className="quick-intake">
              <details>
                <summary>
                  <span>
                    <strong>새 문의 접수</strong>
                    <small>카카오톡, DM, 문자 문의를 정리합니다.</small>
                  </span>
                </summary>
                <div>
                  <div className="composer-head">
                    <div className="intake-tabs">
                      <button className={`intake-tab ${intakeMode === "form" ? "active" : ""}`} onClick={() => setIntakeMode("form")}>상담 접수 폼</button>
                      <button className={`intake-tab ${intakeMode === "paste" ? "active" : ""}`} onClick={() => setIntakeMode("paste")}>일괄 붙여넣기</button>
                    </div>
                  </div>

                  {intakeMode === "paste" && (
                    <>
                      <div className="composer-head">
                        <p>한 줄에 하나씩 붙여넣거나, 고객명 | 채널 | 문의 형식으로 넣을 수 있습니다.</p>
                        <button className="secondary" onClick={() => setInputText(sampleLines.join("\n"))}>
                          샘플 추가
                        </button>
                      </div>
                      <textarea
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="예: 김민지 | 인스타 DM | 손목에 레터링 타투 견적 부탁드립니다. 5cm 정도입니다."
                      />
                      <div className="composer-actions">
                        <button className="primary" disabled={!canCreateInquiry} onClick={processInput}>
                          문의 정리하기
                        </button>
                        <span>분류, 우선순위, 답변 초안이 자동 생성됩니다.</span>
                      </div>
                    </>
                  )}

                  {intakeMode === "form" && (
                    <>
                      <div className="intake-form-grid">
                        <label>
                          고객명
                          <input value={formDraft.customer} placeholder="김민지" onChange={(e) => setFormDraft({ ...formDraft, customer: e.target.value })} />
                        </label>
                        <label>
                          채널
                          <select value={formDraft.channel} onChange={(e) => setFormDraft({ ...formDraft, channel: e.target.value })}>
                            {(settings.channels.length > 0 ? settings.channels : channelOptions).map((ch) => <option key={ch} value={ch}>{ch}</option>)}
                            {settings.channels.length > 0 && !settings.channels.includes(formDraft.channel) && (
                              <option value={formDraft.channel}>{formDraft.channel}</option>
                            )}
                          </select>
                        </label>
                        <label>
                          시술 부위
                          <input value={formDraft.tattooArea} placeholder="예: 팔 안쪽, 손목" onChange={(e) => setFormDraft({ ...formDraft, tattooArea: e.target.value })} />
                        </label>
                        <label>
                          크기
                          <input value={formDraft.tattooSize} placeholder="예: 5x5cm" onChange={(e) => setFormDraft({ ...formDraft, tattooSize: e.target.value })} />
                        </label>
                        <label>
                          스타일
                          <select value={formDraft.tattooStyle} onChange={(e) => setFormDraft({ ...formDraft, tattooStyle: e.target.value as TattooStyle | "" })}>
                            <option value="">미지정</option>
                            {Object.entries(tattooStyleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                          </select>
                        </label>
                        <label>
                          희망 시술일
                          <input value={formDraft.preferredDate} placeholder="예: 7/20 오후, 다음주 토요일" onChange={(e) => setFormDraft({ ...formDraft, preferredDate: e.target.value })} />
                        </label>
                        <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "22px" }}>
                          <input type="checkbox" checked={formDraft.isCoverup} onChange={(e) => setFormDraft({ ...formDraft, isCoverup: e.target.checked })} />
                          커버업
                        </label>
                      </div>
                      <label style={{ display: "block", marginTop: "8px" }}>
                        문의 내용
                        <textarea
                          value={formDraft.message}
                          onChange={(e) => setFormDraft({ ...formDraft, message: e.target.value })}
                          placeholder="고객의 문의 내용을 입력하세요."
                          style={{ minHeight: "80px" }}
                        />
                      </label>
                      <div className="composer-actions">
                        <button className="primary" disabled={!canCreateInquiry || !formDraft.message.trim()} onClick={processFormInput}>
                          문의 접수
                        </button>
                        <span>시술 정보와 함께 분류, 답변 초안이 자동 생성됩니다.</span>
                      </div>
                    </>
                  )}
                </div>
              </details>
            </section>

            <section className="inbox-workflow">
              <div className="inquiry-list-panel">
                <div className="panel-head">
                  <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                    <strong style={{fontSize:'15px',fontWeight:800}}>처리 대기</strong>
                    <span className="badge category" style={{fontSize:'10.5px',fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' as const}}>Queue</span>
                  </div>
                  <div className="filter-row">
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value as Status | "all"); setSelectedId(null); }}
                    >
                      <option value="all">전체 문의 ({inquiries.length})</option>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label} ({counts[value as Status]})
                        </option>
                      ))}
                    </select>
                    <select value={customerFilter} onChange={(e) => { setCustomerFilter(e.target.value); setSelectedId(null); }}>
                      <option value="all">모든 고객</option>
                      {customerGroups.map((group) => (
                        <option key={group.key} value={group.key}>
                          {group.label} ({group.items.length})
                        </option>
                      ))}
                    </select>
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}>
                      <option value="all">모든 유형</option>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <InquiryList
                  inquiries={visibleInquiries}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onStatusChange={updateInquiryStatus}
                  canUpdate={canUpdateInquiry}
                  lockMessage={!canUpdateInquiry ? accessCopies.updateInquiry.body : undefined}
                />
              </div>

              <DetailPanel
                selected={selected}
                inquiries={inquiries}
                members={members}
                onCopy={() => selected && navigator.clipboard.writeText(selected.reply)}
                onSaveReply={updateInquiryReply}
                onUpdateOperations={updateInquiryOperations}
                onGenerateAi={(options) => void generateAiReply(options)}
                aiStatus={aiStatus}
                knowledgeReadiness={{
                  deposit: /예약금/.test(`${currentKnowledge.prices}\n${currentKnowledge.faq}`),
                  aftercare: /애프터케어|관리/.test(`${currentKnowledge.prices}\n${currentKnowledge.faq}`),
                }}
                onDelete={(id) =>
                  requestConfirm({
                    title: "문의 삭제",
                    message: "선택한 문의와 답변 초안을 삭제합니다.",
                    confirmLabel: "문의 삭제",
                    tone: "danger",
                    onConfirm: () => deleteInquiry(id),
                  })
                }
                canUpdate={canUpdateInquiry}
                canDelete={canDeleteInquiry}
                updateLock={accessCopies.updateInquiry}
                deleteLock={accessCopies.deleteInquiry}
              />
            </section>
          </>
        )}

        {activeView === "customers" && (
          <CustomerPanel
            customers={customers}
            selectedCustomer={selectedCustomer}
            selectedCustomerInquiries={selectedCustomerInquiries}
            onSelect={setSelectedCustomerId}
            onUpdate={updateCustomerProfile}
            canUpdate={canUpdateInquiry}
            lockMessage={!canUpdateInquiry ? accessCopies.updateInquiry : undefined}
          />
        )}

        {activeView === "knowledge" && (
          <KnowledgePanel
            profile={settings.businessProfile}
            knowledge={currentKnowledge}
            onSave={saveKnowledge}
            onLoadDefault={loadDefaultKnowledge}
            readOnly={!canWriteKnowledge}
            lockMessage={!canWriteKnowledge ? accessCopies.writeKnowledge : undefined}
          />
        )}

        {activeView === "settings" && (
          <SettingsPanel
            settings={settings}
            workspace={activeWorkspace}
            canWrite={canWriteSettings}
            canReset={!!activeWorkspace && !isLoading && canWriteSettings && canWriteKnowledge}
            lockMessage={!canWriteSettings ? accessCopies.writeSettings : undefined}
            resetLockMessage={!canRunSetup ? accessCopies.writeKnowledge : undefined}
            onChange={updateSettings}
            onReset={() => void resetWorkspaceDefaults()}
          />
        )}

        {activeView === "members" && (
          <MemberPanel
            members={members}
            draft={memberDraft}
            profile={permissionTemplate}
            canManage={canManageMembers}
            lockMessage={!canManageMembers ? accessCopies.manageMembers : undefined}
            onDraftChange={setMemberDraft}
            onInvite={() => void inviteMember()}
            onRoleChange={(userId, role) => void updateMemberRole(userId, role)}
            onRemove={(userId) =>
              requestConfirm({
                title: "멤버 제거",
                message: "선택한 멤버를 현재 워크스페이스에서 제거합니다.",
                confirmLabel: "멤버 제거",
                tone: "danger",
                onConfirm: () => void removeMember(userId),
              })
            }
          />
        )}

        {activeView === "report" && <DailyReport />}
      </main>

      {wizardOpen && (
        <SetupWizard
          step={wizardStep}
          draft={wizardDraft}
          onDraftChange={setWizardDraft}
          onClose={() => setWizardOpen(false)}
          onBack={() => setWizardStep((s) => Math.max(1, s - 1))}
          onNext={() => {
            if (wizardStep < 5) setWizardStep((s) => s + 1);
            else void completeWizard();
          }}
        />
      )}

      {confirmAction && (
        <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmPendingAction} />
      )}
    </div>
  );
}
