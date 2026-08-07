# TODO — Fix CustomDutyPayment Validation Failure

## Root Cause
Two conflicting `CustomDutyPayment` Mongoose models exist:
- Old model in `server/src/models/CustomDutyPayment.js` (requires `customDutyId`, `referenceNumber`, `totalAmount`, restrictive status enum)
- New schema in `server/src/models/RfqLogistics.js` (uses `dutyId`, `blId`, `blNumber`, `dutyAmount`)

`seed.js` registers the old model first, so the route's POST `/custom-duties` payload (with `dutyId`, `blNumber`, `dutyAmount`, and workflow status `'Pending EXIM Manager Approval'`) fails validation.

## Steps

- [x] 1. Analyze & confirm root cause (two conflicting models)
- [x] 2. Update `server/src/models/CustomDutyPayment.js` with complete schema:
       - Fields: `dutyId`, `blId`, `blNumber`, `boeNumber`, `portCode`, `dutyAmount`,
         `customAgentName`, `icegateRef`, `vesselName`, `remarks`, `documents`, `createdBy`,
         `approvalInstanceId`, `utrNumber`, `paidAt`
       - Expanded status enum: `['draft','pending','approved','rejected','returned','paid','Pending EXIM Manager Approval','Pending Finance Lead Approval','Pending Finance Approval','Pending EXIM Approval','Approved & Dispatched']`
       - `strict: false`
- [x] 3. Remove duplicate `customDutyPaymentSchema` from `server/src/models/RfqLogistics.js`
       and export `CustomDutyPayment` from `CustomDutyPayment.js` instead
- [x] 4. Fix `seed.js` to use new field names (`dutyId`, `blId`, `blNumber`)
- [x] 5. Add `Custom Duty` status sync branch in approvals.controller.js
- [x] 6. Verify no remaining broken references (confirmed no `customDutyId`/`fineInterestAmount` references remain)
- [ ] 7. Test by starting server & creating a custom duty payment

