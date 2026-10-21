import type { ComponentProps, ReactNode } from 'react'

type Variant = 'primary' | 'gold' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[#7cecff] to-[#2fb8f0] text-ink-950 shadow-[0_8px_30px_-8px_rgba(95,227,255,0.7),inset_0_1px_0_rgba(255,255,255,0.6)] hover:brightness-110',
  gold: 'bg-gradient-to-b from-[#ffd97a] to-[#ff9d3d] text-ink-950 shadow-[0_8px_30px_-8px_rgba(255,170,61,0.7),inset_0_1px_0_rgba(255,255,255,0.6)] hover:brightness-110',
  secondary:
    'bg-white/[0.06] text-mist border border-white/10 hover:bg-white/[0.1] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]',
  ghost: 'bg-transparent text-haze hover:text-mist hover:bg-white/[0.05]',
  danger: 'bg-coral/15 text-coral border border-coral/40 hover:bg-coral/25',
}

interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  block?: boolean
}

export function Button({ variant = 'secondary', size = 'md', icon, block, className = '', children, ...rest }: ButtonProps) {
  const sizes = {
    sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
    md: 'h-12 px-5 text-[15px] rounded-2xl gap-2',
    lg: 'h-14 px-6 text-base rounded-2xl gap-2.5',
  }
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-display font-semibold tracking-wide transition-[transform,filter,background-color,opacity] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:hover:brightness-100 ${sizes[size]} ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className = '',
  children,
  ...rest
}: ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`glass inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-mist transition active:scale-95 hover:text-white ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
