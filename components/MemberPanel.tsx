"use client";

import type { WorkspaceMember, BusinessProfileKey } from "@/types";
import type { WorkspaceRole } from "@/lib/permissions";
import { getRolePermissions, roleLabels, permissionLabels } from "@/lib/permissions";
import { businessProfiles, manageableRoles, roleDescriptions, rolePolicyTemplates } from "@/lib/constants";
import { PermissionNotice } from "@/components/shared";

export function MemberPanel({
  members,
  draft,
  profile,
  canManage,
  lockMessage,
  onDraftChange,
  onInvite,
  onRoleChange,
  onRemove,
}: {
  members: WorkspaceMember[];
  draft: { name: string; email: string; role: WorkspaceRole };
  profile: BusinessProfileKey;
  canManage: boolean;
  lockMessage?: { title: string; body: string };
  onDraftChange: (draft: { name: string; email: string; role: WorkspaceRole }) => void;
  onInvite: () => void;
  onRoleChange: (userId: string, role: WorkspaceRole) => void;
  onRemove: (userId: string) => void;
}) {
  const roleCounts = members.reduce<Record<string, number>>((acc, member) => {
    acc[member.role] = (acc[member.role] ?? 0) + 1;
    return acc;
  }, {});
  const policy = rolePolicyTemplates[profile];
  const policyRoles: WorkspaceRole[] = ["owner", "member"];

  return (
    <section className="member-panel">
      {lockMessage && <PermissionNotice title={lockMessage.title} body={lockMessage.body} />}
      <div className="member-head">
        <div>
          <p className="eyebrow">Team access</p>
          <h3>멤버 관리</h3>
          <p>{businessProfiles[profile].label} 운영 방식에 맞춘 권한 템플릿을 기준으로 멤버 역할을 관리합니다.</p>
          <div className="member-role-summary">
            {Object.entries(roleLabels).map(([role, label]) => (
              <span key={role}>
                {label} {roleCounts[role] ?? 0}
              </span>
            ))}
          </div>
        </div>
        <div className="member-invite">
          <input
            value={draft.name}
            disabled={!canManage}
            onChange={(e) => onDraftChange({ ...draft, name: e.target.value })}
            placeholder="이름"
          />
          <input
            value={draft.email}
            disabled={!canManage}
            onChange={(e) => onDraftChange({ ...draft, email: e.target.value })}
            placeholder="email@example.com"
          />
          <select
            value={draft.role}
            disabled={!canManage}
            onChange={(e) => onDraftChange({ ...draft, role: e.target.value as WorkspaceRole })}
          >
            {manageableRoles.map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
          <button className="primary" disabled={!canManage} title={!canManage ? "대표 권한 필요" : undefined} onClick={onInvite}>
            추가
          </button>
        </div>
      </div>

      <div className="role-policy-panel">
        <div className="role-policy-copy">
          <p className="eyebrow">Permission template</p>
          <h4>{policy.title}</h4>
          <p>{policy.description}</p>
          <strong>{policy.caution}</strong>
        </div>
        <div className="role-recommendations">
          {policy.recommended.map((item) => (
            <div key={item.role}>
              <span>{roleLabels[item.role]}</span>
              <strong>{item.count}</strong>
              <p>{item.note}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="permission-matrix" aria-label={`${businessProfiles[profile].label} 역할별 권한`}>
        {policyRoles.map((role) => {
          const allowed = getRolePermissions(role, profile);
          return (
            <div className="permission-role-card" key={role}>
              <div>
                <strong>{roleLabels[role]}</strong>
                <span>{roleDescriptions[role]}</span>
              </div>
              <div className="permission-chip-row">
                {allowed.map((permission) => (
                  <span key={permission}>{permissionLabels[permission]}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="member-list">
        {members.map((member) => {
          const roleIsLocked = member.role === "owner";
          return (
            <div className="member-row" key={member.id}>
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              <select
                value={member.role}
                disabled={!canManage || roleIsLocked}
                title={roleIsLocked ? "대표 역할은 여기서 변경할 수 없습니다." : !canManage ? "대표 권한 필요" : undefined}
                onChange={(e) => onRoleChange(member.id, e.target.value as WorkspaceRole)}
              >
                {member.role === "owner" && <option value="owner">{roleLabels.owner}</option>}
                {manageableRoles.map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              <button
                className="danger"
                disabled={!canManage || roleIsLocked}
                title={roleIsLocked ? "대표는 제거할 수 없습니다." : !canManage ? "대표 권한 필요" : undefined}
                onClick={() => onRemove(member.id)}
              >
                제거
              </button>
            </div>
          );
        })}
      </div>
      {!canManage && <div className="knowledge-status">권한이 있는 관리자에게 멤버 초대 또는 역할 변경을 요청하세요.</div>}
    </section>
  );
}
