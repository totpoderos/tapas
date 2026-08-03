# Tasks — The rate limit counts across instances

One slice. It changes no behaviour anybody can see on a single instance, which
is exactly why the specs have to be written first — otherwise there is nothing
to tell a working limiter from a limiter that has quietly stopped counting.

## 1. Count in the database

- [ ] 1.1 Write the acceptance scenarios first, red: attempts spread across two
      instances of one deployment count together; a freshly started instance does
      not reset a spent source; a count that cannot be read refuses; a source that
      waits out the window is served again. Two instances over one database is
      what makes the first two possible to write at all.
- [ ] 1.2 Add the `rate_limits` migration — bucket, count, window start — in SQL
      both engines understand, and check it applies to each.
- [ ] 1.3 Implement the store over the `Database` port: one upsert that resets or
      increments and returns the count, so two instances cannot both read 4.
- [ ] 1.4 Register it, failing closed, with the ceiling and the window exactly as
      they are now. Take the time from the injected `Clock`, so a spec can move a
      window without waiting a minute.
- [ ] 1.5 Sweep buckets untouched for far longer than any window, on the same
      path rather than on a timer.
- [ ] 1.6 Green the whole suite on **both** databases, plus the E2E — which drives
      many logins from one address and will notice a limiter that counts
      differently.
- [ ] 1.7 Update `docs/threat-model.md`: the A04 and A07 entries describe a count
      that is per-deployment and fails closed. Say what it was, since a threat
      model that quietly improves reads as one that was never wrong.

## 2. Close out

- [ ] 2.1 `openspec validate --strict`, then archive.
