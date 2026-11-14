import { brand } from '../../shared/brand'

/* Pages outside this app. Empty until brand/brand.config.json sets them, so a
   self-hosted server does not send people to the upstream marketing site. */
export const DOWNLOAD_URL = brand.links.download
export const WEBSITE_URL = brand.links.website
/** Empty when brand config turns the Source link off (`showSourceLink`). */
export const SOURCE_URL = brand.showSourceLink ? brand.links.source : ''
