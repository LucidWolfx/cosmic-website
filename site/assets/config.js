/* PUBLIC configuration. Never add Discord secrets, database passwords,
   Supabase secret/service_role keys, bot tokens, or txAdmin credentials. */
window.COSMIC = {
  brand: {
    name: 'Cosmic', tagline: 'San Andreas Roleplay', accent: '#8ac7f3',
    logo: '', // Final full-width logo path. Takes priority over the reference sheet.
    referenceSheet: 'assets/cosmic-brand-reference.jpg' // Provisional user-supplied board.
  },
  links: { discord: '', connect: '', support: '', youtube: '', twitch: '', instagram: '', tiktok: '' },
  auth: { supabaseUrl: 'https://mygpttrerwwexljgdiyq.supabase.co', publishableKey: 'sb_publishable_0nTViuh_6URRrT0UBMbdPA_iOqq5nXc' },
  // Authoritative submission settings live in backend cosmic_settings, not this file.
  launch: { label: 'Whitelist transition planned', rulesApproved: true },
  status: { endpoint: '', maxAgeSeconds: 180 },
  heroImage: '', // Final standalone cover. Empty displays the top of the supplied reference.
  enableDesignPreview: true
};
