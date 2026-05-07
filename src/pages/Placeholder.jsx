export default function Placeholder({ title, note }) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="mb-2 text-2xl font-bold text-slate-900">{title}</h1>
      <div className="card">
        <p className="text-sm text-slate-500">{note ?? 'Bu sayfa sıradaki fazda yapılacak.'}</p>
      </div>
    </div>
  );
}
