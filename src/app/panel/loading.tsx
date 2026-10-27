/* Sayfa geçişlerinde anında görünen iskelet (veri gelene kadar) */
export default function Loading() {
  return (
    <div className="grid gap-4 animate-pulse" aria-busy="true" aria-label="Yükleniyor">
      <div className="h-8 w-56 rounded-lg bg-sunk" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-sunk" />)}
      </div>
      <div className="h-[60vh] rounded-xl bg-sunk" />
    </div>
  );
}
