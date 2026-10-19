import { Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Label, NativeSelect } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { COLOR_LABELS, hexFor } from '@/lib/colors'
import type { Category, CategoryChanges, CategoryInput, ColorKey } from '@/types/api'
import { ColorCategoryPicker } from './color-category-picker'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onCreate: (input: CategoryInput) => Promise<boolean>
  onUpdate: (id: number, changes: CategoryChanges) => Promise<boolean>
  onDelete: (id: number, reassignTo?: number) => Promise<boolean | void>
}

export function CategoryManagerDialog({ open, onOpenChange, categories, onCreate, onUpdate, onDelete }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorKey>('sky')
  const [deleting, setDeleting] = useState<number | null>(null)

  const add = async (event: FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    if (await onCreate({ name: trimmed, color_key: color })) setName('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:w-[min(460px,92vw)]">
        <div className="space-y-4 p-5">
          <DialogTitle className="text-xl">Categories</DialogTitle>
          <DialogDescription className="sr-only">Add, rename, recolour or delete categories</DialogDescription>

          <ul className="space-y-1">
            {categories.length === 0 && <li className="text-sm text-sidebar-foreground/60">No categories yet</li>}
            {categories.map((category) => (
              <li key={category.id}>
                <div className="flex items-center gap-2">
                  <SwatchPopover
                    label={`Colour for ${category.name}`}
                    color={category.color_key}
                    onPick={(key) => void onUpdate(category.id, { color_key: key })}
                  />
                  <NameField
                    key={`${category.id}-${category.name}`}
                    value={category.name}
                    onCommit={(next) => void onUpdate(category.id, { name: next })}
                  />
                  <Button
                    variant="ghost" size="icon-sm" aria-label={`Delete ${category.name}`}
                    onClick={() => setDeleting(deleting === category.id ? null : category.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {deleting === category.id && (
                  <DeleteRow
                    category={category}
                    others={categories.filter((c) => c.id !== category.id)}
                    onCancel={() => setDeleting(null)}
                    onConfirm={async (reassignTo) => { await onDelete(category.id, reassignTo); setDeleting(null) }}
                  />
                )}
              </li>
            ))}
          </ul>

          <form onSubmit={add} className="flex items-center gap-2 border-t border-sidebar-border pt-4">
            <SwatchPopover label="Colour for the new category" color={color} onPick={setColor} />
            <Input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="New category" aria-label="New category name" className="h-9"
            />
            <Button type="submit" disabled={!name.trim()}>Add</Button>
          </form>

          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SwatchPopover({ label, color, onPick }: { label: string; color: ColorKey; onPick: (key: ColorKey) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button" aria-label={`${label}, ${COLOR_LABELS[color]}`}
          className="size-6 shrink-0 rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
          style={{ backgroundColor: hexFor(color) }}
        />
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-3" align="start">
        <ColorCategoryPicker
          value={{ color_key: color, category_id: null }}
          categories={[]}
          onPick={(pick) => { if ('color_key' in pick) { onPick(pick.color_key); setOpen(false) } }}
        />
      </PopoverContent>
    </Popover>
  )
}

function NameField({ value, onCommit }: { value: string; onCommit: (name: string) => void }) {
  const [text, setText] = useState(value)
  const commit = () => {
    const trimmed = text.trim()
    if (!trimmed) setText(value)
    else if (trimmed !== value) onCommit(trimmed)
  }
  return (
    <Input
      value={text} aria-label="Category name" className="h-9"
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } }}
    />
  )
}

function DeleteRow({
  category, others, onCancel, onConfirm,
}: {
  category: Category
  others: Category[]
  onCancel: () => void
  onConfirm: (reassignTo?: number) => void | Promise<void>
}) {
  const [target, setTarget] = useState('')
  return (
    <div className="mt-2 ml-8 space-y-2 rounded-md border border-sidebar-border p-3">
      <label className="block">
        <Label>Move its events to…</Label>
        <NativeSelect value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Keep their colour</option>
          {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </NativeSelect>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button variant="destructive" size="sm" onClick={() => void onConfirm(target ? Number(target) : undefined)}>
          Delete {category.name}
        </Button>
      </div>
    </div>
  )
}
