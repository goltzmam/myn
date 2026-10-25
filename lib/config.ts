export function publicConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
export const configured = () =>
  Boolean(publicConfig().url && publicConfig().key);
