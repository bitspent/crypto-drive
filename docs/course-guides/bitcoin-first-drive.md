# Bitcoin first drive — build plan

**Status:** Built. This is the shape that ships. `bitcoin.md` describes how to demo it.

**Audience:** Someone who has never held crypto. Coach tone. Play money only.

**Promise on the track page:** By the end you can receive Bitcoin, prove it arrived, and send a small amount without giving your keys away. About 25 minutes.

Ethereum, USDT, and Solana stay scaffolds. No Gumroad, Supabase, or VIP scheduling in this pass.

---

## Screen law

Every screen has one job, one picture that changes when the learner acts, one coach sentence, and one button.

If a moment needs three beats, it is three screens. The pocket card appears after the action succeeds. It does not sit beside a lecture.

The next stop on the road stays locked until the current stop is done. Earlier stops stay open for review.

---

## The road

One story on every screen: a client is paying you in practice Bitcoin.

| Stop | Minutes | Job | Screens |
| --- | --- | --- | --- |
| 1 · The picture | 2 | Know the rule before touching anything | Cash, not a bank · It does not come back · Play money |
| 2 · Get paid | 8 | Receive and prove it arrived | Give them a place to send · Prove it arrived |
| 3 · Send a little | 8 | Send a tiny test first | The address got swapped · Leave room for the toll · No undo |
| 4 · Guard the car | 8 | See the key, then back up the words | Plate versus key · Write the 12 words |
| 5 · Road test | 5 | Mix the moves. One certificate | Support wants the words · Wrong road · Address does not match |

### 1 · The picture

No typing. Three taps, then one button: “Show me how I get paid.”

1. A coin moves from the client to them. “Bitcoin is cash on the internet. No bank approves the send.”
2. The coin leaves and undo is gone. “Once it leaves, it is gone. Like handing someone a bill.”
3. A practice stamp. “You will not connect a real wallet.”

### 2 · Get paid

**Give them a place to send.** A large practice address labeled “Share this,” and a gray key labeled “Never share this.” They copy the address, then type the first 4 and last 4 characters from a second screen. Caption only: Bitcoin addresses look like `bc1…`. If it starts with `0x`, that is Ethereum — stop.

**Prove it arrived.** “A screenshot is not proof. This page is the receipt.” They paste the receipt number. A counter moves 0 → 1 → 3, labeled in traffic / seen / landed. They confirm only at 3. No multiple-choice amounts.

Pocket card: address = plate. Explorer = receipt. 3 confirms = landed.

### 3 · Send a little

**The address got swapped.** They paste a destination. The app changes it once. They must reject the mismatch on the first and last characters.

**Leave room for the toll.** Amount stays small. Fee is a two-word control: “Slower, cheaper” and “Faster, costs more.” Send stays disabled until amount plus fee fits the balance. No sats/vB.

**No undo.** One confirm, then the same receipt screen until it lands. One aside, not its own lesson: on an exchange this button says Withdraw and they can delay it. In your own wallet, you press send.

### 4 · Guard the car

**Plate versus key.** Sharing the address makes a coin arrive. Sharing the key empties the wallet. One line: your exchange password is not this key.

**Write the 12 words.** They tap practice words onto a paper card in order, dismiss “Save to photos,” refuse a support chat, then recall words 3, 6, and 9 after the list hides. Words come from the BIP39 English list. The drill is the behavior, not a row of checkboxes.

### 5 · Road test

No new ideas. Three scenes:

1. A support DM asks for the 12 words. They close it.
2. A Bitcoin deposit has Ethereum selected. They switch it.
3. A pasted address does not match the first and last characters. They stop the send.

Pass all three, then one certificate: “Can receive, verify, and send Bitcoin (practice).”

---

## What this pass does not teach

History, mining, price, trading. “1 BTC = 100 million sats” is a caption beside `0.001` on the send screen, not a lesson. Older address prefixes `1…` and `3…` are a footnote. Tron, USDT, and the full network picker stay on Track C.

---

## How it sits in the app

### Content

`content/tracks/bitcoin.json` becomes five drives, each with ordered steps. A step is an action, not a lesson essay.

```ts
type Drive = {
  id: string;
  slug: string;
  title: string;
  job: string;
  steps: Step[];
};

type Step = {
  id: string;
  slug: string;
  job: string;
  coachLine: string;
  action: StepAction;
  pocketCard?: string;
};
```

`StepAction` is a small union: `tap`, `address-check`, `receipt`, `clipboard-mismatch`, `fee-room`, `send-confirm`, `key-contrast`, `seed-card`, `scene`. Scaffold tracks keep `lessons: []` and `status: "coming"`. Only Bitcoin uses `drives`.

`src/lib/content.ts` grows `Drive` and `Step` beside the current `Lesson` type. `getMilestoneById` resolves the road-test step so the existing certificate issuer still works.

### Routes

| URL | What |
| --- | --- |
| `/track/bitcoin` | The road. Five stops. Locked ahead, open behind. |
| `/track/bitcoin/[drive]/[step]` | One screen. Refresh and back keep the place. |

The current `/track/bitcoin/[lesson]` page is replaced for Bitcoin by the step player. Coming-next tracks stay on the track page they already have.

### Progress

Passing a step writes `student.modulesPassed[stepId]`. A drive unlocks when the previous drive’s last step is passed. Inside a drive, the next step unlocks when this step’s action succeeds.

Starter completes every step. `certificate` + `verifyLink` gate the certificate form on the road test. `issueCertificate` rejects tiers without those flags. The other four stops do not offer a cert.

Old demo passes (`btc-explorer`, `btc-deposit`, and the rest) are left in the store and ignored by the new road. Already issued certificates keep resolving.

### Copy surfaces

Update the landing line that says “ten steps,” the course-page Starter note and “milestones passed” count, the README demo steps, and `docs/course-guides/bitcoin.md` so they describe the five-stop drive. Tier JSON feature flags stay. The Starter sentence changes from “milestones locked” to “you can practice; the verify link is Certified.”

---

## What we reuse

| Keep | Rework |
| --- | --- |
| Practice `bc1q` address and 64-char tx id, still checked by `tests/practice-samples.test.mjs` | Explorer sim: drop the amount multiple choice; add the 0→3 counter |
| First-4 / last-4 check | Deposit sim becomes the “give them a place to send” screen |
| BIP39 practice words | Seed sim becomes the paper-card drill |
| Certify form, `/verify/[id]`, OG image | Called from the road test only |
| Light / dark, coach tone, plate / key / toll language | Lesson page layout (paragraph + beats + cheat sheet + sim below) goes away for Bitcoin |

New interactions: clipboard swap, fee control, key-contrast animation, three road-test scenes. The uncommitted “Bitcoin in 3 minutes” lesson and keys quiz are source material for stops 1, 4, and 5, not screens we keep as they are.

---

## Build order

1. Types and `bitcoin.json` for the five drives. Track page renders the road and the locks.
2. Step route and the screen shell: coach line, live picture, one button, pocket card after success.
3. Stop 1 (taps only), then Get paid, then Send, then Guard, then Road test.
4. Point the certificate at the road test. Starter finishes the drive without one.
5. Rewrite `bitcoin.md`, README, and landing / course copy. Run `node --test tests/` and walk Certified and Starter in the browser.

---

## Done when

A first-time learner can finish the road without a lesson menu, a jargon slide, or a trick question. Certified gets one verify link. Starter can do every action and sees the upgrade only at the certificate. Ethereum, USDT, and Solana still say coming next.
