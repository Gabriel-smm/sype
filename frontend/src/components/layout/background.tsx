/** Sype's blurred blue light, fixed behind every page and kept dim. */
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-40 left-[8%] size-[520px] rounded-full bg-blue-600/[0.13] blur-[140px]" />
      <div className="absolute top-[45%] -right-40 size-[460px] rounded-full bg-indigo-500/[0.08] blur-[140px]" />
    </div>
  )
}
