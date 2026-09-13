// Side-effect barrel: importing this once (from main.tsx, before the app
// renders) registers every non-English language with useI18n's internal
// `translations` map via each file's own `registerTranslations(code, dict)`
// call. English needs no entry here — it's the default already baked into
// useI18n.tsx. Adding a language later is exactly: write its file the same
// way the files below do, then add one import line here.
import "./es";
import "./fr";
import "./pt";
import "./de";
import "./hi";
