# Alai server

A self-hosted push notification server, and the backend for the [Alai](https://github.com/linusr/ntfy-ios) iOS and
watchOS app. It is a hard fork of [ntfy](https://github.com/binwiederhier/ntfy) that delivers to iOS directly through
Apple Push Notification service (APNs) and ships a redesigned web app.

The HTTP API, message format and `ntfy` CLI stay compatible with ntfy, so ntfy clients, integrations and the
[ntfy documentation](https://docs.ntfy.sh) for publishing and subscribing apply unchanged.

## Differences from ntfy

| | ntfy | This fork |
|---|---|---|
| iOS delivery from a self-hosted server | Poll request relayed through ntfy.sh and Firebase | Direct to APNs with your own auth key |
| Message content in push | `New message`; the app fetches the content | Full message, or IDs only with `apns-payload: minimal` |
| iOS app | Official ntfy app | [Alai](https://github.com/linusr/ntfy-ios), built and signed by your Apple Developer team |
| Android push | Firebase Cloud Messaging (FCM) for ntfy.sh-connected apps | Not supported; the ntfy Android app uses its own connection |
| Hosted-service features | Stripe payments, Twilio phone calls | Not included; tiers remain as a limits mechanism |
| Web app | ntfy design | Redesigned, branded Alai |

APNs delivery requires an [Apple Developer Program](https://developer.apple.com/programs/) membership, since pushes
must be signed by the team that owns the app.

## Upstream

The fork split from ntfy at v2.28.0 (`fork-base` tag). Upstream changes, security fixes first, are cherry-picked
selectively rather than merged; [UPSTREAM.md](UPSTREAM.md) holds the policy and the log of what was taken.

## Compatibility

- APNs support is opt-in: without `apns-key-file`, the server behaves as ntfy for the web app, the CLI and the ntfy
  Android app, which receives messages through its own connection to the server.
- The official ntfy iOS app is not supported: it depends on the ntfy.sh poll-request relay (`upstream-base-url`),
  which this server does not implement.
- FCM delivery to the ntfy Android app, Stripe payments and Twilio phone calls are not implemented. The options
  `firebase-key-file`, `upstream-base-url`, `upstream-access-token`, `stripe-secret-key`, `stripe-webhook-key`,
  `billing-contact` and `twilio-*` are ignored with a warning at startup. Publishing with `X-Call` returns HTTP 400;
  the `X-Firebase` header is accepted and ignored.
- [Alai](https://github.com/linusr/ntfy-ios) also works with stock ntfy servers, without instant push, since they
  have no `/v1/apns` endpoint.

## Running

Images for `linux/amd64` and `linux/arm64` are published to `ghcr.io/linusr/ntfy`:

| Tag | Source |
|---|---|
| `main` | Latest commit on `main` |
| `sha-<commit>` | A specific commit |
| `<version>`, `latest` | `fork-v<version>` release tags |

### Podman with systemd

[`deploy/podman/alai.container`](deploy/podman/alai.container) is a [Quadlet](https://docs.podman.io/en/latest/markdown/podman-systemd.unit.5.html)
unit: systemd generates `alai.service` from it. It mounts the standard ntfy paths, so configuration and data from a
package install are used in place.

```sh
install -m 0644 deploy/podman/alai.container /etc/containers/systemd/
systemctl daemon-reload
systemctl start alai
systemctl enable --now podman-auto-update.timer   # pull new images of the same tag daily
```

| Path | Contents |
|---|---|
| `/etc/ntfy` | `server.yml` and the APNs auth key (mounted read-only) |
| `/var/cache/ntfy` | Message cache, APNs device registrations, attachments |
| `/var/lib/ntfy` | User database |

The container listens on `127.0.0.1:2586` (`PublishPort`); set it to the address your reverse proxy forwards to.
Administration runs inside the container, e.g. `podman exec alai ntfy user list`.

### Migrating from the Debian package

[`deploy/podman/migrate-from-deb.sh`](deploy/podman/migrate-from-deb.sh) backs up the configuration and data, stops
and disables `ntfy.service`, installs the Quadlet unit and starts `alai.service`, then checks its health. The package
stays installed until you remove it with `apt remove ntfy` (not `purge`, which deletes `/etc/ntfy`); remove its APT
source as well so upgrades cannot reinstall the service.

## APNs setup

APNs delivery needs an [Apple Developer Program](https://developer.apple.com/programs/) membership, and the iOS app must
be built by the same team whose key the server uses.

### 1. Register the app

The app's bundle ID (e.g. `me.4vr.alai`) must exist under your team with the Push Notifications capability. Building
[Alai](https://github.com/linusr/ntfy-ios) to a device with automatic signing registers it; otherwise add it under
*Certificates, Identifiers & Profiles → Identifiers*.

### 2. Create an APNs auth key

1. Open *Certificates, Identifiers & Profiles → Keys* and click **+**.
2. Name the key, enable **Apple Push Notifications service (APNs)** and click **Configure**.
3. Choose the environment: **Sandbox**, **Production**, or **Sandbox & Production**, then register the key.
4. Download `AuthKey_<KEYID>.p8`. Apple offers the download only once.
5. Note the **Key ID** (shown next to the key) and your **Team ID** (top right of the portal, or *Membership details*).

The key must cover the environment of the app build: Xcode debug builds use the sandbox, TestFlight and App Store
builds use production. A **Sandbox & Production** key serves both. A key serves every app of the team and does not
expire.

### 3. Configure the server

Place the key in `/etc/ntfy`, e.g. `/etc/ntfy/AuthKey_ABC123DEFG.p8` with mode `0600` (the container reads it as
root; for a package install, make it owned by the `ntfy` user), and add to `server.yml`:

```yaml
base-url: "https://ntfy.example.com"
apns-key-file: "/etc/ntfy/AuthKey_ABC123DEFG.p8"
apns-key-id: "ABC123DEFG"
apns-team-id: "DEF123GHIJ"
apns-bundle-id: "me.4vr.alai"
apns-file: "/var/cache/ntfy/apns.db"   # not needed with database-url
# apns-payload: "minimal"              # send only message IDs through Apple
```

Restart the server. It refuses to start if any required option is missing or the key cannot be parsed.

### 4. Verify

1. Open the app and subscribe to a topic. *Settings → Servers* shows **Instant delivery** once the device registered.
2. Publish a test message: `curl -H "Priority: high" -d "Hello from APNs" https://ntfy.example.com/mytopic`
3. With `log-level: debug`, the server logs `Publishing to 1 APNs device(s)` for each message.

### Troubleshooting

Delivery failures are logged at warning level with the reason Apple returned. A device rejected with
`BadDeviceToken` or `DeviceTokenNotForTopic` is removed and re-registers on the next app launch, so fix the
configuration before reopening the app.

| Reason | Cause |
|---|---|
| `InvalidProviderToken` | Key ID or Team ID does not match the key file |
| `BadEnvironmentKeyInToken` | The key does not cover the environment of the device token; create a key for **Sandbox & Production** |
| `DeviceTokenNotForTopic` | `apns-bundle-id` differs from the installed app's bundle ID |
| `BadDeviceToken` | Token from the other environment: Xcode debug builds use the sandbox, TestFlight and App Store builds use production. The app sends its environment when registering, so this indicates a mismatched build configuration |
| `TopicDisallowed` | The bundle ID lacks the Push Notifications capability |
| `TooManyRequests` | Apple is throttling this device; delivery resumes on its own |

Devices whose app was deleted are removed silently. Settings in the app shows **APNs not enabled on server** when
`/v1/apns` returns 404, i.e. when `apns-key-file` is not set.

Priorities map to iOS interruption levels, messages sharing a sequence ID replace each other, and deletes withdraw
delivered notifications. The full reference is in the
[APNs section of the configuration docs](docs/config.md#apple-push-notification-service-apns).

## Building

```sh
make cli-deps-static-sites   # placeholder web app and docs
go build -o ntfy .
go test ./apns/ ./server/ -run APNS
```

`Dockerfile-build` builds the complete image including the web app and docs.

## License
This fork is based on ntfy, made by [Philipp C. Heckel](https://heckel.io) and its
[contributors](https://github.com/binwiederhier/ntfy/graphs/contributors), and keeps its licensing: the project is dual licensed under the [Apache License 2.0](LICENSE) and the [GPLv2 License](LICENSE.GPLv2).

Third-party libraries and resources:
* [github.com/urfave/cli](https://github.com/urfave/cli) (MIT) is used to drive the CLI
* [Mixkit sounds](https://mixkit.co/free-sound-effects/notification/) (Mixkit Free License) are used as notification sounds
* [Sounds from notificationsounds.com](https://notificationsounds.com) (Creative Commons Attribution) are used as notification sounds
* [Roboto Font](https://fonts.google.com/specimen/Roboto) (Apache 2.0) is used as a font in everything web
* [React](https://reactjs.org/) (MIT) is used for the web app
* [Material UI components](https://mui.com/) (MIT) are used in the web app
* [MUI dashboard template](https://github.com/mui/material-ui/tree/master/docs/data/material/getting-started/templates/dashboard) (MIT) was used as a basis for the web app
* [Dexie.js](https://github.com/dexie/Dexie.js) (Apache 2.0) is used for web app persistence in IndexedDB
* [GoReleaser](https://goreleaser.com/) (MIT) is used to create releases
* [go-smtp](https://github.com/emersion/go-smtp) (MIT) is used to receive e-mails
* [stretchr/testify](https://github.com/stretchr/testify) (MIT) is used for unit and integration tests
* [github.com/mattn/go-sqlite3](https://github.com/mattn/go-sqlite3) (MIT) is used to provide the persistent message cache
* [github/gemoji](https://github.com/github/gemoji) (MIT) is used for emoji support (specifically the [emoji.json](https://raw.githubusercontent.com/github/gemoji/master/db/emoji.json) file)
* Go's [text/template](https://pkg.go.dev/text/template) (BSD-3-Clause) is vendored under [template/gotext/](template/gotext/) with a small patch adding an execution deadline (see [template/gotext/README.md](template/gotext/README.md))
* [Lightbox with vanilla JS](https://yossiabramov.com/blog/vanilla-js-lightbox) as a lightbox on the landing page 
* [HTTP middleware for gzip compression](https://gist.github.com/CJEnright/bc2d8b8dc0c1389a9feeddb110f822d7) (MIT) is used for serving static files
* [Regex for auto-linking](https://github.com/bryanwoods/autolink-js) (MIT) is used to highlight links (the library is not used)
* [Statically linking go-sqlite3](https://www.arp242.net/static-go.html)
* [Linked tabs in mkdocs](https://facelessuser.github.io/pymdown-extensions/extensions/tabbed/#linked-tabs)
* [webpush-go](https://github.com/SherClockHolmes/webpush-go) (MIT) is used to send web push notifications
* [Sprig](https://github.com/Masterminds/sprig) (MIT) is used to add template parsing functions
