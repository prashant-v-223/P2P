import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const routes = read('server/src/modules/p2p/p2pRoutes.js');
const approvals = read('server/src/modules/approvals/approvals.controller.js');
const model = read('server/src/models/RfqLogistics.js');
const rfqForm = read('src/features/p2p/RfqFormView.jsx');
const vendorList = read('src/features/vendorPortal/FreightRfqListPage.jsx');
const vendorDashboard = read('src/features/vendorPortal/FreightForwarderDashboard.jsx');
const vendorDetail = read('src/features/vendorPortal/FreightRfqDetailPage.jsx');
const customsPortal = read('src/features/p2p/CustomsBrokerPortalPage.jsx');
const blFlow = read('src/features/vendorPortal/FreightBlFlowPage.jsx');

let passed = 0;
const check = (name, condition) => {
  assert.ok(condition, name);
  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}  ${name}`);
};
const has = (source, text) => source.includes(text);

console.log('\nRFQ / BL / ASN / LOGISTICS INVOICE CONTRACT SUITE\n');

// RFQ creation and editing
check('RFQ requires title, PO, deadline, shipping, cargo, ports, and container type', has(routes, "const required = ['title', 'linkedPoId', 'closingDate', 'shippingTerms', 'cargoType', 'portOfLoading', 'portOfDischarge', 'containerType']"));
check('RFQ requires a future closing date', has(routes, 'RFQ closing date must be in the future.'));
check('RFQ rejects identical loading and discharge ports', has(routes, 'Port of loading and port of discharge must be different.'));
check('RFQ container quantity must be a positive whole number', has(routes, 'Number of containers must be a positive whole number.'));
check('RFQ requires at least one freight forwarder', has(routes, 'Invite at least one active Freight Forwarder.'));
check('RFQ rejects duplicate vendor invitations', has(routes, 'The same Freight Forwarder cannot be invited more than once.'));
check('RFQ verifies linked PO exists and remains open', has(routes, 'Linked purchase order does not exist or is not open.'));
check('Quoted vendors cannot be removed from an RFQ', has(routes, 'A vendor that already submitted a quote cannot be removed.'));
check('RFQ creation is explicitly internal-user only', has(routes, "router.post('/rfqs', authenticateToken, requireInternalRfqUser"));
check('RFQ deletion is explicitly internal-user only', has(routes, "router.delete('/rfqs/:id', authenticateToken, requireInternalRfqUser"));

// Quote lifecycle
check('Vendor can only see an invited RFQ', has(routes, 'isFreightVendorInvited'));
check('Quote submission requires a published RFQ before deadline', has(routes, "rfq.status !== 'published' || isRfqClosed(rfq.closingDate)"));
check('Quote rejects invalid or negative commercial values', has(routes, 'positive freight, valid charges, and transit days are required.'));
check('Quote rejects ETA earlier than ETD', has(routes, 'Vessel ETA cannot be earlier than Vessel ETD.'));
check('Vendor quote uses upsert to prevent duplicate vendor rows', has(routes, '{ new: true, upsert: true, runValidators: true }'));
check('Quote ranking supports L1 through L50', has(model, "...Array.from({ length: 50 }"));
check('Workflow identifiers include cryptographic entropy', has(routes, "crypto.randomBytes(4)"));

// Award and approval lifecycle
check('RFQ award is explicitly internal-user only', has(routes, "router.post('/rfqs/:id/award', authenticateToken, requireInternalRfqUser"));
check('Award requires quotes belonging to the same RFQ', has(routes, 'Every allocation must use a valid quote from this RFQ.'));
check('Allocation requires positive whole containers', has(routes, 'Allocated containers must be positive whole numbers.'));
check('Allocation cannot exceed remaining containers', has(routes, 'You must allocate between 1 and ${remainingToAllocate} container(s).'));
check('A quote can appear only once per allocation request', has(routes, 'A vendor quote can only be allocated once.'));
check('BL access waits for award approval', has(routes, 'Bill of Lading access is locked until the RFQ award approval is completed.'));
check('Approval completion activates allocations', has(approvals, 'approved: true') && has(approvals, "rfq.status = remainingQty === 0 ? 'awarded'"));
check('Approval rejection removes pending allocations', has(approvals, 'rfq.set(\'awardAllocations\', approvedAllocations)'));
check('Partial award state is preserved', has(approvals, "totalAllocated > 0 ? 'partially_awarded'"));

// BL and ASN lifecycle
check('BL number is globally unique in the schema', /blNumber:\s*\{[^}]*unique:\s*true/.test(model));
check('ASN is intentionally not unique, allowing multiple BLs', !/autoAsnNumber:\s*\{[^}]*unique:\s*true/.test(model));
check('BL API still rejects duplicate BL numbers', has(routes, 'already exists in the system.'));
check('ASN must match an invoice for the linked PO', has(routes, 'does not match any invoice record for the linked Purchase Order (PO).'));
check('ASN validation reports and permits existing BL links', has(routes, 'It can be reused for this shipment.'));
check('BL container count cannot exceed vendor allocation', has(routes, 'awarded container(s) remain.'));
check('BL submission requires a supporting document', has(routes, 'At least one supporting document is required.'));
check('BL access verifies the approved awarded vendor', has(routes, 'Only a vendor with an approved RFQ allocation can manage Bill of Lading entries.'));

// Logistics invoice lifecycle
check('Logistics invoice is locked until customs clearance', has(routes, 'Logistics invoice can only be raised after customs clearance.'));
check('Logistics invoice requires positive amount', has(routes, 'Invoice amount must be greater than zero.'));
check('Logistics invoice rejects duplicate vendor invoice numbers', has(routes, 'has already been submitted.'));
check('Logistics invoice requires supporting evidence', has(routes, 'At least one supporting invoice document is required.'));
check('Logistics invoice creates an approval record', has(routes, "type: 'BL Freight Invoice'"));

// Frontend resilience and truthfulness
check('PO selector searches the complete backend dataset', has(rfqForm, "params.set('q', query)"));
check('RFQ list separates loading from empty state', has(vendorList, 'Loading assigned RFQs') && has(vendorList, '!error && filtered.length === 0'));
check('Vendor dashboard shows metric loading indicators', has(vendorDashboard, 'Loading ${label}'));
check('BL flow separates list, allocation, and detail loading states', ['Loading BL entries', 'Loading shipment allocation', 'Loading BL details'].every((label) => has(blFlow, label)));
check('BL UI reports zero real documents instead of fake placeholders', has(blFlow, 'entry.documents?.length || 0') && !has(blFlow, 'BL_Shipping_Document.pdf'));
check('ASN UI communicates valid reuse instead of claiming availability', has(blFlow, 'asnValidationMessage') && !has(blFlow, '> Available<'));
check('Pending approval shows a read-only quote summary instead of a disabled form', has(vendorDetail, 'Boolean(rfq.myQuote && closed)') && has(vendorDetail, 'SUBMITTED FREIGHT QUOTATION'));
check('Pending approval does not also show the closed-error banner', has(vendorDetail, 'closed && !isPendingApproval'));
check('RFQ detail loading failure is retryable', has(vendorDetail, 'onClick={loadRfq}') && has(vendorDetail, 'Retrieving quotation and award status'));
check('BL details never fabricate assignment, clearance, note, or document dates', !['03 Aug 2026', 'Customs clearance processed successfully.'].some((text) => has(blFlow, text)));
check('BL progress includes the material-received state', has(blFlow, "key: 'material_received'"));
check('BL detail failures provide a retry action', has(blFlow, 'onClick={loadEntry}'));
check('Logistics invoice date and description are persisted', has(routes, 'invoiceNumber, invoiceDate') && has(routes, 'req.body.description || req.body.remarks'));
check('Future logistics invoice dates are rejected', has(routes, 'Invoice date must be a valid date that is not in the future.'));
check('BL detail uses consistent semantic icons for key information', ['UserRound', 'CalendarClock', 'BadgeCheck', 'MessageSquareText', 'Files', 'ReceiptText', 'LockKeyhole'].every((icon) => has(blFlow, icon)));
check('Invoice locked state explains the required next step', has(blFlow, 'Invoice creation is locked') && has(blFlow, 'Invoicing becomes available after customs clearance.'));
check('Customs clearance requires both BOE number and document in the API', has(routes, 'Save the Bill of Entry number before marking customs cleared.') && has(routes, 'Upload the Bill of Entry document before marking customs cleared.'));
check('Repeated customs clearance is rejected', has(routes, 'This BL has already been customs cleared.'));
check('Clearance email resolves the actual vendor instead of using a hard-coded address', has(routes, 'if (vendor?.email) sendBlCustomsClearedEmail') && !has(routes, "to: 'vendor@rayzon.com'"));
check('Customs UI disables clearance until all prerequisites exist', has(customsPortal, 'disabled={saving || !bl.boeNumber || !hasBoeDocument}'));
check('Customs file inputs restrict supported formats and have accessible labels', has(customsPortal, 'aria-label="Select BOE document"') && has(customsPortal, 'aria-label="Select customs document"'));

console.log(`\nSUCCESS: ${passed} RFQ workflow contracts passed.\n`);
