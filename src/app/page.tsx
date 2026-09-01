"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { createIncident, getIncidents } from "@/app/actions/incident";
import { deleteIncident, logoutAction, resolveIncident } from "./actions";
import { sendInviteEmail } from "./actions/invite";
import { getMembers, requestDeleteMemberOTP, verifyAndDeleteMember, requestRoleChangeOTP, verifyAndUpdateMemberRole, requestMfaSetupOTP, verifyMfaSetupOTP, updatePresence } from "./actions/member";
import { getActiveSessionIp, getCurrentUserProfile, updateUserPassword, updateUserProfile } from "./actions/profile";
import { supabase } from "@/lib/supabaseClient";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  CircleCheck,
  Clock3,
  FileWarning,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Users,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface Incident {
  id: string;
  databaseId?: string;
  title: string;
  asset: string;
  owner: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Investigating" | "Contained" | "Open" | "Resolved";
  time: string;
}

interface TeamMember {
  id?: string;
  name: string;
  email: string;
  role: string;
  mfa: "Active" | "Pending";
  status: "Online" | "Offline" | "Invited";
  initials: string;
}

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Incidents", icon: AlertTriangle, countKey: "incidents" },
  { label: "Assets", icon: PackageSearch, count: "248" },
  { label: "Team access", icon: Users, countKey: "members" },
];

const severityColors: Record<string, string> = {
  Critical: "bg-rose-500/10 text-rose-400 border border-rose-500/20",
  High: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  Medium: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
  Low: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
};

function normalizeRealtimeIncident(record: Record<string, unknown>): Incident {
  const statusValue = String(record.status ?? "Open").toLowerCase();
  const severityValue = String(record.severity ?? "Medium").toLowerCase();
  const status = (statusValue.charAt(0).toUpperCase() + statusValue.slice(1)) as Incident["status"];
  const severity = (severityValue.charAt(0).toUpperCase() + severityValue.slice(1)) as Incident["severity"];

  return {
    id: String(record.incidentId ?? record.id ?? "UNKNOWN"),
    databaseId: String(record.id ?? ""),
    title: String(record.title ?? "Untitled incident"),
    asset: String(record.asset ?? "Unknown asset"),
    owner: String(record.owner ?? "Ariel Reyhandy"),
    severity,
    status,
    time: String(record.time ?? "Just now"),
  };
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [currentTab, setCurrentTab] = useState<"dashboard" | "profile" | "settings">("dashboard");
  const [incidentsList, setIncidentsList] = useState<Incident[]>([]);
  const [membersList, setMembersList] = useState<TeamMember[]>([]);
  const [currentUser, setCurrentUser] = useState({ name: "Memuat...", email: "", role: "VIEWER" });
  const [activeSessionIp, setActiveSessionIp] = useState("Mendeteksi...");
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isPending, startTransition] = useTransition();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [isIncidentModalOpen, setIsIncidentModalOpen] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ title: "", asset: "", severity: "Medium" as Incident["severity"] });
  const [incidentFormError, setIncidentFormError] = useState<string | null>(null);
  const [incidentToDelete, setIncidentToDelete] = useState<Incident | null>(null);
  const [isDeletingIncident, setIsDeletingIncident] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteErrorMessage, setInviteErrorMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamMember | null>(null);
  const [deleteAdminEmail, setDeleteAdminEmail] = useState("");
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdmin = currentUser.role === "ADMIN";
  const [roleTarget, setRoleTarget] = useState<TeamMember | null>(null);
  const [roleValue, setRoleValue] = useState("VIEWER");
  const [roleOtp, setRoleOtp] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);
  const [mfaModalOpen, setMfaModalOpen] = useState(false);
  const [mfaOtp, setMfaOtp] = useState("");
  const [mfaError, setMfaError] = useState<string | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => setResendCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    let active = true;
    const loadIncidents = async () => {
      try {
        const incidents = await getIncidents();
        if (active) {
          // Explicit mapping to avoid TypeScript coercion errors
          setIncidentsList(incidents.map((incident: any) => ({
            id: String(incident.incidentId ?? incident.id ?? "UNKNOWN"),
            databaseId: String(incident.id ?? ""),
            title: String(incident.title ?? "Untitled"),
            asset: String(incident.asset ?? "Unknown asset"),
            owner: String(incident.user?.name ?? incident.owner ?? "SOC Lead"),
            severity: (incident.severity ?? "Medium") as Incident["severity"],
            status: (incident.status ?? "Open") as Incident["status"],
            time: String(incident.time ?? "Just now"),
          })));
        }
      } catch (error) {
        console.error("Incident loading failed", error);
        if (active) showToast("Data insiden tidak dapat dimuat.", "error");
      }
    };

    void loadIncidents();
    if (!supabase) return () => { active = false; };
    const realtimeClient = supabase;

    const channel = realtimeClient
      .channel("realtime-incidents")
      .on("postgres_changes", { event: "*", schema: "public", table: "Incident" }, (payload) => {
        console.log("[Realtime Incident Event]", payload);
        const eventRecord = payload.eventType === "DELETE" ? payload.old : payload.new;
        const databaseId = String(eventRecord.id ?? "");

        if (payload.eventType === "INSERT") {
          const incident = normalizeRealtimeIncident(payload.new);
          if (incident.status !== "Resolved") {
            setIncidentsList((current) => current.some((item) => item.databaseId === databaseId) ? current : [incident, ...current]);
            showToast(`Insiden baru terdeteksi: ${incident.title}`);
          }
        } else if (payload.eventType === "UPDATE") {
          const incident = normalizeRealtimeIncident(payload.new);
          setIncidentsList((current) => incident.status === "Resolved"
            ? current.filter((item) => item.databaseId !== databaseId)
            : current.map((item) => item.databaseId === databaseId ? incident : item));
        } else if (payload.eventType === "DELETE") {
          setIncidentsList((current) => current.filter((item) => item.databaseId !== databaseId));
        }
      })
      .subscribe((status) => console.log("[Realtime Incidents]", status));

    return () => {
      active = false;
      void realtimeClient.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const heartbeat = window.setInterval(() => void updatePresence(), 30_000);
    void updatePresence();
    const source = new EventSource("/api/presence");
    source.addEventListener("presence", (event) => {
      const updates = JSON.parse((event as MessageEvent).data) as Array<{ id: string; status: TeamMember["status"] }>;
      setMembersList((current) => current.map((member) => {
        const update = updates.find((item) => item.id === member.id);
        return update && member.status !== "Invited" ? { ...member, status: update.status } : member;
      }));
    });
    return () => { window.clearInterval(heartbeat); source.close(); };
  }, []);

  useEffect(() => {
    let active = true;
    getCurrentUserProfile().then((result) => {
      if (active && result.success) setCurrentUser(result.user);
    }).catch((error) => console.error("Profile loading failed", error));

    getMembers().then((result) => {
      if (!active) return;
      if (!result.success) {
        showToast(result.error ?? "Data member tidak dapat dimuat.");
        return;
      }
      setMembersList(result.data);
    }).catch((error) => {
      console.error("Member loading failed", error);
      if (active) showToast("Data member tidak dapat dimuat.");
    });
    return () => { active = false; };
  }, []);

  const filteredIncidents = incidentsList.filter((item) =>
    `${item.title} ${item.asset} ${item.id} ${item.owner}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const profileName = currentUser.name;
  const profileEmail = currentUser.email;
  const profileInitials = profileName
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || profileEmail.slice(0, 2).toUpperCase();

  useEffect(() => {
    let active = true;
    getActiveSessionIp().then((result) => {
      if (active) setActiveSessionIp(result.ip);
    });
    return () => { active = false; };
  }, []);

  const closeIncidentModal = () => {
    setIncidentForm({ title: "", asset: "", severity: "Medium" });
    setIncidentFormError(null);
    setIsIncidentModalOpen(false);
  };

  // Sanitized Create Incident Handler
  const handleCreateIncident = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setIncidentFormError(null);

    try {
      const title = incidentForm.title.trim().replace(/[<>]/g, "");
      const asset = incidentForm.asset.trim().replace(/[<>]/g, "").toUpperCase();
      const severity = incidentForm.severity || "Medium";

      if (!title || !asset) {
        const message = "Judul insiden dan aset terdampak wajib diisi.";
        setIncidentFormError(message);
        showToast(message, "error");
        return;
      }

      if (!/^[A-Z0-9._-]{2,80}$/.test(asset)) {
        const message = "Format aset tidak valid. Gunakan huruf, angka, titik, underscore, atau dash (contoh: PROD-DB-01).";
        setIncidentFormError(message);
        showToast(message, "error");
        return;
      }

      const formData = new FormData();
      formData.set("title", title);
      formData.set("asset", asset);
      formData.set("severity", severity);

      const result = await createIncident(formData);

      if (!result.success) {
        const message = result.error ?? "Insiden tidak dapat disimpan.";
        setIncidentFormError(message);
        showToast(message, "error");
        return;
      }

      const inc = result.incident as any;
      const newInc: Incident = {
        id: String(inc.incidentId ?? inc.id ?? "INC-NEW"),
        databaseId: String(inc.id ?? ""),
        title: String(inc.title ?? title),
        asset: String(inc.asset ?? asset),
        owner: String(inc.user?.name ?? inc.owner ?? "SOC Lead"),
        severity: (inc.severity ?? severity) as Incident["severity"],
        status: (inc.status ?? "Open") as Incident["status"],
        time: String(inc.time ?? "Just now"),
      };

      setIncidentsList((current) => [newInc, ...current.filter((item) => item.databaseId !== newInc.databaseId)]);
      closeIncidentModal();
      showToast(`Insiden ${newInc.id} berhasil dicatat.`);
    } catch (error) {
      console.error("Incident submission failed", error);
      const message = "Insiden tidak dapat disimpan. Silakan coba lagi.";
      setIncidentFormError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIncident = async () => {
    if (!incidentToDelete?.databaseId) return;

    setIsDeletingIncident(true);
    try {
      const result = await deleteIncident(incidentToDelete.databaseId);
      if (!result.success) {
        showToast(result.error ?? "Insiden tidak dapat dihapus.", "error");
        return;
      }

      setIncidentsList((current) => current.filter((incident) => incident.id !== incidentToDelete.id));
      setIncidentToDelete(null);
      showToast("Insiden berhasil dihapus.");
    } catch (error) {
      console.error("Incident deletion failed", error);
      showToast("Insiden tidak dapat dihapus.", "error");
    } finally {
      setIsDeletingIncident(false);
    }
  };

  // Sanitized Add Member Handler
  const handleInviteMember = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    setIsSubmitting(true);
    setInviteErrorMessage(null);

    try {
      const formData = new FormData(form);
      const name = String(formData.get("name") ?? "").trim().replace(/[<>]/g, "");
      const email = String(formData.get("email") ?? "").trim().toLowerCase();
      const role = String(formData.get("role") ?? "Viewer");

      if (!name || !email) {
        const message = "Mohon isi nama dan alamat email dengan format yang benar.";
        setInviteErrorMessage(message);
        showToast(message, "error");
        return;
      }

      formData.set("name", name);
      formData.set("email", email);
      formData.set("role", role || "Viewer");

      const result = await sendInviteEmail(formData);
      if (!result.success) {
        const message = result.error ?? "Undangan gagal dikirim.";
        setInviteErrorMessage(message);
        showToast(message, "error");
        return;
      }

      const refreshedMembers = await getMembers();
      if (refreshedMembers.success) {
        setMembersList(refreshedMembers.data);
      } else {
        if (!result.data) {
          const message = "Member berhasil dibuat, tetapi data tabel belum dapat dimuat.";
          setInviteErrorMessage(message);
          showToast(message, "error");
          return;
        }
        const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
        setMembersList((current) => [...current, {
          id: result.data.id,
          name,
          email,
          role: role || "Viewer",
          mfa: "Pending",
          status: "Invited",
          initials: initials || "US",
        }]);
      }

      form.reset();
      setIsInviteModalOpen(false);
      showToast("Undangan berhasil dikirim dan member telah ditambahkan.");
    } catch (error) {
      console.error("Invite submission failed", error);
      const message = "Undangan gagal dikirim. Silakan coba lagi.";
      setInviteErrorMessage(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestDelete = async (member: TeamMember) => {
    if (!member.id) {
      showToast("Member ini belum memiliki ID database.");
      return;
    }
    setIsSubmitting(true);
    setDeleteError(null);
    try {
      const result = await requestDeleteMemberOTP(member.id);
      if (!result.success) {
        showToast(result.error ?? "OTP gagal dikirim.");
        return;
      }
      setDeleteTarget(member);
      setDeleteAdminEmail(result.adminEmail ?? "");
      setDeleteOtp("");
      setResendCountdown(30);
      showToast(`OTP dikirim ke ${member.email}`);
    } catch (error) {
      console.error("Delete OTP request failed", error);
      showToast("OTP gagal dikirim.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendDeleteOtp = async () => {
    if (!deleteTarget || resendCountdown > 0) return;
    await handleRequestDelete(deleteTarget);
  };

  const handleConfirmDelete = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deleteTarget?.id) return;
    setIsSubmitting(true);
    setDeleteError(null);
    try {
      const result = await verifyAndDeleteMember(deleteTarget.id, deleteOtp);
      if (!result.success) {
        setDeleteError(result.error ?? "Kode OTP tidak valid.");
        return;
      }
      setMembersList((current) => current.filter((member) => member.id !== deleteTarget.id));
      setDeleteTarget(null);
      setDeleteAdminEmail("");
      setDeleteOtp("");
      showToast(`${deleteTarget.name} berhasil dihapus.`);
    } catch (error) {
      console.error("Member deletion failed", error);
      setDeleteError("Member tidak dapat dihapus.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestRoleChange = async (member: TeamMember, nextRole: string) => {
    if (!isAdmin || !member.id || nextRole === member.role.toUpperCase()) return;
    setIsSubmitting(true);
    setRoleError(null);
    try {
      const result = await requestRoleChangeOTP(member.id, nextRole);
      if (!result.success) {
        showToast(result.error ?? "OTP gagal dikirim.", "error");
        return;
      }
      setRoleTarget(member);
      setRoleValue(nextRole);
      setRoleOtp("");
      setResendCountdown(30);
      showToast(`OTP dikirim ke ${result.adminEmail}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRoleChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roleTarget?.id) return;
    setIsSubmitting(true);
    setRoleError(null);
    try {
      const result = await verifyAndUpdateMemberRole(roleTarget.id, roleValue, roleOtp);
      if (!result.success) {
        setRoleError(result.error ?? "Kode OTP tidak valid.");
        return;
      }
      const label = roleValue === "ADMIN" ? "Administrator" : roleValue === "RESPONDER" ? "Responder" : "Viewer";
      const roleRank: Record<string, number> = { Administrator: 0, Responder: 1, Viewer: 2 };
      setMembersList((current) => current.map((member) => member.id === roleTarget.id ? { ...member, role: label } : member).sort((a, b) => (roleRank[a.role] ?? 99) - (roleRank[b.role] ?? 99) || a.name.localeCompare(b.name)));
      setRoleTarget(null);
      setRoleOtp("");
      showToast(`Role ${roleTarget.name} berhasil diubah.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestMfaSetup = async () => {
    setIsSubmitting(true);
    setMfaError(null);
    try {
      const result = await requestMfaSetupOTP();
      if (!result.success) {
        showToast(result.error ?? "OTP MFA gagal dikirim.", "error");
        return;
      }
      setMfaOtp("");
      setMfaModalOpen(true);
      showToast(`OTP MFA dikirim ke ${result.email}.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmMfa = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMfaError(null);
    try {
      const result = await verifyMfaSetupOTP(mfaOtp);
      if (!result.success) {
        setMfaError(result.error ?? "Kode OTP tidak valid.");
        return;
      }
      setMembersList((current) => current.map((member) => member.email === currentUser.email ? { ...member, mfa: "Active" } : member));
      setMfaModalOpen(false);
      showToast("MFA berhasil diaktifkan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#070d12] text-slate-100 selection:bg-emerald-500/30 font-sans">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed right-6 top-6 z-50 flex items-center gap-3 rounded-xl border bg-[#0c1920]/95 px-4 py-3 text-sm shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-200 ${toastType === "error" ? "border-rose-500/30 text-rose-300" : "border-emerald-500/30 text-emerald-300"}`} role="status" aria-live="polite">
          {toastType === "error" ? <AlertCircle size={18} className="text-rose-400 shrink-0" /> : <CircleCheck size={18} className="text-emerald-400 shrink-0" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-[250px] border-r border-slate-800/80 bg-[#09131a]/95 px-5 py-6 shadow-2xl backdrop-blur-md lg:flex lg:flex-col lg:justify-between">
        <div>
          <div className="flex items-center gap-3 px-2">
            <div className="grid size-9 place-items-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-inner">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[.2em] text-emerald-500/80">Northstar</p>
              <p className="text-sm font-semibold tracking-tight text-white">Security Console</p>
            </div>
          </div>

          <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">Workspace</div>
          <nav className="mt-3 space-y-1.5">
            {navItems.map(({ label, icon: Icon, count, countKey }) => {
              const displayCount = countKey === "incidents" ? incidentsList.length : countKey === "members" ? membersList.length : count;
              const isActive = activeNav === label;
              return (
                <button
                  key={label}
                  disabled={isPending}
                  onClick={() => startTransition(() => { setActiveNav(label); setCurrentTab("dashboard"); })}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all duration-150 active:scale-[0.98] ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm"
                      : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon size={17} strokeWidth={1.8} className={isActive ? "text-emerald-400" : "text-slate-400"} />
                    {label}
                  </span>
                  {displayCount && (
                    <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400 border border-slate-700/60">
                      {displayCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-10 px-2 text-[10px] font-bold uppercase tracking-[.18em] text-slate-500">System</div>
          <button
            onClick={() => setCurrentTab("settings")}
            className="mt-3 flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium text-slate-400 transition-all hover:bg-slate-800/60 hover:text-slate-200"
          >
            <SlidersHorizontal size={17} strokeWidth={1.8} />
            Settings
          </button>
        </div>

        {/* User Card */}
        <div ref={userMenuRef} className="relative border-t border-slate-800/80 pt-4 px-2">
          {isUserMenuOpen && (
            <div className="absolute bottom-full left-2 right-2 z-40 mb-2 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/30">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="truncate text-xs font-semibold text-white">{profileName}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-400">{profileEmail}</p>
                <span className="mt-2 inline-flex items-center rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  {currentUser.role === "ADMIN" ? "Administrator" : currentUser.role === "RESPONDER" ? "Responder" : "Viewer"}
                </span>
              </div>
              <div className="p-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setCurrentTab("profile");
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
                >
                  <UserRound size={15} className="text-slate-400" />
                  Account Settings
                </button>
                <div className="my-1 border-t border-slate-800" />
                <button
                  type="button"
                  onClick={() => void logoutAction()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-400 transition hover:bg-rose-500/10 hover:text-rose-300"
                >
                  <LogOut size={15} />
                  Sign Out
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((open) => !open)}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-slate-800/60"
          >
            <div className="grid size-8 shrink-0 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/20 text-xs font-bold text-emerald-300">
              {profileInitials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{profileName}</p>
              <p className="truncate text-[11px] text-slate-500">{profileEmail}</p>
            </div>
            <ChevronDown className={`ml-auto shrink-0 text-slate-500 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`} size={15} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="lg:pl-[250px]">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-800/80 bg-[#09131a]/80 px-6 backdrop-blur-md lg:px-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/80">Operations / {activeNav}</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-white flex items-center gap-2">
              Console Overview <span className="text-slate-600">/</span> <span className="text-xs font-normal text-slate-400">SOC Live Monitoring</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => showToast("Semua channel log dalam kondisi normal.")}
              className="relative grid size-9 place-items-center rounded-lg border border-slate-800 bg-slate-900/60 text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-95"
              aria-label="Notifications"
            >
              <Bell size={17} />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-[#09131a]" />
            </button>
            <button
              onClick={() => setIsIncidentModalOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-3.5 py-2 text-xs font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              <Plus size={15} strokeWidth={2.5} />
              New incident
            </button>
          </div>
        </header>

        {/* Mobile Navigation */}
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 bg-slate-950 px-5 py-2 lg:hidden">
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              disabled={isPending}
              onClick={() => startTransition(() => { setActiveNav(label); setCurrentTab("dashboard"); })}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeNav === label ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "text-slate-400"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>

        {/* Views Router */}
        <div className="mx-auto max-w-[1400px] px-6 py-8 lg:px-10">
          {currentTab === "dashboard" && activeNav === "Overview" && (
            <div className="space-y-8 animate-in fade-in duration-150">
              {/* Posture Header */}
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                    Perimeter Secured · 0 active breaches
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-white">Security Posture</h2>
                  <p className="mt-1 text-xs text-slate-400">Status perlindungan infrastruktur dan antrean insiden aktif.</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-400">
                  <Clock3 size={13} className="text-slate-400" />
                  Synced with Supabase Cloud
                </div>
              </div>

              {/* Metric Cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Open incidents" value={incidentsList.length.toString()} delta="2 high priority" icon={FileWarning} tone="rose" />
                <MetricCard label="Protected assets" value="248" delta="99.2% uptime" icon={PackageSearch} tone="emerald" />
                <MetricCard label="Critical findings" value="01" delta="Firewall port probe" icon={AlertTriangle} tone="amber" />
                <MetricCard label="Mean response time" value="12m" delta="↓ 25% this month" icon={ShieldCheck} tone="cyan" />
              </div>

              {/* Central Grid */}
              <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
                {/* Incident Table Card */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-xl">
                  <div className="flex flex-col gap-4 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Active Incident Queue</h3>
                      <p className="text-[11px] text-slate-400">Daftar kejadian keamanan yang memerlukan mitigasi</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          maxLength={50}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Filter insiden..."
                          className="h-8 w-36 sm:w-48 rounded-lg border border-slate-800 bg-slate-950/80 pl-8 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[550px] text-left text-xs">
                      <thead className="bg-slate-950/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/60">
                        <tr>
                          <th className="px-5 py-3">Incident</th>
                          <th className="px-3 py-3">Severity</th>
                          <th className="px-3 py-3">Status</th>
                          <th className="px-3 py-3">Owner</th>
                          <th className="px-5 py-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredIncidents.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                              Tidak ada insiden yang cocok dengan filter pencarian.
                            </td>
                          </tr>
                        ) : (
                          filteredIncidents.map((incident: Incident) => (
                            <tr key={incident.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="px-5 py-3.5">
                                <div className="font-semibold text-slate-200">{incident.title}</div>
                                <div className="font-mono text-[10px] text-slate-500 mt-0.5">
                                  {incident.id} · <span className="text-slate-400">{incident.asset}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3.5">
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${severityColors[incident.severity]}`}>
                                  {incident.severity}
                                </span>
                              </td>
                              <td className="px-3 py-3.5 text-slate-300">
                                <span className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-400" />
                                {incident.status}
                              </td>
                              <td className="px-3 py-3.5 text-slate-400">{incident.owner}</td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  onClick={async () => {
                                    const result = await resolveIncident(incident.databaseId ?? incident.id);
                                    if (!result.ok) {
                                      showToast(result.message);
                                      return;
                                    }
                                    setIncidentsList((current) => current.filter((i) => i.id !== incident.id));
                                    showToast(`${incident.id} ditandai sebagai Resolved.`);
                                  }}
                                  className="text-xs text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-all"
                                  title="Resolve & Remove"
                                >
                                  <CheckCircle2 size={15} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Perimeter Shield Card */}
                <div className="rounded-xl border border-slate-800/80 bg-[#0c1b22] p-6 text-slate-100 flex flex-col justify-between shadow-xl">
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">Access Perimeter</p>
                      <div className="grid size-9 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <LockKeyhole size={16} />
                      </div>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-white">Strict Identity Isolation</h3>
                    <p className="mt-1 text-xs text-slate-400">Proteksi Zero-Trust aktif pada seluruh subnet gateway.</p>

                    <div className="mt-6 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Security Policy Adherence</span>
                        <span className="font-mono font-bold text-emerald-400">96%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full w-[96%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" />
                      </div>
                    </div>

                    <div className="mt-6 space-y-2.5 border-t border-slate-800 pt-4 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400">MFA Policy Enforcement</span>
                        <span className="font-semibold text-white">100% Enforced</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Direct SQL Database Access</span>
                        <span className="font-semibold text-emerald-400">Blocked (Pooled)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Privileged Roles</span>
                        <span className="font-semibold text-slate-300">2 Accounts</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => showToast("Perimeter audit log: All policies enforced.")}
                    className="mt-6 w-full rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 py-2 text-xs font-semibold text-emerald-300 transition-all active:scale-[0.98]"
                  >
                    Run Policy Verification →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Incidents View */}
          {currentTab === "dashboard" && activeNav === "Incidents" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Incident Management</h2>
                  <p className="text-xs text-slate-400">Total {incidentsList.length} rekaman ancaman terdeteksi.</p>
                </div>
                <button
                  onClick={() => setIsIncidentModalOpen(true)}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  <Plus size={15} /> Add Incident
                </button>
              </div>

              <div className="grid gap-3">
                {incidentsList.map((inc: Incident) => (
                  <div key={inc.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="grid size-9 place-items-center rounded-lg bg-slate-800 text-rose-400 border border-slate-700">
                        <AlertCircle size={17} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{inc.title}</p>
                        <p className="text-xs text-slate-500 font-mono">{inc.id} · Asset: {inc.asset} · Owner: {inc.owner}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-md px-2.5 py-1 text-xs font-semibold ${severityColors[inc.severity]}`}>
                        {inc.severity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIncidentToDelete(inc)}
                        disabled={isDeletingIncident}
                        title="Hapus insiden"
                        aria-label={`Hapus insiden ${inc.id}`}
                        className="grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assets View */}
          {currentTab === "dashboard" && activeNav === "Assets" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Protected Assets</h2>
                <p className="text-xs text-slate-400">Inventaris server, gateway, dan workstation perusahaan.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {["WS-FIN-044 · Windows Workstation", "VPN-GATEWAY-01 · IPsec Firewall", "MBP-OPS-019 · macOS Engineer", "API-PROD-EU · Node.js Cluster", "DB-SUPABASE-SG · PostgreSQL Cloud"].map((asset, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 p-4">
                    <div className="flex items-center gap-3">
                      <PackageSearch size={18} className="text-emerald-400" />
                      <span className="text-xs font-medium text-slate-200">{asset}</span>
                    </div>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">
                      Protected
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Access View */}
          {currentTab === "dashboard" && activeNav === "Team access" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white">Team Access & RBAC</h2>
                  <p className="text-xs text-slate-400">Kelola otorisasi akun dan kepatuhan autentikasi MFA.</p>
                </div>
                {isAdmin && <button
                  onClick={() => {
                    setInviteErrorMessage(null);
                    setIsInviteModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition"
                >
                  <Plus size={15} /> Invite Member
                </button>}
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Member</th>
                      <th className="px-3 py-3">Role</th>
                      <th className="px-3 py-3">MFA Status</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {membersList.map((m: TeamMember) => (
                      <tr key={m.email} className="hover:bg-slate-800/30">
                        <td className="px-5 py-3.5 flex items-center gap-3">
                          <div className="grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-bold text-[10px]">
                            {m.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{m.name}</div>
                            <div className="text-[11px] text-slate-500">{m.email}</div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-slate-300">
                          {isAdmin ? <select value={m.role === "Administrator" ? "ADMIN" : m.role === "Responder" ? "RESPONDER" : "VIEWER"} onChange={(event) => void handleRequestRoleChange(m, event.target.value)} disabled={isSubmitting} className="rounded-md border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-emerald-500">
                            <option value="ADMIN">Administrator</option><option value="RESPONDER">Responder</option><option value="VIEWER">Viewer</option>
                          </select> : m.role}
                        </td>
                        <td className="px-3 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${m.mfa === "Active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                            {m.mfa}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-slate-400">{m.status}</td>
                        <td className="px-3 py-3.5 text-right">
                          {m.email === currentUser.email && m.mfa === "Pending" && <button type="button" onClick={() => void handleRequestMfaSetup()} disabled={isSubmitting} className="mr-2 rounded-md border-cyan-500/30 px-2 py-1 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50">Setup MFA</button>}
                          {isAdmin && <button
                            type="button"
                            onClick={() => handleRequestDelete(m)}
                            disabled={isSubmitting}
                            title="Hapus member"
                            aria-label={`Hapus ${m.name}`}
                            className="inline-grid size-8 place-items-center rounded-lg text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                          >
                            <Trash2 size={15} />
                          </button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {currentTab === "profile" && (
            <ProfileView
              profileName={profileName}
              profileEmail={profileEmail}
              profileInitials={profileInitials}
              onClose={() => setCurrentTab("dashboard")}
              onToast={showToast}
              activeSessionIp={activeSessionIp}
              onProfileUpdated={(name, email) => {
                setCurrentUser((current) => ({ ...current, name, email }));
                setMembersList((current) => current.map((member) => member.email === email ? { ...member, name, email, initials: name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() } : member));
              }}
            />
          )}

          {currentTab === "settings" && (
            <SystemSettingsView
              onClose={() => setCurrentTab("dashboard")}
              onToast={showToast}
            />
          )}
        </div>
      </section>

      {/* Modal: Delete Member OTP */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c161d] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-semibold text-white">Verifikasi Penghapusan Akun</h3>
                <p className="mt-1 text-xs text-slate-400">Kode 6 digit dikirim ke {deleteTarget.email}</p>
              </div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteAdminEmail(""); }} className="text-slate-400 hover:text-white" aria-label="Tutup">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleConfirmDelete} className="mt-5 space-y-4">
              <p className="text-xs leading-5 text-slate-400">
                Kode keamanan 6-digit telah dikirim ke email Owner/Admin ({deleteAdminEmail}) untuk mengonfirmasi penghapusan akun {deleteTarget.email}.
              </p>
              <input
                value={deleteOtp}
                onChange={(event) => setDeleteOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoFocus
                required
                placeholder="000000"
                aria-label="Kode OTP 6 digit"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.7em] text-cyan-300 outline-none focus:border-emerald-500"
              />
              {deleteError && <p className="text-xs text-rose-400">{deleteError}</p>}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button type="button" onClick={handleResendDeleteOtp} disabled={isSubmitting || resendCountdown > 0} className="text-xs font-medium text-cyan-400 hover:text-cyan-300 disabled:text-slate-600">
                  {resendCountdown > 0 ? `Kirim ulang (${resendCountdown}s)` : "Kirim Ulang OTP"}
                </button>
                <button type="submit" disabled={isSubmitting || deleteOtp.length !== 6} className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50">
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Verifikasi & Hapus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {roleTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border-slate-800 bg-[#0c161d] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><h3 className="font-semibold text-white">Verifikasi Perubahan Role</h3><p className="mt-1 text-xs text-slate-400">OTP dikirim ke {"reyhandy05@gmail.com"}</p></div><button type="button" onClick={() => setRoleTarget(null)} aria-label="Tutup" className="text-slate-400 hover:text-white"><X size={18} /></button></div>
            <form onSubmit={handleConfirmRoleChange} className="mt-5 space-y-4"><p className="text-xs leading-5 text-slate-400">Konfirmasi perubahan {roleTarget.name} menjadi {roleValue === "ADMIN" ? "Administrator" : roleValue === "RESPONDER" ? "Responder" : "Viewer"} menggunakan kode 6 digit dari email admin utama.</p><input value={roleOtp} onChange={(event) => setRoleOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus required placeholder="000" aria-label="Kode OTP role" className="w-full rounded-lg border-slate-800 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.7em] text-cyan-300 outline-none focus:border-emerald-500" />{roleError && <p className="text-xs text-rose-400">{roleError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setRoleTarget(null)} className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:bg-slate-800">Batal</button><button type="submit" disabled={isSubmitting || roleOtp.length !== 6} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Verifikasi & Simpan</button></div></form>
          </div>
        </div>
      )}

      {mfaModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-md rounded-2xl border-slate-800 bg-[#0c161d] p-6 shadow-2xl"><div className="flex items-center justify-between border-b border-slate-800 pb-3"><div><h3 className="font-semibold text-white">Aktivasi MFA</h3><p className="mt-1 text-xs text-slate-400">Masukkan OTP yang dikirim ke email akun Anda.</p></div><button type="button" onClick={() => setMfaModalOpen(false)} aria-label="Tutup" className="text-slate-400 hover:text-white"><X size={18} /></button></div><form onSubmit={handleConfirmMfa} className="mt-5 space-y-4"><input value={mfaOtp} onChange={(event) => setMfaOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" maxLength={6} autoFocus required placeholder="000" aria-label="Kode OTP MFA" className="w-full rounded-lg border-slate-800 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.7em] text-cyan-300 outline-none focus:border-emerald-500" />{mfaError && <p className="text-xs text-rose-400">{mfaError}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setMfaModalOpen(false)} className="rounded-lg px-4 py-2 text-xs text-slate-400 hover:bg-slate-800">Batal</button><button type="submit" disabled={isSubmitting || mfaOtp.length !== 6} className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50">Aktifkan MFA</button></div></form></div></div>
      )}

      {incidentToDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-incident-title"
            className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#0c161d] p-6 shadow-2xl"
          >
            <h2 id="delete-incident-title" className="text-sm font-semibold text-white">
              Hapus catatan insiden?
            </h2>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Apakah Anda yakin ingin menghapus catatan insiden ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <p className="mt-3 truncate rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
              {incidentToDelete.title} · {incidentToDelete.id}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIncidentToDelete(null)}
                disabled={isDeletingIncident}
                className="rounded-lg px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteIncident}
                disabled={isDeletingIncident}
                className="flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-50"
              >
                {isDeletingIncident && <Loader2 size={14} className="animate-spin" />}
                Hapus insiden
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Incident */}
      {isIncidentModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c161d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-white">Record Security Incident</h3>
              <button type="button" onClick={closeIncidentModal} className="text-slate-400 hover:text-white" aria-label="Tutup modal insiden">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateIncident} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-medium text-slate-300">Incident Title</label>
                <input
                  name="title"
                  value={incidentForm.title}
                  onChange={(event) => setIncidentForm((current) => ({ ...current, title: event.target.value }))}
                  maxLength={80}
                  placeholder="Misal: Unusual outbound SSH traffic"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-300">Affected Asset</label>
                <input
                  name="asset"
                  value={incidentForm.asset}
                  onChange={(event) => setIncidentForm((current) => ({ ...current, asset: event.target.value }))}
                  maxLength={40}
                  placeholder="Misal: PROD-DB-01"
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 uppercase outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-slate-300">Severity Level</label>
                <select
                  name="severity"
                  value={incidentForm.severity}
                  onChange={(event) => setIncidentForm((current) => ({ ...current, severity: event.target.value as Incident["severity"] }))}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>

              {incidentFormError && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300" role="alert">
                  {incidentFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeIncidentModal}
                  className="rounded-lg px-4 py-2 font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {isSubmitting ? "Saving..." : "Save Incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Member */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c161d] p-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-semibold text-white">Invite Security Operator</h3>
              <button onClick={() => { setInviteErrorMessage(null); setIsInviteModalOpen(false); }} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleInviteMember} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block mb-1 text-slate-300 font-medium">Full Name</label>
                <input
                  name="name"
                  required
                  maxLength={50}
                  placeholder="Nama Operator"
                  onChange={() => setInviteErrorMessage(null)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-300 font-medium">Email Address</label>
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={60}
                  placeholder="operator@northstar.io"
                  onChange={() => setInviteErrorMessage(null)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-300 font-medium">Role Access</label>
                <select
                  name="role"
                  onChange={() => setInviteErrorMessage(null)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-slate-200 outline-none focus:border-emerald-500"
                >
                  <option value="Administrator">Administrator (Full Access)</option>
                  <option value="Responder">Responder (Incident Triage)</option>
                  <option value="Viewer">Viewer (Read-Only)</option>
                </select>
              </div>
              {inviteErrorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300" role="alert">
                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-400" />
                  <span>{inviteErrorMessage}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setInviteErrorMessage(null); setIsInviteModalOpen(false); }}
                  className="rounded-lg px-4 py-2 font-medium text-slate-400 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}

function ProfileView({
  profileName,
  profileEmail,
  profileInitials,
  onClose,
  onToast,
  onProfileUpdated,
  activeSessionIp,
}: {
  profileName: string;
  profileEmail: string;
  profileInitials: string;
  onClose: () => void;
  onToast: (message: string, type?: "success" | "error") => void;
  onProfileUpdated: (name: string, email: string) => void;
  activeSessionIp: string;
}) {
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isProfilePending, setIsProfilePending] = useState(false);
  const [isPasswordPending, setIsPasswordPending] = useState(false);

  async function handleProfileSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setProfileError(null);
    setIsProfilePending(true);
    try {
      const result = await updateUserProfile(new FormData(form));
      if (!result.success) {
        setProfileError(result.error);
        onToast(result.error, "error");
        return;
      }
      onProfileUpdated(result.user.name ?? profileEmail, result.user.email);
      onToast("Informasi profil berhasil disimpan.");
    } catch (error) {
      console.error("Profile update failed", error);
      setProfileError("Profil tidak dapat diperbarui.");
      onToast("Profil tidak dapat diperbarui.", "error");
    } finally {
      setIsProfilePending(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setPasswordError(null);
    setIsPasswordPending(true);
    try {
      const result = await updateUserPassword(new FormData(form));
      if (!result.success) {
        setPasswordError(result.error);
        onToast(result.error, "error");
        return;
      }
      form.reset();
      onToast("Password berhasil diperbarui.");
    } catch (error) {
      console.error("Password update failed", error);
      setPasswordError("Password tidak dapat diperbarui.");
      onToast("Password tidak dapat diperbarui.", "error");
    } finally {
      setIsPasswordPending(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">Personal account</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Profile & Security</h2>
          <p className="mt-1 text-xs text-slate-400">Kelola identitas dan keamanan akun Anda.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white">
          Back to overview
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Profile information</h3>
          <div className="mt-5 flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-lg font-bold text-emerald-300">{profileInitials}</div>
            <div><p className="font-semibold text-white">{profileName}</p><p className="text-xs text-slate-500">Administrator account</p></div>
          </div>
          <form className="mt-5 space-y-4" onSubmit={handleProfileSubmit}>
            <label className="block text-xs text-slate-400">Display name<input name="name" required maxLength={50} defaultValue={profileName} className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" /></label>
            <label className="block text-xs text-slate-400">Email address<input name="email" value={profileEmail} readOnly className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-500 outline-none" /></label>
            {profileError && <p role="alert" className="text-xs text-rose-400">{profileError}</p>}
            <button type="submit" disabled={isProfilePending} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{isProfilePending ? "Saving..." : "Save profile"}</button>
          </form>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white">Account security</h3>
          <form className="mt-5 space-y-3" onSubmit={handlePasswordSubmit}>
            <input name="currentPassword" type="password" required placeholder="Password lama" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" />
            <input name="newPassword" type="password" required minLength={8} placeholder="Password baru" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" />
            <input name="confirmPassword" type="password" required minLength={8} placeholder="Konfirmasi password baru" className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500" />
            {passwordError && <p role="alert" className="text-xs text-rose-400">{passwordError}</p>}
            <button type="submit" disabled={isPasswordPending} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">{isPasswordPending ? "Updating..." : "Update password"}</button>
          </form>
          <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4">
            <div><p className="text-xs font-semibold text-white">Multi-factor authentication</p><p className="mt-1 text-[11px] text-emerald-400">Enabled for this account</p></div>
            <button type="button" onClick={() => onToast("MFA setup tersedia di perangkat keamanan Anda.")} className="rounded-lg border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 hover:bg-emerald-500/10">Manage MFA</button>
          </div>
        </section>

        <section className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 xl:col-span-2">
          <h3 className="text-sm font-semibold text-white">Active session</h3>
          <div className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-slate-500">Browser</p><p className="mt-1 font-medium text-slate-200">Chrome on Windows</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-slate-500">IP address</p><p className="mt-1 break-all font-mono text-slate-200">{activeSessionIp}</p></div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3"><p className="text-slate-500">Status</p><p className="mt-1 font-medium text-emerald-400">Active now</p></div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SystemSettingsView({
  onClose,
  onToast,
}: {
  onClose: () => void;
  onToast: (message: string, type?: "success" | "error") => void;
}) {
  const [enforceMfa, setEnforceMfa] = useState(true);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">Platform controls</p><h2 className="mt-1 text-2xl font-bold text-white">System Security Config</h2><p className="mt-1 text-xs text-slate-400">Konfigurasi global SOC, akses, dan retensi audit.</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-800 px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white">Back to overview</button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <SettingsSection title="Notifications & email">
          <SettingsRow label="SMTP / Alert channel" detail="Nodemailer via Gmail SMTP" value="Connected" tone="text-emerald-400" />
          <SettingsRow label="Incident alert routing" detail="Email notifications enabled" value="Enabled" tone="text-emerald-400" />
        </SettingsSection>
        <SettingsSection title="Zero-Trust access policy">
          <SettingsRow label="Session timeout" detail="Automatic session expiry" value="30 minutes" />
          <SettingsRow label="Default member role" detail="Applied to new invitations" value="Viewer" />
          <SettingsToggle label="Enforce MFA for administrators" checked={enforceMfa} onChange={setEnforceMfa} />
        </SettingsSection>
        <SettingsSection title="Audit & log retention">
          <SettingsRow label="Incident log retention" detail="Audit records kept online" value="90 days" />
          <SettingsRow label="Security event export" detail="Scheduled compliance archive" value="Weekly" />
          <button type="button" onClick={() => onToast("System settings berhasil disimpan.")} className="mt-3 rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400">Save system settings</button>
        </SettingsSection>
      </div>
    </div>
  );
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5"><h3 className="text-sm font-semibold text-white">{title}</h3><div className="mt-4 space-y-3">{children}</div></section>;
}

function SettingsRow({ label, detail, value, tone = "text-slate-200" }: { label: string; detail: string; value: string; tone?: string }) {
  return <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><div><p className="text-xs font-medium text-slate-200">{label}</p><p className="mt-1 text-[11px] text-slate-500">{detail}</p></div><span className={`shrink-0 text-xs font-semibold ${tone}`}>{value}</span></div>;
}

function SettingsToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-3"><span className="text-xs font-medium text-slate-200">{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-emerald-500" /></label>;
}

function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  delta: string;
  icon: typeof ShieldCheck;
  tone: "rose" | "emerald" | "amber" | "cyan";
}) {
  const colorMap = {
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    cyan: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-5 shadow-lg backdrop-blur-md">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className={`grid size-8 place-items-center rounded-lg border ${colorMap[tone]}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-white">{value}</div>
      <p className="mt-1 text-[11px] text-slate-400">{delta}</p>
    </div>
  );
}