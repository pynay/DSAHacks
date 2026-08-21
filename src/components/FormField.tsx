export const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500';

export default function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
    </label>
  );
}
