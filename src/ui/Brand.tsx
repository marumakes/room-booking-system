import logoUrl from '../assets/logo.svg'
import { SITE } from '../config'
import { BrandSize } from './brandSize'

// Small: logo beside the name (header). Large: logo above the name, centred (sign-in screens).
const LAYOUT_CLASSES: Record<BrandSize, string> = {
  [BrandSize.Small]: 'flex items-center gap-3',
  [BrandSize.Large]: 'flex flex-col items-center gap-4 text-center',
}

const LOGO_CLASSES: Record<BrandSize, string> = {
  [BrandSize.Small]: 'size-9 rounded-xl',
  [BrandSize.Large]: 'size-20 rounded-3xl shadow-card',
}

const NAME_CLASSES: Record<BrandSize, string> = {
  [BrandSize.Small]: 'text-[15px]',
  [BrandSize.Large]: 'text-lg',
}

type BrandProps = {
  size: BrandSize
}

// Logo and name. The logo is decorative: the name next to it says who it is.
export function Brand({ size }: BrandProps) {
  return (
    <div className={LAYOUT_CLASSES[size]}>
      <img src={logoUrl} alt="" className={LOGO_CLASSES[size]} />
      <div className="leading-tight">
        <p className={`font-semibold tracking-tight ${NAME_CLASSES[size]}`}>{SITE.name}</p>
        <p className="text-sm text-muted">{SITE.appName}</p>
      </div>
    </div>
  )
}
