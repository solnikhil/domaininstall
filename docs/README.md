# domaininstall documentation

This directory contains the durable technical documentation for
`domaininstall`. Start with the repository [README](../README.md) if you want to
install or try the CLI.

## Reference

- [DNS record format](RECORD-FORMAT.md) defines the `_dnstall` TXT record,
  canonical publisher output, consumer behavior, and compatibility rules.
- [Security policy](../SECURITY.md) defines the project's security boundary,
  supported versions, and vulnerability-reporting process.
- [Domain-ownership analysis](../SECURITY-domain-ownership.md) examines what a
  DNS declaration can and cannot establish about publisher identity.

## Project operations

- [Roadmap](../ROADMAP.md) is the live source of shipped, open, and deferred
  work.
- [Release procedure](RELEASE.md) is the authoritative release and rollback
  runbook.
- [Changelog](../CHANGELOG.md) records user-facing changes by release.

## Historical material

- [Release-candidate checklist](RELEASE-CANDIDATE.md) is a pre-publication
  snapshot, not a live checklist.
- [History audit](HISTORY-AUDIT.md) records the repository-history review that
  preceded publication.
- [Research](../RESEARCH.md), [demand and prior art](../RESEARCH-demand-and-prior-art.md),
  and [project notes](../NOTES.md) preserve product discovery and design context.

When documents disagree, the implementation and deterministic tests define
current behavior. The roadmap defines current project status, and the release
runbook defines release operations.
