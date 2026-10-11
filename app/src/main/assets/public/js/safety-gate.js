/**
 * Deterministic Safety Gate Rule Engine
 */

export function evaluateSafety(symptoms, mlResults) {
    const textLower = symptoms.toLowerCase();
    
    // 1. Text-based heuristic checks
    if (textLower.includes('smoke') || textLower.includes('fire') || textLower.includes('sparks')) {
        return {
            isSafe: false,
            reason: 'Critical hazard mentioned in symptoms. Do not attempt DIY repair on devices that have smoked or sparked. Fire hazard.'
        };
    }
    
    if (textLower.includes('swollen') || textLower.includes('expanding')) {
        return {
            isSafe: false,
            reason: 'Potential swollen battery mentioned. Puncturing a swollen battery causes severe fire hazards.'
        };
    }

    // 2. ML-based visual checks
    for (const det of mlResults) {
        if (det.class === 'battery_swollen' && det.confidence > 0.6) {
            return {
                isSafe: false,
                reason: 'Visual AI detected a swollen battery. STOP immediately. Fire and explosion risk.'
            };
        }
        if (det.class === 'burn_mark' && det.confidence > 0.7) {
            return {
                isSafe: false,
                reason: 'Visual AI detected severe burn marks. Internal short-circuit likely.'
            };
        }
    }

    // 3. Safe fallback
    return {
        isSafe: true,
        reason: 'No critical hazards detected.'
    };
}
