export function getRfqAllocationSummary(rfq) {
  const cargo = rfq?.cargoDetails || {};
  const totalContainers = Number(cargo.containerCount) || Number(rfq?.totalQuantity) || 0;
  const rawStatus = String(rfq?.status || '').toLowerCase();
  const rawAllocations = Array.isArray(rfq?.awardAllocations) ? rfq.awardAllocations : [];
  const isPendingApproval = rawStatus === 'pending_approval';
  const approvalCompleted = String(rfq?.approvalProgress?.status || '').toLowerCase() === 'approved & dispatched';

  const normalizeAllocation = (allocation) => {
    if (!allocation || typeof allocation !== 'object') return allocation;
    const matchingQuote = Array.isArray(rfq?.quotes)
      ? rfq.quotes.find(q =>
          (allocation.quoteId && (q.quoteId === allocation.quoteId || q._id === allocation.quoteId)) ||
          (allocation.vendorId && (q.vendorId === allocation.vendorId || q.sapVendorCode === allocation.vendorId)) ||
          (allocation.vendorName && q.vendorName === allocation.vendorName)
        )
      : null;

    const containers = Number(allocation.containers || allocation.awardedContainers || allocation.awarded_containers || 0);
    const quoteRate = Number(matchingQuote?.totalInr || matchingQuote?.totalCostINR || matchingQuote?.ratePerContainer || 0);
    const ratePerContainer = Number(allocation.ratePerContainer || allocation.ratePerContainerInr || allocation.rate || 0) || quoteRate;
    const allocationAmount = Number(allocation.allocationAmount || allocation.totalAmountInr || allocation.allocationAmountInr || allocation.totalAmount || 0) || (ratePerContainer * containers);
    const remark = allocation.remark || allocation.remarks || '';

    return {
      ...allocation,
      containers,
      ratePerContainer,
      ratePerContainerInr: ratePerContainer,
      allocationAmount,
      totalAmountInr: allocationAmount,
      remark,
      remarks: remark,
      vendorName: allocation.vendorName || matchingQuote?.vendorName || rfq?.awardedVendorName || 'Vendor'
    };
  };

  let allAwardAllocations = rawAllocations.map(normalizeAllocation);
  if (allAwardAllocations.length === 0 && (rawStatus === 'awarded' || Number(rfq?.allocatedQuantity) > 0) && (rfq?.awardedVendorName || rfq?.awardedVendorId)) {
    const matchingQuote = Array.isArray(rfq?.quotes)
      ? rfq.quotes.find(q =>
          (rfq.awardedQuoteId && (q.quoteId === rfq.awardedQuoteId || q._id === rfq.awardedQuoteId)) ||
          (rfq.awardedVendorId && (q.vendorId === rfq.awardedVendorId || q.sapVendorCode === rfq.awardedVendorId)) ||
          (rfq.awardedVendorName && q.vendorName === rfq.awardedVendorName) ||
          q.status === 'awarded'
        )
      : null;
    const containers = Number(rfq?.allocatedQuantity) || totalContainers;
    const quoteRate = Number(matchingQuote?.totalInr || matchingQuote?.totalCostINR || matchingQuote?.ratePerContainer || 0);
    const amount = quoteRate * containers;
    allAwardAllocations = [
      normalizeAllocation({
        vendorId: rfq.awardedVendorId || matchingQuote?.vendorId || '',
        vendorName: rfq.awardedVendorName || matchingQuote?.vendorName || 'Awarded Vendor',
        quoteId: rfq.awardedQuoteId || matchingQuote?.quoteId || '',
        containers,
        ratePerContainer: quoteRate,
        ratePerContainerInr: quoteRate,
        allocationAmount: amount,
        totalAmountInr: amount,
        approved: true
      })
    ];
  }

  const approvedAllocations = allAwardAllocations.filter((allocation) => {
    if (allocation?.approved === true) return true;
    if (allocation?.approved === false) return false;
    if (isPendingApproval) return false;
    if (allocation?.cycleApprovalId && !approvalCompleted) return false;
    return true;
  });

  const pendingAllocations = isPendingApproval
    ? allAwardAllocations.filter((allocation) => allocation?.approved === false || Boolean(allocation?.cycleApprovalId))
    : [];

  const approvedContainerCount = approvedAllocations.reduce((sum, allocation) => sum + (Number(allocation?.containers) || 0), 0);
  const pendingContainerCount = pendingAllocations.reduce((sum, allocation) => sum + (Number(allocation?.containers) || 0), 0);
  const fallbackAllocatedQuantity = Number(rfq?.allocatedQuantity) || 0;
  const allocatedContainers = approvedContainerCount > 0 ? approvedContainerCount : fallbackAllocatedQuantity;
  const openContainers = Math.max(0, totalContainers - allocatedContainers - pendingContainerCount);
  const isExpired = rfq?.closingDate ? new Date(rfq.closingDate) < new Date() : false;

  let badgeTone = 'sky';
  let badgeText = (rfq?.status || 'PUBLISHED').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  if (rawStatus === 'closed' || rawStatus === 'cancelled') {
    badgeTone = 'rose';
    badgeText = rawStatus === 'closed' ? 'CLOSED' : 'CANCELLED';
  } else if (isPendingApproval) {
    badgeTone = 'amber';
    badgeText = pendingContainerCount > 0
      ? `AWARD APPROVAL PENDING (${pendingContainerCount}/${totalContainers})`
      : 'AWARD APPROVAL PENDING';
  } else if (allocatedContainers > 0 && allocatedContainers < totalContainers) {
    badgeTone = 'amber';
    badgeText = `PARTIALLY AWARDED (${allocatedContainers}/${totalContainers})`;
  } else if ((allocatedContainers > 0 && allocatedContainers >= totalContainers) || rawStatus === 'awarded') {
    badgeTone = 'emerald';
    badgeText = `FULLY AWARDED (${allocatedContainers > 0 ? allocatedContainers : totalContainers}/${totalContainers})`;
  } else if (isExpired) {
    badgeTone = 'rose';
    badgeText = 'EXPIRED';
  } else if (rawStatus === 'published' || rawStatus === 'open' || !rawStatus) {
    badgeTone = 'sky';
    badgeText = 'PUBLISHED (OPEN BIDDING)';
  } else {
    badgeTone = 'slate';
  }

  return {
    allAwardAllocations,
    approvedAllocations,
    pendingAllocations,
    totalContainers,
    allocatedContainers,
    inApprovalContainers: pendingContainerCount,
    openContainers,
    isPendingApproval,
    badgeTone,
    badgeText
  };
}

export function getShipperName(rfq) {
  if (!rfq) return 'IMPORT SEA FREIGHT';

  // 1. Check explicit non-generic shipper fields first
  if (rfq.shipperName && typeof rfq.shipperName === 'string' && rfq.shipperName.trim()) {
    const sName = rfq.shipperName.trim();
    if (!/^(Rayzon Solar|Rayzon)/i.test(sName)) {
      return sName;
    }
  }

  // 2. Clean title: strip trailing container count and port details e.g. "- 4 X 40 FT - SHANGHAI to NHAVA SHEVA"
  const title = (rfq.title || '').trim();
  if (title) {
    const mainTitle = title.split(' - ')[0].trim();
    if (mainTitle) return mainTitle;
  }

  return 'IMPORT SEA FREIGHT';
}
