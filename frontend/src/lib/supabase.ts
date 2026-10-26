import { createBrowserClient } from "@supabase/ssr";

// Browser client - shares the auth cookies refreshed by middleware.ts
export const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
