import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const SAVINGS_ABI = [
  "function getTotalLocked(address _user) view returns (uint256)",
  "function getUserPlans(address _user) view returns (uint256[])",
  "function getPlan(uint256 _planId) view returns (address owner, address vaultAddress, string name, uint256 totalDeposited, uint256 unlockTime, uint256 createdAt, bool withdrawn, bool isRecurring)"
];

// Cache to avoid repeated blockchain calls
let savingsCache = { totalLocked: 0, plans: [], lastFetch: 0, account: null };
const CACHE_DURATION = 10000;

export async function syncSavingsWithBlockchain(account, provider, savingsContractAddress) {
  if (!provider || !savingsContractAddress || !account) return null;
  
  try {
    const contract = new ethers.Contract(savingsContractAddress, SAVINGS_ABI, provider);
    const planIds = await contract.getUserPlans(account);
    const localPlans = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');

    // Get total locked
    const totalLockedWei = await contract.getTotalLocked(account);
    const totalLocked = parseFloat(ethers.formatUnits(totalLockedWei, 18));

    // Update each local plan with on-chain data
    for (const planId of planIds) {
      try {
        const plan = await contract.getPlan(planId);
        const totalDeposited = parseFloat(ethers.formatUnits(plan.totalDeposited, 18));
        const localIndex = localPlans.findIndex(p => p.contractPlanId === Number(planId));
        
        if (localIndex !== -1) {
          localPlans[localIndex].totalSaved = totalDeposited;
          localPlans[localIndex].totalDeposited = totalDeposited;
          localPlans[localIndex].withdrawn = plan.withdrawn;
        }
      } catch (e) {
        console.warn(`Couldn't sync plan ${planId}:`, e);
      }
    }

    // Save to localStorage
    localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(localPlans));
    
    // Update cache
    savingsCache = { totalLocked, plans: localPlans, lastFetch: Date.now(), account };
    
    // Notify all components
    window.dispatchEvent(new CustomEvent('savingsUpdated', { 
      detail: { totalLocked, plans: localPlans } 
    }));
    
    console.log('✅ Synced savings with blockchain:', totalLocked, 'MNEE locked');
    return { totalLocked, plans: localPlans };
  } catch (error) {
    console.error('Sync failed:', error);
    return null;
  }
}

export function getCachedSavings() {
  return savingsCache;
}

export default { syncSavingsWithBlockchain, getCachedSavings };