# Security Policy

## Supported versions

The latest released minor version of img-man receives security fixes. Older
versions may receive backports at the maintainers' discretion.

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Please report security issues privately via GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability)
on this repository, or email the maintainers listed in CODEOWNERS.

Include:

- A description of the vulnerability and its impact
- Steps to reproduce or a proof of concept
- Affected versions and configuration

We aim to acknowledge reports within 3 business days and to provide a remediation
timeline after triage. Please give us a reasonable window to release a fix before
public disclosure.

## Scope

In scope: the img-man application shell, SDK packages, self-host scripts, and
provided Docker/compose configuration. Out of scope: third-party dependencies
(report upstream) and the private SaaS wrapper (reported through its own
channel).
