/**
 * The one answer for a link that cannot be used, whatever the reason — unknown,
 * or already accepted. Naming no address and drawing no distinction is what
 * stops a link becoming an oracle for who was invited (OWASP A07). The security
 * log is where the distinction survives.
 */
export const INVITATION_UNUSABLE = {
  code: 'INVITATION_UNUSABLE',
  message: 'That link cannot be used.',
} as const;
