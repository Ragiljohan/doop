/** Whether this build can open the support chat at all: PostHog's key was
 *  inlined at build time (src/lib/posthog.ts). Without it "Contact support"
 *  would do nothing, so the editor leaves it out. */
export const supportChatConfigured = !!import.meta.env.VITE_POSTHOG_KEY
