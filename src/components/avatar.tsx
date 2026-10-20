// Google-style initial avatar with a stable color per name.
const COLORS = [
  "bg-[#1a73e8]",
  "bg-[#d93025]",
  "bg-[#188038]",
  "bg-[#e37400]",
  "bg-[#9334e6]",
  "bg-[#007b83]",
  "bg-[#c5221f]",
  "bg-[#185abc]",
];

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-medium text-white ${
        COLORS[Math.abs(hash) % COLORS.length]
      }`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
