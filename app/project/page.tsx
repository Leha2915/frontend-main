"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import RequireAuthLevel from "@/components/RequireAuthLevel"
import { useJWTAuth } from "@/context/jwtAuth";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Copy,
  Trash2,
  LibraryBig,
  Lock,
  Unlock,
  Clock,
  Info,
  X,
  Link2,
  Plus
} from "lucide-react";

type Project = {
  id: number
  title: string
  slug: string
  topic?: string
  stimuli: string[]
  is_active: boolean
  created_at?: string
  grouped: string[]
  internal_id?: string
}

const api_url = process.env.NEXT_PUBLIC_API_URL;

function ensureArray<T>(v: unknown, fallback: T[] = []): T[] {
  return Array.isArray(v) ? (v as T[]) : fallback;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function normalizeProject(p: Project): Project {
  return {
    ...p,
    grouped: ensureArray<string>(p.grouped, []),
  };
}

function normalizeProjects(list: Project[]): Project[] {
  return list.map(normalizeProject);
}

export default function ProjectListPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const router = useRouter()
  const { fetchWithAuth } = useJWTAuth()
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedTarget, setSelectedTarget] = useState<Record<string, string>>({})
  const [linkModalForSlug, setLinkModalForSlug] = useState<string | null>(null)

  const copyToClipboard = async (slug: string) => {
    const fullUrl = `${window.location.origin}/project/${slug}`
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(slug);
      setTimeout(() => {
        setCopiedId((prev) => (prev === slug ? null : prev));
      }, 800);
    } catch {
      console.error("unable to copy!");
    }
  };

  const getCreatedTs = (p: Project) => {
    const t = parseUtcMs(p.created_at);
    return Number.isNaN(t) ? 0 : t;
  };

  useEffect(() => {
    async function loadProjects() {
      try {
        const res = await fetchWithAuth(`${api_url}/projects`, {
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        })
        if (!res.ok) throw new Error(`Failed to load projects (status: ${res.status})`)
        const data = await res.json()
        setProjects(normalizeProjects(data))
      } catch (err) {
        console.error("Error loading projects:", err)
        alert("Failed to load projects. You may need to log in again.")
        window.location.href = "/"
      } finally {
        setLoading(false)
      }
    }
    loadProjects().catch()
  }, [])

  const mergeUpdatedProjects = (updatedList: Project[] | Project) => {
    const list = Array.isArray(updatedList) ? updatedList : [updatedList];
    const bySlug = new Map<string, Partial<Project> & { slug: string }>();
    list.forEach((u: any) => {
      bySlug.set(u.slug, u);
    });

    setProjects(prev =>
      prev.map(p => {
        const u = bySlug.get(p.slug);
        if (!u) return p;

        const next: Project = { ...p, ...(u as any) };

        if (Object.prototype.hasOwnProperty.call(u, "grouped")) {
          const g = (u as any).grouped;
          if (Array.isArray(g)) {
            next.grouped = g;
          } else if (g == null) {
            next.grouped = ensureArray<string>(p.grouped, []);
          }
        }
        next.grouped = ensureArray<string>(next.grouped, ensureArray(p.grouped, []));
        return next;
      })
    );
  };

  const handleDelete = async (id: number) => {
    const confirmed = confirm("Are you sure you want to delete this project?")
    if (!confirmed) return
    const res = await fetchWithAuth(`${api_url}/projects/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (res.ok) {
      setProjects(prev => prev.filter(p => p.id !== id))
    } else {
      alert("Error while deleting project.")
    }
  }

  const handleViewInterviews = (slug: string) => {
    router.push(`/project/${slug}/results`)
  }

  const handleViewDetails = (slug: string) => {
    router.push(`/project/${slug}/details`);
  };

  const handleToggleInterview = async (id: number) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, is_active: !p.is_active } : p))
    );
    const res = await fetchWithAuth(`${api_url}/projects/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (res.ok) {
      const updated = await res.json();
      setProjects(prev =>
        prev.map(p => (p.id === id ? normalizeProject({ ...p, ...updated }) : p))
      );
    } else {
      setProjects(prev =>
        prev.map(p => (p.id === id ? { ...p, is_active: !p.is_active } : p))
      );
      alert("Error while toggling!");
    }
  };

  const linkPair = (prev: Project[], aSlug: string, bSlug: string) => {
    const next = prev.map(pr => {
      if (pr.slug === aSlug) return { ...pr, grouped: uniq([...(pr.grouped ?? []), bSlug]) }
      if (pr.slug === bSlug) return { ...pr, grouped: uniq([...(pr.grouped ?? []), aSlug]) }
      return pr
    })
    return next
  }

  const unlinkPair = (prev: Project[], aSlug: string, bSlug: string) => {
    const next = prev.map(pr => {
      if (pr.slug === aSlug) return { ...pr, grouped: (pr.grouped ?? []).filter(s => s !== bSlug) }
      if (pr.slug === bSlug) return { ...pr, grouped: (pr.grouped ?? []).filter(s => s !== aSlug) }
      return pr
    })
    return next
  }

  const handleGroup = async (slugA: string) => {
    const slugB = (selectedTarget[slugA] || "").trim()
    if (!slugB) return alert("Please select a project to link with.")
    if (slugA === slugB) return alert("You cannot link a project with itself.")

    const existsA = projects.some(p => p.slug === slugA)
    const existsB = projects.some(p => p.slug === slugB)
    if (!existsA || !existsB) return alert("One of the selected projects no longer exists.")

    const a = projects.find(p => p.slug === slugA)!
    const already = ensureArray<string>(a.grouped).includes(slugB)
    if (already) {
      setSelectedTarget(prev => ({ ...prev, [slugA]: "" }))
      setLinkModalForSlug(null)
      return
    }

    setMutating(true)
    const snapshot = projects
    setProjects(prev => normalizeProjects(linkPair(prev, slugA, slugB)))

    const res = await fetchWithAuth(`${api_url}/projects/group`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug_a: slugA, slug_b: slugB })
    }).catch(() => null)

    if (res && res.ok) {
      const updated = await res.json()
      mergeUpdatedProjects(updated)
      setSelectedTarget(prev => ({ ...prev, [slugA]: "" }))
      setLinkModalForSlug(null)
    } else {
      setProjects(snapshot)
      const txt = res ? await safeText(res) : "Network error"
      alert(`Linking failed${res ? ` (${res.status})` : ""}. ${txt}`)
    }
    setMutating(false)
  }

  const handleUngroup = async (slugA: string, slugB: string) => {
    const a = projects.find(p => p.slug === slugA)
    if (!a || !ensureArray<string>(a.grouped).includes(slugB)) return

    setMutating(true)
    const snapshot = projects
    setProjects(prev => normalizeProjects(unlinkPair(prev, slugA, slugB)))

    const res = await fetchWithAuth(`${api_url}/projects/ungroup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug_a: slugA, slug_b: slugB })
    }).catch(() => null)

    if (res && res.ok) {
      const updated = await res.json()
      mergeUpdatedProjects(updated)
    } else {
      setProjects(snapshot)
      const txt = res ? await safeText(res) : "Network error"
      alert(`Unlink failed${res ? ` (${res.status})` : ""}. ${txt}`)
    }
    setMutating(false)
  }

  function ActiveToggle({
    isActive,
    onToggle,
  }: { isActive: boolean; onToggle: () => void }) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        onClick={onToggle}
        className={`relative inline-flex w-16 h-8 rounded-full transition-colors duration-200
                    ${isActive ? "bg-green-500" : "bg-red-500"}`}
      >
        <span
          className={`absolute left-1 top-1 w-6 h-6 rounded-full bg-white shadow-md
                      transition-transform duration-200 will-change-transform
                      ${isActive ? "translate-x-8" : "translate-x-0"}`}
        />
      </button>
    )
  }

  function StatusBadge({ isActive }: { isActive: boolean }) {
    return (
      <span
        className={`inline-flex items-center justify-center gap-1 rounded-full text-sm font-medium
                    px-2 py-0.5 w-24
                    ${isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
      >
        {isActive ? (
          <>
            <Unlock size={14} className="shrink-0" />
            <span className="truncate">active</span>
          </>
        ) : (
          <>
            <Lock size={14} className="shrink-0" />
            <span className="truncate">inactive</span>
          </>
        )}
      </span>
    )
  }

  const { activeProjects, inactiveProjects } = useMemo(() => {
    const actives = projects.filter(p => p.is_active)
      .slice()
      .sort((a, b) => getCreatedTs(b) - getCreatedTs(a));
    const inactives = projects.filter(p => !p.is_active)
      .slice()
      .sort((a, b) => getCreatedTs(b) - getCreatedTs(a));
    return { activeProjects: actives, inactiveProjects: inactives };
  }, [projects]);

  const availableTargets = (sourceSlug: string, currentGrouped: string[]) =>
    projects
      .filter(p => p.slug !== sourceSlug && !ensureArray<string>(currentGrouped).includes(p.slug))
      .map(p => ({ slug: p.slug, title: p.title || p.slug }))

  const renderGroupedBadgesInline = (p: Project) => {
    const groupedList = ensureArray<string>(p.grouped)
    if (groupedList.length === 0) return null
    return (
      <div className="flex flex-wrap items-center gap-1">
        {groupedList.map((slugB) => {
          const partner = projects.find(x => x.slug === slugB)
          const label = partner?.title ? `${partner.title} (${slugB})` : slugB
          return (
            <Badge
              key={slugB}
              variant="secondary"
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs"
            >
              <Link2 className="h-3 w-3" />
              <button
                onClick={() => handleViewDetails(slugB)}
                className="underline decoration-dotted hover:opacity-80"
                title="Open linked project"
              >
                {label}
              </button>
              <button
                onClick={() => handleUngroup(p.slug, slugB)}
                className="ml-0.5 rounded hover:bg-gray-200 p-0.5 disabled:opacity-50"
                aria-label="Unlink"
                title="Unlink"
                disabled={mutating}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )
        })}
      </div>
    )
  }

  const renderProjectRow = (p: Project) => (
    <div key={p.id} className="grid grid-cols-1 gap-3 md:gap-4 items-start">
      {renderProjectCard(p)}
    </div>
  )

  const renderProjectCard = (p: Project) => {
    const hasLinks = ensureArray<string>(p.grouped).length > 0
    return (
      <div
        className="relative border border-gray-300 rounded-lg p-6 bg-white hover:shadow-sm transition-shadow"
      >
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>

            {(p.topic || hasLinks) && (
              <div className="mt-1 flex flex-wrap items-center gap-2 text-gray-600">
                {p.topic && <span className="truncate">Topic: {p.topic}</span>}
                {p.internal_id && "|"}
                {p.internal_id && <span className="truncate">{"(" + p.internal_id + ")"}</span>}
                {(p.grouped && p.grouped.length != 0)&& "|"}
                {renderGroupedBadgesInline(p)}


              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => { copyToClipboard(p.slug) }}
                className="text-500 hover:text-blue-700 font-medium text-m truncate max-w-xs"
                title={`Copy link: ${p.slug}`}
              >
                <div className="flex items-center gap-1">
                  <span>{copiedId === p.slug ? <CheckCircle2 size={16} /> : <Copy size={16} />}</span>
                  <span>{`Copy link (${p.slug})`}</span>
                </div>
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => handleViewInterviews(p.slug)}
              className="text-grey-600 hover:text-blue-700 font-medium text-m truncate max-w-xs"
              title="View all processed interviews"
            >
              <div className="flex items-center">
                <span><LibraryBig size={16} /></span>
                <span>View Interviews</span>
              </div>
            </Button>

            <Button
              variant="outline"
              onClick={() => handleViewDetails(p.slug)}
              className="text-grey-600 hover:text-blue-700 font-medium text-m truncate max-w-xs"
              title="View project details"
            >
              <div className="flex items-center">
                <span><Info size={16} /></span>
                <span>View Details</span>
              </div>
            </Button>

            <div className="flex items-center">
              <span
                className="inline-flex items-center gap-1 rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs"
                title={formatAbsolute(p.created_at)}
              >
                <Clock size={12} />
                {formatRelative(p.created_at)}
              </span>
            </div>


            <Button
              variant="outline"
              onClick={() => {
                setSelectedTarget(prev => ({ ...prev, [p.slug]: prev[p.slug] ?? "" }))
                setLinkModalForSlug(p.slug)
              }}
              className="text-grey-600 hover:text-blue-700 font-medium text-m truncate max-w-xs"
              title="Link another project"
              aria-label="Link another project"
            >

              <div className="flex items-center">
                <span><Plus size={16} /></span>
                <span>Manage Grouping</span>
              </div>
            </Button>

            <div>
              <Button
                variant="outline"
                onClick={() => handleToggleInterview(p.id)}
                aria-pressed={p.is_active}
                className={cn(
                  "group flex items-center gap-2 font-medium text-sm px-3 py-1 rounded border transition-colors",
                  p.is_active
                    ? "text-700 border-green-200 hover:border-green-300"
                    : "text-700  border-rose-200 hover:text-green-800 hover:border-rose-300"
                )}
              >
                <Badge
                  variant="secondary"
                  className={cn(
                    "px-2.5 py-1 text-xs transition-colors",
                    p.is_active
                      ? "bg-green-100 text-green-700 group-hover:bg-green-200 group-hover:text-green-800"
                      : "bg-rose-100  text-rose-700  group-hover:bg-rose-200  group-hover:text-rose-800"
                  )}
                  title={p.is_active ? "Active" : "Inactive"}
                >
                  {p.is_active ? (
                    <Unlock className="h-3.5 w-3.5 mr-1" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 mr-1" />
                  )}
                  {p.is_active ? "Active" : "Inactive"}
                </Badge>

                {p.is_active ? "Close Project" : "Open Project"}
              </Button>
            </div>

            <Button
              onClick={() => handleDelete(p.id)}
              variant="outline"
              className="text-red-600 hover:text-red-700 font-medium text-base px-3 py-1 rounded hover:bg-red-50"
            >
              <div className="flex items-center gap-1">
                <span><Trash2 size={16} /></span>
                <span>Delete</span>
              </div>
            </Button>
          </div>
        </div>

        {linkModalForSlug === p.slug && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setLinkModalForSlug(null)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-sm rounded-lg border bg-white p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Link another project</h4>
                <button
                  className="rounded p-1 hover:bg-gray-100"
                  onClick={() => setLinkModalForSlug(null)}
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {(() => {
                const options = availableTargets(p.slug, p.grouped || [])
                if (options.length === 0) {
                  return (
                    <p className="text-sm text-gray-600">
                      No available projects to link.
                    </p>
                  )
                }
                return (
                  <>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Choose project to link with “{p.title || p.slug}”
                    </label>
                    <select
                      value={selectedTarget[p.slug] || ""}
                      onChange={(e) =>
                        setSelectedTarget(prev => ({ ...prev, [p.slug]: e.target.value }))
                      }
                      className="mb-3 w-full rounded border px-2 py-1 text-sm"
                      aria-label={`Select project to link ${p.title ?? p.slug}`}
                      disabled={mutating}
                    >
                      <option value="">Select…</option>
                      {options.map(o => (
                        <option key={o.slug} value={o.slug}>{o.title}</option>
                      ))}
                    </select>

                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setLinkModalForSlug(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleGroup(p.slug)}
                        disabled={mutating || !(selectedTarget[p.slug] || "").trim()}
                      >
                        Link
                      </Button>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    )
  }

  function Divider({ label }: { label?: React.ReactNode }) {
    return (
      <div className="my-6 flex items-center" role="separator" aria-orientation="horizontal">
        <div className="flex-1 h-px bg-gray-400" />
        {label ? (
          <span className="mx-3 bg-white px-3 text-xs uppercase tracking-wide text-gray-600 select-none">
            {label}
          </span>
        ) : null}
        <div className="flex-1 h-px bg-gray-400" />
      </div>
    );
  }

  function parseUtcMs(iso?: string) {
    if (!iso) return NaN;
    const s = iso.replace(' ', 'T');
    const hasTz = /[zZ]|[+\-]\d{2}:\d{2}$/.test(s);
    return Date.parse(hasTz ? s : s + 'Z');
  }

  function formatRelative(iso?: string) {
    const then = parseUtcMs(iso);
    if (Number.isNaN(then)) return "—";
    const now = Date.now();
    const diffSec = Math.round((then - now) / 1000);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const divs: Array<[Intl.RelativeTimeFormatUnit, number]> = [
      ["year", 31536000], ["month", 2592000], ["week", 604800],
      ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1],
    ];
    for (const [unit, size] of divs) {
      const amt = diffSec / size;
      if (Math.abs(amt) >= 1 || unit === "second") return rtf.format(Math.round(amt), unit);
    }
    return "—";
  }

  function formatAbsolute(iso?: string) {
    const ms = parseUtcMs(iso);
    if (Number.isNaN(ms)) return "—";
    return new Intl.DateTimeFormat("en-EN", { dateStyle: "medium", timeStyle: "short" })
      .format(new Date(ms));
  }

  async function safeText(res: Response) {
    try { return await res.text() } catch { return "" }
  }

  return (
    <RequireAuthLevel>
      <div className="flex flex-col h-full bg-white">
        <div className="border-b border-gray-200 p-6 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">My Projects</h1>
              <span className="text-gray-600 font-medium">
                {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              </span>
            </div>
            <button
              onClick={() => router.push('/setup')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              Create New Project
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-gray-500">Loading projects…</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <p className="text-gray-500 text-lg">No projects found.</p>
              <button
                onClick={() => router.push('/setup')}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Create Your First Project
              </button>
            </div>
          ) : (
            <>
              {activeProjects.length > 0 && (
                <>
                  <Divider label={`Active projects (${activeProjects.length})`} />
                  <div className="space-y-6">
                    {activeProjects.map(renderProjectRow)}
                  </div>
                </>
              )}

              {inactiveProjects.length > 0 && (
                <>
                  <Divider label={`Inactive projects (${inactiveProjects.length})`} />
                  <div className="space-y-6">
                    {inactiveProjects.map(renderProjectRow)}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </RequireAuthLevel>
  )
}
