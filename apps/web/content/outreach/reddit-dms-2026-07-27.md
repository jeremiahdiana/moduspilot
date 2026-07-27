# Reddit DM list · 21 real people, pulled 2026-07-27

Every username, post title, date and quote below was scraped live from Reddit with a
headed browser. Nothing is invented. Verify any of them by opening the permalink.

**Rules used:** under 100 words, peer tone, no em dashes, no oxford commas, references
something concrete from their actual post, ends on a question. You are writing as the
founder and every draft says so or implies it. No links. Do not paste a link unless
they ask.

⚠️ **Read before you send.** Reddit throttles DMs hard from accounts with low karma or
recent activity, and unsolicited product DMs are the most-reported thing on the site.
Sending 21 in one sitting from a cold account is a shadowban. Send **5 a day, spread
out**, and reply to their comments in public first where you can. The ones marked
🔥 are the strongest fits. Start there.

---

## 🔥 1. u/RFOK · r/OpenAI, 2026-07-17
https://www.reddit.com/r/OpenAI/comments/1uyxmn0/codex_as_the_control_plane_for_a_real_multimodel/
> "Codex as the control plane for a real multi-model team: the next interface I want"
> Running ChatGPT Pro ($200/mo, 20x) and Claude Max 20x, strongest workflow uses both ecosystems.

```
Your control plane post describes the thing I have been building, except I came at it
from the chat side rather than Codex. Running Pro at $200 plus Max 20x and pulling from
both ecosystems is exactly the person I built it for.

Genuine question. Would you want the control plane inside Codex specifically, or is a
separate surface fine as long as it drives both? I keep going back and forth and you
have thought about it harder than I have.
```

## 🔥 2. u/YaBoyChips3819 · r/ClaudeAI, 2026-07-23
https://www.reddit.com/r/ClaudeAI/comments/1v43tav/i_built_a_router_that_spreads_work_between_my/
> "I built a router that spreads work between my Claude and ChatGPT subscriptions"
> Built Alloy'd, an MCP server dispatching to whichever side has usage left.

```
Alloy'd is the closest thing I have seen to what I ended up building, except you went
at it from the CLI and I went at it from chat. Mine runs one prompt across several
models at once so the disagreement is visible, rather than load balancing between them.
Different goal, same annoyance underneath.

Did you find people actually care which model answered, or do they only care that the
work got done? That answer changes what I build next.
```

## 🔥 3. u/Short_Regular_7191 · r/ClaudeAI, 2026-07-25
https://www.reddit.com/r/ClaudeAI/comments/1v63o29/stop_paying_opus_prices_for_grep_work_a_taskmodel/
> "Stop paying Opus prices for grep work: a task→model routing matrix that lives in the repo"
> R1 to R9 task classification in a markdown file, auto-loaded via CLAUDE.md.

```
Your R1 to R9 matrix is doing by hand what I have been trying to automate. I built a
multi-model chat where one prompt goes to several models at once. Yours is smarter on
cost. Mine is better at catching the cheap model being confidently wrong.

Did you validate the matrix against real outcomes, or is it calibrated on feel? I
cannot work out how to test mine without a ground truth set and I suspect you hit the
same wall.
```

## 🔥 4. u/theargen · r/ClaudeAI, 2026-07-20
https://www.reddit.com/r/ClaudeAI/comments/1v1z4yn/burning_100day_in_api_overages_are_we_just/
> "Burning $100/day in API overages. Are we just brute-forcing this with multiple $200 Max/Pro accounts now?"
> On Max 20x, hits the weekly limit in about 3 days.

```
$100 a day on top of Max 20x is rough. Real question rather than a pitch.

When you blow the weekly limit and push work to the API, is that work actually
Opus-grade, or is some of it stuff a cheaper model would have handled fine? I build a
multi-model tool and routing is the part I am least confident about. Trying to learn
whether people want to route by task or just want the big model always.
```

## 🔥 5. u/b3astown · r/perplexity_ai, 2026-06-01
https://www.reddit.com/r/perplexity_ai/comments/1ttf389/for_pharmabiotech_research_perplexity_or_claude/
> "For Pharma/Biotech Research, Perplexity or Claude?"
> Annual Perplexity Pro up for renewal, pulls clinical trial data, assesses efficacy and safety.

```
Since your renewal is close. Rather than picking one, have you tried running the same
clinical trial question through both and reading them side by side? On efficacy and
safety questions they disagree more than I expected, which matters more in your field
than in most.

That comparison is the thing I build, so I am biased. What is your current process for
checking whether an answer is actually right?
```

## 🔥 6. u/tonyromero · r/ClaudeAI, 2026-07-26
https://www.reddit.com/r/ClaudeAI/comments/1v7h42s/plan_drift_between_opus_5_planning_and_sonnet_5/
> "Plan drift between Opus 5 (planning) and Sonnet 5 (implementation) in Claude Code"
> Plans with Opus at high effort, implements with Sonnet, drifts after a few phases.

```
Plan drift between the planner and the implementer is real and I do not think anyone
has solved it properly. What works for me is having the planning model review the
implementation output at each phase rather than trusting the handoff. Cheap, and it
catches most of the drift before it compounds.

Are you keeping the plan in the context window, or in a file the implementer re-reads
every phase? That difference mattered more than the model choice for me.
```

## 🔥 7. u/ozone6587 · r/perplexity_ai, 2026-06-16
https://www.reddit.com/r/perplexity_ai/comments/1u7oskm/on_perplexity_pro_do_we_know_the_reasoning_effort/
> "On Perplexity Pro, do we know the reasoning effort used for the models?"
> Switches between GPT 5.4 Thinking and Claude Sonnet 4.6 Thinking, says it is behind SOTA.

```
Hidden reasoning effort is the thing that made me stop trusting wrappers. You cannot
tell whether you got the model or a quietly cheaper version of it. I built an
alternative that names the exact model on every answer and refuses to silently
downgrade, because mine had that exact bug and it is genuinely hard to spot.

Since you already switch between GPT and Sonnet Thinking, do you switch mid
conversation or start a fresh one? I still have not got that part right.
```

## 🔥 8. u/adigrazia80 · r/ChatGPTPro, 2026-03-17
https://www.reddit.com/r/ChatGPTPro/comments/1rvx796/i_stopped_using_gpt54_alone_now_it_works/
> "I stopped using GPT-5.4 alone. Now it works alongside Claude Code and Gemini in the same IDE"
> Was paying for ChatGPT without getting value next to Claude, then made them work together.

```
Your setup with Codex CLI plus Claude Code plus Gemini is roughly what I ended up
building into one app. Mine runs the same prompt through all of them at once and shows
the columns next to each other, so disagreement is visible instead of me switching
windows to check.

Curious what made you keep them inside the IDE rather than on a separate surface. Was
it the Telegram notify loop, or something else I am missing?
```

## 9. u/Gliese351c · r/ClaudeAI, 2026-07-24
https://www.reddit.com/r/ClaudeAI/comments/1v5k4w1/beware_the_new_accuracyforward_change_in_opus_5/
> "Beware: The new accuracy-forward change in Opus 5 is most welcome, but it will be a problem when switching between different models."

```
Your point about the accuracy change biting when you switch models is the exact problem
I built around. Running the same prompt through several at once turns a behaviour
change into a visible split, instead of a silent difference you notice three answers
later when something is already wrong.

What was the switch that burned you? Opus to Sonnet, or something further apart than
that?
```

## 10. u/IndividualEngine8579 · r/ClaudeAI, 2026-07-26
https://www.reddit.com/r/ClaudeAI/comments/1v6wgdj/i_burned_246m_tokens_in_22_hours_on_claude_code/
> "I burned 246M tokens in 22 hours on Claude Code and measured exactly where every one went."
> Of 246M tokens, actual output was 0.13%. Rest was context re-read on every tool call.

```
0.13% actual output is an alarming number and I have not seen anyone else bother to
measure it.

Question from someone building in this space. Did you check whether the re-read pattern
differs between providers, or was it Claude Code specific? I run a multi-model setup
and if that ratio is provider specific it changes what I should be doing about caching.
Happy to run the same measurement on my side and send you what I get.
```

## 11. u/NODeeJay · r/OpenAI, 2026-07-19
https://www.reddit.com/r/OpenAI/comments/1v0mm87/pro_is_not_unlimited_and_there_is_no_usagemeter/
> "Pro is not unlimited and there is no usage-meter, you are just cut off"

```
The missing usage meter is the complaint I hear most and the one nobody ships a fix
for. I put a visible counter in the thing I built for exactly this reason. It is not a
hard feature, which makes it strange that the big labs treat it as optional.

Did you ever get a straight answer from support on what the actual Pro allowance is? I
have never once seen a real number published anywhere.
```

## 12. u/mattioso · r/ChatGPTPro, 2026-04-14
https://www.reddit.com/r/ChatGPTPro/comments/1sl2if9/how_do_you_structure_ai_for_different_parts_of/
> "How do you structure AI for different parts of your life/work — one ChatGPT setup or separate Claude"
> Using it for influencer and creator marketing, strategy, pricing.

```
I got stuck on the same question and ended up building something that runs one prompt
through both at once and puts the answers in columns. For strategy and pricing
questions they disagree far more than I expected, which was not what I assumed going
in.

What did you land on for the influencer marketing side? One setup or separate tools per
area? I am curious whether the split ends up being by task or by client.
```

## 13. u/FlRE_Storm · r/perplexity_ai, 2026-06-07
https://www.reddit.com/r/perplexity_ai/comments/1tz7up7/thinking_about_switching_back_to_perplexity_pro/
> "Thinking about switching back to Perplexity Pro after trying Gemini Advanced… Thoughts?"
> Had a year of free Pro via carrier promo, then paid for Gemini Advanced.

```
Your comparison was fairer than most on that sub, which is why I am asking rather than
pitching.

When you were on Gemini Advanced, did you ever want a second model on the same
question, or did you just accept the one answer and move on? I built a thing that runs
several at once and I am trying to work out whether the switching itch is about quality
or about not trusting a single answer.
```

## 14. u/AryeD · r/ChatGPTPro, 2026-05-19
https://www.reddit.com/r/ChatGPTPro/comments/1thof60/looking_for_a_proactive_crossdevice_ai_agent/
> "Looking for a proactive, cross-device AI agent. Hitting the limits of my current setup"
> Has Gemini Advanced and Copilot Pro, happy to pay for something seamless.

```
You said you have Gemini Advanced and Copilot Pro and would pay for something that
feels proactive rather than a chatbot you have to trigger. I built in that direction.
Every premium model in one place, plus briefings and reminders rather than sitting
idle waiting for you.

Not fully there on cross-device yet, so I am not going to claim it. What device
combination are you trying to bridge? That is the part I keep getting wrong.
```

## 15. u/MrNariyoshiMiyagi · r/ChatGPTPro, 2026-05-22
https://www.reddit.com/r/ChatGPTPro/comments/1tkhr93/im_cancelling_my_chatgpt_pro_subscription/
> "I'm cancelling my ChatGPT Pro subscription"
> Claude is better for Accountancy, Taxation and Company Law in the Indian context.

```
Your post on Claude for Indian tax and company law was more specific than most model
comparisons I read, so a question since you clearly tested both properly.

After you cancelled Pro, did you ever want GPT back for a second opinion on a ruling,
or was Claude just decisively better and you never looked? I built a thing that runs
both at once and I am trying to learn whether second opinions matter to people or
whether they just pick one and commit.
```

## 16. u/Living-Acadia-1071 · r/ClaudeAI, 2026-07-26
https://www.reddit.com/r/ClaudeAI/comments/1v6rnzs/hot_take_claudes_personality_is_the_reason_i_stay/
> "Hot take: Claude's 'personality' is the reason I stay, and I think benchmarks miss it entirely"

```
That benchmarks miss what it feels like to work with a model for hours is the most
useful thing I have read on that sub this month. Running several models on the same
question side by side makes the personality gap much more obvious than any benchmark
does, which is roughly why I built that.

Does the pushback and admitting uncertainty hold up across a long session for you, or
does it drift after a few hours? Mine seems to drift and I cannot tell if that is me.
```

## 17. u/swapoer · r/OpenAI, 2026-07-24
https://www.reddit.com/r/OpenAI/comments/1v5e41f/gpt56_thinking_high_surprised_me_on_a_70_page/
> "GPT-5.6 Thinking High surprised me on a 70+ page engineering compliance review"
> Engineer reviewing large welding documentation packages.

```
The welding compliance review is a better test than any benchmark, because there is a
correct answer and it is checkable by someone who knows the standard.

Did you ever run the same package through Claude or Gemini to see whether they caught
the same issues? Specialist document review is where I see the biggest splits between
models. If you still have the package I would genuinely like to know what the others
miss.
```

## 18. u/Lucky_Creme_5208 · r/OpenAI, 2026-07-14
https://www.reddit.com/r/OpenAI/comments/1uw9dz9/which_tool_is_best_for_long_horizon_workflows/
> "Which tool is best for long horizon workflows? (Please help)"
> Example: analyze 300 question images, find connections, create study notes.

```
For the 300 images into study notes job, the thing that decided it for me was not the
model. It was whether the tool holds context across the whole run.

What have you tried so far, and where did it break? If it broke at roughly the same
point every time it is a context problem and switching models will not fix it. If it
broke in different places it is the model. Worth knowing which before you pay for
anything.
```

## 19. u/Brave_Nature_4113 · r/perplexity_ai, 2026-06-13
https://www.reddit.com/r/perplexity_ai/comments/1u4xg9q/best_beginner_projects_to_learn_chatgpt_claude/
> "Best beginner projects to learn ChatGPT, Claude and Perplexity properly?"

```
Fastest way to learn what each one is good at is to ask all three the same question and
read the answers next to each other. You pick up the differences in an afternoon
instead of a month.

You can do that free with three browser tabs. I built a tool that puts it on one screen
but you do not need it to start. Pick a question you already know the answer to. That
is where the differences show up quickest and you can actually judge who was right.
```

## 20. u/something3419 · r/perplexity_ai, 2026-06-17
https://www.reddit.com/r/perplexity_ai/comments/1u8l0e5/ive_basically_been_scammed_by_perplexity/
> "ive basically been scammed by perplexity"
> Bought a 1 year subscription, says features were removed and it is not the same product.

```
Buying a year in this market is a lesson a lot of people are learning at the same time,
so you are not alone in it.

Not going to sell you another annual plan while you are in the middle of that. But the
specific thing that got you, features quietly changing under a subscription you already
paid for, is worth checking before you commit anywhere next.

Which removed feature was the one that actually broke your workflow?
```

## 21. u/Ember95 · r/perplexity_ai, 2026-06-07
https://www.reddit.com/r/perplexity_ai/comments/1tzhi07/beyond_frustrated/
> "Beyond Frustrated"
> AI support gave a useless reply after a failed upload of ~50 pictures and videos.

```
Support answering like that is worse than no support at all.

I am not going to pitch you while you are annoyed. If you do end up looking elsewhere,
I built an alternative that runs the premium models in one place, and I answer support
myself because there are not enough users yet for it to be anybody else.

Did you ever get the upload working, or did you give up on it?
```
