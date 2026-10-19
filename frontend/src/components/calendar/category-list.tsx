import { Pencil, Plus } from 'lucide-react'

import { hexFor } from '@/lib/colors'
import type { Category } from '@/types/api'
import { PanelSection } from './panel-section'

interface CategoryListProps {
  categories: Category[]
  /** Opens the category manager, where categories are added, renamed, recoloured and deleted. */
  onManage: () => void
}

/** "Categories": a swatch and name each, with + to add and a hover pencil to edit. */
export function CategoryList({ categories, onManage }: CategoryListProps) {
  return (
    <PanelSection
      title="Categories"
      action={
        <button type="button" aria-label="Add a category" onClick={onManage}
                className="grid size-8 place-items-center rounded-full text-faint hover:bg-white/10 hover:text-foreground">
          <Plus className="size-4" />
        </button>
      }
    >
      {categories.length === 0 && <p className="px-2 py-1 text-sm text-faint">No categories yet</p>}
      <ul>
        {categories.map((category) => (
          <li key={category.id} className="group flex h-8 items-center gap-3 rounded-md px-2 text-sm hover:bg-white/10">
            <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ background: hexFor(category.color_key) }} />
            <span className="min-w-0 flex-1 truncate">{category.name}</span>
            <button
              type="button"
              aria-label={`Edit ${category.name}`}
              onClick={onManage}
              className="grid size-6 place-items-center rounded-full text-faint opacity-0 group-hover:opacity-100
                         hover:bg-white/10 hover:text-foreground focus-visible:opacity-100 pointer-coarse:opacity-100"
            >
              <Pencil className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </PanelSection>
  )
}
