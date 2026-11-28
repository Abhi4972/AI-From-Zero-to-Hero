---
title: Audio and Images: AI_TRANSCRIBE for Calls, Image Classification and Multimodal Prompts
minutes: 55
group: AI in SQL: Cortex AI Functions
lessons: a1110
---
:::goals What you will be able to do
- Transcribe call recordings with speaker labels and turn them into call-level metrics
- Classify and describe product images with the same functions you use for text
- Estimate the token cost of audio and design around the duration limits
:::

:::prereq Before you start
- **Needs**: {{NEEDS}}
- **Type**: Lesson (build). **Time**: about 55 minutes.
:::

:::plain The idea in one line
Calls and photos become rows: transcribe audio into timed, labelled segments, describe images with the same SQL functions, then analyse them like any other data.
:::

## The problem

Brightwell's contact centre records 9,000 calls a week, and customers attach photos to damage claims. Supervisors listen to a handful of calls; claims staff open every photo by hand.

## Calls

`AI_TRANSCRIBE(file [, options])` accepts audio (AAC, FLAC, M4A, MP3, MP4, OGG, WAV, WEBM) and video with an audio track. `{'timestamp_granularity': 'speaker'}` returns `segments` with `start`, `end`, `text` and `speaker_label`; `'word'` gives word timings. Limits: 700 MB, and 90 minutes with timestamps (120 without). Audio is billed at 50 tokens per second.

```sql
CREATE OR REPLACE TABLE support.calls.transcripts AS
SELECT relative_path AS call_file,
       PARSE_JSON(AI_TRANSCRIBE(TO_FILE('@support.raw.calls', relative_path), {'timestamp_granularity': 'speaker'})) AS t
FROM DIRECTORY(@support.raw.calls)
WHERE last_modified >= DATEADD(day, -1, CURRENT_DATE());

-- one row per segment, ready for sentiment and analytics
SELECT call_file, s.value:speaker_label::STRING AS speaker, s.value:start::FLOAT AS start_s,
       s.value:end::FLOAT AS end_s, s.value:text::STRING AS text
FROM support.calls.transcripts, LATERAL FLATTEN(input => t:segments) s;
```

## Locally: call metrics from speaker segments

```python
import pandas as pd
segments = pd.DataFrame([   # the segment shape AI_TRANSCRIBE returns with speaker granularity, for two calls
    ("call-001", "SPEAKER_00", 0.0, 6.5, "Thanks for calling Brightwell, this is Sam."),
    ("call-001", "SPEAKER_01", 6.9, 21.0, "My tent pole snapped on the second night and I want a replacement."),
    ("call-001", "SPEAKER_00", 21.4, 33.0, "I'm sorry. Can you send a photo of the pole and your order number?"),
    ("call-001", "SPEAKER_01", 34.8, 38.0, "Yes, sending it now."),
    ("call-002", "SPEAKER_00", 0.0, 5.0, "Brightwell support, Priya speaking."),
    ("call-002", "SPEAKER_01", 5.2, 49.0, "This is the third time I'm calling about the same refund and nobody has called me back as promised."),
    ("call-002", "SPEAKER_00", 52.5, 58.0, "Let me check that for you."),
    ("call-002", "SPEAKER_01", 58.3, 75.0, "I want to cancel my membership."),
], columns=["call", "speaker", "start", "end", "text"])
segments["dur"] = segments.end - segments.start

def call_metrics(seg):
    out = []
    for call, g in seg.groupby("call"):
        g = g.sort_values("start")
        agent = g.speaker.iloc[0]                                   # the first speaker is the agent in this contact centre
        talk = g.groupby("speaker").dur.sum()
        gaps = (g.start.shift(-1) - g.end).dropna()
        out.append({"call": call, "length_s": round(g.end.max(), 1), "customer_talk_share": round(1 - talk[agent] / talk.sum(), 2),
                    "longest_silence_s": round(gaps.max(), 1),
                    "mentions_cancel": g.text.str.contains("cancel", case=False).any(),
                    "audio_tokens": int(g.end.max() * 50)})
    return pd.DataFrame(out).set_index("call")

call_metrics(segments)
```

Call 2 shows the pattern supervisors want flagged: the customer talks most, there is a long silence after the complaint, and the call ends with a cancellation threat. Each signal is a column you can now filter on, join to orders, or pass to `AI_SENTIMENT` and `AI_CLASSIFY`. The token column gives the transcription cost per call before you scale to 9,000 a week.

## Images

Image input works with `AI_COMPLETE`, `AI_CLASSIFY` and `AI_FILTER` through `TO_FILE` (or `PROMPT` with a FILE argument). Image classification is offered in a subset of regions (AWS US West 2, US East 1 and Frankfurt) and through cross-region inference, which ties back to lesson 33.2.

```sql
SELECT relative_path,
       AI_CLASSIFY(TO_FILE('@claims.raw.photos', relative_path),
                   ['torn fabric', 'broken pole', 'water damage', 'no visible damage']):labels[0]::STRING AS damage_type,
       AI_COMPLETE('claude-sonnet-4-5',
                   PROMPT('Describe the visible damage to this outdoor gear in one sentence: {0}', TO_FILE('@claims.raw.photos', relative_path))) AS description
FROM DIRECTORY(@claims.raw.photos);
```

A useful pattern for claims: classify every photo cheaply, and only send the uncertain or high-value ones to the larger model for a description.

## Video

Video joined audio and images in 2026. `AI_COMPLETE` can analyse video and audio with Gemini models (May 2026) and with Twelve Labs Pegasus 1.5 for video understanding (GA 16 Nov 2026), and `AI_MULTI_EMBED` creates embeddings for semantic video search, including large files (GA 10 Aug 2026). `AI_TRANSCRIBE` added AAC, M4A and MOV inputs in July 2026. The pattern is the same as for calls: stage the files, process incrementally, store results in a table, and measure on a labelled sample before trusting them.

:::check
Which statements are right?

- ✓ Speaker-labelled segments turn a call into rows you can analyse with SQL.
- ✗ Long calls can be transcribed with word timestamps regardless of length.
  With word or speaker timestamps the limit is 90 minutes per file.
- ✓ Audio is billed by duration (50 tokens per second), so cost can be estimated before transcribing.
:::

:::recap What to keep
- `AI_TRANSCRIBE` with speaker granularity, flattened to segments.
- Call metrics: talk share, silences, keywords, cost per call.
- Images through `TO_FILE` in the same functions; mind regional availability.
:::

## Exercises

1. Add an "interruptions" metric: segments that start before the previous one ends.
2. Compute the weekly transcription tokens for 9,000 calls averaging 7 minutes.
3. Design the claims flow: which photos get only `AI_CLASSIFY`, and which also get a description?

## Practise on Snowflake

This lesson's local code needs no account. To practise on the real platform, use a Snowflake trial account and these hands-on guides that Snowflake publishes. They change as features change, so follow the guide where it differs from this lesson, and drop the objects you create afterwards (trial credits are limited).

- [Build an AI assistant with AI functions over documents, audio and images](https://www.snowflake.com/en/developers/guides/build-an-ai-assistant-for-fsi-with-aisql-and-snowflake-intelligence/) (Snowflake guide)

:::checked Sources and further reading
- [AI_TRANSCRIBE](https://docs.snowflake.com/en/sql-reference/functions/ai_transcribe)
- [AI_CLASSIFY](https://docs.snowflake.com/en/sql-reference/functions/ai_classify): image input and regional availability
- [Cost considerations for Cortex AI Functions](https://docs.snowflake.com/en/user-guide/snowflake-cortex/aisql-cost)
:::
