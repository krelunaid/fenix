# Worker request boundary

The visual worker previously buffered the entire HTTP body before checking the HTML character limit. A large unrelated JSON field or a non-object JSON body could therefore bypass the intended input boundary or throw outside job handling.

`readWorkerBody` limits raw UTF-8 bytes to 1 MiB before JSON parsing, checks both declared Content-Length and actual chunks, and requires a non-null JSON object. Oversize returns 413 and invalid JSON/shape returns 400 before enqueue/model calls. Early exit does not destroy the socket before the error response; the remaining request is drained without retention.

The existing 120,000-character HTML limit is unchanged. The byte allowance accommodates a full document even if every character uses six-byte JSON Unicode escapes. Oversize must not silently truncate an artifact.

Reproduce with `node --test scripts/visual-request-body.test.mjs scripts/visual-artifact-http.test.mjs`. The latter launches the actual worker on loopback with no inherited provider credentials, exercises build and polish with Content-Length/chunked oversize and invalid JSON shapes, then verifies health and zero queued jobs. Unit cases cover the inclusive byte boundary, multibyte UTF-8 and escaped full-size artifacts.

This is a transport memory/input bound, **not** authentication, ownership, rate limiting, durable jobs, slow-client protection or a fix for full-document rewrites during initial generation. No graphics, Studio, deployment configuration or provider model changes are included.
