# Before you go live

Work through this with an agent before real people use {{PROJECT_NAME}}, and again before each big release. Agents tick what they can check, and turn the rest into entries in `docs/operator/todo.md` (things you do) or `docs/operator/mtest.md` (things you try). Skip any section that doesn't apply, and say why.

## Safe

- [ ] The technical security checklist in `docs/security.md` ("Before you go live") is done.
- [ ] `node .agents/scripts/health.mjs` shows nothing to fix.
- [ ] Every key the live app needs is in the host's settings (not only on your computer), and test keys are not used live.

## Money

- [ ] **Every paid service has a monthly spending limit and a billing alert to your email:** AI APIs, hosting, database, email and SMS. One bug in a loop can run up a large bill overnight.
- [ ] Anything that costs money per use (AI calls, emails, texts, uploads) is rate limited, so one person can't run up your bill.
- [ ] Payments work end to end in test mode, and you have made one small real payment and refunded it.

## Legal basics

This is a reminder list, not legal advice. Check what applies where your users live.

- [ ] A privacy policy says what you collect, why, who you share it with, and how to ask for it to be deleted.
- [ ] Terms of use, if people sign up or pay.
- [ ] A cookie banner, if you use tracking or advertising cookies and have visitors from places that require consent (for example the EU and the UK).
- [ ] A way to delete someone's account and data when they ask, and to give them a copy of it.
- [ ] Marketing emails have an unsubscribe link. Sign-up does not opt people into marketing by default.
- [ ] If children could use it, or you handle health or financial data, you have checked the extra rules that apply.

## Name and email

- [ ] Your domain points at the live app, and the address works with and without `www`, over `https`.
- [ ] Email the app sends (sign-up, password reset, receipts) arrives in the inbox, not spam: the email provider's domain checks (SPF, DKIM, DMARC) show as passing in its dashboard.
- [ ] Replies to the app's emails go somewhere you read.

## Works for everyone

- [ ] Every main page works on a phone, and you have tried it on your own phone.
- [ ] Every page works by keyboard alone, text is readable (contrast), and images have alt text.
- [ ] Pages load in a few seconds on a phone connection.
- [ ] Error pages and empty states (no items yet, nothing found) say something helpful.

## After launch

- [ ] Errors in the live app reach you (an error-tracking service, or the host's alerts) by email.
- [ ] You get told if the site goes down (an uptime check that emails you).
- [ ] Backups run automatically, and you have restored one at least once.
- [ ] You know how to undo a bad deploy (`docs/operator/guide.md`).
- [ ] Once a month: ask an agent to run the health check, update dependencies, and check for known security problems in them.
