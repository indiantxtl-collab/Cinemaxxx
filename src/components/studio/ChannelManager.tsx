"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { Channel } from "@/lib/catalogue";
import Artwork from "@/components/Artwork";
import { MAX_LOGO_BYTES } from "@/lib/channel-logo";

type Category = { id: number; name: string; enabled: boolean };
type Mutate = (url: string, method: string, body?: unknown) => Promise<{ ok: boolean; error?: string; data?: unknown }>;
const label: CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6 };
const primary: CSSProperties = { padding: "10px 20px", borderRadius: 12, background: "var(--gloss-fill-strong)", boxShadow: "var(--gloss-shadow)", color: "#fff", fontWeight: 800, fontSize: 11, border: "none", cursor: "pointer" };

/** Additive studio tab: the same panels, fields, rows and actions as the library. */
export default function ChannelManager({ categories, mutate, onChanged, flash }: {
  categories: Category[];
  mutate: Mutate;
  onChanged: () => Promise<void>;
  flash: (text: string, kind?: "ok" | "error") => void;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [streamUrl, setStreamUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/channels", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (!Array.isArray(data)) throw new Error("Invalid channel response");
      setChannels(data);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Channels could not be loaded"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const reset = () => {
    setEditingId(null); setName(""); setDescription(""); setStreamUrl(""); setCategoryId("");
    setSortOrder(0); setEnabled(true); setLogoUrl(null); setLogoFile(null); setPreview(null); setShowForm(false);
  };
  const edit = (channel: Channel) => {
    setEditingId(channel.id); setName(channel.name); setDescription(channel.description);
    setStreamUrl(channel.streamUrl); setCategoryId(String(channel.categoryId)); setSortOrder(channel.sortOrder);
    setEnabled(channel.enabled); setLogoUrl(channel.logoUrl); setLogoFile(null); setShowForm(true);
  };
  const refresh = async () => {
    await Promise.all([load(), onChanged()]);
    window.dispatchEvent(new Event("cinemax:catalogue-refresh"));
  };
  const fail = (message: string) => { setError(message); flash(message, "error"); };

  const save = async () => {
    if (!name.trim() || !streamUrl.trim() || !categoryId) { fail("Name, stream URL and category are required"); return; }
    if (logoFile && logoFile.size > MAX_LOGO_BYTES) { fail("Logo must be 2 MB or smaller"); return; }
    setBusy(true);
    const result = await mutate(editingId ? `/api/admin/channels/${editingId}` : "/api/admin/channels", editingId ? "PUT" : "POST", {
      name, description, streamUrl, categoryId: Number(categoryId), sortOrder, enabled,
    });
    if (!result.ok) { setBusy(false); fail(result.error || "Could not save channel"); return; }
    const saved = result.data as Channel | undefined;
    const id = editingId ?? saved?.id;
    if (!id) { setBusy(false); fail("The channel was saved without an id. Refresh before uploading a logo."); await refresh(); return; }
    // If logo storage fails, keep editing this saved row so Retry cannot duplicate it.
    setEditingId(id);
    if (logoFile) {
      try {
        const form = new FormData(); form.set("logo", logoFile);
        const response = await fetch(`/api/admin/channels/${id}/logo`, { method: "POST", body: form });
        const data = await response.json().catch(() => null);
        if (!response.ok) { setBusy(false); fail(data?.error || "Channel saved, but logo upload failed"); await refresh(); return; }
      } catch { setBusy(false); fail("Channel saved, but logo upload failed. Try again."); await refresh(); return; }
    }
    setBusy(false); flash(editingId ? "Channel updated" : "Channel added"); reset(); await refresh();
  };

  const removeLogo = async () => {
    if (!editingId) return;
    setBusy(true);
    const result = await mutate(`/api/admin/channels/${editingId}/logo`, "DELETE");
    setBusy(false);
    if (!result.ok) { fail(result.error || "Could not remove logo"); return; }
    setLogoUrl(null); setLogoFile(null); setPreview(null); flash("Logo removed"); await refresh();
  };
  const action = async (url: string, method: string, body?: unknown) => {
    setBusy(true); const result = await mutate(url, method, body); setBusy(false);
    if (!result.ok) { fail(result.error || "Could not update channel"); return; }
    await refresh();
  };
  const visible = channels.filter((channel) => !filter || channel.categoryId === Number(filter));
  const move = async (index: number, direction: number) => {
    const ids = visible.map((channel) => channel.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    // Keep hidden/category-filtered rows in their existing slots. Sending only
    // the filtered ids would assign colliding sort orders to unrelated rows.
    const visibleIds = new Set(ids);
    let position = 0;
    const complete = channels.map((channel) => visibleIds.has(channel.id) ? ids[position++] : channel.id);
    await action("/api/admin/channels/reorder", "PUT", { ids: complete });
  };

  return <section style={{ marginTop: 8 }} aria-label="Channel management">
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 800 }}>Channels ({channels.length})</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={busy} onClick={() => void refresh()} className="studio-small-button" style={{ width: "auto", padding: "0 12px" }}>Refresh</button>
        <button disabled={busy} onClick={() => { reset(); setShowForm(true); }} style={primary}>+ Add</button>
      </div>
    </div>
    {error && <p role="alert" className="studio-login-error" style={{ marginBottom: 16 }}>{error}</p>}
    <div style={{ marginBottom: 16 }}>
      <label htmlFor="channel-category-filter" style={label}>Show category</label>
      <select id="channel-category-filter" className="glass-input" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All categories</option>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.enabled ? "" : " (disabled)"}</option>)}
      </select>
    </div>
    {showForm && <div className="detail-panel" style={{ marginBottom: 20 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 20 }}>{editingId ? "Edit Channel" : "New Channel"}</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div><label htmlFor="channel-name" style={label}>Name</label><input id="channel-name" className="glass-input" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} /></div>
        <div><label htmlFor="channel-description" style={label}>Description (optional)</label><textarea id="channel-description" className="glass-input" rows={2} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label htmlFor="channel-stream" style={label}>Stream URL</label><input id="channel-stream" type="url" className="glass-input" value={streamUrl} maxLength={4096} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://…/live.m3u8" /><p className="studio-field-help">Direct HTTP(S) video, HLS (.m3u8) or DASH (.mpd). Only add non-explicit streams you are authorized to distribute.</p></div>
        <div className="studio-form-grid">
          <div><label htmlFor="channel-category" style={label}>Category</label><select id="channel-category" className="glass-input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Choose a category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.enabled ? "" : " (disabled)"}</option>)}</select></div>
          <div><label htmlFor="channel-order" style={label}>Sort Order</label><input id="channel-order" type="number" min={0} max={2147483647} className="glass-input" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} /></div>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} style={{ width: 18, height: 18 }} /><span style={{ fontSize: 12, fontWeight: 700 }}>Enabled</span></label>
        <div>
          <label htmlFor="channel-logo" style={label}>Channel logo</label>
          {(preview || logoUrl) && <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <Artwork src={preview || logoUrl} alt="Channel logo preview" className="studio-channel-logo" kind="backdrop" sizes="48px" />
            {logoUrl && !logoFile && <button disabled={busy} onClick={() => void removeLogo()} className="studio-small-button" style={{ width: "auto", padding: "0 12px" }}>Remove logo</button>}
          </div>}
          <input id="channel-logo" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="glass-input" disabled={busy} onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            if (file && file.size > MAX_LOGO_BYTES) { fail("Logo must be 2 MB or smaller"); e.target.value = ""; return; }
            setPreview(file ? URL.createObjectURL(file) : null);
            setLogoFile(file);
          }} />
          <p className="studio-field-help">PNG, JPEG, WebP or GIF · up to 2 MB. Choosing a new file replaces the logo when you save.</p>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <button onClick={() => void save()} disabled={busy} style={{ ...primary, flex: 1, padding: "14px 0", opacity: busy ? 0.6 : 1 }}>Save</button>
          <button disabled={busy} onClick={reset} className="studio-small-button" style={{ width: "auto", padding: "0 24px" }}>Cancel</button>
        </div>
      </div>
    </div>}
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }} aria-busy={loading}>
      {loading ? <p className="studio-empty">Loading channels…</p> : visible.map((channel, index) => <div key={channel.id} className="studio-record-row">
        {channel.logoUrl ? <Artwork src={channel.logoUrl} className="studio-channel-logo" kind="backdrop" sizes="48px" /> : <span className="studio-channel-logo" aria-hidden="true">TV</span>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" }}>{channel.name}</p>
          <p style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>{channel.categoryName} • Order: {channel.sortOrder} • {channel.enabled ? "Enabled" : "Disabled"}</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button className="studio-small-button" aria-label={`Move ${channel.name} up`} disabled={busy || index === 0} onClick={() => void move(index, -1)}>↑</button>
          <button className="studio-small-button" aria-label={`Move ${channel.name} down`} disabled={busy || index === visible.length - 1} onClick={() => void move(index, 1)}>↓</button>
          <button className="studio-small-button" style={{ width: "auto", padding: "0 10px", fontSize: 11 }} aria-label={`${channel.enabled ? "Disable" : "Enable"} ${channel.name}`} disabled={busy} onClick={() => void action(`/api/admin/channels/${channel.id}`, "PUT", { enabled: !channel.enabled })}>{channel.enabled ? "Disable" : "Enable"}</button>
          <button className="studio-small-button" aria-label={`Edit ${channel.name}`} disabled={busy} onClick={() => edit(channel)}>✏️</button>
          <button className="studio-small-button" style={{ background: "rgba(239,68,68,0.08)" }} aria-label={`Delete ${channel.name}`} disabled={busy} onClick={() => { if (confirm(`Delete ${channel.name} and its logo?`)) void action(`/api/admin/channels/${channel.id}`, "DELETE"); }}>🗑️</button>
        </div>
      </div>)}
      {!loading && !visible.length && <p className="studio-empty">{channels.length ? "No channels in this category." : "No channels yet. Add a channel to get started."}</p>}
    </div>
  </section>;
}
