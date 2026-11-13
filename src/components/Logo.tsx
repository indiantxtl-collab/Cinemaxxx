/* eslint-disable @next/next/no-img-element -- small local brand PNGs; next/image would add nothing here */
/**
 * The cinemaxxx logo: the uploaded artwork, used exactly as supplied (no
 * recolouring, no added wordmark). `cinemaxxx-logo-256.png` is a transparent,
 * aspect-preserving square, so it is safe at header sizes on 2x and 3x screens.
 */
export const LOGO_SRC = "/brand/cinemaxxx-logo-256.png";

export function CinemaxEmblem({ className = "" }: { className?: string }) {
  return (
    <img
      className={`cinemax-emblem ${className}`}
      src={LOGO_SRC}
      srcSet={`${LOGO_SRC} 1x, /brand/cinemaxxx-logo-512.png 2x`}
      width={256}
      height={256}
      alt="cinemaxxx"
      decoding="async"
      draggable={false}
    />
  );
}

export default function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`cinemax-logo ${className}`}>
      <CinemaxEmblem />
    </span>
  );
}
