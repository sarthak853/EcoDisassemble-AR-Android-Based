/**
 * EcoDisassemble AR - Deterministic Safety Gate
 * 
 * Life-Safety Rule Engine that combines multimodal user symptom inputs
 * and edge-AI visual detections. Fails safe: prevents dangerous DIY actions
 * when lithium battery thermal runaway, fire, or mains voltage hazards exist.
 */

export class SafetyGate {
  evaluate(symptomsText = '', aiResults = [], hazardsChecked = []) {
    let flag = 'SAFE';
    let message = 'Proceed to AR disassembly steps.';
    let riskLevel = 'LOW';
    let diyLevel = 'GUIDED DIY';

    const criticalHazards = ['swelling', 'burning', 'sparks', 'hot', 'smoke', 'high voltage', 'bulging', 'puncture', 'odor'];
    const textLower = (symptomsText || '').toLowerCase();

    // 1. Evaluate User Inputs & Checkboxes
    const userCriticalMatch = criticalHazards.filter(h => hazardsChecked.includes(h) || textLower.includes(h));
    const userHasHazard = userCriticalMatch.length > 0;

    // 2. Evaluate Edge-AI Results with Calibrated Safety Thresholds (SEC-01)
    // Critical acute hazards fail safe at >= 0.45 confidence (from Roboflow + DeepPCB)
    const criticalAIClasses = ['swollen_battery', 'exposed_wire', 'burnt_chip', 'short_circuit'];
    const detectedCriticalAI = aiResults.filter(res => 
      (criticalHazards.includes(res.class) || criticalAIClasses.includes(res.class)) && res.confidence >= 0.45
    );

    // Structural or moderate damage checked at >= 0.70 confidence
    const moderateAIClasses = [
      'shattered_screen',
      'corroded_contact',
      'broken_port',
      'open_circuit',
      'mouse_bite',
      'mousebite_defect',
      'spur',
      'spur_defect',
      'copper_spill',
      'pin_hole',
      'pin_hole_defect'
    ];
    const detectedModerateAI = aiResults.filter(res => 
      moderateAIClasses.includes(res.class) && res.confidence >= 0.70
    );

    // 3. Deterministic Decision Tree
    if (userHasHazard || detectedCriticalAI.length > 0) {
      flag = 'HAZARD_STOP';
      riskLevel = 'STOP';
      diyLevel = 'TECHNICIAN REQUIRED';
      
      const hazardNames = [
        ...userCriticalMatch,
        ...detectedCriticalAI.map(d => `${d.class.replace('_', ' ')} (${Math.round(d.confidence * 100)}%)`)
      ];

      message = `STOP: TECHNICIAN REQUIRED. Severe hazard detected: ${[...new Set(hazardNames)].join(', ')}. Do not charge, heat, puncture, or disassemble this device.`;
    } else if (hazardsChecked.includes('liquid') || textLower.includes('liquid') || textLower.includes('water') || detectedModerateAI.some(d => d.class === 'corroded_contact')) {
      flag = 'WARNING';
      riskLevel = 'HIGH';
      diyLevel = 'TECHNICIAN ADVISED';
      message = 'WARNING: Potential liquid or internal corrosion damage. Disconnect all power sources immediately. Proceed with caution.';
    } else if (detectedModerateAI.length > 0) {
      flag = 'MODERATE';
      riskLevel = 'MODERATE';
      diyLevel = 'ADVANCED DIY';
      message = `Proceed with model-specific tools: ${detectedModerateAI.map(d => d.class.replace('_', ' ')).join(', ')} detected.`;
    }

    return {
      flag,
      riskLevel,
      diyLevel,
      message,
      criticalAIDetections: detectedCriticalAI,
      moderateAIDetections: detectedModerateAI
    };
  }
}
