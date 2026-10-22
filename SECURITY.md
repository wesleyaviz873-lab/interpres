# Security policy

## Supported versions

Interpres is not released yet. Once the first public release exists, this file
will list the supported versions and the security update policy.

## Reporting a vulnerability

Do not open a public issue for a security vulnerability.

Send a private report to the maintainer with:

- a description of the issue;
- the affected version or commit;
- reproduction steps;
- the impact you believe it has;
- any suggested fix.

You will receive an acknowledgement and a timeline for the fix. Please allow a
reasonable period for a patch before public disclosure.

## Scope

The most sensitive areas of Interpres are:

- authentication and session handling;
- provider key storage;
- workspace path validation;
- the tool execution layer;
- the local agent connection and pairing;
- Docker defaults and file permissions.

Reports about these areas are especially welcome.
