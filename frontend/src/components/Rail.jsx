const ICONS = {
  today: (
    <>
      <circle cx="10" cy="10" r="3.2" />
      <path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" />
    </>
  ),
  add: <path d="M10 4.5v11M4.5 10h11" strokeWidth="1.8" />,
  calendar: (
    <>
      <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
      <path d="M3 8.5h14M7 3v3M13 3v3" />
      <rect x="6" y="11" width="4" height="3" rx="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  tasks: (
    <>
      <circle cx="5" cy="5.5" r="2.2" />
      <circle cx="5" cy="14.5" r="2.2" />
      <path d="M9.5 5.5H17M9.5 14.5H17" />
      <path d="M3.6 14.5l1 1 1.8-2.1" strokeWidth="1.6" />
    </>
  ),
  chat: (
    <>
      <path d="M3.5 5.5a2 2 0 012-2h9a2 2 0 012 2v6a2 2 0 01-2 2H8l-4 3.2V13.5a2 2 0 01-.5-1.3z" />
      <path d="M7 7.5h6M7 10h4" />
    </>
  ),
  parameters: (
    <>
      <path d="M3.5 6h9M15 6h1.5M3.5 14h5M11 14h5.5" />
      <circle cx="13.6" cy="6" r="1.9" />
      <circle cx="9.4" cy="14" r="1.9" />
    </>
  ),
}

function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  )
}

/**
 * The app shell's navigation. A rail rather than a top tab bar, so the week
 * grid keeps the full width of the window. Adding a task is the one action
 * that is always in reach, so it sits above the pages (a floating button on
 * phones); chat opens beside whatever page is showing.
 */
export default function Rail({ pages, current, onNavigate, onAdd, onChat, pendingCount, online }) {
  const item = (active) =>
    `relative flex flex-1 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px]
     transition-colors md:w-[60px] md:flex-none ${
       active ? 'bg-ink-800 text-chalk' : 'text-chalk-faint hover:bg-ink-850 hover:text-chalk-dim'
     }`

  return (
    <>
      <nav
        aria-label="Sections"
        className="flex shrink-0 gap-1 border-ink-800 bg-ink-900
                   max-md:sticky max-md:bottom-0 max-md:z-30 max-md:order-last max-md:border-t max-md:px-2 max-md:py-1
                   md:w-[76px] md:flex-col md:items-center md:gap-0.5 md:border-r md:py-3"
      >
        <button
          type="button"
          onClick={onAdd}
          title="Add a task (n)"
          className="mb-3 hidden size-11 place-items-center rounded-xl bg-lamp text-ink-950
                     transition-colors hover:bg-[#f0be66] md:grid"
        >
          <Icon name="add" />
          <span className="sr-only">Add a task</span>
        </button>

        {pages.map(({ key, label, icon }) => {
          const active = current === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? 'page' : undefined}
              className={item(active)}
            >
              <span className="relative">
                <Icon name={icon} />
                {key === 'tasks' && pendingCount > 0 && (
                  <span
                    className="absolute -top-1 -right-2 min-w-[15px] rounded-full bg-lamp px-1
                               text-[9px] leading-[15px] font-semibold text-ink-950 tnum"
                  >
                    {pendingCount}
                  </span>
                )}
              </span>
              {label}
            </button>
          )
        })}

        <button type="button" onClick={onChat} className={`${item(false)} md:mt-3`}>
          <Icon name="chat" />
          Chat
        </button>

        <span
          title={online ? 'Connected to the scheduler' : 'The scheduler is not responding'}
          className={`mt-auto hidden size-1.5 rounded-full md:block ${
            online ? 'bg-type-problem' : 'bg-alarm'
          }`}
        >
          <span className="sr-only">{online ? 'Connected' : 'Offline'}</span>
        </span>
      </nav>

      <button
        type="button"
        onClick={onAdd}
        aria-label="Add a task"
        className="fixed right-4 bottom-[76px] z-30 grid size-14 place-items-center rounded-full
                   bg-lamp text-ink-950 shadow-xl md:hidden"
      >
        <Icon name="add" />
      </button>
    </>
  )
}
