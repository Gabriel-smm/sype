import { typeColor, typeLabel } from '@/lib/task-meta'

/** Sype's subject pill, tinted by the kind of work. */
export function SubjectPill({ taskType }: { taskType: string }) {
  const color = typeColor(taskType)
  return (
    <span
      className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 10%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 20%, transparent)`,
      }}
    >
      {typeLabel(taskType)}
    </span>
  )
}
