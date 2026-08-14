// Day 91: A GATE MUST NEVER REFUSE WITHOUT SAYING SO.
//
// After several window.prompt calls in one session, Chrome offers "prevent this page from creating
// additional dialogs" - and once that is ticked EVERY prompt returns null instantly, with no dialog
// shown. Every gate built on a prompt then refuses without a word: the button does nothing, the
// console is clean, and nothing on screen explains it. It cost the founder half an hour on Day 90
// and bit three separate gates in one day, twice during demo preparation.
//
// This does not defeat the suppression - nothing in the page can. What it does is make the refusal
// AUDIBLE: if the answer comes back empty, the caller is told to say so, and the broker learns that
// the act was cancelled rather than that the app is broken.
//
// It also distinguishes the two cases the native prompt cannot:
//   - CANCELLED: the user pressed Cancel or left it blank. Normal, and the toast is quiet.
//   - SUPPRESSED: the prompt returned in under ~50ms, which no human can do. That is the browser,
//     and the toast says so and tells him to reload.
//
// Usage:  const reason = askReason("...", showToast);  if (!reason) return;

export function askReason(question, showToast, opts = {}) {
  const t0 = Date.now();
  const answer = window.prompt(question);
  const elapsed = Date.now() - t0;

  // Nobody reads a question and answers it in 50ms. If it came back that fast with nothing, the
  // browser never showed it.
  if (answer === null && elapsed < 50) {
    showToast?.(
      "Your browser has blocked this app's dialogs, so nothing was asked and nothing was changed. Reload the page (Ctrl+Shift+R) and try again.",
      "error"
    );
    return null;
  }

  if (answer === null) {
    if (!opts.quiet) showToast?.("Cancelled - nothing was changed", "info");
    return null;
  }

  if (!answer.trim()) {
    // An empty answer to a mandatory reason is a refusal, and it should read as one rather than as
    // a button that did nothing.
    if (!opts.allowEmpty) {
      showToast?.("A reason is required - nothing was changed", "warning");
      return null;
    }
    return "";
  }

  return answer.trim();
}
