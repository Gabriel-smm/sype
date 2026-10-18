/** Sype's app backdrop: two faint blobs drifting behind the panels. */
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] animate-blob rounded-full bg-blue-600/[0.07] mix-blend-screen blur-[120px]" />
      <div className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] animate-blob rounded-full bg-slate-400/[0.07] mix-blend-screen blur-[120px] animation-delay-2000" />
    </div>
  )
}
