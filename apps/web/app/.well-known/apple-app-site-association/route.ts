import { env } from "@/lib/env";

// Apple fetches this file to link the iOS app to this domain, so iCloud
// Keychain and other password managers offer the site's saved passwords
// inside the app. The app declares `webcredentials:<domain>` to match.
export function GET() {
  return Response.json({
    webcredentials: { apps: env.appleAppIds },
  });
}
