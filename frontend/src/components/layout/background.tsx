/** Sype's hero light: three blurred blobs drifting behind every page. */
export function Background() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] h-[50vw] w-[50vw] animate-blob rounded-full bg-blue-600/15 mix-blend-screen blur-[120px]" />
      <div className="absolute top-[20%] right-[-10%] h-[40vw] w-[40vw] animate-blob rounded-full bg-slate-600/15 mix-blend-screen blur-[120px] animation-delay-2000" />
      <div className="absolute bottom-[-10%] left-[20%] h-[45vw] w-[45vw] animate-blob rounded-full bg-blue-500/10 mix-blend-screen blur-[120px] animation-delay-4000" />
      <div className="absolute bottom-0 left-1/2 h-[500px] w-full -translate-x-1/2 bg-gradient-to-t from-blue-900/20 to-transparent" />
    </div>
  )
}
