const SCHEDULES_KEY = 'sentinel_schedules_';
const SAVINGS_KEY = 'sentinel_savings_';

export const PaymentType = {
  VENDOR: 'vendor',
  SAVINGS: 'savings'
};

export const Frequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};


export function calculateNextDate(frequency, startDate = null, executionTime = '09:00') {
  const now = startDate ? new Date(startDate) : new Date();
  const [hour, minute] = executionTime.split(':').map(Number);
  
  let next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  
 
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  
  switch (frequency) {
    case Frequency.DAILY:
      
      break;
    case Frequency.WEEKLY:
     
      if (startDate) {
      
        const startDay = new Date(startDate).getDay();
        while (next.getDay() !== startDay || next <= new Date()) {
          next.setDate(next.getDate() + 1);
        }
      }
      break;
    case Frequency.MONTHLY:
      
      if (startDate) {
        const startDayOfMonth = new Date(startDate).getDate();
        next.setDate(startDayOfMonth);
        if (next <= new Date()) {
          next.setMonth(next.getMonth() + 1);
        }
      } else {
        next.setMonth(next.getMonth() + 1);
      }
      break;
    case Frequency.YEARLY:
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      break;
  }
  
  return next.toISOString();
}


export function formatScheduleDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}


export function formatTime(timeString) {
  const [hour, minute] = timeString.split(':');
  const h = parseInt(hour);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minute} ${ampm}`;
}


export function getDaysUntil(dateString) {
  const next = new Date(dateString);
  const now = new Date();
  const diff = next - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

class RecurringScheduler {
  constructor(userAddress, apiUrl = '', network = 'mainnet') {
    this.userAddress = userAddress?.toLowerCase();
    this.apiUrl = apiUrl;
    this.network = network;
    this.schedules = [];
    this.savingsPlans = [];
  }

  setNetwork(network) {
    this.network = network;
  }

  
  load() {
    this.schedules = this.loadSchedules();
    this.savingsPlans = this.loadSavingsPlans();
    return {
      schedules: this.schedules,
      savingsPlans: this.savingsPlans
    };
  }

  
  loadSchedules() {
    try {
      const stored = localStorage.getItem(`${SCHEDULES_KEY}${this.userAddress}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load schedules:', error);
    }
    return [];
  }

  
  loadSavingsPlans() {
    try {
      const stored = localStorage.getItem(`${SAVINGS_KEY}${this.userAddress}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Failed to load savings plans:', error);
    }
    return [];
  }

  
  saveSchedules() {
    localStorage.setItem(
      `${SCHEDULES_KEY}${this.userAddress}`,
      JSON.stringify(this.schedules)
    );
  }

  
  saveSavingsPlans() {
    localStorage.setItem(
      `${SAVINGS_KEY}${this.userAddress}`,
      JSON.stringify(this.savingsPlans)
    );
  }

  
  createSchedule({
    vendor,
    vendorAddress,
    amount,
    frequency,
    startDate = null,
    executionTime = '09:00',
    reason = '',
    isTrusted = false
  }) {
    const id = `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const schedule = {
      id,
      type: PaymentType.VENDOR,
      vendor,
      vendorAddress: vendorAddress?.toLowerCase(),
      amount: parseFloat(amount),
      frequency,
      executionTime,
      startDate: startDate || new Date().toISOString(),
      nextExecution: calculateNextDate(frequency, startDate, executionTime),
      reason,
      isTrusted,
      isActive: true,
      network: this.network,
      createdAt: new Date().toISOString(),
      lastExecuted: null,
      executionCount: 0,
      failedCount: 0
    };

    this.schedules.push(schedule);
    this.saveSchedules();
    this.syncToBackend(schedule);

    return schedule;
  }

  
 createSavingsPlan({
    name,
    amount,
    frequency,
    lockDays,
    lockType = 0,
    startDate = null,
    executionTime = '09:00',
    reason = '',
    isRecurring = true,
    savingsPlanId = null
  }) {
    const id = `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + lockDays);
    
   
    let totalDeposits = 1;
    if (isRecurring) {
      switch (frequency) {
        case Frequency.DAILY:
          totalDeposits = lockDays;
          break;
        case Frequency.WEEKLY:
          totalDeposits = Math.ceil(lockDays / 7);
          break;
        case Frequency.MONTHLY:
          totalDeposits = Math.ceil(lockDays / 30);
          break;
        case Frequency.YEARLY:
          totalDeposits = Math.ceil(lockDays / 365);
          break;
      }
    }

   const plan = {
      id,
      type: PaymentType.SAVINGS,
      name,
      amount: parseFloat(amount),
      frequency: isRecurring ? frequency : null,
      lockDays,
      lockType,
      executionTime,
      startDate: startDate || new Date().toISOString(),
      nextDeposit: isRecurring ? calculateNextDate(frequency, startDate, executionTime) : null,
      unlockDate: unlockDate.toISOString(),
      reason,
      isRecurring,
      isActive: true,
      savingsPlanId, 
      totalDeposits,
      depositsCompleted: 0,
      totalSaved: 0,
      targetAmount: parseFloat(amount) * totalDeposits,
      network: this.network,
      createdAt: new Date().toISOString(),
      lastDeposit: null
    };

    this.savingsPlans.push(plan);
    this.saveSavingsPlans();
    this.syncToBackend(plan);

    return plan;
  }

  
  markScheduleExecuted(scheduleId, txHash) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) return null;

    schedule.lastExecuted = new Date().toISOString();
    schedule.executionCount += 1;
    schedule.nextExecution = calculateNextDate(
      schedule.frequency, 
      schedule.nextExecution, 
      schedule.executionTime
    );

    this.saveSchedules();
    return schedule;
  }

  
  markSavingsDeposit(planId, amount, txHash) {
    const plan = this.savingsPlans.find(p => p.id === planId);
    if (!plan) return null;

    plan.lastDeposit = new Date().toISOString();
    plan.depositsCompleted += 1;
    plan.totalSaved += parseFloat(amount);
    
    if (plan.isRecurring && plan.depositsCompleted < plan.totalDeposits) {
      plan.nextDeposit = calculateNextDate(
        plan.frequency,
        plan.nextDeposit,
        plan.executionTime
      );
    } else {
      plan.nextDeposit = null;
      if (!plan.isRecurring) {
        plan.isActive = false;
      }
    }

    this.saveSavingsPlans();
    return plan;
  }

  
  markScheduleFailed(scheduleId, error) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    schedule.failedCount += 1;
    schedule.lastError = error;
    schedule.lastErrorAt = new Date().toISOString();

    
    if (schedule.failedCount >= 3) {
      schedule.isActive = false;
    }

    this.saveSchedules();
  }

  
  pauseSchedule(scheduleId) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (schedule) {
      schedule.isActive = false;
      this.saveSchedules();
    }
    return schedule;
  }

  
  resumeSchedule(scheduleId) {
    const schedule = this.schedules.find(s => s.id === scheduleId);
    if (schedule) {
      schedule.isActive = true;
      schedule.failedCount = 0;
     
      schedule.nextExecution = calculateNextDate(
        schedule.frequency,
        null,
        schedule.executionTime
      );
      this.saveSchedules();
    }
    return schedule;
  }

 
  deleteSchedule(scheduleId) {
    this.schedules = this.schedules.filter(s => s.id !== scheduleId);
    this.saveSchedules();
  }

  
  deleteSavingsPlan(planId) {
    this.savingsPlans = this.savingsPlans.filter(p => p.id !== planId);
    this.saveSavingsPlans();
  }

  
  getDueSchedules() {
    const now = new Date();
    return this.schedules.filter(s => {
      if (!s.isActive) return false;
      const next = new Date(s.nextExecution);
      return next <= now;
    });
  }

 
  getDueSavingsDeposits() {
    const now = new Date();
    return this.savingsPlans.filter(p => {
      if (!p.isActive || !p.isRecurring || !p.nextDeposit) return false;
      const next = new Date(p.nextDeposit);
      return next <= now;
    });
  }

  
  getUpcomingPayments(days = 7) {
    const now = new Date();
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    
    const upcoming = [];

       this.schedules.forEach(s => {
      if (!s.isActive) return;
      const next = new Date(s.nextExecution);
      if (next <= future) {
        upcoming.push({
          id: s.id,
          type: 'schedule',
          name: s.vendor,
          amount: s.amount,
          date: s.nextExecution,
          frequency: s.frequency
        });
      }
    });

       this.savingsPlans.forEach(p => {
      if (!p.isActive || !p.isRecurring || !p.nextDeposit) return;
      const next = new Date(p.nextDeposit);
      if (next <= future) {
        upcoming.push({
          id: p.id,
          type: 'savings',
          name: p.name,
          amount: p.amount,
          date: p.nextDeposit,
          frequency: p.frequency
        });
      }
    });

   
    return upcoming.sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  
  getTotalUpcoming(days = 7) {
    const upcoming = this.getUpcomingPayments(days);
    return upcoming.reduce((sum, p) => sum + p.amount, 0);
  }

  
  getActiveScheduleCount() {
    return this.schedules.filter(s => s.isActive).length;
  }

  
  getActiveSavingsCount() {
    return this.savingsPlans.filter(p => p.isActive && !p.withdrawn).length;
  }

  
  getTotalLocked() {
    return this.savingsPlans
      .filter(p => !p.withdrawn)
      .reduce((sum, p) => sum + (p.totalSaved || 0), 0);
  }

  
  async syncToBackend(item) {
    if (!this.apiUrl) return;

    try {
      const endpoint = item.type === PaymentType.SAVINGS 
        ? '/api/v1/savings-plans'
        : '/api/v1/recurring-schedules';

      await fetch(`${this.apiUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          userAddress: this.userAddress
        })
      });
    } catch (error) {
      console.error('Failed to sync to backend:', error);
    }
  }

  
  async syncAllToBackend() {
    if (!this.apiUrl) return;

    try {
      await fetch(`${this.apiUrl}/api/v1/recurring/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: this.userAddress,
          schedules: this.schedules,
          savingsPlans: this.savingsPlans
        })
      });
    } catch (error) {
      console.error('Failed to sync all to backend:', error);
    }
  }

  
  async loadFromBackend() {
    if (!this.apiUrl) return;

    try {
      const response = await fetch(
        `${this.apiUrl}/api/v1/recurring/${this.userAddress}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.schedules) {
          this.schedules = data.schedules;
          this.saveSchedules();
        }
        if (data.savingsPlans) {
          this.savingsPlans = data.savingsPlans;
          this.saveSavingsPlans();
        }
      }
    } catch (error) {
      console.error('Failed to load from backend:', error);
    }
  }

 
  getSchedule(id) {
    return this.schedules.find(s => s.id === id);
  }

  getSavingsPlan(id) {
    return this.savingsPlans.find(p => p.id === id);
  }

 
  updateSchedule(id, updates) {
    const index = this.schedules.findIndex(s => s.id === id);
    if (index === -1) return null;

    this.schedules[index] = {
      ...this.schedules[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    
    if (updates.frequency || updates.executionTime) {
      this.schedules[index].nextExecution = calculateNextDate(
        this.schedules[index].frequency,
        null,
        this.schedules[index].executionTime
      );
    }

    this.saveSchedules();
    return this.schedules[index];
  }

  
  updateSavingsPlan(id, updates) {
    const index = this.savingsPlans.findIndex(p => p.id === id);
    if (index === -1) return null;

    this.savingsPlans[index] = {
      ...this.savingsPlans[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveSavingsPlans();
    return this.savingsPlans[index];
  }

  setSavingsPlanContractId(localId, contractPlanId) {
    const plan = this.savingsPlans.find(p => p.id === localId);
    if (plan) {
      plan.savingsPlanId = contractPlanId;
      this.saveSavingsPlans();
    }
    return plan;
  }
}

export default RecurringScheduler;