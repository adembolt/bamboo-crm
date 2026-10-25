import Image from "next/image";

export function BambooLogo({ size = 40 }: { size?: number }) {
  return (
    <span className="grid place-items-center rounded-full bg-white shadow-card flex-none overflow-hidden" style={{ width: size, height: size }}>
      <Image src="/logo.png" alt="Bamboo Beauty Lifes" width={Math.round(size * 0.78)} height={Math.round(size * 0.78 * 153 / 160)} priority />
    </span>
  );
}
