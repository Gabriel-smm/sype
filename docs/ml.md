# Machine learning

> Placeholder. This document will be filled in when ML work lands.

There is no ML in the codebase today. The schedule is fully deterministic (see
[architecture.md](architecture.md)). The append-only `EventLog` is written on purpose as
future training data and is not yet read by anything.

Planned work is tracked in issues #24–#27 (feature dataset from the event log, per-type
estimate correction, productive-window suggestions, weight tuning from behaviour).
