---
status: current
---

# Station remote access from a phone: options (2026-10-23)

Station binds 127.0.0.1 only (scripts/station.js:479). Today: Tailscale (`tailscale serve`, which fronts localhost). Question: which two others to add.

## Table

| Option | Needs bind beyond 127.0.0.1? | Free tier | Phone app | Windows | Auth model | Setup steps |
|---|---|---|---|---|---|---|
| Tailscale Serve (today) | No, proxies localhost, tailnet-only | Personal plan free | iOS/Android | Yes | Device + identity login; tailnet ACL | ~3 (install both ends, login, `tailscale serve`) |
| Tailscale Funnel | No | Same | Not needed (public URL) | Yes | None by default, public internet; station would need its own auth | ~4 |
| Cloudflare Tunnel + Access | No, `cloudflared` dials out to localhost origin; firewall can stay closed | Zero Trust free up to 50 users (third-party sources) | No app needed: browser hits a public hostname behind an Access login (WARP app only for private-network mode) | Yes (third-party sources; official page silent) | Cloudflare Access policy (Google/GitHub/email OTP) before traffic reaches origin | ~5-6 (Cloudflare account, a domain on Cloudflare, install cloudflared, create tunnel + hostname, add Access policy) |
| ngrok + OAuth | No, agent dials out | Free tier exists; whether OAuth policy is free is unconfirmed in docs | No app; browser only | Yes | OAuth/IdP sign-in via traffic policy, email-domain rules | ~4 (account, authtoken, `ngrok http`, policy) |
| NetBird | No on the server side if station is reached through a proxy; otherwise a mesh peer would need station to listen on the NetBird interface (bind change) | Cloud has a free tier (limits not confirmed); fully self-hostable | Yes (docs mention mobile peers; app details not confirmed) | Yes | Mesh VPN, SSO plus ACLs | ~3-4 |
| ZeroTier | Yes: it is a virtual LAN, so station must listen on the ZeroTier address, or a local proxy must forward | Free tier (limit not confirmed) | iOS/Android | Yes | Network ID + member approval; weaker identity policy than Tailscale per a comparison blog | ~4 |
| Plain WireGuard | Yes, same as ZeroTier; plus router/port-forward or a public relay | Free, open source | iOS/Android | Yes | Static keypairs, no identity layer | 6+ (keys, config both ends, port-forward) |
| Headscale | Same as Tailscale Serve (uses Tailscale clients) | Free, self-hosted | Tailscale apps | Client yes; server on Linux | Self-run control plane | 6+ (needs a VPS) |

## Reading

- Tailscale, NetBird, ZeroTier are mesh VPNs: the phone joins a private network. Only Tailscale (Serve) and the outbound-tunnel services (Cloudflare, ngrok) front localhost without a bind change.
- Cloudflare and ngrok expose a public URL, so authentication happens at their edge before traffic reaches station. Station itself stays unauthenticated behind them, which is acceptable only because the edge enforces login. A misconfigured policy exposes station to the internet.
- Mesh VPNs ZeroTier and WireGuard need a bind or proxy change in station, which is a security trade (listening on a non-loopback interface).

## Gaps (not verified)

Official Cloudflare, NetBird and ngrok pages fetched were thin: Windows support, mobile apps, free-tier caps and whether ngrok OAuth is free came from third-party blogs or were unconfirmed. Check the vendor pricing pages before committing.

## Recommendation

1. Cloudflare Tunnel + Access: no phone app, no bind change, free tier, real identity login at the edge. Cost: needs a domain on Cloudflare and public-URL exposure behind a policy.
2. NetBird: the closest Tailscale-like mesh VPN with a phone app and a free cloud tier, self-hostable, so it covers the "no dependence on Tailscale's control plane" case. Pair it with a local proxy or interface bind. (ngrok + OAuth is the runner-up if a domain is unwanted, but its free-tier OAuth is unconfirmed.)

## Sources

- [Cloudflare Tunnel docs](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [ngrok OAuth traffic policy](https://ngrok.com/docs/traffic-policy/actions/oauth/)
- [NetBird how it works](https://docs.netbird.io/about-netbird/how-netbird-works)
- [Mesh VPN compared 2026 (wz-it)](https://wz-it.com/en/blog/mesh-vpn-comparison-2026-overview/)
- [Tailscale vs ZeroTier 2026](https://speedtesthq.com/compare/tailscale-vs-zerotier)
- [NetBird vs Tailscale (wz-it)](https://wz-it.com/en/blog/netbird-vs-tailscale-comparison/)
- [Free VPN: Cloudflare Tunnel & WARP guide](https://orthogonal.info/free-vpn-cloudflare-tunnel-warp-zero-trust-guide/)
- [Cloudflare Tunnel (toolradar)](https://toolradar.com/tools/cloudflare-tunnel)
