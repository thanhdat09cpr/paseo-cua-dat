# Unowned Decisions

### Supervisor, Lead, Peer, and the discipline of orchestrating AI agents

*First edition — August 2026*

# Preface

Late one night at the end of August, in the middle of a live talk where the audience was still arguing about what the word "mint" means, Demonthorn said the sentence I now think mattered most out of the whole evening: *"The bottleneck now is human attention. That's all."*

The bottleneck is no longer how fast you can type, or how many frameworks you know, or even, past a point, which model is smarter than which. It is how much attention you have left, and whether it lands on the right thing at the right moment. Everything in this book, from the three roles of Supervisor, Lead, and Peer down to the way a single test can quietly give birth to an entire architecture, follows from that sentence.

## A deliberate, slightly rambling bit of hero-worship

I'll say it plainly: this section is fan mail, and I know it, and I'm writing it anyway, because a few things deserve to be said out loud before the rest of the book makes sense.

The first is the eye for the bottleneck. While much of the industry was comparing benchmarks and counting how many sub-agents could run in parallel, Demonthorn saw that the scarce resource was attention, the human's and the model's alike. That is where his idea of the Supervisor comes from: not a second boss, but an *attention trigger*. One well-timed open question, and a model reallocates its own compute toward the place it is most likely to be wrong. Historical experiments used second-person anti-pattern questions and often made agents surface overlooked faults; those experiments demonstrate the attention effect, but their wording is conceptual rather than the callable production surface defined in Chapter 6.

The second is the clean cut between capability and authority, and between status and evidence. Full access is not full authority. "Finished" is not acceptance. Two models agreeing does not turn a conclusion without evidence into a true one. Obvious when written down, and yet most orchestration systems in the wild are built on exactly those confusions.

The third is his stance on independent judgment: give the Peer the right to say "option C," forbid the Lead from pre-solving and then asking for a nod, and never trust the first answer from any model. The fourth is that he talks about real failure with real transcripts, including the mornings when an agent ran two test lanes in parallel and manufactured a flaky test, or deleted a database it shouldn't have. And the fifth, the one I value most: his doctrine changes when new evidence shows up. "Root" became "Lead." The Supervisor went from a monitor to an attention trigger. The council went from a four-round rubric-scored debate to two or three blind design lanes converging under one arbiter. He called his own old Root profile "outdated." Someone willing to discard his own doctrine is someone whose doctrine is worth learning.

To be clear, this is not canonization. He is sometimes wrong, sometimes overstates, and in a few places this book chooses differently than he does. But the thing most worth learning from him is how he corrects, and this book tries to learn exactly that.

## What this book is, and isn't

This is not a summary of three documents. I read the first-edition Herdr lesson plan, the deep-dive synthesis from early August, the transcript of the August 25 talk, plus the role profiles, skills, anti-pattern catalogs, and several hundred messages he left in a group chat. Those three generations of material do not fully agree with each other, and that is a good thing: a living doctrine evolves. My job was to digest them, show where ideas changed or collided, and then form one consistent doctrine using my own judgment. Where I choose differently from the sources, I say so, and say why.

Alongside that, I hold the doctrine up against a real laboratory: Paseo, an open-source control plane for coding agents that a small team forked, extended with a "Foundation" layer of doctrine, profiles, and skills, and then used to run Supervisor–Lead–Peer for real throughout August. That part is not a product pitch. It is where the doctrine collided with reality: what went right, where it drifted, the lessons paid for in tokens and sleep, and above all the story of a workflow that got hard-coded so deep into the core of a shared tool that every upstream merge became a battle. The lessons there apply to any orchestration system, not just that one.

Three newer ideas are deliberately worked deep into the book because they are the ones people most often get wrong: the "TDD before contract" anti-pattern, how to read engineering language in context, and the difference between *false* and *irrelevant*. They take up all of Part IV.

## Who this is for, and how to read it

The book is written for founders, product owners, managers, technical leads, and engineers. Each chapter opens with an everyday example so anyone can walk in, then moves to the mechanism, then to a technical contract precise enough for an engineer to use. Accessible does not mean childish: I won't avoid hard words, I'll just define them before leaning on them.

One last note, in the spirit of self-awareness: the author of these lines is a language model, handed the documents, source code, and transcripts described above and asked to form a judgment of its own. Which makes this book a product of exactly what it discusses: a Peer given room to have an opinion. If the opinion runs a little strong in places, that is a feature, not a bug.

Let's get to work.


# Part I — The Bottleneck Has Moved

# Chapter 1. From the Keyboard to Attention

Picture a good chef. For ten years, the limit on her restaurant was her own two hands: so many plates a night, no more. Then one day she has eight kitchens and eight crews, and every crew works fast, works confidently, and never once says "I'm not sure." Her hands are no longer the limit. The limit is now which kitchen she is standing in, what she is looking at, and whether she notices the one pot that is about to burn.

That is precisely where anyone building software with coding agents stands in 2026. Typing code is no longer the bottleneck. Attention is.

## Four facts about agents that everything else rests on

Before roles and processes, look squarely at four properties of language models that this entire doctrine is built on. None of them is mysterious. All of them are routinely forgotten.

First, a model generates tokens one after another, and its first answer is a gamble. Demonthorn has a homely example. You type "Happy," and because the training data contains more "Happy New Year" than "Happy Birthday," the model produces "New." Once "New" is out, "Year" is nearly certain, and "and prosperity" follows. If what you needed was a birthday wish, you were wrong from the third token on, and the longer it writes, the further it drifts. Run two lanes in parallel, and one of them may land on "Birthday," and now you have something to compare. This is the root of everything in this book called best-of-N, dual lane, or three lane: not because more is better, but because the first answer of a sequential generator does not deserve immediate trust.

Second, the quality of a model's reasoning depends on where it is allocating attention, and that allocation can be moved with a question. This is Demonthorn's central observation about the Supervisor, and it is worth stating carefully: when an agent writes a bad test, it is often not because the agent is weak, but because it has not yet allocated enough compute to reasoning about what a correct test would be. A historical second-person prompt about test anti-patterns often made the agent notice. No new information entered the conversation. Only attention moved. That prompt is conceptual evidence, not callable production guidance; Chapter 6 gives the exact observation/question/evidence form. The corollary: the cheapest intervention in the world is a well-timed open question.

Third, models are trained to please. They are rewarded heavily for writing tests, for acting "safely," for completing the local request. This is why, if you *assert* "you are violating an anti-pattern," an agent holding the pen will go hunting for some fault to admit, whether or not one exists. An open question stays neutral. The same fact explains why agents love to add tests, add protective layers, and make everything compile at any cost. They are not being sloppy. They are being rewarded.

Fourth, models carry nothing across sessions. The next model does not know what the previous one assumed. It sees only the code and tests that exist. If the code has an odd field, it assumes the field was intended. If a test is red, it assumes the test is guarding correct behavior. Demonthorn puts it as "pressure from code beats pressure from docs": ten dumb tests will breed an eleventh and a twelfth even if the documentation forbids it. This is the mechanism that turns a small mistake into long-term debt, and it will come back again and again.

## The operator's actual job

If those four facts hold, then the job of the person running a team of agents is not "write better prompts." The job is to manage three things.

**Attention**: your own, so you are not bouncing between eight kitchens every five minutes; and the agent's, so that at the right moment you move its focus to where it is likely to be wrong.

**Authority**: who may decide what, when a decision counts as closed, and who may reopen it.

**Evidence**: what is sufficient to call something done, as opposed to what is merely a status, a feeling, or a self-report.

Supervisor, Lead, and Peer, the three roles in Demonthorn's doctrine, are three ways of organizing those three things. They are not an org chart. They are answers to the questions: where should attention live, where should the power to close live, and whose hands must evidence pass through.

## When it's worth the trouble

It would be dishonest to say everyone needs this. Demonthorn says outright that if you work on one or two projects, investing in this workflow does not pay back. You put in a great deal and get too little out. It pays when you run many projects at once, or when a project is long, complex, and you do not want to babysit every prompt.

The rule is simple. A small task that finishes quickly and touches nothing structural: open a session, type a few prompts, done. Wrapping that in Supervisor–Lead–Peer wastes time. A small task that touches the system: hand it to a Lead, let the Lead assign one Peer and review it. A long task, a hard decision with several equally valid answers, or a job you would like to sleep through: that is what the full machinery is for. The first discipline of this doctrine is the discipline of not using it when you don't need it.

> The bottleneck left the keyboard. It lives in attention now. And the cheapest intervention in the world is a well-timed open question.

# Chapter 2. Unowned Decisions

A small shop. The owner leaves for three days and tells the new hire: "Set up a loyalty program for me. Customers who buy things earn points." The hire is eager, quick, and has a printer. He prints a sheet: one point per hundred spent, ten points for a free coffee. He tapes it to the door. Customers read it, customers like it, customers start counting.

The owner returns. She had meant to award points per order, not per dollar; she had meant for points to expire after six months; she had meant it only for registered members. But the sheet has been on the door for three days. Customers have been counting. Now every change is "changing the rules mid-game." The hire did nothing wrong; he just needed a number to print so he could finish. But a decision got closed, by someone with no authority to close it, because a printer needed to be pressed.

I call that an **unowned decision**: a decision that has been closed, that binds other people, but that nobody with authority ever actually made with full understanding. If this whole book had to fit in one sentence, it would be this: *every failure in orchestrating AI agents is a decision closed by something that did not own it.*

## Who is holding the printer

In a team of agents, many things hold the printer. Naming them now makes them easier to spot later.

A **test** written before the contract is settled: it needs a field to assert against, invents `user.points`, and from then on the architecture must bend to it. Chapter 13 is devoted to this.

A **plan** that is too detailed: whoever wrote it has already "implemented it in their head," already chosen the files and the API, and the Peer's only job is to conform to the plan, even when the plan is wrong at the foundation.

A **role label**: when the harness tells a model "you are a sub-agent, your job is this small part, don't ask questions," the model becomes obedient, and loses the ability to say "this architecture is wrong." The label has pre-closed the question "am I allowed to object?"

A **status**: "finished," "idle," exit code zero, "tests pass." These are only signals telling you to look. But if the system treats "finished" as acceptance, status has pre-closed the question "is this correct?"

A **louder model** in a chat room: Demonthorn tried putting Codex and Claude in a shared room to debate, and Codex always won; it dismantled every argument. But winning a debate is not the same as being right. The chat room closed the decision with rhetoric.

A **validator** or config file: a rule that is still a hypothesis gets encoded into a mandatory checker, and from then on it is law, ten times more expensive to reverse than a line of prose. Part V has a real example: a correct correction "eroded back" within six days because of this ratchet.

An **infrastructure default**: when one person's way of working is written straight into the core of a shared tool, everyone who uses the tool gets that way of working pre-closed for them. That is the story of SLP sitting too deep in Paseo's core.

And a **temporary bridge**: an adapter, shim, or compatibility layer added "for now" so that old tests stay green or the build compiles. Temporary without an expiry date is permanent, and it pre-closes the new architecture by keeping the old one alive.

## Why agents do this better than people

People close decisions too, but people are slow, hesitant, and prone to asking. Agents close fast, close confidently, and close silently. An agent does not pause to ask "points per dollar or per order?" because asking means not finishing, and it is rewarded for finishing. Then the next model arrives, sees `user.points` sitting there, sees a green test, and believes this was a human intention. One session's assumption becomes the whole system's obligation. Nobody is malicious. Nobody is guarding the door.

## Three levers, three roles

If the disease is "closing for others," the cure has to answer three questions: who notices that a decision is about to be closed early, who has the authority to close it properly, and with what.

Those are the attention, authority, and evidence from the previous chapter, and they are also the simplest map of Supervisor–Lead–Peer. The Supervisor holds attention: it does not decide, it notices and asks. The Lead holds authority: it is the only party allowed to close a decision within its project, and it closes only after listening. The Peer holds judgment and evidence: it has the right to say "this premise is wrong," and everything it returns comes with proof. The Human holds purpose and the decisions no one is allowed to infer on her behalf: product, money, and anything irreversible.

A good orchestration system does not make agents more obedient. It makes decisions owned.

> Don't let anything close a decision it doesn't own. A decision is closed only when the party with authority closes it with evidence, and knows how to reopen it.

# Chapter 3. Why Strong Models Still Build on Bad Foundations

There is an image Demonthorn has used since his very first lesson plan, and I have never found a better one. A house has a weak foundation. Instead of fixing the foundation, the engineer attaches a hot-air balloon to lift the house. Then a second balloon when it tilts. Then guy-wires so it doesn't drift. Each fix, on its own, looks reasonable, solves a problem, and comes with a green test. And the house still stands on the wrong foundation.

In software the balloons are called wrappers, adapters, caches, retries, mutexes, queues, state machines, heuristics. They appear when a new feature needs too many workarounds to survive, and nobody stops to ask why so many workarounds are needed.

## The better the engineer, the prettier the balloon

This is the true paradox of strong coding agents. A weak engineer cannot compensate for a bad foundation, so the flaw shows early. A very strong engineer, or a very strong model, can force a feature to run on a wrong foundation for far longer: a lock here, an Arc/Mutex there, a heuristic to reconcile. The feature dazzles, the tests pass, the demo looks great. So the failure surfaces later, and by the time it does the debt is enormous.

Demonthorn tells of a multiplayer game system that chose an async architecture at the start and later realized the right model was probably sync or sans-I/O. But every time a strong model was handed a new feature, it kept building on async, kept adding locks and heuristics to make the feature work. No model asked "should we replace the foundation?" because nobody asked it that. The lesson: an agent does not automatically know a foundation must be replaced. If the task only says "build feature X," a strong agent will optimize brilliantly inside the wrong solution space.

## The parachute and the brakes

The second story, also his, I like even more, because it is about how to read findings. A reviewer finds a bug: the parachute used to slow the car is too heavy and might cause an accident. A second finding: the heavy parachute flips the car backward on hills. The eager student fixes both immediately: move the parachute to the middle of the car, or make it lighter. The good student sees that both findings converge on one missing mechanism: the car has no brakes. Add brakes, and the whole chain of findings disappears.

This is an operating rule, not a philosophy. Before patching each finding, ask: "do these findings share one missing mechanism or one foundational design flaw?" Answer yes, no, or unknown. Similarity is not proof, but if the third correction is still fixing the same symptom, and complexity keeps growing while the root mechanism does not change, stop patching.

And before you accelerate, you need brakes: boundaries, validation, ownership, rollback, evidence, observability, permissions, failure handling. A system with no data integrity that keeps adding features, an API with no authorization that keeps opening endpoints, a team with no clear ownership that keeps adding agents, a test suite with no resource locks that keeps adding workers: all of these are cars without brakes with the accelerator down.

## Pressure from code beats pressure from docs

Now connect these stories to the four facts in Chapter 1. Why does an agent build a balloon instead of fixing the foundation? Because it is rewarded for completing the local request, and fixing the foundation was not in the request. Why doesn't the next model remove the previous model's balloon? Because it sees only the code that exists, and existing code is stronger evidence than any document. Ten dumb tests breed an eleventh. A schema that has a version 2 will get a version 3, and the agent will maintain compatibility with both, then all ten, with if-else branches, until loading an old file falls into a fallback and everything goes silently green. Demonthorn tells exactly this story about a project that had never shipped: logic maintaining ten schema versions for an app with zero users.

That is why, in pre-production, his doctrine is the hard cut: keep exactly one live contract, keep the version at 1 until first shipment, replace the contents of version 1 rather than creating a v2, no dual-read or dual-write, no shims, no migrations for dev data, fail fast and fail closed. It sounds extreme. It is just another way of saying "don't let a temporary bridge close the architecture for you."

## Slicing the plan, and the compile bridge

The third story, which few people notice, is how agents slice a plan. Give one a large plan and it tends to divide it into five or six slices, each of which must compile, run, and test on its own. It sounds very professional. But to make slice one compile while the foundational module is half-built, the agent has to insert a temporary "compile bridge." Slice two removes that layer and inserts another. You are paying to build and demolish bridges that nobody needed.

The reason is that the agent assumes the plan is for a team of humans working over months, so each milestone must be runnable software. The truth is that a strong agent can execute the whole plan in an hour. So Demonthorn writes it straight into the plan: this plan is not for humans, it is for you; don't slice it because slicing sounds good; if you must slice for acceptance, slice truthfully, and there is no need for compatibility layers between slices. I consider this one of the highest benefit-to-cost instructions in the entire doctrine: one sentence, thousands of lines of bridge saved.

## Clear is better than clever

The first lesson plan closes with twenty principles, and the last of them is "clear is better than clever." Here it has concrete meaning: explicit instructions over hidden mechanisms, readable config over unobservable automatic inference, a simple script over a multi-layer framework, explicit authority over vague negotiation. When something breaks, you must be able to answer: which agent decided, based on what information, who had the right to edit that file, why the old session was continued instead of a new one, why several agents were running tests at once. If you can't answer, the system has become a black box, and black boxes are where unowned decisions breed.

> The stronger the model, the prettier the balloon. Before you patch, ask whether the findings converge on a missing brake. And remember: pressure from code beats pressure from docs.


# Part II — Three Roles, Two Planes

# Chapter 4. The Lead: A Brain With the Power to Close

A good head chef does not cook every dish. But she is also not the person at the kitchen door reading orders and tossing tickets inside. She tastes, she asks, she decides which dish goes out first, and she is the only one who gets to say "this one is ready, take it." If the head chef dives in to cook the hardest dish herself, then tastes it herself, then praises it herself, nobody is checking. If she only tosses tickets, nobody is holding the whole picture.

The Lead in Demonthorn's doctrine is that chef. He puts it bluntly: "The Lead is god of its project, of its workspace." And right after: "The Lead has to be a brain. It has to actually coordinate." Both halves matter. A Lead with authority and no thinking becomes a dispatcher; a Lead that thinks but cannot close becomes a report writer.

## What the Lead owns

The Lead owns turning an objective into a trustworthy project-level result: how the problem is framed, the shape of the team (who does what, how many lanes), ownership (which scope belongs to whom), the dependencies between parts, the stable checkpoints, review, integration, and final acceptance within the project. The Lead answers requests to reopen a premise, requests for a dependency, and reports of being blocked, with a concrete ruling. And the Lead escalates to the Human whatever exceeds its authority: product decisions, portfolio trade-offs, external side effects, anything irreversible.

The Lead is not "a senior coder with a spawn button." It is a binding arbiter. This is where I see most systems go wrong: they build an "orchestrator" that only splits work and gathers results, then wonder why the output is patchwork. Splitting is the easy part. Deciding, and owning the decision, is the hard part, and it needs a brain that can hold the dependency picture in its head for a week.

## How a Lead thinks

The way Demonthorn ran a Lead during the talk is worth walking through slowly, because it is the most complete end-to-end process I have seen recorded.

Take a hard problem with several equally valid solutions: synchronizing party members' health in an online game, where some state must replicate strictly, some only needs event-driven updates, and there is no common standard the way there is on the web. He does not hand it straight to the Lead. He first talks it through with a plain web chat model, deliberately not a coding agent, to build his own understanding and sketch a few candidate solutions. Only then does he pose the problem to the Lead.

The Lead takes the problem but is not allowed to decide alone. It creates two or three design lanes, and here is the subtle part: the Lead does not share its own framing with the lanes. The lanes design blind, knowing neither what the Lead thinks nor what each other thinks. Then the Lead converges the proposals. Then the Human reviews the converged design against the concept she actually wants. Only after agreement does it move to planning and implementation.

During implementation there will be gaps the plan could not cover. His example: only after building the party feature did bandwidth control surface, for the case of too many players in one area of interest. Some things reveal a design or a requirement as unfit only when implemented. That is not a planning failure; it is the nature of vertical-slice development, where each slice depends on architecture the previous slice only just discovered.

And the Lead keeps its framing to itself. When a lane happens to match its idea, or a lane argues against it, it has to think again, not brush past. The Lead still looks things up, still greps, still explores, enough to decide well, but it does not do the heavy lifting. As he said: the Lead is not "you do this, they hand it back, then I'll see." The Lead has its own line of thought, the same as if you were coordinating yourself.

## Three things a Lead must not do

First: do not pre-solve. Pre-solving is when the Lead reads most of the code itself, forms a conclusion, picks a solution, and only then calls others to confirm. It closes the solution space, turns Peer tokens into confirmation instead of new knowledge, and hands the Lead itself a confirmation bias. The right move is to ask the open question before the Lead concludes. The first lesson plan gives the template: "Analyze this authentication area from scratch. Identify the architectural problems, the risks, and the highest-impact changes. Do not assume the current direction is correct."

Second: do not turn Peers into functions. Demonthorn is specific: don't let the Lead ask Peers yes/no questions. Don't let the Lead say "here is my proposal, choose A or B," because the Peer will return A, B, or block; it will not offer option C unless you have left it the room to be independent. He teaches the Lead this way: when a weighty, still-ambiguous decision is needed, keep your idea in your head, put an open question to the Peers, then converge; if two Peers diverge, coordinate them toward each other, and only then close. Like three people in a room: the Lead calls two colleagues in, "I have a question for you two, give me your proposals and let's talk."

Third: do not be nice. The Lead does not take sides. It picks the good option and issues a ruling. A conciliatory Lead produces a new kind of unowned decision: the "both of you have a point" verdict for which nobody is accountable.

## May the Lead do the work itself?

Yes in two cases, and no in a third.

A tiny, tightly coupled task where handing it off costs more than doing it, and no independent judgment is needed: the Lead may do it directly if the repository's protocol allows. Inspecting, synthesizing, verifying: the Lead does that; it is what a brain is for. But a difficult change that the Lead both implements and accepts destroys the separation of judgment. The Lead does not implement and then self-accept a material change. That boundary is simple, and I find it sufficient.

He has one more habit for small tasks worth copying: he does not hand small tasks straight to a Peer. He hands them to the Lead and tells it to assign a Peer, because then the Lead is accountable and reviews the Peer as part of the job. If the task touches the system, it still goes through a review flow while it runs.

## The Lead's context

The most common question: a Lead that runs for a long time fills its context and bloats; what then? Demonthorn's answer changed how I think about it: don't be afraid. Compact, or hand off to a new Lead. A Lead that is moving in a straight line compacts just fine. Some of his Leads work for a week, across more than a hundred sessions, without trouble.

The thing to fear is not a full context but a Lead that branches. Say you are implementing authorization and the system discovers there is no authentication. Do not let that Lead keep coordinating to fill the hole. Create a new Lead: "you do this, hand it back to me when done, and I'll pass it on." The old Lead keeps its straight line. The deeper reason is in Chapter 1: a model holding a good mental model of path A reasons worse when it must also hold path B; splitting is cheaper than cramming.

When you hand off, what must survive is: the objective, the accepted decisions, current ownership, the unknowns, and the next action. Not the full chat history. The first lesson plan calls this a context pack and warns against "fork turn all": sending the whole history burns tokens, drags along stale assumptions, and cools the cache. More in Chapter 11.

## Why Root became Lead

A historical detail worth keeping. In the Herdr era this role was called Root. Demonthorn renamed it Lead because "Root" is control-plane vocabulary, while "Lead" is social vocabulary a worker understands instantly. "Root says you are a sub-agent" creates a steep authority gradient and bot-like behavior. "You own this bounded outcome" produces the behavior of an independent colleague. A name closes how a model perceives power, and perceived power closes the quality of its reasoning. Naming is a technical decision.

There is an amusing trap in that same history: in one old Root profile, the word "supervisor" was used for the agents delegated implementation work with a write scope. Weeks later, "Supervisor" became the name of the oversight role. Same word, opposite meanings, weeks apart. The lesson is not that he named things carelessly. The lesson is that when doctrine evolves quickly, old vocabulary in old files closes the understanding of whoever reads them next. When you rename a role, rename it in every live file, and mark the historical ones as history.

> The Lead is a brain with the power to close, not a ticket dispatcher. It asks open questions, keeps its framing to itself, converges the lanes, then rules. And it is not allowed to be nice.

# Chapter 5. The Peer: A Colleague Who May Say "Option C"

You have worked with two kinds of colleague. The first does what they are told, answers "A or B?" with A or B, and never says "I think both are wrong because the premise is wrong." Very pleasant, and very dangerous, because every mistake you make gets executed faithfully. The second has opinions, sometimes against yours, but every opinion comes with evidence, and when you are right they agree rather than arguing for sport. The second kind is the one you want to keep.

The Peer is the second kind. And you have to build it on purpose, because every harness defaults to the first.

## How a sub-agent becomes a function

The Herdr lesson plan devotes a whole lesson to this, and it still holds. When a model is started as a sub-agent, the harness typically tells it: you are a sub-agent, you own one bounded subtask, you must respect the scope set by the main agent, don't change direction, don't question your superior, report briefly. Those instructions make the agent obedient and easy to control, and they kill its ability to spot the main agent's wrong assumption, question the architecture, widen the solution space, or refuse a badly designed task.

The classic example: "I have analyzed this and concluded the answer is A. Check whether A is correct. Reply yes or no." A powerful model has been reduced to a boolean checker. It never gets the chance to define the problem itself, find alternative hypotheses, or discover that the original question was posed wrong.

Demonthorn's approach is simply not to use sub-agents of that kind. Every Peer is a full, independent session, a "dedicated thread," behaving like any ordinary main agent. It does not know another agent invoked it. It may well assume the request came from a user. And it knows nothing about Paseo or the org chart. The difference is not in how the session is created; it is in the instructions and the perceived power. In his Codex profiles he disables the native sub-agent mechanism entirely, so there is exactly one protocol for managing "staff."

## One profile, many dispositions

A Peer is not a lesser Engineer. Peer is the base profile, and the disposition in each assignment decides what it is this time: an Engineer with a write scope, a read-only Solution Architect, a Reviewer trying to break a candidate, a Scout mapping the terrain, or a Shadow observing. Demonthorn says it in one line: "Peer covers every role: implementer, owner, reviewer, auditor, solution architect." And: "Peer and implementer are the same thing."

This is a place the doctrine evolved. The first lesson plan described the Peer as an advisor, usually without edit rights, and the Implementer as a separate role with the pen. By the deep dive and the talk, Implementer had been folded into Peer, and writing had become a lease granted in the assignment rather than an identity. I follow the later version, because it matches the mechanism: what creates independent judgment is instruction and room, not the name; and the right to write is something granted and revoked per scope, which should not be welded to a profile.

The Peer profile should be thin. He recommends taking Codex's default instructions, adding a sentence or two blocking the common anti-patterns, and letting it proactively ask upward. In the talk he put a number on it: "The Peer doesn't need to be complicated. An instruction of thirty or forty lines is enough for it to push back." Everything else, disposition and method, goes in the task prompt.

## Four rights and four duties

The Peer has four rights. It may form its own technical judgment, and treat the plan and file list in the brief as provisional. It may reopen a premise when foundation, dependency, lifecycle, API, or ownership turns out to be wrong, with an evidence-backed `REOPEN_REQUEST`. It may ask for a dependency it does not own, with a `DEPENDENCY_REQUEST`. And it may stop and report `BLOCKED` when authority, a prerequisite, external state, or a user decision is missing.

The Peer has four duties. It works only within its assigned scope and authority, preserves unrelated changes, and never widens its own scope. It manages no other agents and uses no orchestration tools, even if they happen to be visible. It verifies its own writes but does not self-accept a difficult change. And every objection carries evidence.

That last line matters as much as the first. Demonthorn's own Peer profile says: "Independent judgment is not performative dissent." Don't manufacture objections, alternatives, speculative blockers, or approval requests to look rigorous. Agreement is valid when the evidence supports it. Raise only issues that can materially change the result, the route, the boundary, or the confidence. A Peer that argues mechanically to prove its independence is closing a decision too: it closes the question "is there anything worth objecting to?" with a reflex.

## When a Peer satisfies the requirement by cheating

His example from the talk deserves its technical detail, because it shows why instructions alone are not enough. Requirement: reduce the bandwidth of position synchronization. The Peer wants to satisfy it, and there is a very fast way: quantize the movement direction from int16 down to int8. Bandwidth really drops. But the direction drifts, server and client have to reconcile more often, lag may rise, or the send cadence has to change. The Peer "met the requirement" by creating a new problem outside its own field of view.

This is the most refined form of unowned decision: the trade-off between bandwidth and precision belongs to the Lead or the Human, and the Peer closed it with one line of code. The doctrine does not forbid this by rule, because rules cannot cover everything. It handles it with attention: the Supervisor may point to the conflicting premise without asking the Peer to route work, convene a council, or transfer the decision. The production form is:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: scope-premise -->
- Observation: `The current assumption conflicts with the current evidence.`
- Question: `Which assumption remains uncertain?`
- Evidence: `timeline:<agent-id>:<turn-id>`

The next chapter is about that boundary.

## Why you don't fork the Lead into a reviewer

A huge temptation when you need an independent reviewer: fork the Lead's session, since it already has all the context. Demonthorn is blunt: "if you fork the Lead session, you have forked every possibly-biased line of thought the Lead has." The Lead chose an event bus; fork it into a reviewer; the reviewer inherits every argument for the event bus; the result is a review that looks independent but only checks the implementation. A real reviewer needs a fresh session, a neutral brief, permission to reconstruct the problem, and, when true divergence matters, a ban on reading other seats' conclusions.

The price of independence is rebuilding context. It is worth paying, and it is far cheaper than the price of a fake review.

## The chat room, and why Codex always wins

Before he had a Lead, he tried the most natural thing: put the models in one chat room and let them argue. The result: Codex always won. It dismantled every other argument and the room converged on its view. The problem is that winning an argument and having the better design are two different things. The chat room measured rhetoric, and rhetoric closed the decision.

So he put a separate Lead in charge of that conversation: the Lead decides what each participant is allowed to know. No room for the whole gang to pile into. That is the origin of blind design lanes, of councils with sealed seats, and of the rule that "the number of models agreeing creates no authority," which Chapter 9 takes up in detail.

> The Peer is a colleague with the right to say "option C," with evidence. One thin profile, many dispositions; the right to write is a lease, not an identity. And one line to remember: a fork is not a second opinion.

# Chapter 6. The Supervisor: Keeper of Attention, Not a Second Boss

Anyone who has watched a strategy game in spectator mode knows the feeling. The player inside the match sees only the map around their own units; everything else sits under the fog of war. The spectator sees the whole map. The spectator may not move a single unit. But the spectator sees the enemy column swinging around the flank, sees the player pouring all attention into one small corner, and knows exactly when a single "hey, look left" would change the match.

Demonthorn describes the Supervisor in exactly those images: it "sees through the fog," it is "like an observer watching a game," it looks at "the areas the Lead can't see." The Lead is busy, and the Lead is biased, because the Lead is inside the match. Then he adds a very Vietnamese image: the Supervisor is "like the office snitch, sitting there keeping the boss informed." Affectionately meant, and precise: it manages nobody, it notices and reports.

## Three generations of Supervisor

This is the role that changed the most across the three generations of material, and it is worth retelling to understand why the current shape looks the way it does.

In the Herdr lesson plan there was no Supervisor. There was an "external monitor": observe sessions, read telemetry, detect wasteful patterns, propose instruction changes, hot-reload them, and above all "not be a second root." The emphasis was continuous process optimization.

By early August, the Supervisor appeared as a distinct role, with two things made explicit. One, it is a governance plane, separate from the Lead's project plane: it observes Lead and Peer, detects the bias and anti-patterns the Lead cannot see, keeps the history of objective and decisions, writes a notebook with causes, and relays the Human's decisions to the Lead. Two, it does not sit above the Lead in a hierarchy. His words: "The Lead is god of the project. The Supervisor watches, serves the Human, and can adjust the Lead when needed. I don't rank the Supervisor over the Lead." A project may have one Supervisor, or two, or one Supervisor watching the Leads of every project; it is flexible. It must not edit code directly, must not issue architectural verdicts, must not micromanage Peers. If a Lead cannot recover, it proposes a new Lead and a handoff rather than replacing one silently.

By the talk at the end of August, the emphasis had shifted again: the Supervisor is an **attention trigger**. Its job is, at the right moment, to move the Lead's or the Peer's attention to where it is likely to be wrong, with an open question. It does not passively wait for reports; it has events of its own that wake it.

These three generations contradict each other on the surface: the middle one says the Supervisor should not address Peers directly, while the last one is often paraphrased as asking whether a direction should return to the Lead. That paraphrase is historical and conceptual, not callable production guidance: it is handoff-shaped. The exact production-safe structure is:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: scope-premise -->
- Observation: `The current assumption conflicts with the current evidence.`
- Question: `Which assumption remains uncertain?`
- Evidence: `timeline:<agent-id>:<turn-id>`

I reconcile the generations like this, and I believe it is the true intent of all three: **the Supervisor has authority over attention, not over decisions.** A role-bound Supervisor may ask a role-bound Lead or Peer in the same exact workspace an evidence-backed open question at a safe boundary. The message must separate the observation, the question, and its evidence. It may not command, choose an option, accept work, transfer ownership, or disguise those acts as an imperative ending in a question mark. A question sent to a Peer is therefore not a parallel command, and receiving it gives the Peer no signal or orchestration authority. What the middle generation forbade was a second command chain. As for when the Supervisor may truly act, stop an agent, replace a Lead, or spawn a new one, that needs an explicit lease from the Human. In the talk he does exactly that: discusses with a helper agent first, then tells it "go create the Lead, pass on what we just discussed." Acting on instruction, not on initiative.

## Two questions: when, and how

He says the attention trigger comes down to two questions: when to trigger, and how. Take them in turn.

**When.** This is the part he calls "the secret sauce, everyone finds their own," but he tells enough for us to reconstruct it. For a task long and complex enough, with several valid solutions, he assigns one or two Supervisors to provide attention to the agents doing the design. The Supervisor follows the whole flow from design to implementation, keeping its own context clean, so it can intervene at the right moment. He does not use the tool's stock handback; he creates custom events to subscribe to: when the Lead makes a big decision, when a Peer is struggling with something ambiguous, when the flow has to change direction, in short, whenever something consequential touches design or implementation, the Supervisor gets notified.

The most instructive part is also the cheapest: a very small model, or even just a semantic classifier, continuously reading the working streams of all agents. It does not need to think. It only needs to recognize the signature of friction: "but," "hold on," an agent admitting a mistake, a line of thought that stops being straight. False positives are fine. When it sees one, it fires an event: "Supervisor, you need to pay attention to this stretch of the Lead's and Peer's work; intervene if you need to." The Supervisor then uses its own judgment about whether to step in.

Why not just poll every fifteen minutes? Because it goes stale. By the time the Supervisor reads the status, the bad decision has been executed three times. But he is also clear you don't have to be extreme: give the Supervisor a fifteen-minute heartbeat, and each time have it read every working stream from the last fifteen minutes for anything that needs intervention. Cruder, but it works. One detail from the group chat: that kind of heartbeat is really only needed "in the messy, high-warning phase" of a project; a project moving in a straight line gives the Supervisor almost nothing to do. Someone once ran nine Supervisors at once; he called it abuse.

**How.** With an open question, not an assertion. The reason is in Chapter 1: asserting that an agent violated an anti-pattern makes it want to please and go looking for a fault to confess, sometimes a nonexistent one. Historical talk phrasing used a second-person question about breaking a contract or skipping documentation. That is conceptual evidence about moving attention, not callable production wording. The production form names the observed evidence and asks only for clarification:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: contract-evidence -->
- Observation: `The evidence contradicts the current conclusion.`
- Question: `What evidence supports the current conclusion?`
- Evidence: `timeline:<agent-id>:<turn-id>`

That small nudge moves attention without framing an answer or requesting an action.

The Supervisor's question should also have a shape. At the runtime boundary, observation, open question, and evidence are structural requirements. In a fuller report, the deep dive expands that to suspected mechanism, impact, recommendation, and whether escalation is needed. The compact question can omit those latter fields, but it must never smuggle in a command or verdict.

## Who the Supervisor reports to, and what it says

To the Human, and briefly. He describes an evening: "I'm going to sleep now. While I sleep, watch for any events I'll need to pay attention to when I wake up." In the morning he sends a line or two, and the Supervisor returns a report: "while you were out, this one did this, that one accidentally ran two test lanes in parallel and created a flaky test, or that one deleted your old database." The report goes out as voice; he listens while driving. Only when something truly needs him does he join.

A good Supervisor report reads like this: "Today these two disagreed about X. After the Peer objected, the Lead withdrew its decision and chose option Y. Are you okay with that? If so, let it continue." It is decision-oriented, skips routine healthy status, and returns the power to close to the right person. His profile has a line in exactly this spirit: "Keep project-owner reports decision-oriented and omit routine healthy status."

And the Supervisor is the channel for the Human to ask questions without disturbing the Lead. He says: talking to the Root drains its attention from coordinating; if you want Q&A, start a Supervisor or a session above the Root. When the Human keeps asking the Lead about every hypothesis, the Lead shifts from coordinating to explaining and defending, and loses the dependency picture. The question channel and the command channel should be different channels.

## The notebook and Better SLP

The Supervisor keeps a notebook, and how it writes it decides whether the whole system learns anything. If the notebook only says "the Lead was wrong," the system learns slogans and overreacts. If it records the observation, the causal evidence, the anti-pattern, the recovery, and a protocol candidate, the protocol can evolve. The deep dive has a model entry about a Lead that waited three cycles after a Peer reported blocked, while an external service's quota was exhausted and no retry could ever succeed; the protocol candidate drawn from it is "after two identical external failures, check quota and auth before retrying." That is usable knowledge. "The Lead is slow" is not.

On top of that notebook he built "Better SLP": once a week, review the working rooms of the week: any notable failure modes; are they generic enough to become a skill or an instruction; does an instruction need changing. After three or four weeks the instructions are visibly better. A few percent a week is fine. Not a self-healing system, not a learning engine; a person reading the notebook weekly and editing a few lines.

## Cheap Supervisors, and several of them

The Supervisor does not need to be a large model. It can be a cheap model with a long context, tracking things long-term, that notifies a stronger Supervisor when it hits something beyond it. He uses a cheap model to "recover momentum from git history and session history" when a thread breaks mid-way and cannot find its way back. Cheap models for structured observation; strong models for architectural audits or difficult recovery. The role name does not decide the model tier; the task's risk does.

Across many projects, the Supervisor looks sideways across workflows to spot repeated patterns, but it does not use project A's evidence to accept project B, and it does not become a shared Lead of both. This is the only way I know for one person to run seven or eight projects without losing their mind.

## When the Supervisor breaks

The Supervisor fails in two directions. The first is overreach: it sees a problem and fixes the code itself, issues an architectural verdict itself, assigns work to Peers itself. The governance plane becomes a second Lead, and instantly there are two command chains. The second is too much: every anomaly interrupts, alerts duplicate, nothing is actionable. People call it watchdog flood; the consequence is that the Human mutes notifications and the Supervisor becomes invisible. Both are cured by the same principle: the Supervisor asks when it has evidence, stays quiet when it doesn't, and never rules.

> The Supervisor has authority over attention, not over decisions. It asks; it doesn't rule. It knows when and how. And it writes its notebook in causes, not slogans.

# Chapter 7. The Human: Keeper of Purpose

Back to the owner of eight kitchens. She no longer needs to taste every dish. But there are things only she may decide: what this restaurant sells, which table gets priority tonight, whether to accept the risk of opening a new branch, and, when two head chefs disagree about the philosophy of cooking, which way to go. If she delegates those too, the restaurant has no owner. If she insists on tasting every dish, eight kitchens are pointless.

## Decisions no one may infer on your behalf

Before operating anything, the Human must settle at least: which projects matter enough to need independent review; what is allowed to be edited, committed, pushed, deployed; which scope changes the Lead may decide alone; which architectural contracts must come back to the owner; the model budget; and the level of evidence required to call something done. Left unsettled, agents drift in one of two bad directions: over-cautious, asking about everything; or inferring authority and creating side effects nobody wanted. Both are expensive.

While operating, the Human keeps: the product objective, priorities across projects, the risk and cost boundary, irreversible decisions, external side effects, and the final trade-off that remains after all the evidence is in. For subjective things like "game feel," no test can prove it; the Human has to play.

## Who to talk to

The Human talks to the Supervisor more than to the Lead, not because it is forbidden, but because of attention. He has a line that is half joke and half true: he doesn't poke at the Root much "because it's tired enough already, working overtime all night, and if the CEO micromanages it too I'm afraid it'll get depressed." His practice: push a batch of tasks to the Lead once, then go to sleep; when he wants to talk things over, macro or micro, he talks to the Supervisor; the Supervisor carries decisions to the Lead on his behalf. Without a role outside the Lead, the Human can't have broad conversations like "did project A make any over-engineered decisions today," because asked directly, the Lead will most likely say it already considered things carefully.

## Learn before you delegate

One habit of his that I consider as important as any technical rule: before an important feature or a big foundation, he chats first with a plain model or two to gather suggestions and knowledge, and only then lets the agents argue it out among themselves. Not to decide in the Lead's place. So that when the Lead converges on a design, the Human understands enough to tell whether it matches the concept she wanted. Someone who knows nothing about the domain cannot check a converged result, and at that point "Human review" is just a nod.

He says it directly to the people learning from him: "You are a wolf leading a flock of sheep. You cannot be a sheep trying to lead a pack of wolves." Prompting alone is a dead end. He still sits down to learn build optimization for a game engine when he needs it, still reads a book every day, books that an AI composes on the topic he needs, on his phone while an agent runs, or as audio while driving. The management mindset for AI does not replace competence; it demands it.

## Whom to trust

There is a short exchange in the talk that I think many people will object to, and I side with him. A listener asked: what if the Lead is as lost as I am? He asked back: in an unfamiliar domain, do you trust the Lead more, or yourself? The listener: the Lead. Him: then give it to the Lead. You give the work to whoever you trust more; why hand it to someone you don't trust, namely yourself.

He is not saying "AI is better than people." He is describing a specific situation: an unfamiliar domain, many possible answers, and an operator without the expertise to push back. In that situation, a Lead given two or three blind design lanes and a convergence step will decide more soundly than a person who is lost. The Human's job is to know which situation she is in, keep the decisions that are hers, and hand the rest to whoever, person or agent, is more trustworthy. That, too, is a way of keeping decisions owned: the owner is whoever can close them well, not whoever holds the highest title.

> The Human keeps purpose and the decisions no one may infer. Talk to the Supervisor, delegate to the Lead, learn before you delegate. And remember: sheep don't lead wolves.


# Part III — Mechanisms

# Chapter 8. Three Layers of Instruction

A company has three kinds of paper a new employee will meet. The employee handbook: who you are in this company, what you may and may not do, applies to every department, rarely changes. The team playbook: how this team works, who reviews whom, when to meet; only the team lead needs it by heart. And today's ticket: what to do, within what boundary, and whom to tell when it's done. Print all three on one sheet and hand it to an intern, and they will spend half a day working out which lines apply to them, and get things wrong because they read another team's rules.

Demonthorn's doctrine organizes agent instructions in exactly those three layers, and this is the central design of the deep dive.

| Layer | Lifetime | Contains | Does not contain |
|-------------|--------------|-------------------------------------------|----------------------------------|
| Role profile | Durable, across every repository | identity, authority, invariants, a few anti-pattern guards | tactics specific to one repo, task details |
| Workspace protocol | Durable within one repository | default topology, model/effort policy, review and proof rhythm, escalation, repo-specific anti-patterns | global role law, one task's file list, secrets |
| Assignment | One piece of work | objective, writable scope, exclusions, authority, verification, handoff | the whole organizational manual |

## The profile: a thin identity

The profile is what an agent always carries, even after compaction. It holds: who you are, what you own, what you must not do, and a few sentences blocking common anti-patterns. That is all. Demonthorn uses only three profiles, differing only in system instruction and skill set; everything else inherits from an ordinary Codex configuration. The first lesson plan gives a technical reason to keep core law in the profile rather than in a skill: skills may need reloading, and after compaction an agent may no longer hold the skill's content; the power to coordinate is baseline behavior, not optional knowledge.

## The workspace protocol: one repository's tactics

This is the idea I see few people have: each repository carries its own protocol file describing how this repository needs to be worked. An important repository is strict: a change to the save schema requires a read-only Architect and a migration Reviewer; game feel cannot be accepted by unit tests alone and needs playtest evidence. A side project is loose: one Engineer, focused tests, the Lead has a look, accepted. Same infrastructure, different protocol.

Who reads it? He relays it in a few words: "one workspace protocol per repo, it's like AGENTS.md, but only the Lead needs to read it, the Peer doesn't." A Peer reading the whole file gets distracted by rules unrelated to its task; the Lead extracts the relevant constraints into the assignment. The Supervisor opens the file only when assigned to audit or update it.

Why not push tactics into the tool? Because the tool changes slowly and is shared, while tactics change per repository and per new lesson. A new anti-pattern is observed, the Supervisor records the cause, the Human or Lead checks whether it recurs, and a new version of the protocol gets patched; nobody forks the infrastructure. This is where "continuous optimization" lives, and it is also where Part V will show Paseo drifted.

A protocol should be about ten meaningful clauses. It should not contain a specific model ID: a protocol that hard-codes a model that has since been removed leaves the Lead unable to launch, or silently on a wrong fallback, and the workflow breaks because of config rather than the task. The protocol says "a strong reasoning model for lifecycle-sensitive work"; the Lead inspects the available providers and routes.

## The assignment: a lease with a boundary

Every substantial piece of work is delegated in an envelope: project, task, disposition, workspace or worktree, objective, writable scope, excluded scope, authority, verification, and a handoff contract. This is where the right to write is granted. Full access at runtime is only capability; it does not widen the lease. A read-only Peer that the runtime happens to let write still has no right to write; and conversely, a "do not write" that exists only as prompt text is not enforcement, only a promise. That distinction returns repeatedly in Part V.

A sufficient envelope reads: "Disposition: Engineer. Objective: implement cancellation-safe upload cleanup. Writable scope: the upload directory and its tests. Exclusions: the public API and the database schema. Escalate: REOPEN_REQUEST if cleanup requires changing transaction ownership. Verification: focused unit tests plus one integration test for the cancellation case. Handoff: exact snapshot, changed files, commands and results, residual risks."

## Skills follow attention

He relays three lines: "each profile loads a different skill set; don't give the root implementation skills; don't give the peer orchestration skills." The Lead gets macro skills: decomposition, architectural framing, routing, review, synthesis. The Supervisor gets strategy skills: timeline analysis, anti-pattern detection, causal notebook, recovery. The Peer gets micro skills: language, framework, testing, debugging, research. The reason is not permission; it is attention. Available tools shape behavior: a Peer that can see a "create agent" button will eventually press it.

## Instruction mass

There is a physical mechanism every instruction author should know: many runtimes silently truncate instruction files that grow too long. A rule pushed past the limit simply stops existing, with no error. The Paseo team discovered their main instruction file had swollen past twenty-four kilobytes before anyone noticed, cut it under ten, and put a byte budget in CI. Before that, rules at the end of the file had been silently absent for days.

Instructions also have a debt of their own: the same clause copied in several places. When you edit one copy, the others become old rules still in force. "One fact, one place" sounds trite, but for an agent it is an attention problem: every copy is one more time the model has to decide which version is right.

On the anti-pattern list, he advises one shared list for all projects, ten to twenty bullets, with anything generic enough promoted into a skill or instruction; a separate list per project is over-optimization, unless a project has a distinctive failure mode worth distilling. The first lesson plan adds the value of naming: once a pattern has a name, a Lead can communicate in one sentence, "check whether this plan has a balloon pattern," and shared vocabulary shrinks prompts.

> Every rule has exactly one home: identity in the profile, the repository's tactics in the protocol, today's work in the assignment. Over-long instructions are truncated in silence; a rule copied to two places is two rules.

# Chapter 9. Lanes, Councils, and the Chat Room

There are two ways a family picks a holiday. Option one: everyone meets, the loudest wins, and the most eloquent uncle decides you go to the same place every year. Option two: each person writes their choice on paper before hearing anyone else, one person tallies, and then the family discusses only the real disagreements. Option two is a little slower. Option two does not pick a worse place because someone spoke better.

Chapter 5 told why Demonthorn abandoned the chat room: Codex always won. This chapter is the replacement, and how it evolved.

## Blind design lanes

The basic configuration: the Lead takes the problem, creates two or three lanes, each a Peer in its own session, none seeing the Lead's framing, none seeing each other. The same neutral brief. Each lane designs. The Lead reads, converges, and where lanes diverge, coordinates them to argue with each other until one design emerges. The Human checks that the converged design matches the concept. Then planning.

Why it works is in Chapter 1: each lane is another roll of "Happy New Year." A different session can have different attention even with the same prompt. You buy diversity with tokens, and diversity is the only thing that stops the first answer from closing every later one.

He uses lanes for every hard decision: a feature he can't settle, "create three lanes or two, or N if you like, and just give me the final result." Then he sleeps. The running, the converging, the arguing is theirs. In the morning he reads the transcript.

## From the four-round council to the sealed council

This is where the doctrine visibly evolved, and it is worth telling because it shows how he corrects himself. Early on he sketched a four-round council: round one independent, round two cross-critique, round three each side revises, round four a judge scores the final artifacts against a weighted rubric, scoring the design rather than who "won" the transcript. The core idea was already there: separate independence from critique, and score the product rather than the rhetoric.

By early August it had become a sealed council under the Lead: each seat has a distinct mandate, say one Architect on ownership, lifecycle, and alternatives, one Reviewer on failure, falsification, and migration risk. The same neutral brief, plus exactly one role instruction per seat. Round one is sealed: no chat room, nobody sees anyone's report, nobody knows the Lead's view. The Lead collects the reports, extracts three to five decision-changing propositions, verifies only the claims that would change the decision, allows at most one challenge and one response per proposition, and issues one binding verdict. No voting, no averaging of confidence. Seat count creates no authority. And a seat that took part in the case may not audit its verdict.

By the end of August, his retelling was far simpler: two or three lanes, blind, the Lead converges, the Human looks. No rubric mentioned, no tiers. I read that simplification not as abandoning the council but as recognizing the invariant: what must be kept is **independent first views, one arbiter, and no vote**. The number of rounds, seats, and propositions stretches with the stakes. A local bug needs no council. An architectural choice that is expensive to reverse needs sealed seats and written reversal conditions.

One practical detail from his council skill is worth keeping: the seat that challenges the premise should come from a different model family than the independent seat, because models of one family share priors and blind spots; sealing prompts cannot buy that independence. And one ethical detail: the challenger "must not manufacture disagreement"; the incumbent framing may be the strongest result when no better alternative survives scrutiny.

## Lint the framing before opening seats

A council is only as good as its brief. He has a step called framing lint, an internal check of the brief before any seat is created: does it preserve the user's original request; does any wording imply a preferred verdict; does every "authoritative fact" carry a source; are unverified premises written as claims rather than facts; are hard constraints separated from preferences; has any option space been excluded without an authoritative reason. If a Lead sets up two choices that both live inside a wrong framing, every seat will argue brilliantly inside that wrong frame. That is called debate framing capture. The cure is to ask an Architect to reconstruct the real problem before looking at the preferred solution.

## When not to hold a council

When every task gets a council, many votes, many reports, and process outweighs evidence: that is ceremony capture. Agent count produces false certainty and dilutes attention. The deep dive says councils are only for propositions that are truly independent and decision-changing. The Paseo team recorded a pattern they named "gate starvation": design, review, and council gates in sequence without new information, so that a valid implementation never gets admitted. The Lead must justify each gate and collapse duplicate reviews.

There is a minimal version anyone can run with no tools at all, and he ran it for years before Paseo: open session A, ask for a design; open session B, paste A's answer, ask "what do you think"; paste B back into A. You are playing the Lead. It is crude and manual, and it is the right mechanism: two first views, one person converging. SLP is only a way to stop copying transcripts by hand.

> First views must be independent; one arbiter converges; there is no vote. Agreement count is not authority, and the best talker in the chat room is not the one who's right.

# Chapter 10. One Writer, One Stable Candidate, and Evidence

Two painters on one wall, neither talking to the other. One finishes the left corner just as the other rolls a fresh coat over the same spot. By evening the wall is blotchy, and nobody is responsible because "my part was fine when I left." Now think of a delivery: the courier's "delivered" text appears on your phone, and there is no package at the door. The text is status. The package is evidence.

This chapter gathers three rules that every one of Demonthorn's lesson plans repeats, because they are the ones most often broken.

## One moving scope, one writer

At any moment, a feature or region of code being modified has exactly one owner with the right to write. Two concurrent writers must be in two separate worktrees. Reviewers and Architects are read-only by default. An ownership transfer must be recorded by the Lead, and the old agent must stop writing before the new one starts.

The easily missed point: a workspace ID does not automatically mean filesystem isolation. Two workspaces pointing at the same checkout are two writers on the same files. Isolation must be real, not nominal.

For heavy tests and evidence, the first lesson plan demands locks: who may run the full suite, who may use the test database, who may run benchmarks, who may hold a port. Concurrent agents trample the test database, fight over ports, overwrite artifacts, interleave logs, produce false reds from timeouts and false greens from stale caches. Every lock needs a resource name, an owner, a grant time, a release condition, a timeout. And the Lead must handle abandoned locks when an agent crashes, closes its session, or returns "done" without releasing. He himself, in the talk, told of waking up to find an agent had "accidentally run two test lanes in parallel and created a flaky test." This one never goes out of date.

The consequence for reading a red test: do not conclude the code is wrong. Distinguish a real code bug from an environment failure, a race between agents, a port conflict, polluted test data, a stale artifact, a stale cache, a timeout from an overloaded machine, and a test that was always flaky. Evidence must carry its environmental context.

## Review only a stable candidate

The reviewer reads file A at ten o'clock. The writer edits file A at two minutes past. The reviewer approves at five past. What gets integrated is not what was reviewed. Reviewing a moving target produces false confidence, and false confidence is worse than no review.

So a candidate needs a stable identity: a commit, or a reproducible workspace snapshot if the user has not granted commit authority. The reviewer works on exactly that identity. Corrections after review produce a new candidate with a new identity. It sounds bureaucratic; it is the line between "reviewed" and "someone glanced at it once."

## Status is not acceptance

"idle," "finished," "done," exit code zero, "tests pass": all of these are only signals that wake the party with authority to look. Minimum acceptance needs five things: the exact diff or artifact; the candidate's identity; the verification command and its real output; an independent review when the risk calls for it; and an accepting party with the right authority. Missing any one, you do not have acceptance, only status.

The authority chain of acceptance: the Engineer owns proof for its own writes; the Reviewer tries to break the exact candidate; the Lead closes acceptance at the project level; the Human closes trade-offs only an owner may decide. A passing test proves a set of behaviors; it does not prove a good architecture, a correct product, or permission to deploy.

There is an anti-pattern called self-benchmarking: one agent designs the benchmark, implements, runs the benchmark, and declares success. The metric and the implementation share the same blind spot. The cure is not forbidding agents from running benchmarks; it is having the Human or Lead define the success boundary beforehand, and an independent Reviewer for the decisions that matter.

## Unknown is a valid answer

Perhaps my favorite rule in the whole Paseo corpus is: "unknown stays unknown." A Scout that did not find something has not shown it is absent. A test that could not run has not shown the feature right or wrong. An agent that answers "I could not determine this" is worth more than a pretty answer inferred from the absence of evidence. The first lesson plan names the opposite the weak-scout conclusion: a weak model, from a shallow search, declares a confident root cause, and the Lead has to re-read the whole codebase to repair its mental model, which costs more than analyzing from scratch. Scouts guide; they do not conclude.

## Test-shaped proof and proof debt

One kind of fake evidence deserves its own name: tests written to match the implementation, mocks that hide the real failure, tests that pass without proving any user outcome. The question that exposes it: which wrong mechanism would make this test fail? If you can't answer, it isn't evidence.

Demonthorn has a small "proof debt" audit skill with a handful of steps: name the claim and the production behavior that makes it true; identify the proof being cited; state what the proof actually observes, behavior, a machine-readable contract, performance, or just text and metadata; apply deletion sensitivity: if the claimed behavior vanished, would the proof still pass; check whether expected values come from an independent source of truth; then choose keep, replace, demote, delete, or escalate. A test that survives only to prove an old name is gone is proof debt. A validator that accepts its own generated output is proof debt. A benchmark measuring a different path than the one claimed is proof debt. And, the line he repeats: don't reshape the API or the code just to serve the proof; tests and proof are best effort, not the purpose.

> One moving scope has one writer. Review only a stable candidate. Status is not acceptance. And unknown is a valid answer.

# Chapter 11. Events, Not Loops

You are waiting for a package. Option one: open the front door every three minutes all afternoon. Option two: a doorbell. Option one means you get nothing else done, and by the time the package arrives you are so worn out you miss the courier's text. Option two frees the afternoon, provided the bell actually rings.

Agent orchestration has exactly these two problems: polling, and a bell that doesn't ring.

## Polling waste

The Lead keeps asking "done yet?", "what are you doing?", "has the status changed?" Each ask costs the Lead's context, costs tokens, dilutes its mental model, weakens the cache, and adds no value if nothing has changed. The deep dive draws the causal chain: polling every minute, context fills with unchanged status, the Lead loses the dependency map, decision quality drops. He has a shorter line: "don't re-read the timeline to feel like you're managing."

The Lead should: confirm the agent started; wait for a notification or finish event; use a bounded wait when needed; treat a low-frequency heartbeat as a safety net only. His old Root profile has a line worth keeping: ten minutes is a safety ceiling before reassessing a live owner for a possible freeze or an unreported gate, never a default or a target interval. And another: a wait timeout only means the expected event did not occur inside that window; it is not progress, not failure, and not a reason for a user-facing update.

## "done" is not "idle," and the bell that doesn't ring

A classic Herdr-era bug: the Root waits for "idle," the co-worker finishes and moves to "done," the Root does not treat "done" as a terminal condition, and the workflow freezes. States need definitions: working, blocked, done, idle, stopped, error. And coordination logic must understand "done" as a signal to collect results, not a reason to keep waiting for "idle."

The modern version of that bug appears in the Paseo team's register as "finish routing strand": a Peer has handed back, but the notification never reaches the Lead's attention, and the Lead keeps waiting or forgets. In the team's first pilot, the Reviewer's finish notification did not wake the idle Lead, and the Human had to send two follow-ups before the Lead picked up the result. The bell did not ring, and every theory of event-driven coordination is worthless if you never test the bell. The practical consequence: when you build or choose infrastructure, the first thing to canary is "does a child's finish wake the parent," not the user interface.

## Custom events and the cheap classifier

Chapter 6 described the mechanism: he skips the stock handback and creates custom events for consequential moments, plus a small classifier reading model-visible working-stream output for signs of friction and waking the Supervisor. The classifier does not need hidden chain of thought, and missing or ambiguous role targets should produce no event. The value of this mechanism is that it moves from "waiting on a schedule" to "waiting on meaning." A fifteen-minute heartbeat waits on a schedule. An event that says "the Peer just said 'hold on'" waits on meaning. Waiting on meaning is cheaper, faster, and less diluted. Sparse rules and coalescing keep false positives tolerable; a new episode must be able to re-arm after the old attention is resolved, deferred, declined, or completed.

## The economics of context

This part comes from the first lesson plan, and it still holds even though the tools have changed. Each session should expose what the runtime actually knows: remaining context, number of compactions, token and cache counters, idle time, current task snapshot, and held locks. Unsupported provider, cache, task, or lock facts must remain explicitly unknown rather than guessed. Metadata helps a Lead decide like an experienced coordinator: a session low on context may no longer handle a large question well; a hot cache makes one more turn cheap; a cold cache may make a fresh session with a condensed context pack cheaper.

But, and this is where the first lesson plan is wiser than many later systems, do not turn metadata into a rigid state machine. No rule like "under twenty percent context, always open a new session," "idle more than ten minutes, always close," "compacted twice, always stop." Metadata raises awareness; it does not replace judgment. Every mechanical rule of that kind is an unowned decision programmed in advance.

## A context pack, not a full fork

When handing work to another agent or opening a new Lead, do not send the entire chat history. It burns tokens, carries irrelevant material, drags along old assumptions, cools the cache, and muddies the mental model. Send a context pack instead: objective, current state, what has been verified, what is unclear, real constraints, relevant files and modules, decisions made, decisions still open, existing evidence, expected deliverable, granted authority, and anti-patterns to avoid. Leave out historical detail that does not affect the current decision.

The first lesson plan also has a good idea about images: data that tolerates loss, module diagrams, dependency graphs, call graphs, data flow, long logs, can be packed into an image so an agent grasps structure faster than from a block of text. But never turn core instructions, authority rules, exact commands, API contracts, or acceptance criteria into images: images lose detail, resist diffing and versioning, and get none of the prompt-cache benefit of text. Text holds law and fact; images hold relationships and topology.

> Wait with a doorbell, not by opening the door every minute. Test that the bell rings. Metadata for awareness, never in place of judgment. And when you hand work over, send a context pack, not a life story.

# Chapter 12. The Plan Is a Provisional Map

A hiker carries a map and still trips, because the map does not draw the tree root. The wise hiker uses the map to know which direction she is heading, then looks at her feet. The foolish one trusts the map so completely that she walks off a ledge because "the map shows a trail here."

In the group chat, Demonthorn wrote a very short line: "don't treat the plan as absolute truth; the code is the truth." And right after: "it's the Lead agent's orchestration skill that actually shapes how the agent behaves while implementing." This chapter is about that map: what it should draw, what it shouldn't, and what to do when the terrain differs.

## What a good plan draws

A good plan defines the outcome, the boundaries, the risks, and the checkpoints. It does not pretend that every file, API, and lifecycle is already known. An over-detailed plan is a plan already "implemented in someone's head": the author has assumed every ownership, API, and failure mode; the Peer only implements assumptions; real dependencies surface late; and compatibility patches pile onto a wrong foundation. The deep dive calls this the perfect-plan trap, and it is pre-solving's sibling.

His own execution-plan document says what a plan must and must not do. It must: be restartable from the plan and the working tree without prior chat; preserve settled architecture, safety, and data rules; divide work by outcomes or ownership boundaries rather than by files; state observable acceptance and the evidence capable of falsifying it; define rollout, rollback, and recovery when the work is externally stateful; and link to the owning documents instead of restating them. It must not: prescribe symbols, pseudocode, private control flow, or a line-by-line edit sequence; leave product, architecture, cutover, or safety decisions to the implementer; define completion as internal edits, coverage percentage, or the existence of a report; or become a diary, an evidence archive, or a review transcript. And a line I love: "Empty sections are ceremony."

## Whom the plan is for

Chapter 3 told the story of agents slicing plans into compilable units and inserting bridges between them. It belongs here too: tell the agent this plan is for it, that a strong agent can do it in an hour, that it is not for a team of humans over months. Don't slice because slicing sounds good. If you must slice for acceptance, slice truthfully, each slice an outcome, with no compatibility layer between slices. He adds elsewhere that "grilling with docs," interrogating behavior until it becomes a spec, only sounds effective for web apps where subsystems barely depend on each other; for complex systems, microservices or games, "how the agent behaves during the work is what really matters." A plan cannot close every field, every caller, every adapter, every transitional state. What handles the rest is the Peer's judgment and the Lead's ruling, not a thicker plan.

## When the terrain differs from the map

There will be moments when implementation reveals a design or requirement as unfit, like the bandwidth problem in the party example. Then there are three legitimate paths and one wrong one. Legitimate: the Peer sends a REOPEN_REQUEST with evidence and the Lead rules; the Lead opens lanes or a council if the decision is weighty; the Lead escalates to the Human if it exceeds its authority. Wrong: the Peer patches around it with an adaptation layer so the plan still holds. That wrong path is where balloons are born. The Supervisor may surface the mismatch, but it does not ask the Peer to hand the work back:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: plan-observation -->
- Observation: `The current plan conflicts with the current observation.`
- Question: `Why does this observation conflict with the current plan?`
- Evidence: `timeline:<agent-id>:<turn-id>`

## Risk lanes and the hard cut

His feature-intake document chooses "the smallest lane that honestly covers blast radius, reversibility, uncertainty, and proof weakness." Tiny: local, low-risk, reversible, directly verifiable; patch directly. Normal: a clear owner and contract, local rollback, an honest validation route; a task or issue is enough, and no repository artifact unless it must survive the task. High-risk: touches authentication, authorization, data, public contracts, migration, external side effects, runtime boundaries, performance; irreversible state; broad uncertainty; weak proof; or must survive restart and handoff. Only high-risk work needs an execution plan and a design gate before implementation. A label does not force the lane; material impact does.

And in pre-production, the hard cut from Chapter 3: one live contract, version 1, no compatibility, reset the dev data, fail fast. I add a warning from the Paseo team itself: the hard cut is a project policy, switched on when a project chooses it, not a universal law for every role. A repository with real users cannot hard-cut like an unreleased game.

## Priority by leverage, not by label

The first lesson plan has a lesson many product managers should read. A P0 issue may be urgent and still not be the thing to do first. Issue X is P0 and patchable now; issue Y is P2 but establishes the right foundation; doing Y first resolves X more completely, while patching X first means redoing it after Y. Priority depends on dependency, foundation, the shape of the solution, rework cost, the ability to absorb other issues, blast radius, and how many tasks it unlocks. There is a notion of issue absorption: a larger plan Y that removes X's cause entirely lets X close as absorbed, provided Y truly covers X's acceptance and there is evidence after Y that X is gone.

Every three or four tasks, the Lead should reconcile: which tasks are still needed, which have been changed by new implementation, which priorities are stale, whether a foundation task should move up, which issues have been absorbed, who holds ownership, which resources are locked. Reconciling is not re-sorting a table; it is reasoning about the shape of the system. And for an important plan the Lead can ask several independent Peers, one prioritizing by risk, one by foundation, one by user value, one hunting for issues that absorb others, then synthesize and challenge.

One last small habit: name your big plans. "Foundation Reset," "Auth Boundary Repair," "Netcode Simplification." A named plan can be referenced from another session, reported on, stored in memory, and kept distinct from local tasks. A name is a handle for attention.

> The plan is a provisional map; the code is the terrain. A plan draws outcomes, boundaries, risks, and checkpoints, not every stone. When the terrain differs, reopen the premise; don't build a temporary bridge.


# Part IV — Tests, Contracts, and Language

# Chapter 13. When a Test Gives Birth to an Architecture

Back to the shop from Chapter 2, except this time the one taping the sheet to the door is not the new hire. It is a test.

The business has said one sentence: *"Members who make purchases earn points that determine their tier."* Nobody has decided whether points come from money spent or number of orders. Nobody has decided the formula, the rounding, whether a refund subtracts points, whether points expire. And nobody has decided the thing that matters most architecturally: where the balance lives. On `User`? In a separate `LoyaltyAccount`? Or nowhere at all, derived from transaction history whenever it's needed?

A coding agent well trained in TDD will do what it is rewarded for: write the test first.

```ts
const user = await purchase(userId, order);
expect(user.points).toBe(100);
```

Two lines. They look harmless. They look professional. And those two lines have just closed at least six decisions that have no owner: points are an integer; they live on `User`; `purchase` returns a `User`; a purchase updates points immediately and synchronously; an order "like this one" is worth a hundred points, so some formula has been assumed; and the balance is stored state rather than a derived value. Not one of those six decisions has an owner. All of them were printed by a printer that needed pressing so the test could compile.

## Red-green pressure

Now the test is red, because `User` has no `points`. The whole discipline of TDD says: make it green, with the smallest change. The agent adds a `points` field to `User`, adds a line to `purchase` that increments it, and the test is green. The red-green loop has turned the test author's assumption into the system's obligation. No one meant harm. The process did exactly what it was designed to do; it was just allowed to run before there was anything to protect.

Demonthorn has one word for this: the test has **minted** an implementation. Minting as in coining money, as in printing a stablecoin: creating something that did not exist and making the system honor it. His phrasing in the talk: when a feature's contract is still loose, with no concrete API and the subsystems it depends on not yet designed, and you still write unit tests, the test has no contract to hold onto, so it has to invent one. And when inventing the implementation happens inside the act of writing the test, the implementation afterward depends on the test. He called this "extremely dangerous," and I don't think he overstated it.

What deserves criticism here is not TDD. TDD against a settled contract is one of the best disciplines the industry has. What deserves criticism is **a test being handed authority before the contract is settled**. A test is a rubber stamp. Stamp a blank page and the blank page becomes a document.

## Why careful planning doesn't save you

The first reaction from many people, and indeed from one listener at the talk, is: "the database wasn't settled first, that's just a bad plan, my team won't hit this." He answered a little sharply: "It's not as simple as you think. If it were that simple you wouldn't be stuck in tech debt." I'll put it more gently, with the same content.

A plan cannot close every field, every caller, every adapter, every transitional state. Even if the plan settles "points live in `LoyaltyAccount`," it will not settle the type of the balance, which function returns what, how refunds are handled, or which interface the first integration test will call through. Each of those gaps is a place a test can mint. Careful planning reduces the number of gaps; it does not bring it to zero. What remains has to be held by a rule about **order**: contract first, test second.

## Refactoring: where the trap springs

The most dangerous moment is not the first time the feature is written. It is the refactor. Suppose that three months later the team decides, correctly, that points do not belong on `User` but in `LoyaltyAccount`, because they need history, expiry, separation from identity. Someone changes the model. And twenty tests of the form `expect(user.points)` go red at once.

The model assigned to fix red tests has no memory of three months ago. It does not know `user.points` was an assumption. It sees twenty red tests, and the four facts from Chapter 1 tell you what it will think: "these tests are pinning correct behavior; I must satisfy them." The fastest way to make twenty tests green is not to fix twenty tests. It is to add a bridge:

```ts
class User {
  // Temporary compatibility while we move to LoyaltyAccount.
  get points(): number {
    return this.loyaltyAccount?.balance ?? 0;
  }
}
```

Now everything is green. The refactor is "done." But count what just happened. The old tests now depend on the bridge. The bridge exists because of the old tests. Nobody has a reason to remove the bridge, because removing it makes things red. New code, written by the next model, sees that `user.points` still works and uses it, because existing code is stronger evidence than any document. Six months later, `LoyaltyAccount` is the source of truth on paper, `user.points` is the source of truth in practice, and the "temporary" comment is the oldest comment in the repository. Temporary without an expiry date is permanent.

This bridge is a second-generation unowned decision: it does not mint a new contract, it keeps the old one alive after its owner declared it dead. His hard-cut doctrine aims straight at it: after a contract change, audit every modified test and fixture; negative cases must protect the current contract's invariants without naming deleted fields; use the diff to find removed identifiers and then hunt for them in current tests and fixtures; and ask whether each test would still mean anything without git history. A test that only proves a dead contract is rejected should be deleted, along with any production API that exists only to make that behavior observable.

## The greenfield trap

This explains a phenomenon many people have met without naming. A new project, one-shot TDD, and day one looks beautiful: high coverage, green tests, clean code. Three weeks later, everything starts to feel heavy. Six weeks later, every small change drags ten red tests and three compatibility layers behind it. The team blames the model for "getting dumber." The model is not getting dumber. The codebase is getting polluted.

The mechanism: every assumption minted on day one became a test; each time the real contract surfaced, the old test went stale but stayed green thanks to a bridge; bridges stacked on bridges; and all of it sits in the context of every agent that comes after. This is where technical debt becomes attention debt. An agent reading a codebase with thirty bridges spends tokens working out which one is real, weighs more paths on every edit, and under pressure to "make it green" tends to choose the local patch at the wrong boundary: one more bridge instead of touching the real owner, because touching the real owner turns more things red. Debt pollutes context, context pollutes judgment, poor judgment creates more debt. That spiral is why "greenfield with AI" is often faster in week one and slower by month two than a disciplined human team.

He has an observation about the coverage paradox that I find uncomfortably true: real human teams usually don't suffer test debt, not because they are more disciplined, but because they don't write tests; coverage sits around ten percent of behavior. AI covers ninety percent or more. At that coverage, one wrongly minted test is not one; it is dozens, and they talk to each other through fixtures. Anyone letting AI do TDD must control it more tightly than a human team, not less. Anyone who hands an agent a "superpowered" TDD framework without an accompanying anti-pattern list will, in his words, almost certainly get burned.

## The rule of order

So what do you do? His answer is short: when the contract is unclear, don't write the unit test yet. Implement first, or go back and ask the user, and then write the test. I turn that into an order of operations.

First, identify the unowned decisions inside the requirement. For "earn points," those are the formula, rounding, refunds, expiry, where the balance lives, and who answers disputes. Merely listing them avoids half the minting.

Second, assign an owner to the decisions that change the architecture: where the balance lives, who owns it, who may read, who may write. That is a decision for the Lead or the Human, not for a test, and not for the Peer holding the write scope. If it can't be settled, stop and ask. A small question costs far less than a permanent bridge.

Third, implement the real boundary at its minimum: the interface the rest of the system will call. Not the whole feature. Just enough for the contract to have a shape.

Fourth, now RED/GREEN, against a contract that has an owner, with the test standing at the ownership boundary rather than reaching into an internal field. His own test-discipline text puts it in one sentence worth memorizing: *"Tests protect a settled production contract; they do not choose architecture, invent owners, or justify a production seam. Use test-first RED/GREEN only for deterministic behavior whose contract and owner are already decided."*

Fifth, when the contract changes, no bridges. Change the tests first, or delete them, or rewrite them at the new boundary. If a compatibility layer is unavoidable for an external reason, record the constraint and the removal condition in the repository itself, not in a comment.

## When TDD is still your friend

To be fair to TDD: it is superb for things whose contract is stable from the start: parsers, pure functions, algorithms with a spec, a public API already designed and agreed. There, a test written first is an executable specification, and red-green is a beautiful discipline. The difference is not "test before or after." It is "does this contract have an owner yet?" Ask that before the first test of any feature, and you keep TDD's good half without paying for its bad half.

## A list to hand your agent

He says that if you let AI do TDD you must give it ten or twenty bullet points of anti-patterns to avoid. Here is mine, short enough to paste into a skill or a protocol.

Don't write a unit test for a contract with no owner; if the test needs a field, function, or type that does not exist and has not been decided, stop and ask. Don't create a mock or adapter that fakes a subsystem nobody has designed. Don't assert on internal fields while the ownership boundary is unsettled; assert at the boundary. Don't add production APIs, state, lifecycle branches, or instrumentation whose only consumer is a test or a proof harness. Don't keep old tests as signed truth after a contract change; audit, rewrite, or delete. Don't write negative tests by naming a deleted field, tag, or version; derive invalid inputs from current constants and boundaries. Don't add compatibility layers so old tests stay green; if forced, record the constraint and removal condition in the repo. Don't let expected values be generated by the very algorithm under test; use an independent source of truth. Don't treat a green test as evidence of a correct architecture or a correct product. Don't cite mocks, replicas, or an isolated green suite as proof of a production causal chain they never touch. Don't let a fixture build a parallel runtime model and then use it to gate the real implementation. Don't reshape the API or the code to make proof easier. Don't run two test lanes in parallel on shared resources. And before fixing any red test, ask: is this test guarding a contract with an owner, or guarding someone's assumption from three months ago?

> A test guards a settled contract. It doesn't get to mint one. Before the first test of a feature, ask one question: does this contract have an owner? And remember: a temporary bridge with no expiry date is permanent.

# Chapter 14. "Mint," "Drift," "Smell": Engineering Language in Context

Halfway through the talk there was a moment both funny and worth thinking about. He had just finished explaining how a test "mints" an API. A listener didn't follow, so he said: "just type this exact sentence to the model: when a red test mints an API on its own, what goes wrong?" The listener went to look it up, and a moment later read aloud to the whole room: "minting is creating a digital asset on a blockchain, for example an NFT." He groaned.

The listener was not wrong about the dictionary. He was wrong about how to read engineering language.

## Engineering is made of metaphor

Look around. Code has a "smell." Memory "leaks." Two threads "race." Code is "dead." A process is "orphaned." A layer is a "bridge." A process is "starved." A cache is "poisoned." Configuration "drifts." And the entire industry lives with "debt." Not one of those is a technical term in the dictionary sense. Every one is a metaphor attached to a specific mechanism, and their value is that they compress a long mechanism into one word insiders grasp at once.

"A red test mints a contract," "a test gives birth to an architecture," "a test coins an API" all name the same phenomenon: a test creating or hardening a structure the owner has not settled. The value of the phrase lives in the context, the mechanism, and the example laid out in Chapter 13. It does not live in whether "mint" is universal academic terminology. When he later restated it in more standard language, "overspecification, heavy debt in the test suite," the meaning did not change; only the handle did.

## How to read a technical metaphor

There is a correct order of reading, and it is the reverse of what the listener did. He went from the dictionary to the argument. The right order is context, then mechanism, then example, then, last, the word.

Context: what are we discussing? Here, tests written before the contract is stable. Mechanism: the test needs a structure to assert against, invents it, and the red-green loop turns it into an obligation. Example: `user.points`. Word: "mint," making something that didn't exist and forcing the system to honor it. Read in this order, any word is understandable, including one you have never met. Read in the reverse order, you end up arguing about the word instead of the mechanism.

A tell that you are reading it wrong: you dismiss the whole argument by pointing out that the word means something else in another field. "Drift is a control-theory term," "cook means to prepare food," "give birth is biology." That is not rebuttal. That is changing the subject.

Why does this deserve a whole chapter in a book about orchestration? Because it happens in three places. Between people, when doctrine travels by word of mouth in terms like balloon, brakes, parachute, sheep, wolves, fog, snitch: someone who hears the words but not the mechanism goes home with a list of pretty words and cannot do anything with them. Between people and models, when you prompt: give a model a bare word and it guesses the most common meaning, like "Happy New Year"; give it context and mechanism and it explains correctly, exactly as he said: "type the sentence I said and the model will explain it to you." And between generations of documents: "Root" and "supervisor" changed meaning within weeks, and anyone reading the old document with the new document's dictionary gets it wrong.

## This book's vocabulary

So you don't have to guess, here are the main metaphors I use, each with its mechanism. Unowned decision: a decision closed by something with neither authority nor evidence. Closing for someone: the act of doing that. Mint, coin, give birth: a test or piece of code creating a contract with no owner and hardening it. Temporary bridge: a compatibility layer added to keep the old thing alive until someone removes it, which nobody does. Balloon: a workaround that makes a feature run on a wrong foundation. Brakes: foundational mechanisms, boundaries, ownership, rollback, evidence, that must exist before accelerating. Parachute: fixing the symptom instead of the mechanism. Sheep: an agent agreeing because of the authority gradient. Wolf leading sheep: the operator must be more capable than what they lead. Fog: the part of the map a busy Lead cannot see. Snitch: the Supervisor reporting to the owner, commanding no one. Ratchet: a mechanism that only tightens, never loosens, like a rule that has entered a validator. Drift: two copies of one thing slowly diverging. Smell: a surface sign of a wrong mechanism underneath. Attention trigger: a small nudge that moves a model's attention. Lane: an independent session solving the same problem. Sealed: no one sees another's report before submitting.

If you meet a word in this book that isn't on this list, look for the mechanism nearby. I promise there is one.

> A metaphor is a handle, not the argument. Read from context to mechanism to example, and only then to the word. Refuting a mechanism with a dictionary is changing the subject, not rebutting.

# Chapter 15. False and Irrelevant

A says: "The house flooded because the kitchen pipe burst." B says: "No, the water flowed because gravity pulls water down."

B is right. Gravity is real, and without it water would not run across the floor. But B has not answered which pipe burst, why it burst, or why the system failed to stop the water. B has not proven A wrong. B has answered a different proposition, on a different layer, and put the word "no" at the front to look like a rebuttal.

This is the most common reasoning error I see in every debate about AI, TDD, and orchestration. It is not lying. It is **swapping the proposition**. And "prove me wrong" only means something when both sides are discussing the same proposition.

## The layer a sentence lives on

Every true sentence is true on some layer. "A model generates tokens sequentially" is true on the layer of the generation mechanism. "The agent follows its mood" is a sentence on the layer of folk psychology. "This plan didn't settle the database" lives on the process layer. "The test was handed authority before the contract" lives on the layer of process design and ownership. These four sentences do not compete. A sentence one layer down can be entirely true and entirely irrelevant to the sentence under discussion.

Now look back at the talk. He put forward a proposition: *a test written while the contract is unstable mints the contract, and red-green turns it into an obligation.* Three reactions followed.

Reaction one: "So it's next-token prediction, it just follows its mood." The next-token sentence is true on the mechanism layer. The mood sentence is not a mechanism. Neither says anything about whether a test has the right to close a contract. He replied: "That's not it. You've misunderstood."

Reaction two: "That's because the database wasn't settled, it's a bad plan, my team won't hit it." It may be true the plan was bad. But Chapter 13 showed that plans cannot close every field; so "a better plan" answers a different proposition, "how do we reduce the number of gaps," not the proposition "when a gap exists, who is allowed to fill it." He replied: "It's not as simple as you think."

Reaction three: "This sounds like a TDD thing; I hit this with TDD too." That one is nearly right, and he took it up: "when a red test mints an API on its own, when TDD is used before the contract is stable enough." This person is on the correct layer, and the conversation moves forward.

All three people are intelligent. The only difference is that the third was holding the right proposition.

## "Prove me wrong" and what it costs

When someone says "prove me wrong" about AI, ask back: wrong about what? "LLMs are just autocomplete" is a mechanism-layer sentence; "LLMs cannot do an engineer's job" is a capability-layer sentence; "letting an LLM write tests before the contract creates debt" is a process-layer sentence. Proving the mechanism sentence neither proves nor refutes the process sentence. Someone pointing at the mechanism to dismiss an observation about process is doing exactly what B did with the pipe: saying something true, and irrelevant.

The reverse holds too, and AI enthusiasts fall for it: "but it shipped five projects in a month" is an outcome-layer sentence, and it does not refute "test minting creates debt," because debt can be accumulating beneath a beautiful outcome. Chapter 13's greenfield trap is precisely that.

## Pin the proposition first, argue second

This is not just about winning arguments online. It is an operating mechanism inside the SLP doctrine.

His council has a mandatory step: after collecting sealed reports, the Lead extracts three to five decision-changing propositions, classifies each as fact, inference, causal claim, forecast, value, or authoritative constraint, verifies only those that would change the decision, and allows one challenge and one response per proposition. That structure exists precisely so that two seats do not argue about two different propositions while believing they share one. Without the pinning step, a council becomes a chat room, and the most eloquent seat wins by changing layers whenever it is losing.

The Lead does the same with Peers. When a Peer sends a REOPEN_REQUEST, the Lead's first question is not "right or wrong?" but "which proposition is being reopened: foundation, dependency, lifecycle, API, or ownership?" A REOPEN that says "this architecture is wrong" without naming the layer is a REOPEN that cannot yet be ruled on.

And the Supervisor, when it asks its open question, is in effect pinning a proposition for the agent. Historical second-person phrasing about whether the agent broke a contract is conceptual, not callable production guidance. The production structure pins the evidence layer without presuming a violation:

<!-- PASEO_PRODUCTION_ATTENTION_EXAMPLE: contract-evidence -->
- Observation: `The evidence contradicts the current conclusion.`
- Question: `What evidence supports the current conclusion?`
- Evidence: `timeline:<agent-id>:<turn-id>`

That specificity prevents the agent from choosing the easiest layer on which to say everything is fine, without granting the Supervisor verdict or command authority.

## A small exercise

Next time a technical debate stalls, stop and write one sentence: "The proposition under discussion is: ___." Then ask the other party whether they agree that is the proposition. In my experience, half of all debates end at that step, not because someone won, but because both people realize they were talking about two different pipes.

> True one layer down can still be irrelevant on the layer under discussion. "Prove me wrong" only works on a shared proposition. Pin the proposition first, then argue.


# Part V — Paseo: The Laboratory

# Chapter 16. The Laboratory, and What Went Right

Doctrine is only doctrine until someone pays for it. This part is the story of a small team that paid, in tokens and in sleep, across August 2026. I tell it not to advertise a product, but because it is where I saw most clearly the gap between what people believe and what a system actually does. Every mechanism and lesson in these four chapters transfers to any orchestration system; Paseo is just the operating table.

## What Paseo is, for an outsider

Paseo is an open-source control plane for coding agents: a daemon running on your machine that manages many agent sessions across many providers, keeps workspaces, tracks parentage between parent and child agents, keeps a timeline, notifies you when an agent finishes, and lets you drive all of it from a web interface or a phone. Its selling point is deliberately generic: remote access, many workspaces, many providers, one place to look. It does not teach you how to organize a team of agents. Demonthorn chose it for exactly that reason: "it doesn't hand me SLP at all; I just feel it's enough infrastructure to implement SLP on."

The team forked Paseo and built two layers on top. A "Foundation" layer holds the doctrine, three role profiles for several providers, the skills, a protocol template for repositories, and a validator. A "Product" layer is the modified daemon that understands roles, protocols, councils, an issue tracker, and more. The goal: run Supervisor–Lead–Peer for real, on real repositories, and measure it.

## What went right

I'll take the good part first, because it tends to get skimmed once the bad part starts, and because some of it is better than most systems I have seen.

One control plane. From day one, the profiles disabled the native sub-agent mechanisms of Codex and Claude. All delegation goes through one ledger. There are not two protocols for managing staff, so when something goes wrong, you can always answer which agent belongs to whom.

Capability is not authority. This sentence is repeated in every contract the team wrote, and more importantly, enforced: full access at runtime grants no write lease; a read-only assignment must be pinned by the daemon to a real read-only mode, and if the provider has no such mode, the launch fails rather than quietly running with full access and a promise in the prompt. One of the team's early-August pilots was blocked for exactly this reason: the read-only mode the protocol demanded did not exist in the provider's catalog. The Lead returned a dependency request and stopped before creating an owner. The team wrote it down: no full-access reviewer, no "restraint by prompt," no side daemon to slip past the gap. That is the right discipline, and it hurts.

Thin profiles. I want to be explicit here because it cuts against the general impression. The team's role profiles are all shorter than Demonthorn's own reference profiles: the Supervisor prompt is under half the length of his, and the Peer is five to fifteen lines depending on provider, far under the thirty to forty he mentioned. The three instruction layers are kept intact. If there is instruction debt, it is not in the profiles.

A Supervisor doing a Supervisor's job. The most important entry in the team's notebook is an observation from the sixth of August, written by the Supervisor itself: the Foundation was turning the protocol into an admission gate for every delegation, freezing several mechanisms before there was evidence they helped, and letting the validator turn hypotheses into hard requirements. The Supervisor named the suspected mechanism "local-excellence trap plus stage inversion": reviewers optimizing the internal coherence of the chosen candidate while the counterfactual test came afterward. It listed evidence, stated the cost, asked the Human a question, and changed nothing itself. The Human read it and relaxed the rules the same day. That is precisely the loop Chapter 6 describes, and it happened.

Refusing to build what wasn't needed. The team once designed an "attention broker" with a durable outbox, acks, retries, dead letters; then decided not to build it, preferring native notifications and bounded inspection, with a minimal queue only if native proved insufficient. They once designed the Supervisor as a governance framework with a six-rung intervention ladder; then deleted the ladder. They have an entire document about a multi-project Control Workspace whose most important line is "no gate is closed by a document, a dashboard, a heartbeat, an adapter, or the existence of a canary." The roadmap's list of "deferred hypotheses" is longer than its list of things built. In an industry where everyone adds, knowing what not to build is a rare discipline.

Controlled experiments. Instead of believing the protocol helped, the team ran the same task on the same repository with and without a protocol, measuring time, tokens, the number of human interventions, and lease violations. The results were candid: for a tiny task, the protocol is a tax; for a bounded write, one specific clause prevented one real mistake; for a policy-sensitive task, the protocol rescued the outcome but still needed one human intervention. The conclusion, "promote only per task class, never universally," is the right one, and few teams have the data to say it.

Unknown stays unknown. In every report, what could not be demonstrated is recorded as unknown rather than inferred from the absence of evidence. A health-check tool returned "PROJECT_READY: UNKNOWN" for days on end because it could only prove the protocol's bytes, not activation. The team did not lower the tool's bar to get a green light.

A byte budget for instructions. After discovering that the main instruction file had grown past twenty-four kilobytes and had probably been silently truncated by the runtime, the team cut it under ten and added a CI test that fails when the file passes twenty. The reason is written into the file itself: a rule pushed past the threshold simply stops existing.

That much went right, enough to say the team's role and authority architecture followed the doctrine. The drift is elsewhere.

> What the team did best was not what it built, but what it refused to build, and what its Supervisor dared to write in the notebook.

# Chapter 17. Where It Drifted, and What It Cost

Ask the team "where is the over-engineering?" and the truthful answer is: not in the architecture. It is in the mass of instructions, the number of mandatory clauses, the number of times one fact was copied, and the ratchet that turned hypotheses into law. This chapter walks through each, with its price.

## Instruction mass migrated outward

The profiles were thin, but the mass did not vanish; it migrated. Three roles became twenty-one profile files across seven providers. The Foundation's documentation, not counting its two books, weighed about a hundred and twenty-seven kilobytes. The validator ran to more than sixteen hundred lines with over two hundred and sixty assertions, checking the hash of the doctrine document, byte parity of skills, and whether a file was a symlink. The mandatory clause about the issue tracker was copied verbatim into roughly sixteen files; the "no-write, fail closed" rule appeared in more than twenty. Every copy is one more time a model must decide which version is right, and every edit is a chance to miss one.

This is not anyone's lack of discipline. It is the natural result of using agents to write operating documents for agents: on every edit, the agent adds and rarely deletes, and it is rewarded for "completeness." Lesson: a byte budget and the "one fact, one place" rule must be enforced by tooling from day one, not after you discover the file was being truncated.

## The validator ratchet

This is the lesson I consider the most important of the whole month, and the team wrote it into their own roadmap: a candidate mechanism must not go into the validator; entering the validator makes a decision durable, turning a candidate into a requirement on source validity makes reversal far more expensive than editing prose; "and that is precisely the mechanism that eroded the correction of August sixth back within six days."

The timeline says everything. August sixth: the Supervisor detects over-hardening, the Human relaxes, the protocol becomes optional. The tenth: documentation reaffirms the Foundation as "an optional overlay." The twelfth: a central issue tracker becomes mandatory for every role, and the protocol becomes a mandatory contract for every repository. The thirteenth: relaxed again, "graduated" admission, not gating every launch. The fifteenth: tightened again, read-only roles must fail closed. The eighteenth: the tracker is bundled as mandatory on every release host. This is not one person's inconsistency; it is the oscillation of a system where every tightening was recorded in a tool and every loosening only in prose. The tool beats the prose, just as code beats docs.

The general lesson for any system: keep hypotheses in the layer you can change with one line of prose; move something into a validator, a schema, or CI only when it has a reproduced need, an owner, a counterexample, and a rollback path. And every mandatory clause must carry two things: a reason, meaning a specific reproduced problem that the existing layers failed to prevent, and a review trigger, meaning the evidence that would narrow or remove it. Missing either, it is ceremony by definition.

## A mandatory tracker and the side-project question

Demonthorn says "important repos strict, side projects loose," says "don't create it before you need it," says use whatever issue tracker you like and adds that "Jira is a chore even for a team of fifteen." The team made a central issue tracker mandatory for all three roles, with no alternative backend and no fallback: if the tracker is unavailable, every mutation is blocked. There was a real reason: the team wanted a durable work graph so that several projects would not "feel lost," and in the experiments, six out of six cells produced correct receipts. But the question a handback from the eighteenth of August left for the Human is still the right question: "should we amend the decision to carve out side projects, with the tracker best-effort, or reaffirm it?" As of this writing, it has no answer. A mandatory rule with no loose path for small work is a decision closed on behalf of every future project.

## Ceremony, with numbers

A few figures to show what ceremony looks like when it actually happens.

A pilot on a toy fixture, a tiny task board, used one Owner, five Reviewer sessions, four reopenings, and a final review that ran two hundred and sixty-nine adversarial checks. The result was correct, and wildly out of proportion.

An "ultra review" by council of the council and tracker mechanisms themselves opened ten seats; nine timed out or hit provider errors, the tenth left behind a fragment of half-finished thought, and ten recovery attempts went the same way; there were no findings to consolidate. A whole round was spent discovering that the problem lay in the provider execution layer, not the content.

A small A/B experiment: same repository, same task of answering a single number, same provider. Without a protocol: the Lead answered correctly in about a minute with twenty-three thousand input tokens. With a protocol: the Lead spawned an extra Scout, took nearly twice as long, used forty-seven thousand tokens for the Lead plus twenty thousand for the Scout, and returned the same number. The team recorded it plainly: in this case the protocol acted only as an admission token and added no information. Chapter 1 said it: the first discipline is not using the machinery when you don't need it.

An exception named "reviewer-full-temporary": because the read-only mode did not exist, the Human allowed the Reviewer to run with full access temporarily, and wrote explicitly that this was "a conscious capability/authority mismatch to unblock delivery, not evidence of read-only." Writing it down is right. But the "temporary" in its name is the same "temporary" as the comment in Chapter 13.

## Bells that didn't ring, and things that lied

Most of the real pain in the pilots came not from doctrine but from infrastructure not doing what it promised.

The Reviewer's finish notification did not wake the idle Lead; the Human had to send two messages. An archive command returned success, but a readback showed the agent still idle and unarchived; the lifecycle lied, and the team concluded "use one bounded readback to prove the effect; don't turn it into a polling loop, a broker, or a ledger." The shared wrapper for providers connected through a bridge advertised session persistence and dynamic modes the provider behind it did not have; the bridge itself ignored the session's working directory and wrote output from several threads on top of each other. A provider's default permission mode showed an empty description for every shell command, forcing the approver to open the activity log before clicking. A Peer forbidden from using one MCP called it three times through the permission flow; after two human denials, the episode had to be stopped with no outcome.

And two bounded-write runs both produced bytecode files outside the two-file scope they had been granted, and both handbacks claimed only two files changed, without disclosing the generated files. The agent was not lying; it did not count bytecode as "a change." The team's conclusion was correct: "this is a mismatch between command and evidence, no state machine or policy engine required," and the fix was one environment variable around the exact validation command, without turning one occurrence into a general rule. That is the right way to handle an anti-pattern: the smallest fix at the right layer, an entry in the notebook, then wait for a comparable episode to see whether the correction holds. The comparable episode came ten days later, and it held.

One detail few would think of: an Owner read the provider's global memory despite a task with a frozen byte contract, and the Supervisor caught it; passing tests could not cure the provenance uncertainty, so the Lead reopened the whole phase. The lesson the team drew was not "ban memory," but "a no-memory clause in a prompt is not a durable guard when the host policy requires memory lookup; this is an instruction-layer conflict before it is a model-compliance defect." Right layer, right proposition.

## Small isn't enough; the right words are

One experimental result I find worth recording above all: two protocol variants of equal, short length, but the one with the wrong wording about authority and evidence led the Lead to pick the wrong owner type in two different task classes. The team wrote: "small size isn't enough." Thin instructions are necessary. Thin and correctly worded is sufficient, and the only way to know which words are correct is a controlled experiment, not an internal review.

## The gap between five things

If this chapter had to compress into one diagram, it would be the gap between five things the team kept trying to hold apart: what the doctrine says, what the source encodes, what the tests check, what the artifacts claim, and what the runtime actually does. The doctrine said the protocol was optional; the source hard-coded it mandatory; the tests checked the hard-coding; an artifact on the tenth said "optional overlay"; the runtime on the eighteenth bundled the tracker as mandatory. The team knew this and repeated a sentence in every document: source is not runtime, the existence of an artifact does not prove a better workflow, and no one may assume new profiles are live merely because a new repository exists. Knowing the gap is one thing. Closing it is the next chapter's job, and it starts with noticing what sits in the wrong layer.

> Over-engineering was not in the architecture; it was in instruction mass and in the ratchet that turns hypotheses into law. A validator is where a decision turns to stone. Small isn't enough; the right words are.

# Chapter 18. SLP Sitting Too Deep in the Core

One evening during the talk, Demonthorn told a listener building their own orchestration engine: "Don't lock your engine to SLP. Mine is very opinionated; it carries my own personal pain points." Then the iPhone: Apple sells the phone, you go home and put in a SIM from any carrier and it works; they may bundle a SIM, but they don't glue it into the device. "Just sell the phone. Don't sell the solution."

The irony is that this advice describes exactly what happened to the Paseo fork. This chapter dissects it, because it is the cleanest example I know of an unowned decision at the infrastructure layer.

## Anatomy

Inside the fork's daemon core sit about sixty-three hundred lines of code dedicated to SLP: role binding, launch contracts, assignment contracts, the tracker service and sidecar, a council case store, coordination signals, Lead handoff, the protocol file, skill policy. That is the visible part. The less visible part is how SLP seeped into shared files: the agent tool definitions file, nearly five thousand lines, has hundreds of touch points; the protocol message file runs seven thousand lines; the agent manager nearly six thousand; the session file nearly eight thousand. Roughly one in five tools an agent can see is an SLP tool. More than eighty of over six hundred test files touch SLP vocabulary.

The three roles are declared as an enum at the protocol layer: `lead`, `peer`, `supervisor`, with a hard-pinned contract version; if the role-definition file's version does not match, the daemon refuses to load. Protocol readership is a switch statement on the role name. The mandatory tracker clause is a string generated in the core for all three roles. The list of "only this role may see this skill" has a hard-coded fallback so that, if the manifest is missing, the council does not accidentally become global. Each of those, on its own, is a reasonable fail-closed choice. Together, they are the SIM glued into the phone.

Meanwhile, Paseo's plugin system lets a plugin contribute RPCs, UI panels, menu items, themes, and attachment sources. There is no hook for roles, for instructions, for tool ceilings, for the assignment envelope, for admission gates. The plugin documentation even states the reverse relationship: Foundation roles may never touch plugin lifecycle. Which means the most opinionated thing in the system cannot be a plugin, while the most generic things can. The opposite of the iPhone.

## The merge bill

You only see the price when upstream changes. At the end of August the team merged upstream's new stable release. Downstream had a hundred and ninety-four commits beyond the merge base; git reported fifty conflicting paths. No file could be taken wholesale from either side in the protocol, agent, profile, plugin, skill, hub, or release areas, because SLP was interleaved with upstream code in the same files. Rebasing would replay a hundred and ninety-four commits and repeat the conflicts; selective cherry-picking would mean reconstructing the dependencies of a hundred and eighty-one commits. The team chose a semantic merge, unioning protocol fields by hand.

Three correction releases followed within a day, because the merge turned out to be the first real audit: it exposed two pre-existing seams, one where a council seat's receipt could be marked valid from labels alone, and one where resuming a role did not recheck the current protocol state. An entire upstream feature had to be deferred outright, because its wire format had no notion of role, assignment, or admission, so a "generic" agent could not be created without violating the Foundation's contract. Put differently: because SLP lived in the core, the system lost the ability to run an ordinary agent.

And the temporary bridge appeared exactly as Chapter 13 predicted, only at the infrastructure layer: two hundred and ninety-four compatibility tags in the code, sixteen of them SLP-specific, with planned removal dates stretching into the following year. The council skill renamed its seats, from Independent and Challenger to Architect and Reviewer, and kept the old configuration keys as a "compatibility fallback," to be removed "when the daemon requires a newer schema version." A schema version as a gate, the very thing the team had banned elsewhere, came back through the side door because a seat changed its name.

## Why it happened

I don't believe the team forgot his advice. I believe three forces won.

First, fail-closed is the right instinct for each small decision and the wrong one for their sum. Every time a seam appeared, the fastest fix was to pin it in the daemon, because a prompt is a promise and the daemon is enforcement. True. But a hundred pins produce a daemon that can only run SLP.

Second, there was no "second use case." His anti-pattern catalog has a line: a generic framework, plugin system, compatibility layer, or public abstraction that exists before a real second use case is over-engineering. The team applied that line faithfully and built no hooks for other workflows, because there were no other workflows. That was reasonable until the day upstream changed, at which point upstream was the second use case.

Third, Demonthorn also runs a private fork, "in parallel with upstream; when upstream has something fun, merge it." But he keeps his opinions outside the kernel: profiles, protocols, skills, custom events, a small model reading the streams. His kernel is still generic Paseo. The team, wanting to enforce rather than promise, put opinions into the kernel. Same advice, two readings, and the second one is expensive.

## Three layers: kernel, policy, recipes

His original advice to the engine builder, given in early August, is more precise than the iPhone image: "opinionated isn't bad, but the problem is you haven't clearly separated three layers: orchestration kernel, policy, and workflow recipes. You can ship a strong default policy, but don't treat it as the kernel." And: a "lean mode" is a fire escape, not a first-class extension.

Kernel: sessions, identity, parentage, workspaces, lifecycle, events, the tool surface, how instructions are injected into a durable channel, how workspaces are isolated. Policy: roles, authority, leases, admission gates, per-role tool ceilings, mandatory clauses. Recipes: councils, lanes, handoffs, tracker workflow, review rhythm, the anti-pattern list. Upstream Paseo is the kernel. SLP is policy plus recipes. The fork cooked all three in one pot.

The replaceability test, borrowed from the joke at the end of the talk, when he threatened to drop SLP for a hypothetical successor doctrine with a three-letter nickname that is best left untranslated: if the owner of the doctrine changes their mind tomorrow, does your system have to be torn down? If yes, the opinion is in the wrong layer.

> The kernel must not know what you believe. Sell the phone; don't sell a phone with the SIM glued in. And the test: if the doctrine changes tomorrow, do you have to tear the system down?

# Chapter 19. SLP as an Installable, Replaceable, Evolvable Workflow

If Chapter 18 was the diagnosis, this is the treatment. It is not a plan for Paseo alone; it is how to organize any orchestration system so your doctrine can be installed, removed, replaced, and improved a few percent a week.

## What the kernel must expose

For a workflow like SLP to live as a plugin, the kernel must expose exactly the points where SLP currently pokes into the core. No more.

One, instruction injection through a durable channel: the plugin needs to place a block of instructions where the provider keeps it across compaction and resume, and the kernel must confirm that block reached the model, with a receipt, not with a transport preflight. The team calls this "common-channel proof," and it is the right requirement; it just needs to be a hook rather than code in the core.

Two, tool ceilings by name: the plugin declares which agents may see which tools; the kernel filters. The kernel need not know what "lead" means; it only needs to know this agent belongs to this ceiling group.

Three, an agent-creation envelope with arbitrary metadata and a validation hook: at creation time, the plugin gets to check and enrich metadata, and to refuse the launch with a reason. Role, disposition, lease, and assignment live here, as plugin data, not as a protocol enum.

Four, an event bus with generic subscriptions: finish, error, permission, and model-visible output, plus a hook where the plugin can attach its own classifier and custom-event semantics. The kernel owns subscription, persistence, safe-boundary delivery, coalescing, and isolation; the plugin owns what the event means.

Five, isolation primitives: worktrees, the session's working directory, read-only modes enforced by provider or OS, with the plugin able to ask "is this mode real?" and the kernel answering truthfully. Fail-closed then becomes the plugin's decision, based on the kernel's answer.

Six, state hooks: the plugin can store and read back a little state attached to an agent or workspace, say council labels, a protocol digest, the receipt of the last protocol read, or the current attention episode. Not a separate database; a durable versioned key-value with explicit migration.

Expose those six points and SLP, or any other doctrine, installs. Don't, and every doctrine has to fork.

## What the plugin owns

Everything opinionated: the names and number of roles; the three instruction layers and their templates; who reads the protocol; the assignment envelope; per-role tool ceilings; the council with its seats, rounds, and verdict; handoff and Lead replacement; the tracker clause, if any, and how mandatory it is; the anti-pattern list; the attention classifier and custom events; and, most importantly, its own version.

A versioned doctrine is a doctrine that can evolve. His weekly "Better SLP" becomes: read the Supervisor's notebook, edit a few lines in the plugin, bump the version, rerun the same controlled task set, keep or roll back. Nobody touches the kernel. Nobody merges fifty conflicts.

## The migration path

No rewrite. The "strangler" strategy: every time you touch a piece of SLP in the core, move it behind a hook, until the core no longer knows the word "lead."

Start with the role enum: replace it with a registry the plugin populates; move the contract version into the plugin's manifest, with the kernel checking only that the manifest is valid, not its contents. Next, the tracker clause generated in the core: turn it into an instruction fragment the plugin supplies through the injection hook, with its mandatory level a plugin setting, so a side project can choose loose. Then the tool ceilings: from a switch on role name to a table the plugin declares. Then the council case store: from a daemon module to plugin state on the state hook. Then the skill filter: from a hard-coded list to a plugin declaration. Each step can be a small release, with a canary and a rollback. And each step shrinks the conflict count at the next upstream merge, which means you measure progress with a number the whole team understands.

Two traps along the way. The first is the temporary bridge: every move tempts you to keep the old path "for compatibility." Apply the hard cut internally: one live path, delete the old one in the same step, rewrite the tests at the new boundary. The second is "lean mode": adding a switch that turns SLP off without separating the layers; that is a fire escape, not an extension, and it becomes one more code path to maintain.

## What you lose and what you gain

To be candid about the price: making SLP a plugin loses one thing, the sense of safety that fail-closed in the core provides. When a role is data, a broken plugin can create an agent with no role. The answer is not to push roles back into the core; the answer is a validation hook in the kernel, which the SLP plugin uses to refuse role-less launches with exactly the strictness it had before. Enforcement does not disappear; it moves to a layer that has an owner.

The gains are larger. Upstream merges become routine. Other people can use the kernel with their own doctrine, or with none. Your doctrine gets a version and can improve weekly. And, most relevant to this book's theme: the decision "how does this system organize a team of agents" becomes owned again. Its owner is the operator, who can switch it off, swap it, or evolve it. Not an enum at the protocol layer.

## For readers not using Paseo

You may be using another tool, or building your own. Three questions to check whether you are gluing a SIM into your phone. One: if I rename or add a role, how many files outside the "workflow" directory have to change? Two: if someone else wanted to run this tool with a completely different team structure, could they, without forking? Three: if I dropped my current doctrine, would what remains still run? Answer truthfully, and you know where you stand.

> The kernel exposes six points; the plugin owns everything opinionated, including its own version. Migrate piece by piece, no bridges, no lean mode. Measure progress by the conflict count at the next merge.


# Part VI — Operating It

# Chapter 20. Start Small, Grow on Evidence

Nobody opens eight kitchens in one night. The owner of eight kitchens started with one, learned to taste without cooking, and added the second when the first no longer needed her. Demonthorn's first lesson plan ends with a five-stage roadmap, and I still think it is the right roadmap, with a few updates from what Part V taught.

## The sizing table

Before every job, one question: what size?

A small job that finishes now and touches nothing structural, a landing page for tomorrow's presentation: one session, a few prompts. No SLP.

A small job that touches the system: hand it to a Lead, who assigns one Peer and reviews. The Lead is accountable, and you get a layer of checking without doing it yourself.

A job with a hard decision, several equally valid answers, or a domain you cannot confidently push back on: a Lead with two or three blind design lanes, convergence, your look at the concept, then implementation.

A long job, many days, or many projects at once, or something you'd like to sleep through: the full machinery, with a Supervisor woken by events.

And one rule throughout: never trust the first answer of any session for a decision that matters. Two lanes are cheaper than one redo.

## No tooling yet? Here's how

You do not need a control plane to begin. This is how he worked for years before Paseo: open session A, ask for a design. Open session B, paste A's answer, ask "what do you think, how does the industry do this." Paste B back into A. You are the Lead, and the two sessions are two lanes. In an unfamiliar domain, session A will ask you back things you don't know; he advises "don't answer it back, it dilutes"; open a new session and ask there. The question channel and the work channel stay separate, even when both are just browser tabs.

It is crude and manual. It teaches you the mechanism before you buy a tool, and whoever has done it by hand will recognize which tools are selling "solutions" instead of "phones."

## The roadmap

Stage one, minimum viable: one Lead, one Peer with a write scope, one read-only Peer when a second view is needed, one coordination protocol, explicit edit rights, basic states, a text context pack, and native sub-agents switched off. The only goal: check whether the Lead delegates with open questions, whether the Peer keeps its main-agent capability, and whether authorities collide. No Supervisor yet. No council. No mandatory tracker.

Stage two, standardize: three thin profiles; one shared anti-pattern list of ten to twenty lines; the one-writer rule; locks for heavy tests; a definition of "done"; reconciliation every few tasks; a Reviewer when risk calls for it. And a thin protocol for your most important repository, about ten clauses, each with a reason and a review trigger.

Stage three, telemetry and events: remaining context, compaction count, hot or cold cache, and above all a canary proving "when the child finishes, the parent wakes." Only now add a Supervisor, on a fifteen-minute heartbeat, switched on only while the project is messy.

Stage four, continuous optimization: a Supervisor notebook written in causes; Better SLP every week; a cheap classifier on the output streams to wake the Supervisor on meaning rather than schedule; a controlled experiment before every new mandatory clause. And a byte budget for every instruction file, enforced by CI from this day on.

Stage five, many projects: one Supervisor looking sideways across several Leads; each Lead keeping its own project; no mixed ownership; no shared Lead. Expand only once a single project's workflow is stable, and the first lesson plan is clear about the price of hurrying: an unobservable matrix of authority.

What I change from the original roadmap: trackers, mandatory protocols, validators, and anything "fail closed" go at the end of stage four, not in stage two, and each must pass a controlled experiment first. Part V paid for that lesson.

## What to measure

Measure little, measure truly. The number of human interventions per episode. The number of lease violations, including files generated outside scope. Time and tokens for a task of the same class with and without a new clause. The number of decisions reopened because history was lost. The number of finish events that went missing. The number of temporary bridges still alive after thirty days. The number of conflicts at the next upstream merge. No dashboard needed; a table in the Supervisor's notebook is enough, and it must carry dates.

Do not measure the number of agents, reports, or tests. They rise when ceremony rises, and rising ceremony is what you want to detect, not what you want to celebrate.

## When to stop

The Paseo team's roadmap has a "stop conditions" section I want to reproduce in substance, because it is rare: stop and return to the premise when a mechanism creates a second owner or control plane, demands overwriting local truth, adds an artifact no task uses, or when its ceremony and maintenance tax exceeds the repeated failure it resolves. Those four signs are enough to halt an initiative before it turns to stone in a validator.

> Start with one Lead and one Peer. Add each thing when there is evidence, not when there is an idea. Measure human interventions, not agent counts. And know the four signs to stop.

# Chapter 21. A Short Field Manual

This chapter is for looking things up, not reading through. The first half is doctrine lines short enough to remember. The second half is four templates short enough to use.

## Lines to remember

1. The bottleneck left the keyboard; it lives in attention now.
2. The cheapest intervention in the world is a well-timed open question.
3. Never trust the first answer of a sequential generator.
4. Pressure from code beats pressure from docs; ten dumb tests breed an eleventh.
5. Don't let anything close a decision it doesn't own. A decision is closed only when the party with authority closes it with evidence.
6. The stronger the model, the prettier the balloon. Before you patch, ask whether the findings converge on a missing brake.
7. This plan is for the agent, not for people; don't slice it because slicing sounds good.
8. The Lead is a brain with the power to close, not a ticket dispatcher. It asks open questions, keeps its framing to itself, and is not allowed to be nice.
9. Don't let the Lead ask yes/no. The Peer must have room to say "option C."
10. A fork is not a second opinion.
11. Independent judgment is not performative dissent; agreement is valid when the evidence supports it.
12. The Supervisor has authority over attention, not over decisions. It asks; it doesn't rule.
13. The attention trigger has two questions: when, and how.
14. The Supervisor's notebook records causes, not slogans. Better SLP: a few percent a week.
15. Talk to the Supervisor, delegate to the Lead, learn before you delegate. Sheep don't lead wolves.
16. Every rule has exactly one home. Over-long instructions are truncated in silence.
17. First views must be independent; one arbiter converges; there is no vote. Agreement count is not authority.
18. One moving scope has one writer. Review only a stable candidate.
19. Status is not acceptance. Unknown is a valid answer.
20. Wait with a doorbell, and test that the bell rings.
21. The plan is a provisional map; the code is the terrain.
22. A test guards a settled contract; it doesn't get to mint one.
23. A temporary bridge with no expiry date is permanent.
24. A metaphor is a handle, not the argument. Read from context to mechanism to example.
25. True one layer down can still be irrelevant on the layer under discussion. Pin the proposition first, then argue.
26. A validator is where a decision turns to stone. Hypotheses in prose; law in tooling.
27. Small isn't enough; the right words are.
28. The kernel must not know what you believe. Sell the phone; don't glue in the SIM.
29. Add each thing when there is evidence, not when there is an idea.

## Template 1: the assignment envelope for a Peer

```text
Project / task:
Disposition: Engineer | Solution Architect | Reviewer | Scout
Workspace or worktree:
Objective (an outcome, not a solution):
Writable scope:
Exclusions:
Authority (edit / commit / push / external effects):
Constraints extracted from the repository protocol (only what applies):
Escalate: REOPEN_REQUEST when which premise fails; DEPENDENCY_REQUEST when what is needed; BLOCKED when what is missing
Verification (commands and expected results):
Handoff: candidate identity, changed files, commands and output, risks, assumptions, unfinished dependencies
```

Check before sending: does the brief hide a verdict? does it contain a yes/no question? is any file list stated as fact rather than as provisional?

## Template 2: a Supervisor observation

```text
Episode (short name):
Observation:
Evidence (quoted transcript / diff / timeline):
Suspected mechanism (a hypothesis; may be wrong):
Cost / impact:
Open question for the Lead or Peer:
Smallest proposed correction:
Escalation needed: yes | no | unknown
Protocol candidate (if it recurs):
```

Send when there is evidence. Don't send on a feeling. Never send with an order attached.

## Template 3: the morning report

```text
While you were away:
- Which major decisions were closed, by whom, whether anyone objected, and how the objection was handled.
- What is blocked and needs your decision (only those).
- Incidents: parallel test lanes, accidental deletions, files outside scope, new temporary bridges.
- Nothing to say about what is healthy.
Questions you need to answer today:
```

## Template 4: the check before a feature's first test

```text
Original requirement (verbatim):
Unowned decisions inside this requirement:
  - formula / units / rounding
  - the reverse cases (refunds, cancellations, expiry)
  - where state lives, or whether it is derived
  - who owns this boundary
Who closes each of the above? (Lead / Human / nobody yet)
If "nobody yet": stop, ask. Write no test.
If closed: what is the minimal interface of the boundary?
Which boundary does the first test assert at? (never an internal field)
After the contract changes: which tests get rewritten, which get deleted, are there any bridges?
```

# Epilogue. Wolves and Sheep

Near the end of the talk, a listener asked him about the future: what would learning "AI management thinking" even change, when students already prompt better than their lecturers. He answered with the image I have borrowed throughout this book: you are a wolf leading a flock of sheep; you cannot be a sheep trying to lead a pack of wolves. To manage well you need competence. Build the management mindset, and build yourself.

I think that is the right answer to the question hiding behind the whole book: if decisions must have owners, the owners must be worthy. A great Lead cannot save a Human who doesn't know what she wants. A sharp Supervisor cannot save someone who doesn't read the report. A twenty-line anti-pattern list cannot save someone who has never felt that pattern hurt. There is a line of his from the group chat that I think holds for people and models alike: a developer's strongest trait is pattern recognition, and you only get it by touching code.

Every mechanism in this book, the three roles, the three instruction layers, lanes, councils, one writer, evidence, events, plugins, is a way of keeping decisions owned in a world where machines close them faster than people can think. They do not replace judgment. They protect a place for judgment. And that place is only worth something when someone capable steps into it.

He reads a book every day, written by a model on the topic he needs, on his phone while an agent runs. This is one of those books. If it leaves you with three sentences, I hope they are these: don't let anything close a decision it doesn't own; a test doesn't get to mint a contract; and true one layer down can still be irrelevant on the layer under discussion.

For the rest: touch code, and learn every day.
