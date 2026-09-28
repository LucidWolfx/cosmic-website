/* PUBLIC configuration. Never add Discord secrets, database passwords,
   Supabase secret/service_role keys, bot tokens, or txAdmin credentials. */
window.COSMIC = {
  brand: {
    name: 'Cosmic', tagline: 'Roleplay', accent: '#df2846',
    logo: 'assets/cosmic-mascot.webp', // Owner-approved mascot, preserved from the supplied artwork.
    referenceSheet: 'assets/cosmic-brand-reference.jpg' // Department concept artwork only.
  },
  links: { discord: '', connect: '', support: '', youtube: '', twitch: '', instagram: '', tiktok: '' },
  auth: { supabaseUrl: 'https://mygpttrerwwexljgdiyq.supabase.co', publishableKey: 'sb_publishable_0nTViuh_6URRrT0UBMbdPA_iOqq5nXc' },
  // Authoritative submission settings live in backend cosmic_settings, not this file.
  launch: { label: 'Whitelist applications open', rulesApproved: true },
  status: { endpoint: '', maxAgeSeconds: 180 },
  heroImage: 'assets/cosmic-after-dark.jpg', // Promotional concept artwork, not server gameplay.
  enableDesignPreview: true
};
