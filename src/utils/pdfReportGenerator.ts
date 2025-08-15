import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AssessmentData } from '../pages/Index';

interface BlockPerformance {
  block: number;
  rule: string;
  accuracy: number;
  avgResponseTime: number;
  firstCorrectTrial: number | null;
  adaptationLatency: number | null;
  totalTrials: number;
  correctTrials: number;
}

interface ReportData {
  assessmentData: AssessmentData;
  participantId: string;
  duration: string;
  blockPerformance: BlockPerformance[];
  overallAccuracy: number;
  totalTrials: number;
}

export class PDFReportGenerator {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private currentY: number;
  private lineHeight: number;

  constructor() {
    this.pdf = new jsPDF('p', 'mm', 'a4');
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
    this.margin = 20;
    this.currentY = this.margin;
    this.lineHeight = 6;
  }

  private addNewPageIfNeeded(requiredSpace: number) {
    if (this.currentY + requiredSpace > this.pageHeight - this.margin) {
      this.pdf.addPage();
      this.currentY = this.margin;
    }
  }

  private addHeader(data: ReportData) {
    // Logo placeholder and title
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(20, 152, 84); // Cogello green
    this.pdf.text('COGELLO', this.margin, this.currentY);
    
    // Determine report title based on task type.  The default Flex Sort report
    // title is replaced with a Focus Flicker title when the assessment data
    // includes a `task` field set to 'focusFlicker'.  This maintains a
    // consistent visual identity while accurately describing the underlying task.
    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    const reportTitle = isFlicker
      ? 'Focus Flicker Cognitive Assessment Report'
      : 'Flex Sort Cognitive Assessment Report';
    this.pdf.setFontSize(18);
    this.pdf.setTextColor(75, 85, 99); // Gray-600
    this.pdf.text(reportTitle, this.margin, this.currentY + 10);
    
    // Report metadata
    this.pdf.setFontSize(10);
    this.pdf.setTextColor(107, 114, 128); // Gray-500
    const reportDate = new Date(data.assessmentData.completed_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    this.pdf.text(`Generated: ${reportDate}`, this.margin, this.currentY + 18);
    this.pdf.text(`Participant ID: ${data.participantId}`, this.margin, this.currentY + 23);
    
    // Fix grammar for duration display
    const durationValue = parseInt(data.duration.split(' ')[0]);
    const formattedDuration = durationValue === 1 ? '1 minute' : `${durationValue} minutes`;
    this.pdf.text(`Assessment Duration: ${formattedDuration}`, this.margin, this.currentY + 28);
    
    this.currentY += 40;
  }

  private addSummaryOverview(data: ReportData) {
    this.addNewPageIfNeeded(60);
    
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(31, 41, 55); // Gray-800
    this.pdf.text('EXECUTIVE SUMMARY', this.margin, this.currentY);
    this.currentY += 10;

    // Create summary boxes similar to dashboard cards
    const boxWidth = (this.pageWidth - 3 * this.margin) / 2;
    const boxHeight = 25;
    
    // Determine if this assessment is a Focus Flicker report
    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    // Flicker-specific hit and error calculations
    const totalTrials = data.totalTrials;
    const flickerHitRate = totalTrials > 0 ? Math.round((data.assessmentData.shifts_achieved / totalTrials) * 100) : 0;
    const flickerFalseAlarmRate = totalTrials > 0 ? Math.round((data.assessmentData.perseverative_errors / totalTrials) * 100) : 0;
    const flickerErrorControl = Math.max(0, 100 - flickerFalseAlarmRate);

    // Primary score box (Flexibility or Flicker Threshold)
    this.pdf.setDrawColor(229, 231, 235); // Gray-200
    this.pdf.setFillColor(249, 250, 251); // Gray-50
    this.pdf.roundedRect(this.margin, this.currentY, boxWidth, boxHeight, 2, 2, 'FD');

    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(20, 152, 84); // Green
    // Choose the appropriate score for display.  For Focus Flicker we
    // prioritise attention_score when present; for Flex Sort we use the
    // cognitive flexibility score.  This ensures the primary score box
    // reflects the right construct.
    const primaryScore = (data.assessmentData as any).task === 'focusFlicker'
      ? ((data.assessmentData as any).attention_score ?? data.assessmentData.cognitive_flexibility_score)
      : data.assessmentData.cognitive_flexibility_score;
    this.pdf.text(primaryScore.toString(), this.margin + 5, this.currentY + 10);

    this.pdf.setFontSize(10);
    this.pdf.setTextColor(75, 85, 99);
    if (isFlicker) {
      this.pdf.text('Attention Score', this.margin + 5, this.currentY + 16);
      this.pdf.text(this.getScoreLabel(primaryScore), this.margin + 5, this.currentY + 21);
    } else {
      this.pdf.text('Cognitive Flexibility Score', this.margin + 5, this.currentY + 16);
      this.pdf.text(this.getScoreLabel(primaryScore), this.margin + 5, this.currentY + 21);
    }

    // Secondary box (Hits or Rule Adaptations)
    this.pdf.setFillColor(249, 250, 251);
    this.pdf.roundedRect(this.margin + boxWidth + 10, this.currentY, boxWidth, boxHeight, 2, 2, 'FD');

    this.pdf.setFontSize(20);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(20, 152, 84);
    if (isFlicker) {
      this.pdf.text(`${data.assessmentData.shifts_achieved}`, this.margin + boxWidth + 15, this.currentY + 10);
    } else {
      this.pdf.text(`${data.assessmentData.shifts_achieved}/5`, this.margin + boxWidth + 15, this.currentY + 10);
    }

    this.pdf.setFontSize(10);
    this.pdf.setTextColor(75, 85, 99);
    if (isFlicker) {
      this.pdf.text('Hits Achieved', this.margin + boxWidth + 15, this.currentY + 16);
      this.pdf.text('total detections', this.margin + boxWidth + 15, this.currentY + 21);
    } else {
      this.pdf.text('Rule Adaptations Achieved', this.margin + boxWidth + 15, this.currentY + 16);
      this.pdf.text('out of 5 possible', this.margin + boxWidth + 15, this.currentY + 21);
    }

    this.currentY += boxHeight + 10;

    // Additional metrics: adapt labels for flicker vs flex sort
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(75, 85, 99);
    if (isFlicker) {
  // Recompute right here so we can’t pick up a stale/wrong value from elsewhere.
  const trials = (data.assessmentData.trials ?? []) as Array<{ correct: boolean; change_occurred?: boolean }>;
  const totalTrials = trials.length;
  const changeTrials = trials.filter(t => t.change_occurred).length;
  const noChangeTrials = totalTrials - changeTrials;

  const hits = data.assessmentData.shifts_achieved ?? 0;
  const falseAlarms = data.assessmentData.perseverative_errors ?? 0;

  const flickerHitRate =
    changeTrials > 0 ? Math.round((hits / changeTrials) * 100) : 0;

  const falseAlarmPercent =
    noChangeTrials > 0 ? Math.round((falseAlarms / noChangeTrials) * 100) : 0;

  const flickerErrorControl = Math.max(0, 100 - falseAlarmPercent);

  this.pdf.text(`False Alarms: ${falseAlarms}`, this.margin, this.currentY);
  this.pdf.text(
    `Average Detection Time: ${data.assessmentData.avg_response_time.toFixed(1)}s`,
    this.margin,
    this.currentY + 6
  );
  this.pdf.text(`Hit Rate: ${flickerHitRate}%`, this.margin, this.currentY + 12);
  this.pdf.text(`Error Control: ${flickerErrorControl}%`, this.margin, this.currentY + 18);
  
    } else {
      this.pdf.text(`Perseverative Errors: ${data.assessmentData.perseverative_errors}`, this.margin, this.currentY);
      this.pdf.text(`Average Response Time: ${data.assessmentData.avg_response_time.toFixed(1)}s`, this.margin, this.currentY + 6);
      this.pdf.text(`Overall Accuracy: ${data.overallAccuracy}%`, this.margin, this.currentY + 12);
      this.pdf.text(`Total Trials: ${data.totalTrials}`, this.margin, this.currentY + 18);
    }

    this.currentY += isFlicker ? 32 : 30;
  }

  private addPerformanceMetrics(data: ReportData) {
    this.addNewPageIfNeeded(80);
    
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(31, 41, 55);
    this.pdf.text('PERFORMANCE METRICS', this.margin, this.currentY);
    this.currentY += 15;

    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    // Compute flicker metrics relative to total trials
    // Flicker-specific hit and error calculations (correct denominators)
const totalTrials = data.totalTrials;
const trials = (data.assessmentData.trials ?? []) as Array<{ correct: boolean; change_occurred?: boolean }>;
const changeTrials = isFlicker ? trials.filter(t => t.change_occurred).length : 0;
const noChangeTrials = isFlicker ? (totalTrials - changeTrials) : 0;

const flickerHitRate = isFlicker
  ? (changeTrials > 0 ? Math.round((data.assessmentData.shifts_achieved / changeTrials) * 100) : 0)
  : Math.round(((data.assessmentData.shifts_achieved ?? 0) / 5) * 100); // Flex Sort: % of 5

const flickerFalseAlarmRate = isFlicker
  ? (noChangeTrials > 0 ? Math.round((data.assessmentData.perseverative_errors / noChangeTrials) * 100) : 0)
  : 0; // not used for FS

const flickerErrorControl = isFlicker
  ? Math.max(0, 100 - flickerFalseAlarmRate)
  : Math.max(0, 100 - ((data.assessmentData.perseverative_errors ?? 0) * 15)); // FS convention

    const metrics = isFlicker
      ? [
          {
            label: 'Attention Score',
            value: ((data.assessmentData as any).attention_score ?? data.assessmentData.cognitive_flexibility_score),
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'Hit Rate',
            value: flickerHitRate,
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'False Alarm Control',
            value: flickerErrorControl,
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'Overall Accuracy',
            value: data.overallAccuracy,
            color: [20, 152, 84] as [number, number, number]
          }
        ]
      : [
          {
            label: 'Cognitive Flexibility',
            value: data.assessmentData.cognitive_flexibility_score,
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'Rule Adaptation',
            value: Math.round((data.assessmentData.shifts_achieved / 5) * 100),
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'Error Control',
            value: Math.max(0, 100 - (data.assessmentData.perseverative_errors * 15)),
            color: [20, 152, 84] as [number, number, number]
          },
          {
            label: 'Overall Accuracy',
            value: data.overallAccuracy,
            color: [20, 152, 84] as [number, number, number]
          }
        ];

    metrics.forEach((metric, index) => {
      const y = this.currentY + (index * 15);
      
      // Label
      this.pdf.setFontSize(11);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(75, 85, 99);
      this.pdf.text(metric.label, this.margin, y);
      
      // Progress bar background
      this.pdf.setFillColor(229, 231, 235); // Gray-200
      this.pdf.rect(this.margin + 60, y - 4, 100, 6, 'F');
      
      // Progress bar fill
      this.pdf.setFillColor(metric.color[0], metric.color[1], metric.color[2]);
      this.pdf.rect(this.margin + 60, y - 4, (metric.value / 100) * 100, 6, 'F');
      
      // Value text
      this.pdf.setTextColor(75, 85, 99);
      this.pdf.text(`${metric.value}%`, this.margin + 170, y);
    });

    this.currentY += (metrics.length * 15) + 20;
  }

  private addBlockPerformanceTable(data: ReportData) {
    this.addNewPageIfNeeded(100);
    
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(31, 41, 55);
    this.pdf.text('BLOCK PERFORMANCE ANALYSIS', this.margin, this.currentY);
    this.currentY += 15;

    // Table headers
    const colWidths = [20, 25, 25, 35, 35, 30];
    const headers = ['Block', 'Rule', 'Accuracy', 'Avg RT (s)', 'First Correct', 'Adaptation'];
    
    this.pdf.setFillColor(243, 244, 246); // Gray-100
    this.pdf.rect(this.margin, this.currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
    
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(55, 65, 81); // Gray-700
    
    let x = this.margin;
    headers.forEach((header, i) => {
      this.pdf.text(header, x + 2, this.currentY + 5);
      x += colWidths[i];
    });
    
    this.currentY += 8;

    // Table rows
    data.blockPerformance.forEach((block, index) => {
      this.pdf.setFillColor(index % 2 === 0 ? 255 : 249, index % 2 === 0 ? 255 : 250, index % 2 === 0 ? 255 : 251);
      this.pdf.rect(this.margin, this.currentY, colWidths.reduce((a, b) => a + b, 0), 8, 'F');
      
      this.pdf.setFontSize(9);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(75, 85, 99);
      
      const rowData = [
        block.block.toString(),
        block.rule.charAt(0).toUpperCase() + block.rule.slice(1),
        `${block.accuracy}%`,
        block.avgResponseTime.toFixed(1),
        block.firstCorrectTrial ? `Trial ${block.firstCorrectTrial}` : 'N/A',
        block.adaptationLatency !== null ? `${block.adaptationLatency} trials` : 'N/A'
      ];
      
      x = this.margin;
      rowData.forEach((data, i) => {
        this.pdf.text(data, x + 2, this.currentY + 5);
        x += colWidths[i];
      });
      
      this.currentY += 8;
    });

    this.currentY += 15;
  }

  private addNarrativeInterpretation(data: ReportData) {
    this.addNewPageIfNeeded(120);
    
    this.pdf.setFontSize(16);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(31, 41, 55);
    this.pdf.text('CLINICAL INTERPRETATION', this.margin, this.currentY);
    this.currentY += 15;

    // Executive Summary
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(75, 85, 99);
    this.pdf.text('Executive Summary:', this.margin, this.currentY);
    this.currentY += 8;

    const executiveSummary = this.generateExecutiveSummary(data);
    this.addWrappedText(executiveSummary, this.pageWidth - 2 * this.margin);
    this.currentY += 10;

    // Clinical Implications
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(75, 85, 99);
    this.pdf.text('Clinical Implications:', this.margin, this.currentY);
    this.currentY += 8;

    const clinicalImplications = this.generateClinicalImplications(data);
    this.addWrappedText(clinicalImplications, this.pageWidth - 2 * this.margin);
    this.currentY += 10;

    // Legal/Educational Summary
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(75, 85, 99);
    this.pdf.text('Legal/Educational Summary:', this.margin, this.currentY);
    this.currentY += 8;

    const legalSummary = this.generateLegalEducationalSummary(data);
    this.addWrappedText(legalSummary, this.pageWidth - 2 * this.margin);
  }

  private addWrappedText(text: string, maxWidth: number) {
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(75, 85, 99);

    const lines = this.pdf.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      this.addNewPageIfNeeded(6);
      this.pdf.text(line, this.margin, this.currentY);
      this.currentY += 5;
    });
  }

  private generateExecutiveSummary(data: ReportData): string {
    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    if (isFlicker) {
      // ---- Correct denominators & metrics for Focus Flicker ----
      const trials = ((data.assessmentData as any).trials ?? []) as Array<{ change_occurred?: boolean }>;
      const totalTrials =
        (Array.isArray(trials) ? trials.length : 0) ||
        Number(data.totalTrials ?? 0);

      const changeTrials = Array.isArray(trials)
        ? trials.filter(t => t.change_occurred).length
        : 0;
      const noChangeTrials = Math.max(0, totalTrials - changeTrials);

      const hits = Number(data.assessmentData.shifts_achieved ?? 0);
      const falseAlarms = Number(data.assessmentData.perseverative_errors ?? 0);

      // Correct rates
      const hitRatePct     = changeTrials    > 0 ? Math.round((hits / changeTrials) * 100) : 0;
      const falseAlarmPct  = noChangeTrials  > 0 ? Math.round((falseAlarms / noChangeTrials) * 100) : 0;
      const errorControlPct = Math.max(0, 100 - falseAlarmPct);

      // Other fields
      const thresholdScore = Number(
        (data.assessmentData as any).attention_score ??
        data.assessmentData.cognitive_flexibility_score ??
        0
      );
      const scoreLabel = this.getScoreLabel(thresholdScore);

      const meanRT = Number(data.assessmentData.avg_response_time ?? 0);
      const rtQual = meanRT <= 2.0
        ? 'rapid and confident detection'
        : meanRT <= 3.0
          ? 'typical detection speed with adequate deliberation'
          : 'careful, methodical detection that prioritizes accuracy';

      return `Your performance on the Focus Flicker assessment demonstrates ${scoreLabel.toLowerCase()} change detection ability. ` +
             `You detected ${hits} changes with ${falseAlarms} false alarms across ${totalTrials} trials ` +
             `(hit rate ${hitRatePct}%, error control ${errorControlPct}%). ` +
             `Your attention score of ${thresholdScore} on a 0–100 scale indicates ${scoreLabel.toLowerCase()} sensitivity to rapid changes. ` +
             `Your average detection time of ${meanRT.toFixed(1)}s reflects ${rtQual}.`;
    }

    // Default to Flex Sort narrative (unchanged)
    const scoreLabel = this.getScoreLabel(data.assessmentData.cognitive_flexibility_score);
    const adaptationQuality = data.assessmentData.shifts_achieved >= 4 ? 'excellent' :
                             data.assessmentData.shifts_achieved >= 3 ? 'good' : 'developing';
    return `Your performance on the Flex Sort assessment demonstrates ${scoreLabel.toLowerCase()} cognitive flexibility. You successfully achieved ${data.assessmentData.shifts_achieved} out of 5 possible rule adaptations, indicating ${adaptationQuality} ability to adapt to changing task demands. With ${data.assessmentData.perseverative_errors} perseverative errors, your performance suggests ${data.assessmentData.perseverative_errors <= 2 ? 'strong inhibitory control and flexible thinking' : data.assessmentData.perseverative_errors <= 5 ? 'moderate difficulty with rule switching but overall adequate flexibility' : 'significant challenges in cognitive flexibility requiring attention'}. Your average response time of ${data.assessmentData.avg_response_time.toFixed(1)}s indicates ${data.assessmentData.avg_response_time <= 2.0 ? 'efficient and confident decision-making' : data.assessmentData.avg_response_time <= 3.0 ? 'typical processing speed with adequate deliberation' : 'careful, methodical responding that prioritizes accuracy'}.`;
  }


  private generateClinicalImplications(data: ReportData): string {
    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    if (isFlicker) {
      const threshold = ((data.assessmentData as any).attention_score ?? data.assessmentData.cognitive_flexibility_score);
      const falseAlarms = data.assessmentData.perseverative_errors;
      const meanRT = data.assessmentData.avg_response_time;
      const implications: string[] = [];
      // Threshold interpretations
      if (threshold >= 80) {
        implications.push('Strong attentional vigilance with minimal intervention needs');
      } else if (threshold >= 60) {
        implications.push('Good change detection that may benefit from targeted strategies');
      } else {
        implications.push('Difficulty detecting subtle changes; supportive strategies may be warranted');
      }
      // False alarm interpretations
      if (falseAlarms <= 2) {
        implications.push('Excellent inhibitory control and selective attention');
      } else {
        implications.push('Consider interventions to reduce impulsive responding and improve inhibitory control');
      }
      // Processing speed
      implications.push(`Detection speed appears ${meanRT <= 2.5 ? 'optimal' : 'deliberate'}, with no significant concerns`);
      // Guided mode
      if (data.assessmentData.guided_mode_triggered) {
        implications.push('Adaptive support was activated, suggesting benefit from guided instruction in visual change detection tasks');
      }
      return `These results may inform clinical decision-making regarding attentional vigilance, inhibitory control, and adaptive reasoning abilities in change detection tasks. Performance patterns suggest: ${implications.join('; ')}.`;
    }
    // Default to Flex Sort narrative
    const implications = [];
    
    if (data.assessmentData.cognitive_flexibility_score >= 80) {
      implications.push('Strong executive functioning with minimal intervention needs');
    } else if (data.assessmentData.cognitive_flexibility_score >= 60) {
      implications.push('Moderate executive functioning that may benefit from targeted strategies');
    } else {
      implications.push('Executive functioning challenges that may require comprehensive intervention');
    }

    if (data.assessmentData.perseverative_errors <= 2) {
      implications.push('Excellent inhibitory control and cognitive flexibility');
    } else {
      implications.push('Consider strategies to improve cognitive flexibility and reduce perseverative responding');
    }

    implications.push(`Processing speed appears ${data.assessmentData.avg_response_time <= 2.5 ? 'optimal' : 'deliberate'} with no significant concerns`);

    if (data.assessmentData.guided_mode_triggered) {
      implications.push('Adaptive support was activated, suggesting benefit from guided instruction in complex cognitive tasks');
    }

    return `These results may inform clinical decision-making regarding executive function, cognitive flexibility, and adaptive reasoning abilities. Performance patterns suggest: ${implications.join('; ')}.`;
  }

  private generateLegalEducationalSummary(data: ReportData): string {
    const isFlicker = (data.assessmentData as any).task === 'focusFlicker';
    if (isFlicker) {
      const threshold = data.assessmentData.cognitive_flexibility_score;
      const accommodationNeeded = threshold < 70;
      return `For Educational/Legal Purposes: This assessment provides objective measures of visual change detection ability that may be relevant for educational accommodations, workplace adaptations, or legal considerations. The ${this.getScoreLabel(threshold).toLowerCase()} performance suggests ${accommodationNeeded ? 'potential need for accommodations or modifications to support effective monitoring and vigilance in tasks requiring rapid change detection' : 'typical change detection abilities with standard expectations appropriate'}. Results should be interpreted by qualified professionals in conjunction with other assessment data and clinical observations.`;
    }
    const accommodationNeeded = data.assessmentData.cognitive_flexibility_score < 70;
    
    return `For Educational/Legal Purposes: This assessment provides objective measures of cognitive flexibility that may be relevant for educational accommodations, workplace adaptations, or legal considerations. The ${this.getScoreLabel(data.assessmentData.cognitive_flexibility_score).toLowerCase()} performance suggests ${accommodationNeeded ? 'potential need for accommodations or modifications to support optimal performance in demanding cognitive tasks' : 'typical cognitive flexibility abilities with standard expectations appropriate'}. Results should be interpreted by qualified professionals in conjunction with other assessment data and clinical observations. This report meets professional standards for cognitive assessment documentation and may be used to support recommendations for academic, workplace, or legal accommodations as deemed appropriate by qualified professionals.`;
  }

  private getScoreLabel(score: number): string {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Average';
    if (score >= 40) return 'Below Average';
    return 'Needs Improvement';
  }

  private prepareReportData(assessmentData: AssessmentData): ReportData {
    // Calculate block performance
    const blockPerformance: BlockPerformance[] = [];
    const rules = ['color', 'shape', 'number', 'color', 'shape', 'number'];
    
    for (let i = 0; i < 6; i++) {
      const blockTrials = assessmentData.trials.filter(t => t.rule_block_number === i + 1);
      const correctTrials = blockTrials.filter(t => t.correct).length;
      const avgResponseTime = blockTrials.reduce((sum, t) => sum + t.response_time, 0) / blockTrials.length;
      
      // Find first correct trial in block
      const firstCorrect = blockTrials.find(t => t.correct);
      const firstCorrectTrial = firstCorrect ? firstCorrect.trial_in_block : null;
      
      // Calculate adaptation latency for blocks 2-6
      let adaptationLatency = null;
      if (i > 0) {
        const errorsBeforeFirst = blockTrials.findIndex(t => t.correct);
        adaptationLatency = errorsBeforeFirst >= 0 ? errorsBeforeFirst : blockTrials.length;
      }

      blockPerformance.push({
        block: i + 1,
        rule: rules[i],
        accuracy: Math.round((correctTrials / blockTrials.length) * 100),
        avgResponseTime,
        firstCorrectTrial,
        adaptationLatency,
        totalTrials: blockTrials.length,
        correctTrials
      });
    }

    const totalTrials = assessmentData.trials.length;
    const correctTrials = assessmentData.trials.filter(t => t.correct).length;
    const overallAccuracy = Math.round((correctTrials / totalTrials) * 100);

    // Calculate assessment duration
    const startTime = Math.min(...assessmentData.trials.map(t => t.timestamp));
    const endTime = Math.max(...assessmentData.trials.map(t => t.timestamp));
    const durationMinutes = Math.round((endTime - startTime) / (1000 * 60));

    return {
      assessmentData,
      participantId: `FLEX-${new Date(assessmentData.completed_at).getTime().toString().slice(-6)}`,
      duration: `${durationMinutes} minutes`,
      blockPerformance,
      overallAccuracy,
      totalTrials
    };
  }

  public async generateReport(assessmentData: AssessmentData): Promise<void> {
    const reportData = this.prepareReportData(assessmentData);

    // Generate all sections
    this.addHeader(reportData);
    this.addSummaryOverview(reportData);
    this.addPerformanceMetrics(reportData);
    this.addBlockPerformanceTable(reportData);
    this.addNarrativeInterpretation(reportData);

    // Determine report name based on task for footer and file naming
    const isFlickerReport = (assessmentData as any).task === 'focusFlicker';
    const reportName = isFlickerReport 
      ? 'Focus Flicker Cognitive Assessment Report'
      : 'Flex Sort Cognitive Assessment Report';
    // Add footer
    const pageCount = this.pdf.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(156, 163, 175); // Gray-400
      this.pdf.text(
        `${reportName} - Page ${i} of ${pageCount}`,
        this.margin,
        this.pageHeight - 10
      );
      this.pdf.text(
        'Generated by Cogello Assessment Platform',
        this.pageWidth - this.margin - 50,
        this.pageHeight - 10
      );
    }

    // Generate filename and save
    const date = new Date().toISOString().split('T')[0];
    const filename = `${isFlickerReport ? 'FocusFlicker' : 'FlexSort'}_Report_${date}.pdf`;
    
    this.pdf.save(filename);
  }
}
