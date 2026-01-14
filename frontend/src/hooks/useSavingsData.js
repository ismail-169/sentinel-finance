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

/**
 * Sync savings data with blockchain
 * @param {string} account - User's wallet address (for localStorage key)
 * @param {string} agentAddress - Agent wallet address (owns the plans on-chain)
 * @param {object} provider - Ethers provider
 * @param {string} savingsContractAddress - SentinelSavings contract address
 */
export async function syncSavingsWithBlockchain(account, agentAddress, provider, savingsContractAddress) {
  if (!provider || !savingsContractAddress) return null;
  
  // Need agent address to query blockchain (plans are owned by agent)
  const queryAddress = agentAddress || account;
  if (!queryAddress) return null;
  
  // Check cache
  const now = Date.now();
  if (savingsCache.account === account && (now - savingsCache.lastFetch) < CACHE_DURATION) {
    console.log('📦 Using cached savings data');
    return { totalLocked: savingsCache.totalLocked, plans: savingsCache.plans };
  }
  
  try {
    const contract = new ethers.Contract(savingsContractAddress, SAVINGS_ABI, provider);
    
    // Get plans owned by agent wallet (agent is the on-chain owner)
    const planIds = await contract.getUserPlans(queryAddress);
    const localPlans = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');

    // Get total locked for agent
    const totalLockedWei = await contract.getTotalLocked(queryAddress);
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

    // Save to localStorage (keyed by user account)
    localStorage.setItem(`sentinel_savings_${account}`, JSON.stringify(localPlans));
    
    // Update cache
    savingsCache = { totalLocked, plans: localPlans, lastFetch: Date.now(), account };
    
    // Notify all components listening for updates
    window.dispatchEvent(new CustomEvent('savingsUpdated', { 
      detail: { totalLocked, plans: localPlans } 
    }));
    
    console.log('✅ Synced savings with blockchain:', totalLocked, 'MNEE locked,', localPlans.length, 'plans');
    return { totalLocked, plans: localPlans };
  } catch (error) {
    console.error('Blockchain sync failed:', error);
    return null;
  }
}

export function getCachedSavings() {
  return savingsCache;
}

export function clearSavingsCache() {
  savingsCache = { totalLocked: 0, plans: [], lastFetch: 0, account: null };
}

export default { syncSavingsWithBlockchain, getCachedSavings, clearSavingsCache };