export function Avatar({
  initials,
  color = "var(--brand-600)",
  size = 38,
  photoUrl,
}: {
  initials: string;
  color?: string;
  size?: number;
  photoUrl?: string | null;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={initials}
        className="inline-block shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: color, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}
