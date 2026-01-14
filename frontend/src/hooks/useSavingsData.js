// REPLACE THE ENTIRE FILE WITH:

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const SAVINGS_ABI = [
  "function getTotalLocked(address _user) view returns (uint256)",
  "function getUserPlans(address _user) view returns (uint256[])",
  "function getPlan(uint256 _planId) view returns (address owner, address vaultAddress, string name, uint256 totalDeposited, uint256 unlockTime, uint256 createdAt, bool withdrawn, bool isRecurring)"
];

let savingsCache = { totalLocked: 0, plans: [], lastFetch: 0, account: null };
const CACHE_DURATION = 10000;

export async function syncSavingsWithBlockchain(account, agentAddress, provider, savingsContractAddress) {
  if (!provider || !savingsContractAddress) return null;
  
  // Use agent address to query blockchain (agent owns plans), fall back to account
  const queryAddress = agentAddress || account;
  if (!queryAddress) return null;
  
  try {
    const contract = new ethers.Contract(savingsContractAddress, SAVINGS_ABI, provider);
    const planIds = await contract.getUserPlans(queryAddress);
    const localPlans = JSON.parse(localStorage.getItem(`sentinel_savings_${account}`) || '[]');

    console.log('🔍 Blockchain planIds:', planIds.map(id => id.toString()));
    console.log('🔍 Local plans:', localPlans.map(p => ({ name: p.name, contractPlanId: p.contractPlanId, type: typeof p.contractPlanId })));

    // Get total locked
    const totalLockedWei = await contract.getTotalLocked(queryAddress);
    const totalLocked = parseFloat(ethers.formatUnits(totalLockedWei, 18));

    // Update each local plan with on-chain data
    for (const planId of planIds) {
      try {
        const plan = await contract.getPlan(planId);
        const totalDeposited = parseFloat(ethers.formatUnits(plan.totalDeposited, 18));
        const planName = plan.name;
        
        // FIX: Use string comparison to handle BigInt/number/string mismatches
        const planIdStr = planId.toString();
        let localIndex = localPlans.findIndex(p => 
          String(p.contractPlanId) === planIdStr
        );
        
        // Fallback: match by name if contractPlanId doesn't match
        if (localIndex === -1) {
          localIndex = localPlans.findIndex(p => 
            p.name === planName && !p.contractPlanId
          );
          // If found by name, update the contractPlanId
          if (localIndex !== -1) {
            console.log(`🔗 Matched plan "${planName}" by name, updating contractPlanId to ${planIdStr}`);
            localPlans[localIndex].contractPlanId = parseInt(planIdStr);
          }
        }
        
        if (localIndex !== -1) {
          console.log(`✅ Updating plan "${localPlans[localIndex].name}": ${localPlans[localIndex].totalSaved} → ${totalDeposited}`);
          localPlans[localIndex].totalSaved = totalDeposited;
          localPlans[localIndex].totalDeposited = totalDeposited;
          localPlans[localIndex].withdrawn = plan.withdrawn;
        } else {
          console.warn(`⚠️ No local plan found for on-chain plan ${planIdStr} ("${planName}")`);
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
    
    console.log('✅ Synced savings with blockchain:', totalLocked, 'MNEE locked,', localPlans.length, 'plans');
    return { totalLocked, plans: localPlans };
  } catch (error) {
    console.error('Sync failed:', error);
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