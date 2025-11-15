
import { Sale, PayPlan, PayPlanRuleType, VehicleType, PayPlanRule } from '../types';

interface CalculationResult {
    description: string;
    amount: number;
}

/**
 * Calculates the total estimated pay based on a given pay plan and sales data.
 * @param plan The pay plan configuration.
 * @param salesData An array of sale objects for the period.
 * @returns An object containing the total pay, a breakdown of results, total units, and total gross.
 */
export const calculatePay = (plan: PayPlan, salesData: Sale[]): { totalPay: number; results: CalculationResult[]; totalUnits: number; totalGross: number } => {
    
    const allSales = salesData.filter(s => s.status === 'delivered');
    const newSales = allSales.filter(s => s.newOrUsed === VehicleType.NEW);
    const usedSales = allSales.filter(s => s.newOrUsed === VehicleType.USED);
    
    const totalUnits = allSales.reduce((sum, s) => sum + s.count, 0);
    const totalNewUnits = newSales.reduce((sum, s) => sum + s.count, 0);
    const totalUsedUnits = usedSales.reduce((sum, s) => sum + s.count, 0);
    const totalGross = allSales.reduce((sum, s) => sum + s.frontGross + s.backGross, 0);

    const results: CalculationResult[] = [];
    let totalCommissionBasedPay = 0;
    let basePay = 0;
    let isDraw = false;
    let minCommissionGuarantee = 0;

    const getRelevantSales = (rule: PayPlanRule) => {
        const appliesTo = rule.appliesTo || 'All';
        return appliesTo === 'All' ? allSales : (appliesTo === VehicleType.NEW ? newSales : usedSales);
    }
    const getRelevantUnitCount = (rule: PayPlanRule) => {
        const appliesTo = rule.appliesTo || 'All';
        return appliesTo === 'All' ? totalUnits : (appliesTo === VehicleType.NEW ? totalNewUnits : totalUsedUnits);
    }

    plan.forEach(rule => {
        let rulePay = 0;
        const relevantSales = getRelevantSales(rule);
        const relevantUnitCount = getRelevantUnitCount(rule);
        
        const rulePrefix = rule.appliesTo !== 'All' ? `${rule.appliesTo} - ` : '';
        
        switch (rule.type) {
            case PayPlanRuleType.BASE_SALARY:
                basePay = rule.salaryAmount || 0;
                isDraw = rule.isDraw || false;
                results.push({ description: `${rule.isDraw ? "Draw" : "Base Salary"}`, amount: basePay });
                break;
            
            case PayPlanRuleType.FLAT_RATE_PER_UNIT:
                rulePay = relevantUnitCount * (rule.flatAmount || 0);
                if (rulePay > 0) results.push({ description: `${rulePrefix}Flat Rate (${relevantUnitCount} units)`, amount: rulePay });
                totalCommissionBasedPay += rulePay;
                break;

            case PayPlanRuleType.PERCENT_OF_GROSS:
                let frontCommission = 0;
                let backCommission = 0;
                allSales.forEach(sale => {
                    const frontDealCommission = sale.frontGross * ((rule.frontEndPercent || 0) / 100);
                    const backDealCommission = sale.backGross * ((rule.backEndPercent || 0) / 100);
                    
                    const frontCapped = (rule.frontEndCap && rule.frontEndCap > 0) ? Math.min(frontDealCommission, rule.frontEndCap) : frontDealCommission;
                    const backCapped = (rule.backEndCap && rule.backEndCap > 0) ? Math.min(backDealCommission, rule.backEndCap) : backDealCommission;
                    
                    frontCommission += frontCapped;
                    backCommission += backCapped;
                });

                if (frontCommission > 0) results.push({ description: `${rule.frontEndPercent}% of Front-End Gross`, amount: frontCommission });
                if (backCommission > 0) results.push({ description: `${rule.backEndPercent}% of Back-End Gross`, amount: backCommission });
                totalCommissionBasedPay += frontCommission + backCommission;
                break;
            
            case PayPlanRuleType.TIERED_UNIT_COMMISSION:
                const tiers = [...(rule.unitTiers || [])].sort((a, b) => a.from - b.from);
                if (rule.isRetroactive) {
                    const currentTier = tiers.slice().reverse().find(t => relevantUnitCount >= t.from);
                    if (currentTier) {
                        rulePay = relevantUnitCount * currentTier.amount;
                        results.push({ description: `${rulePrefix}Retro Tier (${relevantUnitCount.toFixed(1)} @ $${currentTier.amount}/ea)`, amount: rulePay });
                    }
                } else {
                    let unitsAccountedFor = 0;
                    tiers.forEach(tier => {
                        const upperLimit = tier.to === null || tier.to === 0 ? Infinity : tier.to;
                        if (relevantUnitCount > unitsAccountedFor && relevantUnitCount >= tier.from) {
                            const unitsInTier = Math.min(relevantUnitCount, upperLimit) - unitsAccountedFor;
                            if(unitsInTier <= 0) return;
                            const tierCommission = unitsInTier * tier.amount;
                            rulePay += tierCommission;
                            results.push({ description: `${rulePrefix}Unit Tier (${unitsInTier.toFixed(1)} @ $${tier.amount}/ea)`, amount: tierCommission });
                            unitsAccountedFor += unitsInTier;
                        }
                    });
                }
                totalCommissionBasedPay += rulePay;
                break;
            
            case PayPlanRuleType.TIERED_PERCENT_OF_GROSS:
                 const grossTiers = [...(rule.grossTiers || [])].sort((a, b) => a.from - b.from);
                 let totalGrossForTier = 0;
                 switch(rule.grossType) {
                     case 'Front': totalGrossForTier = relevantSales.reduce((sum, s) => sum + s.frontGross, 0); break;
                     case 'Back': totalGrossForTier = relevantSales.reduce((sum, s) => sum + s.backGross, 0); break;
                     default: totalGrossForTier = relevantSales.reduce((sum, s) => sum + s.frontGross + s.backGross, 0);
                 }

                 if (rule.isGrossRetroactive) {
                     const currentTier = grossTiers.slice().reverse().find(t => relevantUnitCount >= t.from);
                     if (currentTier) {
                         rulePay = totalGrossForTier * ((currentTier.percent || 0) / 100);
                         results.push({ description: `${rulePrefix}Retro ${rule.grossType} Gross (${currentTier.percent}%)`, amount: rulePay });
                     }
                 } else {
                     const currentTier = grossTiers.slice().reverse().find(t => relevantUnitCount >= t.from);
                     if(currentTier){
                         rulePay = totalGrossForTier * ((currentTier.percent || 0) / 100);
                         results.push({ description: `${rulePrefix}${rule.grossType} Gross Tier (${currentTier.percent}%)`, amount: rulePay });
                     }
                 }
                 totalCommissionBasedPay += rulePay;
                 break;

            case PayPlanRuleType.UNIT_BONUS:
                const bonuses = [...(rule.unitBonuses || [])].sort((a, b) => a.from - b.from);
                bonuses.forEach(bonus => {
                    if (relevantUnitCount >= bonus.from) {
                        rulePay += bonus.amount;
                        results.push({ description: `${rulePrefix}Unit Bonus (>=${bonus.from} units)`, amount: bonus.amount });
                    }
                });
                break; // Note: Unit bonuses are treated as separate from commission pay for draw calculation

            case PayPlanRuleType.ADDON_COMMISSION:
                const totalAccessories = allSales.reduce((sum, s) => sum + s.accessory, 0);
                const totalSpiffs = allSales.reduce((sum, s) => sum + s.spiffs, 0);
                const totalTradeSpiffs = allSales.reduce((sum, s) => sum + s.tradeSpiff, 0);
                
                const accessoryPay = totalAccessories * ((rule.accessoryPercent || 0) / 100);
                const spiffPay = totalSpiffs * ((rule.spiffPercent || 0) / 100);
                const tradeSpiffPay = totalTradeSpiffs * ((rule.tradeSpiffPercent || 0) / 100);

                if (accessoryPay > 0) results.push({ description: "Accessory Commission", amount: accessoryPay });
                if (spiffPay > 0) results.push({ description: "Spiff Commission", amount: spiffPay });
                if (tradeSpiffPay > 0) results.push({ description: "Trade Spiff Commission", amount: tradeSpiffPay });
                
                totalCommissionBasedPay += accessoryPay + spiffPay + tradeSpiffPay;
                break;
            
            case PayPlanRuleType.MINIMUM_COMMISSION:
                minCommissionGuarantee = rule.minCommissionAmount || 0;
                break;
        }
    });

    // Handle minimum commission guarantee
    if (minCommissionGuarantee > 0 && totalUnits > 0) {
        const requiredTotalCommission = totalUnits * minCommissionGuarantee;
        if (totalCommissionBasedPay < requiredTotalCommission) {
            const difference = requiredTotalCommission - totalCommissionBasedPay;
            results.push({ description: `Min. Commission Guarantee`, amount: difference });
            totalCommissionBasedPay += difference;
        }
    }

    const unitBonuses = results.filter(r => r.description.includes('Unit Bonus')).reduce((sum, r) => sum + r.amount, 0);
    
    let totalPay = totalCommissionBasedPay + unitBonuses;

    if (isDraw) {
        const commissionForDraw = totalCommissionBasedPay; // Bonuses not typically included against draw
        totalPay = Math.max(basePay, commissionForDraw) + unitBonuses;
        const deficit = basePay - commissionForDraw;
        if(deficit > 0) {
            const drawEntryIndex = results.findIndex(r => r.description === "Draw");
            if (drawEntryIndex !== -1) {
                // Show the commission earned against the draw
                results.splice(drawEntryIndex + 1, 0, { description: 'Commission vs Draw', amount: -commissionForDraw });
            }
        }
    } else {
        totalPay += basePay;
    }


    return { totalPay, results, totalUnits, totalGross };
};


/**
 * Calculates commission for a single sale based on non-tiered rules.
 * @param saleData The data for the single sale from the form.
 * @param plan The consultant's pay plan.
 * @returns The calculated commission amount.
 */
export const calculateSimpleCommission = (saleData: Omit<Sale, 'id' | 'cumulativeGross'>, plan: PayPlan): number => {
    let commission = 0;

    plan.forEach(rule => {
        const appliesTo = rule.appliesTo || 'All';
        if (appliesTo !== 'All' && appliesTo !== saleData.newOrUsed) {
            return; // Skip rule if it doesn't apply to this vehicle type
        }

        switch (rule.type) {
            case PayPlanRuleType.PERCENT_OF_GROSS:
                const frontDealCommission = saleData.frontGross * ((rule.frontEndPercent || 0) / 100);
                const backDealCommission = saleData.backGross * ((rule.backEndPercent || 0) / 100);
                
                const frontCapped = (rule.frontEndCap && rule.frontEndCap > 0) ? Math.min(frontDealCommission, rule.frontEndCap) : frontDealCommission;
                const backCapped = (rule.backEndCap && rule.backEndCap > 0) ? Math.min(backDealCommission, rule.backEndCap) : backDealCommission;
                
                commission += frontCapped + backCapped;
                break;
            case PayPlanRuleType.FLAT_RATE_PER_UNIT:
                commission += (rule.flatAmount || 0) * saleData.count;
                break;
            case PayPlanRuleType.ADDON_COMMISSION:
                 commission += saleData.accessory * ((rule.accessoryPercent || 0) / 100);
                 commission += saleData.spiffs * ((rule.spiffPercent || 0) / 100);
                 commission += saleData.tradeSpiff * ((rule.tradeSpiffPercent || 0) / 100);
                break;
            // Tiered and bonus rules are ignored as they require context of all sales for the period.
        }
    });

    const minCommissionRule = plan.find(r => r.type === PayPlanRuleType.MINIMUM_COMMISSION);
    if (minCommissionRule && minCommissionRule.minCommissionAmount) {
        const minAmountForDeal = minCommissionRule.minCommissionAmount * saleData.count;
        if (commission < minAmountForDeal) {
            commission = minAmountForDeal;
        }
    }

    return commission;
};