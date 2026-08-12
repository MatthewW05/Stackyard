// OAuth Device Flow client ID for Stackyard's GitHub App. Device Flow has no
// client secret, so this is safe to embed in the extension source - see
// roadmap Phase 3, feature/github-oauth-device-flow.
//
// To get a real value: sign in to GitHub, go to
// https://github.com/settings/developers -> "New OAuth App", register it
// with any homepage URL and no callback URL, then open the app's settings
// and check "Enable Device Flow". Copy the "Client ID" shown there into the
// placeholder below.
export const GITHUB_OAUTH_CLIENT_ID: string = 'Ov23liCXY359PVLwsu9M';
