# Known issues
This is an incomplete list of known issues with the ntfy server, web app, Android app, and iOS app. You can find a complete
list [on GitHub](https://github.com/binwiederhier/ntfy/labels/%F0%9F%AA%B2%20bug), but I thought it may be helpful
to have the prominent ones here to link to.

## iOS app not refreshing (see [#267](https://github.com/binwiederhier/ntfy/issues/267))
For some (many?) users, the iOS app is not refreshing the view when new notifications come in. Until you manually
swipe down, you do not see the newly arrived messages, even though the popup appeared before.

This is caused by some weirdness between the Notification Service Extension (NSE), SwiftUI and Core Data. I am entirely
clueless on how to fix it, sadly, as it is ephemeral and not clear to me what is causing it.

Please send experienced iOS developers my way to help me figure this out.

## Safari does not play sounds for web push notifications
Safari does not support playing sounds for web push notifications, and treats them all as silent. This will be fixed with
iOS 17 / Safari 17, which will be released later in 2023.

## PWA on iOS sometimes crashes with an IndexedDB error (see [#787](https://github.com/binwiederhier/ntfy/issues/787))
When resuming the installed PWA from the background, it sometimes crashes with an error from IndexedDB/Dexie, due to a
[WebKit bug]( https://bugs.webkit.org/show_bug.cgi?id=197050). A reload will fix it until a permanent fix is found.
