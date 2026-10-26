# rfc2119ify

A browser extension that rewrites the
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) key words (MUST, MUST NOT,
REQUIRED, SHALL, SHALL NOT, SHOULD, SHOULD NOT, RECOMMENDED, NOT RECOMMENDED,
MAY, OPTIONAL) on Bikeshed specs into whatever case you pick.

Modes, set on the extension's options page:

- UPPERCASE, the default
- lowercase
- Prose case: lowercase, capitalized when the word starts a sentence, heading
  or list item
- aLtErNaTiNg
- As the editors wrote it

Manifest V3, one source tree for Chrome, Firefox and Safari.

## Install

Chrome: `chrome://extensions`, turn on Developer mode, Load unpacked, pick
`src/`.

Firefox: `about:debugging#/runtime/this-firefox`, Load Temporary Add-on, pick
`src/manifest.json`. For a permanent install, `npm run build` and sign the zip
through AMO.

Safari: on a Mac with Xcode, run `scripts/safari.sh`, open the project it
writes under `safari/`, and run the "rfc2119ify" scheme. Then enable the
extension in Safari Settings > Extensions and allow it on all websites. An
unsigned build also needs Settings > Developer > Allow unsigned extensions.
