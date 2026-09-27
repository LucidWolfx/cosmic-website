# Access model

| Capability | Visitor | Applicant | Member | Staff/admin |
| --- | --- | --- | --- | --- |
| Public site and draft/public rules | Yes | Yes | Yes | Yes |
| Sign in with Discord | Yes | Yes | Yes | Yes |
| Own profile and account export | No | Yes | Yes | Yes |
| Save whitelist draft | No | Yes | Already approved | Already approved |
| Submit whitelist | No | When intake/rules permit | No | No |
| View own application status/feedback | No | Yes | Yes | Yes |
| Support request | No | When intake permits | When intake permits | When intake permits |
| Department/business/organization/creator request | No | No | When intake permits | When intake permits |
| Published member resources | No | No | Yes | Yes |
| Published staff resources | No | No | No | Yes |
| View review queue and decide | No | No | No | Yes, never own application |
| Change account roles | No | No | No | Privileged owner SQL only |
| Enable intake/publish private resources | No | No | No | Privileged owner SQL only |

Suspended users can read their own basic profile/access record but cannot use
portal actions, read applications, or access private resources. The front end
shows an access-paused state. Use the configured external support route.

Whitelist state machine:

    draft -> submitted -> under_review -> approved / denied / changes_requested
    changes_requested -> submitted
    any active state -> withdrawn (applicant action)

Reviewers may decide directly from submitted. Approved, denied, and withdrawn
records cannot be edited. A new request after closure is possible within rate
limits. Only one active record per user per kind is allowed. Approval of a
whitelist record promotes an applicant to member and does not overwrite an
existing staff/admin role. It does not synchronize any external service.

Current departmental permissions are not granular: authorized reviewers can see
all submissions, and resource audiences are member or staff. Add department
membership tables, scoped policies, and corresponding authorization tests before
storing department-confidential resources requiring narrower visibility.
