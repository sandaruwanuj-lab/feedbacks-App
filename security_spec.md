# FeedbackHub Security Specification

## 1. Data Invariants
1. **Authenticated & Verified Identity**: All feedback reads and writes require a signed-in user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. **Owner Attribution**: On creation, `userId` must strictly equal `request.auth.uid` and match `^[a-zA-Z0-9_\-]+$` (max 128 chars).
3. **Strict Schema Enforcement**: Documents in `/feedbacks/{feedbackId}` must contain all and only the 6 allowed keys: `type`, `sessionName`, `learningPoints`, `suggestions`, `userId`, `timestamp`.
4. **Enumerated Rating & Bounded Strings**: `type` must be `'good'`, `'average'`, or `'poor'`. `sessionName` is 1..120 chars; `learningPoints` and `suggestions` are strings of 0..2000 chars.
5. **Server Timestamp Integrity**: `timestamp` must equal `request.time`.
6. **Immutability & Scoped Reads**: Feedback records cannot be updated once created (`allow update: if false`). List/get reads are restricted to the submitting owner (`resource.data.userId == request.auth.uid`) or the verified admin (`ujithaekanayake@gmail.com`).

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Creating a feedback doc when `request.auth == null`.
2. **Unverified Email Create**: Creating a feedback doc with `email_verified: false`.
3. **UID Spoofing**: Creating a feedback doc where `userId` does not match `request.auth.uid`.
4. **Shadow / Ghost Field**: Creating a feedback doc with an extra field (`isAdmin: true` or `verified: true`).
5. **Missing Required Field**: Creating a feedback doc missing `learningPoints` or `suggestions`.
6. **Invalid Rating Enum**: Creating a feedback doc with `type: "excellent"`.
7. **Client-Forged Timestamp**: Creating a feedback doc with a static timestamp instead of `request.time`.
8. **Oversized Session Name (DoW)**: Creating a feedback doc with `sessionName` > 120 chars.
9. **Oversized Textarea (DoW)**: Creating a feedback doc with `learningPoints` or `suggestions` > 2000 chars.
10. **ID Poisoning**: Creating or reading `/feedbacks/invalid$id!` or an ID > 128 chars.
11. **Blanket List Scraping**: A non-admin authenticated user executing a `list` query without `where('userId', '==', uid)`.
12. **Cross-User Read/Update/Delete**: A non-admin authenticated user attempting `get`, `update`, or `delete` on another user's feedback document.
