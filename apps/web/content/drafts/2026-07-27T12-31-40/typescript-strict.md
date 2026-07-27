# typescript-strict

**Question:** You are inheriting a 60k-line JavaScript codebase and adding TypeScript. Turn on `strict` immediately and suppress the errors, or migrate file-by-file with strict off?
**Split:** 3 File-by-file, strict off / 2 Strict immediately  (disagreement 0.4)

---

## X — single post

```
Asked 5 frontier models the same question:

"You are inheriting a 60k-line JavaScript codebase and adding TypeScript. Turn on `strict` immediately and suppress the errors, or migrate file-by-file with strict off?"

3 said File-by-file, strict off.
2 said Strict immediately.

GPT-5.6 Sol: "It establishes a clear safety baseline and prevents new non-strict code."
```

## X — thread

```
1/ 5 frontier models, one question, and they did not agree.

"You are inheriting a 60k-line JavaScript codebase and adding TypeScript. Turn on `strict` immediately and suppress the errors, or migrate file-by-file with strict off?"

---

2/ Claude Opus, Llama 4 Maverick, DeepSeek V3.1 picked File-by-file, strict off.

"Turning on `strict` across 60k lines at once buries you in thousands of suppressed errors that become invisible tech debt and get ignored."

---

3/ GPT-5.6 Sol, Gemini 3.1 Pro picked Strict immediately.

"It establishes a clear safety baseline and prevents new non-strict code."

---

4/ Neither side is obviously wrong, which is the point. One model gives you one answer and no way to know it was contested.
```

## Reddit — comment (NO LINK, on purpose)

```
I ran this exact question past 5 of the current frontier models side by side, mostly out of curiosity about whether they'd converge.

They didn't. 3 picked File-by-file, strict off (Claude Opus, Llama 4 Maverick, DeepSeek V3.1), 2 picked Strict immediately (GPT-5.6 Sol, Gemini 3.1 Pro).

The case for File-by-file, strict off, roughly: Turning on `strict` across 60k lines at once buries you in thousands of suppressed errors that become invisible tech debt and get ignored.

And against: It establishes a clear safety baseline and prevents new non-strict code.

What stuck with me is that if you'd only asked one of them you'd have walked away thinking this was settled.
```

## Short-form video script

```
HOOK (0:00-0:03)  on-screen: "5 AI models. One question. They disagreed."
  vo: I asked 5 frontier models the same question and screenshotted every answer.

SETUP (0:03-0:08)  on-screen: the question, full width, held
  vo: You are inheriting a 60k-line JavaScript codebase and adding TypeScript. Turn on `strict` immediately and suppress the errors, or migrate file-by-file with strict off?

REVEAL (0:08-0:16)  on-screen: columns filling in one at a time, pick highlighted
  vo: 3 said File-by-file, strict off. 2 said Strict immediately.

TURN (0:16-0:24)  on-screen: the minority quote, large
  vo: GPT-5.6 Sol was the holdout. Quote: It establishes a clear safety baseline and prevents new non-strict code.

CLOSE (0:24-0:30)  on-screen: all columns side by side
  vo: Ask one model and you get one answer. You never find out it was a coin flip.
```

## SEO page

Written to `seo/typescript-strict.md`.
