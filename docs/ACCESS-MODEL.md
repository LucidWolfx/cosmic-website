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

The portal's **Staff review** view is shown only for website `staff` and `admin`
accounts. Having an authorized Discord reviewer role permits Discord reviews
but does not assign the website role. Owner-side role changes must target the
verified Discord-linked account, never a matching display name alone. Refresh
the portal after an approved role change.

Whitelist state machine:

    draft -> submitted -> under_review -> approved / denied / changes_requested
    changes_requested -> submitted
    any active state -> withdrawn (applicant action)

Reviewers may decide directly from submitted. Approved, denied, and withdrawn
records cannot be edited. A new request after closure is possible within rate
limits. Only one active record per user per kind is allowed. Approval of a
whitelist record promotes an applicant to member and does not overwrite an
existing staff/admin role. It does not synchronize any external service.

The LSPD internal workspace uses separate Discord permissions. Role
`1449442096955002982` permits reading published notices and the active roster.
Editing requires that role **and** command role `1449494268329852938`.
Website staff/admin status does not bypass these requirements. Draft and archived
entries are command-only. The server verifies current Discord roles on every
request; suspended accounts and unavailable role verification are denied.
See `DEPARTMENT-HUB.md` for operation and the tested authorization design.

Department applications are reviewed on the website; Discord receives only a
notification in #department-apps mentioning LSPD Command. The notification does
not grant website permissions. Approval requires website staff/admin access plus both
department roles. It saves the assigned character details and automatically
links the verified applicant Discord ID to the roster. Ordinary website review
RPCs cannot approve a department request without this enrollment step.
The scheduled service archives linked employees after a confirmed Discord
departure; errors never remove them. Archived departures require reapproval.

These department permissions apply to department notices, rosters and enrollment.
Authorized application reviewers still share all submissions, and general
resource audiences remain member or staff.
