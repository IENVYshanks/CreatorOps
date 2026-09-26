# Instagram Comment Analytics Architecture

**Status:** Proposed target architecture
**Date:** 27 September 2026
**Scope:** Instagram comment ingestion, classification, analytics, background processing, storage, and chat-model access

## 1. Executive summary

CreatorPilot should provide creators with useful analytics rather than requiring them to manually read or manage every Instagram comment. The system must support accounts with millions of historical comments and sustained live traffic around 2,000 comments per minute, while remaining extensible enough to add new classifications and analytics later.

The proposed design separates the system into five layers:

1. **Ingestion:** Meta webhooks for live events and paginated Meta API requests for historical backfills.
2. **Durable work distribution:** prioritized queues for real-time events, backfills, and reanalysis.
3. **Classification:** a fine-tuned, self-hosted Laya model as the high-volume classifier, with Jev or another strong model as a fallback and teacher.
4. **Storage:** PostgreSQL for compact operational state and aggregates; compressed object storage for raw comments required by future analytics.
5. **Consumption:** the dashboard and a tool-calling chat model use the same authorized capability layer.

The primary design principle is:

> Store compact, queryable analytics in PostgreSQL; retain reusable source data cheaply outside PostgreSQL; perform expensive work asynchronously; expose all capabilities through typed, authorized backend services.

The chat model does not access Instagram, access tokens, queues, PostgreSQL, or raw archives directly. It calls narrowly scoped tools such as `getSentimentOverview`, `getTopPosts`, `startAnalysis`, and `getAnalysisJobStatus`.

## 2. Product goals

The architecture should support the following user experiences:

- Show sentiment summaries for each post and across an account.
- Identify top posts using likes, comments, reach, saves, shares, and views.
- Identify praise, complaints, questions, purchase intent, urgency, and spam.
- Explain analytics conversationally through a chat model.
- Start new analyses through chat without blocking the conversation.
- Process newest posts first so useful results appear quickly.
- Continue historical analysis in the background.
- Keep live analytics current as comments are created, edited, or deleted.
- Add new analytics later without redesigning the entire pipeline.
- Reclassify archived comments when a taxonomy or classifier changes.

## 3. Non-goals for the first release

The first release should not attempt to:

- Display or search every historical comment in the product.
- Store every comment as a large, permanently indexed PostgreSQL document.
- Ask a general-purpose LLM to classify every comment.
- Guarantee that every model decision is correct.
- Process the entire account history before returning any useful result.
- Build a user-configurable analytics taxonomy before the base taxonomy is validated.
- Introduce Kafka-scale infrastructure before measured traffic requires it.

## 4. Requirements that shaped the architecture

### 4.1 Users mainly want analytics

Most users are expected to care about sentiment, trends, top-performing posts, complaints, questions, and opportunities. They may not want a full comment-management interface.

Therefore, the primary read model contains summaries and rankings, not millions of comments.

### 4.2 Future analytics need original information

Aggregates such as `positive = 700` cannot later answer:

- How many negative comments concerned delivery?
- Which comments expressed purchase intent?
- Did anger increase after a product launch?
- Which questions should become FAQs?

Once raw text is discarded, those questions require downloading and processing all comments again. Consequently, raw comments should be retained in compressed object storage even when they are not shown to users.

### 4.3 Comments are mutable

Instagram comments can be created, edited, and deleted. A live aggregate cannot be updated correctly unless the system remembers the previous classification of each comment.

For example:

```text
Previous classification: positive
New classification:      negative

Required aggregate delta:
positive -1
negative +1
```

This requires a compact per-comment state ledger in PostgreSQL. The ledger does not need to contain the full text.

### 4.4 Queue delivery is not exactly once

Practical queues provide at-least-once delivery. Duplicate and out-of-order events are normal. Workers must therefore be idempotent and must produce exactly-once observable database effects even when they receive the same work multiple times.

### 4.5 Workers must not depend on a user session

A user may close the browser, log out, lose workspace membership, or disconnect Instagram while work remains queued. Workers operate as internal system actors, not as a continuation of the user's HTTP session.

Authorization happens before work is enqueued. Workers still verify workspace and Instagram-account ownership before applying results.

### 4.6 Chat must use the same trusted analytics

The dashboard and chat interface must not calculate competing versions of the same metric. Both use the same backend capability layer and the same persisted aggregates.

## 5. High-level architecture

```text
                         +--------------------+
                         | Instagram / Meta   |
                         +---------+----------+
                                   |
                     OAuth, webhooks, Graph API
                                   |
                         +---------v----------+
                         | Express backend    |
                         | - verify webhook   |
                         | - resolve tenant   |
                         | - enqueue work     |
                         +---------+----------+
                                   |
                    +--------------v--------------+
                    | Prioritized durable queues  |
                    |                              |
                    | High: live comment events    |
                    | Low: backfill/reanalysis     |
                    +--------------+--------------+
                                   |
                     +-------------v-------------+
                     | Classification workers    |
                     | - deduplicate             |
                     | - batch                   |
                     | - classify                |
                     | - calculate state delta   |
                     | - update aggregates       |
                     +------+-------------+------+
                            |             |
                 +----------v---+   +-----v----------------+
                 | Laya service |   | Jev / strong model  |
                 | Primary      |   | Fallback and teacher |
                 +--------------+   +----------------------+
                            |
              +-------------v------------------------------+
              | Storage                                    |
              |                                            |
              | PostgreSQL          Object storage         |
              | - current state     - compressed comments  |
              | - aggregates        - replay source        |
              | - jobs/events       - immutable chunks     |
              +-------------+------------------------------+
                            |
                  +---------v----------+
                  | Capability layer   |
                  | - analytics APIs   |
                  | - chat tools       |
                  | - authorization    |
                  +------+--------+----+
                         |        |
                +--------v--+  +--v--------------+
                | Dashboard |  | General LLM     |
                | Next.js   |  | Explanation     |
                +-----------+  +-----------------+
```

## 6. Technology choices

| Concern | Proposed choice | Reason |
|---|---|---|
| Frontend | Existing Next.js application | Already used by CreatorPilot and suitable for dashboard and chat UI. |
| API | Existing Express/TypeScript backend | Preserves the current stack and domain services. |
| Operational database | PostgreSQL with Drizzle | Existing dependency; strong transactions, constraints, indexes, and tenant relationships. |
| Queue | Redis with BullMQ behind an interface | Supports priorities, retries, delayed jobs, concurrency, and Node.js workers without Kafka-level complexity. |
| Worker orchestration | Node.js/TypeScript | Shares contracts and domain logic with the backend. |
| Primary classifier | Fine-tuned Laya | Local inference, batching, typed outputs, multilingual checkpoint, and no per-comment external API dependency. |
| Classification runtime | Separate Python/GPU inference service | Matches Laya's primary runtime and permits independent GPU scaling. |
| Fallback classifier | Jev or another evaluated strong model | Handles uncertain cases and generates training/evaluation labels. |
| Chat explanation | General tool-calling LLM | Suitable for conversation and explanation, but not bulk classification. |
| Raw archive | S3-compatible object storage | Cheap, compressed, durable source data for future reanalysis. |
| Local development | Docker Compose | Reproducible PostgreSQL, Redis, and worker services when Docker is available. |

All infrastructure dependencies should be accessed through interfaces. Redis can later be replaced by SQS, Pub/Sub, or another managed queue. S3-compatible storage can be replaced by R2, Azure Blob Storage, or Google Cloud Storage.

## 7. Data ingestion

### 7.1 Live event flow

Meta supports comment-related webhook notifications for Instagram professional accounts. The webhook endpoint should do minimal work:

```text
Receive webhook
    -> verify Meta signature
    -> validate payload
    -> resolve Instagram account to workspace
    -> create deterministic event identity
    -> enqueue high-priority job
    -> acknowledge immediately
```

It must not call Laya, Jev, or a general LLM. It must not update analytics directly.

Reference: [Meta comment moderation documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/comment-moderation)

### 7.2 Historical backfill

Historical processing is initiated as a job:

```text
List posts newest to oldest
    -> select next post
    -> fetch comments page by page
    -> archive raw comment batches
    -> enqueue classification batches
    -> record checkpoint
    -> continue to older post
```

Only one post needs to be active per account initially. This reduces memory use, simplifies checkpoints, and limits pressure on Meta's API.

### 7.3 Reanalysis

When a new classifier or analytics dimension is introduced:

```text
Create versioned reanalysis job
    -> read archived comment chunks
    -> classify with new model/taxonomy
    -> write a new analysis version
    -> make it current only after completion
```

This path does not require another complete download from Instagram.

## 8. Queue design

### 8.1 Queue priorities

Use separate queues or strict priorities:

1. **Live events:** new comments, edits, and deletions.
2. **Recent refresh:** reconciliation for recently active posts.
3. **Historical backfill:** older posts processed newest first.
4. **Reanalysis:** replay of archived data for a new model or taxonomy.

Historical work must never starve live processing.

### 8.2 Job contract

Conceptual job payload:

```ts
interface InstagramCommentJob {
  eventId: string;
  eventType: 'created' | 'updated' | 'deleted';

  workspaceId: string;
  instagramAccountId: string;
  instagramPostId: string;
  instagramCommentId: string;

  text?: string;
  providerUpdatedAt: string;

  classifierVersion: string;
  taxonomyVersion: string;

  receivedAt: string;
  initiatedByUserId?: string; // audit only
}
```

`initiatedByUserId` is never used as worker authorization and never participates in idempotency.

### 8.3 Retry policy

Transient failures should use exponential backoff with jitter. Permanent failures should move to a dead-letter queue after a limited number of attempts.

Examples of transient failures:

- Meta rate limiting
- Temporary network failure
- Laya inference timeout
- Database connection interruption
- Object-storage timeout

Examples of permanent failures:

- Invalid payload
- Deleted workspace
- Revoked Instagram connection
- Unsupported schema version
- Invalid classifier response after validation

## 9. Idempotent worker design

The target guarantee is:

> At-least-once job delivery with exactly-once observable database effects.

### 9.1 Event-level deduplication

Every event is recorded under a unique combination of:

```text
provider event ID
classifier version
taxonomy version
```

The classifier and taxonomy versions are part of the identity because the same Instagram event may need to be processed by more than one analysis version.

### 9.2 State-level deduplication

Different event IDs can describe the same logical comment revision. The compact comment ledger therefore records:

- Provider revision or updated timestamp
- Text hash
- Accepted classification
- Classifier version
- Taxonomy version
- Deletion state

Older or identical revisions are ignored.

### 9.3 State transitions

The worker calculates a transition instead of blindly incrementing counts.

```text
No previous state -> positive
    positive +1

Positive -> positive
    no aggregate change

Positive -> negative
    positive -1
    negative +1

Negative -> deleted
    negative -1

Deleted -> deleted
    no aggregate change
```

### 9.4 Transaction boundary

The following steps occur in one PostgreSQL transaction:

1. Insert the processed-event identity.
2. Lock the relevant comment-state row.
3. Reject a stale revision.
4. Read the previous classification.
5. Write the new classification state.
6. Apply aggregate metric deltas.
7. Update analysis freshness.
8. Commit.

If the process crashes before commit, the transaction rolls back and the queue can retry safely.

### 9.5 Model determinism

Production jobs pin a concrete model version such as:

```text
laya-instagram-v1
jev-1.13.0
```

They do not use an unpinned `latest` identifier. A classification is uniquely associated with:

```text
comment ID
comment revision
classifier version
taxonomy version
```

## 10. Classification model strategy

### 10.1 Primary model: fine-tuned Laya

Laya is an open, non-autoregressive decision model that supports typed `choice`, `score`, and yes/no decisions, multilingual routing, and batched prediction. These properties suit high-volume classification.

Reference: [Laya repository](https://github.com/NandhaKishorM/laya) and [Laya model card](https://huggingface.co/convaiinnovations/laya)

Laya is not accepted as a production classifier without evaluation and fine-tuning. Its own published results show a large gap between a base checkpoint and a task-specific checkpoint. The base model is therefore considered a starting point, not a drop-in source of truth.

### 10.2 Fallback and teacher: Jev

Jev accepts unstructured state and typed questions and returns typed decisions, probabilities, and confidence. It is appropriate for uncertain cases, evaluation, and producing candidate labels for a human-reviewed training set.

References: [Jev quick start](https://docs.typesafe.ai/introduction/quickstart) and [TypeSafe's Jev announcement](https://typesafe.ai/blog/introducing-system-one-models-and-jev)

Jev should not initially classify every comment because external request latency, provider limits, and dependency risk may dominate at large scale.

### 10.3 General-purpose LLM

The general LLM is used for:

- Conversational explanations
- Recommendations based on structured results
- Tool selection
- Rare escalation cases during evaluation
- Assistance with taxonomy development

It is not used as the default per-comment classifier.

### 10.4 Rule-based classifier

The existing rule-based classifier remains useful for:

- Unit tests
- Local development
- Provisional results during model outages
- A baseline in evaluations

It should not be presented as production-grade semantic understanding.

### 10.5 Classification cascade

```text
Comment
    -> route language
    -> fine-tuned Laya
        -> high confidence: accept
        -> low confidence: Jev/strong fallback
            -> persistent disagreement: evaluation sample
```

When the primary service is unavailable, the rule classifier may produce a result explicitly marked `provisional`. A later final classification corrects the aggregate through the same idempotent state-transition mechanism.

## 11. Foundational classifications

### 11.1 Engagement metrics

These come from Instagram and require no semantic model:

- Likes
- Comment count
- Views
- Reach
- Shares
- Saves
- Total interactions
- Media type
- Publication timestamp

They support top-post rankings, format comparisons, momentum, and timing analysis.

### 11.2 Sentiment

One primary choice with a probability distribution:

```text
positive
neutral
negative
mixed
```

### 11.3 Intent

Independent probabilities because more than one may apply:

```text
praise
complaint
question
support_request
purchase_intent
feature_request
recommendation
cancellation_intent
```

### 11.4 Urgency

An ordered score:

```text
none
normal
urgent
critical
```

### 11.5 Moderation and relevance

Independent probabilities:

```text
spam
abusive
toxic
off_topic
bot_like
relevant
```

### 11.6 Later dimensions

After the base pipeline is evaluated:

- Emotions such as joy, anger, sadness, fear, surprise, and disgust
- Account-specific topics such as price, design, delivery, quality, or availability
- Aspect-level sentiment, such as positive design sentiment but negative delivery sentiment

## 12. Derived analytics

| Derived result | Base signals |
|---|---|
| Audience satisfaction | Sentiment distribution and trend |
| Best-performing posts | Likes, reach, shares, saves, views |
| High-priority complaint | Complaint + negative sentiment + urgency |
| Purchase opportunity | Purchase intent + positive or mixed sentiment |
| FAQ opportunity | Question + repeated topic + engagement |
| Brand advocate | Praise + positive sentiment + recommendation |
| Crisis risk | Negative velocity + anger + high engagement |
| Content resonance | Sentiment + saves + shares + reach |
| Spam-adjusted sentiment | Sentiment excluding spam/irrelevant comments |
| Product concern | Complaint + topic/aspect |

Separate aggregate totals are insufficient for cross-dimensional questions. Knowing that 30% of comments are negative and 20% mention price does not reveal how many price comments are negative. The per-comment classification vector must therefore remain available in the compact ledger or analytical archive.

## 13. PostgreSQL data model

The current fixed `positive_count`, `neutral_count`, and `negative_count` prototype should be replaced before its unapplied migration is adopted.

### 13.1 Processed events

```text
instagram_processed_events
--------------------------
provider_event_id
classifier_version
taxonomy_version
workspace_id
processed_at
```

The event ID and versions form the unique key.

### 13.2 Compact comment state

```text
instagram_comment_states
------------------------
id
workspace_id
instagram_account_id
instagram_post_id
instagram_comment_id
provider_revision
text_hash
classification_payload
classifier_version
taxonomy_version
deleted_at
updated_at
```

The unique identity includes the workspace, Instagram account, comment, classifier version, and taxonomy version.

Full comment text is deliberately omitted from this hot operational table.

### 13.3 Versioned post analyses

```text
instagram_post_analyses
-----------------------
id
workspace_id
instagram_post_id
post_published_at
classifier_version
taxonomy_version
status
total_comments
analyzed_at
created_at
updated_at
```

Status values:

```text
processing
completed
failed
```

The dashboard reads only the latest completed compatible version.

### 13.4 Flexible metric counts

```text
instagram_post_analysis_metrics
-------------------------------
analysis_id
metric_key
count
```

Examples:

```text
sentiment.positive        700
sentiment.neutral         200
sentiment.negative         80
sentiment.mixed            20
intent.purchase            44
intent.complaint           72
moderation.spam            31
```

This normalized representation permits new metric keys without adding database columns.

### 13.5 Analysis jobs

```text
instagram_analysis_jobs
-----------------------
id
workspace_id
instagram_account_id
job_type
priority
status
current_post_cursor
posts_completed
posts_failed
comments_processed
last_error
started_at
completed_at
created_at
updated_at
```

The job record is product-visible progress state. The queue remains responsible for work delivery.

## 14. Raw archive

### 14.1 Why object storage

Raw comments are valuable for new analytics but inefficient as millions of indexed PostgreSQL rows. Compressed object storage provides cheaper retention and sequential replay.

### 14.2 Proposed layout

```text
workspaces/{workspaceId}/
  instagram/{accountId}/
    posts/{postId}/
      comments/{snapshot-or-batch}.jsonl.gz
```

An archived record contains only reusable source fields:

```json
{
  "id": "comment-123",
  "text": "I love the design, but mine arrived broken",
  "timestamp": "2026-09-27T12:00:00Z",
  "providerRevision": "revision-value"
}
```

### 14.3 Write behavior

- Objects are immutable.
- Object keys include a deterministic batch identity.
- A manifest records the complete set of chunks for a post snapshot.
- A snapshot becomes eligible for analysis only after its manifest is committed.
- Partial snapshots never replace the previous complete snapshot.

### 14.4 Retention

- Delete workspace archives when the workspace is deleted.
- Delete account archives when the connection is removed, subject to the chosen retention policy.
- Retain only the snapshot history needed for audit or rollback.
- Keep model-derived results separately versioned.

## 15. Capability layer and chat access

The dashboard and chat model call the same backend services.

Proposed tools:

```ts
getSentimentOverview(input)
getTopPosts(input)
getPostAnalysis(input)
getPurchaseIntentSummary(input)
getUrgentComplaints(input)
comparePosts(input)
startAnalysis(input)
getAnalysisJobStatus(input)
```

### 15.1 Authorization

The server supplies the authenticated user context. The model does not establish authority by including a workspace ID.

```text
Authenticated user
    -> tool request
    -> workspace membership check
    -> capability execution
```

### 15.2 Long-running chat actions

```text
User: Analyze purchase intent across my posts.

Chat calls startAnalysis()
    -> returns job ID and queued status

User: How is it going?

Chat calls getAnalysisJobStatus()
    -> returns progress and freshness
```

### 15.3 Compact tool results

The LLM receives structured summaries, not millions of comments:

```json
{
  "postsAnalyzed": 42,
  "commentsAnalyzed": 182340,
  "sentiment": {
    "positive": 0.68,
    "neutral": 0.2,
    "negative": 0.09,
    "mixed": 0.03
  },
  "pendingEvents": 184,
  "processedThrough": "2026-09-27T14:32:10Z",
  "status": "updating"
}
```

### 15.4 Untrusted comment content

Comments can contain prompt-injection text such as instructions to reveal secrets. Comment text is always treated as untrusted data.

- Comment text never becomes a system instruction.
- Access tokens never appear in model or tool output.
- Raw object paths are not accepted from the model.
- Tools enforce strict schemas and result limits.
- Representative comments are clearly delimited as untrusted quotations.
- The model cannot execute arbitrary SQL or queue arbitrary internal jobs.

## 16. Throughput and scaling

### 16.1 Expected live traffic

```text
2,000 comments/minute = approximately 33 comments/second
```

The initial design target should include substantial burst headroom:

```text
Average:       33 comments/second
Burst target: 150-300 comments/second
```

### 16.2 Historical retrieval

At 50 comments per page, one million comments require approximately 20,000 Meta API requests. The Meta retrieval phase may take much longer than local classification and must respect provider rate limits.

### 16.3 Worker scaling

- Workers are stateless.
- Queue consumers scale horizontally.
- Laya requests are micro-batched.
- Model concurrency is explicitly bounded.
- Live queue lag controls autoscaling.
- Backfill consumes only spare capacity.

### 16.4 Micro-batching

A worker collects either:

- A maximum number of compatible comments, or
- Comments accumulated during a very short time window.

It then submits one batch to the inference service. Batch size must be determined through benchmarks on production-like hardware and comment lengths.

### 16.5 Backpressure

When arrival rate exceeds final-model capacity:

```text
Accept and persist queue event
    -> classify provisionally if necessary
    -> expose pending count and freshness
    -> finalize later
```

The webhook remains available even when downstream classification is delayed.

## 17. Freshness and reconciliation

Webhooks can be duplicated, delayed, or missed. Periodic reconciliation remains necessary.

Recommended schedule:

```text
Newest/high-activity posts: frequent reconciliation
Recent posts:              daily reconciliation
Older posts:               occasional or on-demand
Archived posts:            reprocess only when requested
```

Every user-visible result includes:

- `analyzedAt`
- `processedThrough`
- `pendingEvents`
- `status`
- Classifier and taxonomy versions

## 18. Security

### 18.1 Instagram credentials

- Continue encrypting access tokens with AES-256-GCM.
- Never place tokens in URLs, logs, queue dashboards, or tool responses.
- Restrict token decryption to authorized backend services.

### 18.2 Webhooks

- Verify Meta's signature over the original request bytes.
- Apply body-size limits.
- Reject malformed payloads before enqueueing.
- Rate-limit abusive sources without blocking legitimate Meta delivery.

### 18.3 Queues

- Encrypt queue transport and storage in production.
- Limit administrative queue access.
- Avoid logging full comment text.
- Use dead-letter retention policies.

### 18.4 Object storage

- Encrypt at rest and in transit.
- Use private buckets and least-privilege service credentials.
- Never expose raw object keys to the browser or LLM.
- Record deletion and retention operations.

### 18.5 Tenant isolation

All keys and queries are scoped by workspace and Instagram account. Workers confirm that the connected account still belongs to the workspace before applying an event.

## 19. Observability

Monitor at least:

- Webhook acceptance and rejection counts
- Queue depth by priority
- Age of oldest queued event
- Events processed per second
- Duplicate and stale-event counts
- Classification latency by model and language
- Laya confidence distribution
- Fallback rate
- Model disagreement rate
- PostgreSQL transaction failures
- Aggregate correction counts
- Meta API status and rate-limit responses
- Archive write failures
- Dead-letter queue size
- Per-workspace job progress

Logs should contain correlation IDs, event IDs, workspace IDs, post IDs, and model versions, but not access tokens or unrestricted raw comment text.

## 20. Evaluation and model improvement

### 20.1 Evaluation dataset

Build a representative, human-reviewed dataset containing:

- English
- Hindi
- Hinglish
- Other common account languages
- Emoji-only comments
- Very short comments
- Sarcasm
- Spam
- Mixed sentiment
- Multiple simultaneous intents
- Edits and deletions

### 20.2 Metrics

Measure:

- Macro F1
- Per-label precision and recall
- Recall for complaints and urgent comments
- Calibration error
- Accuracy by language/script
- Low-confidence rate
- Primary/fallback disagreement
- GPU throughput
- Batch latency at p50 and p95
- Memory consumption
- Cost per million comments

Accuracy alone is insufficient because majority labels can hide poor performance on rare but important categories.

### 20.3 Improvement loop

```text
Production comments
    -> Laya low-confidence/disagreement sample
    -> Jev or stronger teacher label
    -> human review
    -> fine-tuning dataset
    -> candidate Laya version
    -> offline evaluation
    -> controlled deployment
```

New model versions do not silently replace old analytics. They create a versioned analysis and become current only after validation and successful processing.

## 21. Alternatives considered

### 21.1 MongoDB for comments

**Rejected as the primary solution.** MongoDB does not eliminate data volume, reclassification, synchronization, or idempotency concerns. It would introduce a second operational database beside PostgreSQL.

### 21.2 Store every comment in PostgreSQL

**Rejected for raw long-term storage.** It enables flexible queries but creates a large indexed operational dataset when the main product requires aggregates. PostgreSQL retains only compact state required for correctness.

### 21.3 Store only post aggregates

**Rejected as insufficient for live correctness and future analytics.** Without per-comment state, edits and deletions cannot be applied incrementally. Without raw text, new analytics require another complete Instagram download.

### 21.4 Fixed sentiment columns

**Rejected for the target architecture.** Columns such as `positive_count` are simple but require migrations for `mixed`, intents, moderation metrics, and future classifications. Flexible metric rows support new keys without schema changes.

### 21.5 JSON-only aggregate map

**Not selected as the primary relational representation.** JSON is flexible but harder to constrain, index, update atomically, and query across accounts. It remains useful for versioned classification payloads.

### 21.6 General LLM for every comment

**Rejected as the default.** It adds unnecessary cost, latency, output validation, and external dependency. A general LLM remains valuable for explanation and rare escalation.

### 21.7 Jev for every comment

**Not selected as the primary long-term path.** Jev is attractive for typed zero-shot decisions, but a hosted dependency and per-request path is less controllable for sustained high-volume workloads than a fine-tuned local model.

### 21.8 Base Laya without fine-tuning

**Rejected for production.** The base model must be evaluated and adapted to Instagram language, emojis, short comments, and the chosen taxonomy.

### 21.9 Kafka immediately

**Deferred.** The expected initial workload is within the range of a simpler durable queue. Queue interfaces preserve a migration path if measured scale later requires Kafka.

## 22. Proposed deployment topology

```text
Web/API service
    - Express routes
    - OAuth and webhook ingestion
    - authorized analytics and chat tools

Redis
    - live queue
    - backfill queue
    - reanalysis queue

Worker service
    - queue consumers
    - state transitions
    - archive writes
    - PostgreSQL transactions

Laya inference service
    - Python runtime
    - GPU batching
    - English/multilingual routing

PostgreSQL
    - users/workspaces/connections
    - event idempotency
    - compact comment states
    - analyses and metrics
    - product-visible jobs

Object storage
    - raw compressed comment chunks
    - manifests and replay data
```

The API, worker, and inference services scale independently.

## 23. Implementation phases

### Phase 1: Correct persistence foundation

- Replace the unapplied fixed-count migration with versioned analysis tables.
- Add processed-event and compact comment-state tables.
- Add repository transactions for idempotent state transitions.
- Add integration tests for create, duplicate, edit, delete, stale event, and tenant isolation.

### Phase 2: Queue-independent worker

- Define queue and worker contracts.
- Implement the event processor using fake dependencies.
- Test retry safety and aggregate deltas.
- Keep classifier and archive behind interfaces.

### Phase 3: Local model evaluation

- Create a representative labeled dataset.
- Benchmark rules, base Laya, fine-tuned Laya, Jev, and a strong LLM.
- Establish confidence and fallback policies.
- Implement the Laya inference adapter only after evaluation gates are defined.

### Phase 4: Durable infrastructure

- Add Redis/BullMQ adapter.
- Add object-storage adapter.
- Add worker runtime, retries, priorities, and dead-letter handling.
- Add operational metrics and health checks.

### Phase 5: Meta live ingestion

- Add verified webhook endpoint.
- Add account-to-workspace routing.
- Add live event enqueueing.
- Add reconciliation jobs.

### Phase 6: Backfill and progress

- List posts newest first.
- Process comments page by page.
- Persist checkpoints.
- Expose job progress and freshness.

### Phase 7: Dashboard and chat capabilities

- Add aggregate read APIs.
- Add top-post and trend queries.
- Add typed chat tools.
- Add asynchronous start/status workflows.

### Phase 8: Production hardening

- Load and burst tests.
- Failure injection.
- Retention and deletion automation.
- Model-version rollout and rollback.
- Security review and Meta policy review.

## 24. Current repository status

The repository currently contains isolated prototype work for:

- A rule-based positive/neutral/negative classifier
- Negation and common reaction-emoji handling
- A fixed sentiment summarizer
- An Instagram comment-page provider
- A one-post paginated analysis service
- A PostgreSQL fixed-count repository and schema
- A generated fixed-count migration
- Unit tests for the above components

Known current limitations:

- The generated migration has not been successfully applied.
- The integration test has not run because Docker is unavailable in the current environment.
- The fixed-count schema is not the recommended target schema.
- There is no production queue, worker runtime, webhook endpoint, archive adapter, Laya service, or chat capability layer yet.
- The current classifier is a baseline, not a production semantic model.

No implementation should continue from the fixed schema without first deciding whether to adopt the flexible target model described in this report.

## 25. Open decisions

The following choices still require explicit product or operational approval:

1. Raw-comment archive retention period.
2. Whether archive deletion occurs immediately on Instagram disconnect or after a short recovery period.
3. Which object-storage provider will be used.
4. Whether Redis is self-hosted or managed.
5. Production GPU provider and autoscaling policy for Laya.
6. Human-review process for the evaluation dataset.
7. Initial languages that must meet quality thresholds.
8. Initial confidence thresholds for fallback.
9. Which intents enter the first production taxonomy.
10. Whether representative comments may be shown to users and chat when explicitly requested.

## 26. Acceptance criteria for the target system

The architecture is considered successfully implemented when:

- Duplicate queue delivery never double-counts a comment.
- Out-of-order events cannot overwrite newer state.
- Comment edits and deletions produce correct aggregate deltas.
- Workers operate without user sessions while preserving tenant isolation.
- Live events are prioritized over historical work.
- Backfills resume from checkpoints after restarts.
- Partial post fetches do not replace complete analyses.
- Raw comments can be replayed for a new classifier version.
- New metric keys do not require database columns.
- Dashboard and chat return the same analytics.
- The chat model cannot access tokens, arbitrary SQL, raw object paths, or unrestricted comment content.
- Results expose freshness, pending work, classifier version, and taxonomy version.
- The system sustains expected traffic with measured burst headroom.
- Model quality meets per-language and per-label evaluation thresholds before production rollout.

## 27. Final recommendation

Adopt the architecture in stages, beginning with correctness rather than infrastructure:

1. Establish the flexible, versioned database model.
2. Prove idempotent state transitions with tests.
3. Define queue-, archive-, and classifier-independent worker interfaces.
4. Evaluate and fine-tune Laya on real Instagram-style data.
5. Add Redis, object storage, Meta webhooks, and chat tools only after the core invariants are proven.

This sequence preserves the ability to change infrastructure and models while locking down the hardest invariant first: every comment event must result in a correct, repeatable, tenant-isolated analytics state.
