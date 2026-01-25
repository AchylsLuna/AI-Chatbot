type LogoMarkProps = {
  title?: string
}

export function LogoMark({ title = 'The Health Care' }: LogoMarkProps) {
  return (
    <div className="inline-flex items-center gap-3 text-lg font-extrabold text-navy" aria-label={title} role="img">
      <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#113b7e] shadow-lg">
        <svg className="h-6 w-6" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
          <path
            d="M6 20c3.5 0 3.5-8 7-8s3.5 8 7 8 3.5-8 7-8"
            fill="none"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-white"
          />
        </svg>
      </span>
      <span>{title}</span>
    </div>
  )
}
