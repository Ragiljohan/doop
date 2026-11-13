import { brand } from '../../shared/brand'

/* Pages outside this app. Empty until brand/brand.config.json sets them, so a
   self-hosted server does not send people to the upstream marketing site.
   `docs` falls back to the in-app /docs path. */
export const DOWNLOAD_URL = brand.links.download
export const WEBSITE_URL = brand.links.website
export const DOCS_URL = brand.links.docs || '/docs'
export const SOURCE_URL = brand.links.source
