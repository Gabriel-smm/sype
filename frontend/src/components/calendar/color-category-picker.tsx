import { Check } from 'lucide-react'

import { COLOR_HEX, COLOR_LABELS, EVENT_INK, hexFor } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { COLOR_KEYS, type Category, type ColorKey } from '@/types/api'

export type ColorPick = { color_key: ColorKey } | { category_id: number }

interface Props {
  value: { color_key: ColorKey | null; category_id: number | null }
  categories: Category[]
  onPick: (pick: ColorPick) => void
}

/** Eleven pastel swatches, then the categories. A category pick wins over a swatch. */
export function ColorCategoryPicker({ value, categories, onPick }: Props) {
  return (
    <div className="space-y-3">
      <div role="group" aria-label="Colour" className="grid grid-cols-[repeat(11,minmax(0,1fr))] gap-1.5">
        {COLOR_KEYS.map((key) => {
          const selected = value.category_id == null && value.color_key === key
          return (
            <button
              key={key}
              type="button"
              aria-label={COLOR_LABELS[key]}
              aria-pressed={selected}
              title={COLOR_LABELS[key]}
              onClick={() => onPick({ color_key: key })}
              className="flex aspect-square min-w-0 items-center justify-center rounded-full outline-hidden
                         focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
              style={{ backgroundColor: COLOR_HEX[key], color: EVENT_INK }}
            >
              {selected && <Check aria-hidden className="size-3.5" strokeWidth={3} />}
            </button>
          )
        })}
      </div>
      {categories.length > 0 && (
        <div role="group" aria-label="Category" className="space-y-0.5">
          {categories.map((category) => {
            const selected = value.category_id === category.id
            return (
              <button
                key={category.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onPick({ category_id: category.id })}
                className={cn(
                  `flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-sm outline-hidden hover:bg-white/10
                   focus-visible:ring-2 focus-visible:ring-ring`,
                  selected && 'bg-white/10',
                )}
              >
                <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: hexFor(category.color_key) }} />
                <span className="min-w-0 flex-1 truncate">{category.name}</span>
                {selected && <Check aria-hidden className="size-4 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
