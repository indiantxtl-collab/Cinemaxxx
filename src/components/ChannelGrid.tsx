"use client";

import { useState } from "react";
import type { Channel } from "@/lib/catalogue";
import type { LinkResolution } from "@/lib/providers";
import PlaybackOverlay from "./PlaybackOverlay";
import Icon from "./Icon";
import Artwork from "./Artwork";

/** Channels reuse the existing collection tiles and playback overlay. */
export default function ChannelGrid({ channels }: { channels: Channel[] }) {
  const [playing, setPlaying] = useState<{ channel: Channel; resolution: LinkResolution } | null>(null);
  const [pending, setPending] = useState<number | null>(null);
  const [error, setError] = useState("");
  const play = async (channel: Channel) => {
    setPending(channel.id); setError("");
    try {
      const response = await fetch(`/api/channels/${channel.id}/playback`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.resolution?.ok) throw new Error(data.error || "This channel is unavailable.");
      setPlaying({ channel, resolution: data.resolution });
    } catch (e) { setError(e instanceof Error ? e.message : "This channel is unavailable."); }
    finally { setPending(null); }
  };
  if (!channels.length) return null;
  return <section className="channel-section" aria-label="Channels">
    <div className="section-heading"><h2>Channels</h2><span className="result-count">{channels.length} channels</span></div>
    {error && <p role="alert" className="studio-login-error">{error}</p>}
    <div className="channel-grid">
      {channels.map((channel) => <button key={channel.id} type="button" className="collection-tile channel-tile" disabled={pending !== null} onClick={() => void play(channel)} aria-label={`Watch ${channel.name}`}>
        {channel.logoUrl ? <Artwork className="channel-logo" src={channel.logoUrl} kind="backdrop" sizes="180px" /> : <span className="channel-logo-fallback"><Icon name="film" /></span>}
        <span className="collection-tile-shade" aria-hidden="true" />
        <span className="collection-tile-copy"><span className="collection-tile-name">{channel.name}</span><span className="collection-tile-count">{pending === channel.id ? "Opening…" : "Watch channel"}</span></span>
        <span className="collection-tile-icon" aria-hidden="true"><Icon name="play" /></span>
      </button>)}
    </div>
    {playing && <PlaybackOverlay movie={{ id: `channel-${playing.channel.id}`, title: playing.channel.name, videoUrl: playing.channel.streamUrl, posterUrl: playing.channel.logoUrl }} resolution={playing.resolution} onClose={() => setPlaying(null)} />}
  </section>;
}
