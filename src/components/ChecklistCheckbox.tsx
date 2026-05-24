import { toggleChecklistItem } from '@/lib/actions'

export function ChecklistCheckbox({
  id, done, label,
}: { id: string; done: boolean; label: string }) {
  return (
    <form action={toggleChecklistItem}>
      <input type="hidden" name="id" value={id} />
      <label className="flex gap-2 items-center cursor-pointer text-sm">
        <button
          type="submit"
          className={`w-4 h-4 rounded border-2 flex-shrink-0 grid place-items-center transition ${
            done ? 'border-sage bg-sage' : 'border-line bg-paper-pure hover:border-sage'
          }`}
        >
          {done && <span className="text-paper-pure text-[10px] leading-none">✓</span>}
        </button>
        <span className={done ? 'line-through text-ink-muted' : 'text-ink'}>{label}</span>
      </label>
    </form>
  )
}
