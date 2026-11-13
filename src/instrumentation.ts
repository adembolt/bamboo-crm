export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && !process.env.VERCEL) {
    const { startAutoUpdate } = await import("@/lib/self-update");
    startAutoUpdate();
  }
}
