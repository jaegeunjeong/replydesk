import type { WorkspaceRole } from "@/lib/permissions";

export type Category = "quote" | "booking" | "coverup" | "retouch" | "aftercare" | "general";
export type Status =
  | "new"
  | "info_requested"
  | "quoted"
  | "deposit_pending"
  | "booked"
  | "completed"
  | "aftercare"
  | "closed";
export type BusinessProfileKey = "tattoo";
export type ToneKey = "warm" | "concise" | "premium";
export type ResponseWindowKey = "fast" | "same-day" | "next-business";
export type AppView = "inbox" | "customers" | "knowledge" | "settings" | "members" | "report";

export type TattooStyle = "blackwork" | "color" | "watercolor" | "lettering" | "linework" | "oriental" | "realism" | "newschool" | "tribal" | "other";
export type CustomerStatus = "new" | "consulted" | "booked" | "completed" | "returning";

export type InquiryTimelineItem = {
  id: string;
  at: string;
  actor: string;
  label: string;
};

export type AiQualityReport = {
  score: number;
  changedChars: number;
  changedRatio: number;
  forbiddenHits: string[];
  missingSignals: string[];
  checkedAt: string;
};

export type ReplyRevisionLogItem = {
  id: string;
  at: string;
  actor: string;
  changedChars: number;
  forbiddenHits: string[];
  summary: string;
};

export type Inquiry = {
  id: string;
  customerId?: string;
  customer: string;
  channel: string;
  message: string;
  category: Category;
  priority: "\uAE34\uAE09" | "\uBCF4\uD1B5";
  keywords: string[];
  reply: string;
  status: Status;
  createdAt: string;
  profile: BusinessProfileKey;
  tone: ToneKey;
  responseWindow: ResponseWindowKey;
  aiGeneratedAt?: string;
  aiModel?: string;
  aiDraft?: string | null;
  aiQuality?: AiQualityReport | null;
  replyRevisionLog?: ReplyRevisionLogItem[];
  assigneeId?: string | null;
  internalNote?: string | null;
  timeline?: InquiryTimelineItem[];
  tattooArea?: string | null;
  tattooSize?: string | null;
  tattooStyle?: TattooStyle | null;
  isCoverup?: boolean;
  sessionCount?: number | null;
  quotedPrice?: string | null;
  preferredDate?: string | null;
  hasReferenceImage?: boolean;
  referenceImageNote?: string | null;
  depositAmount?: string | null;
  depositPayerName?: string | null;
  depositPaidAt?: string | null;
  appointmentAt?: string | null;
  policyConfirmed?: boolean;
};

export type Settings = {
  businessProfile: BusinessProfileKey;
  toneProfile: ToneKey;
  responseWindow: ResponseWindowKey;
  channels: string[];
  intakeFields: string[];
  welcomeMessage: string;
  onboardingCompletedAt?: string | null;
};

export type OnboardingDraft = Settings & {
  loadDefaults: boolean;
  prices: string;
  faq: string;
  inviteName: string;
  inviteEmail: string;
  inviteRole: WorkspaceRole;
};

export type Knowledge = Record<BusinessProfileKey, { prices: string; faq: string }>;

export type Customer = {
  id: string;
  name: string;
  channel: string;
  contact?: string | null;
  status?: CustomerStatus;
  tags?: string[];
  note?: string | null;
  skinNotes?: string | null;
  normalizedKey?: string | null;
  inquiryCount: number;
  lastInquiryAt?: string | null;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
};

export type DemoWorkspace = {
  id: string;
  name: string;
  profile: BusinessProfileKey;
  userId: string;
  role: string;
};

export type WorkspaceMember = {
  id: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt?: string;
};

export type AuthDraft = {
  mode: "login" | "register";
  name: string;
  email: string;
  password: string;
  workspaceName: string;
};

export type ConfirmAction = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "danger" | "default";
  onConfirm: () => void;
};
