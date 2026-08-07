export function getRfqAllocationSummary(rfq) {
  const cargo = rfq?.cargoDetails || {};
  const totalContainers = Number(cargo.containerCount) || Number(rfq?.totalQuantity) || 0;
  const rawStatus = String(rfq?.status || '').toLowerCase();
  const allAwardAllocations = Array.isArray(rfq?.awardAllocations) ? rfq.awardAllocations : [];
  const isPendingApproval = rawStatus === 'pending_approval';
  const approvalCompleted = String(rfq?.approvalProgress?.status || '').toLowerCase() === 'approved & dispatched';

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
